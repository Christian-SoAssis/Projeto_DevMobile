import { AnimalPhoto } from '../../../../domain/entities/AnimalPhoto';
import { SyncState, SyncStateType } from '../../../../domain/value-objects/SyncState';
import { PhotoStorage } from '../../../../domain/ports/PhotoStorage';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface LocalImageRow {
  id: string;
  animal_local_or_remote_id: string;
  local_path: string | null;
  remote_url: string | null;
  upload_status: string;
  created_at: string;
}

/**
 * Recorte do `expo-file-system/legacy` usado na cópia (testes injetam um
 * dublê e o device usa o pacote real via `loadFileSystem`).
 */
export interface FileSystemLike {
  documentDirectory: string | null;
  getInfoAsync(uri: string): Promise<{ exists: boolean }>;
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
}

/**
 * MID-02 (ordem 5): falha de cópia no device é erro EXPLÍCITO. O arquivo de
 * câmera/galeria deixa de existir quando o app é encerrado; registrar essa
 * URI em `local_images` construiria um cache offline apontando para um
 * arquivo condenado — perda silenciosa da imagem no próximo reinício
 * (violaria RNF01/RNF02). O aviso permite o usuário reescolher a foto.
 */
export class PhotoCopyError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PhotoCopyError';
    this.cause = cause;
  }
}

/**
 * Implementação SQLite do port `PhotoStorage` (Fase 2, doc §13 e §5.1).
 *
 * Critério "Acessando imagens locais e registrando o endereço no SQLite":
 * toda foto capturada/selecionada no app tem seu endereço local registrado
 * na tabela `local_images`, com estado de upload para a fila de
 * reconciliação (doc §14.1 passos 5–6: upload da imagem antes do reconcile).
 *
 * A cópia física do arquivo para o diretório do app usa `expo-file-system`
 * quando o pacote está disponível (device real — Fase 4). Sem cópia
 * operante (unit tests/demo), o endereço originado da câmera/galeria é
 * registrado como está — o vínculo foto ↔ anúncio nunca é perdido
 * (RNF02/RNF03). Em DEVICE, a falha de cópia é erro explícito
 * (`PhotoCopyError`), nunca registro silencioso da URI temporária (MID-02).
 */
export class SqlitePhotoStorage implements PhotoStorage {
  constructor(
    private db: SqliteDatabaseDriver,
    private enableFileCopy: boolean = true,
    private fileSystem?: FileSystemLike
  ) {}

  async persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto> {
    const persistedPath = this.enableFileCopy
      ? await this.copyToAppStorage(photo)
      : photo.localPath;
    if (!persistedPath) {
      // Foto já remota não tem o que registrar em `local_images`; a foto
      // puramente local continua obrigatória para o cache offline.
      if (photo.remoteUrl) return photo;
      throw new Error('A foto precisa de um caminho local para ser persistida.');
    }
    const existing = await this.findRow(photo.id);

    if (existing) {
      // Copiar a mesma foto de novo atualiza o endereço, não duplica registro.
      await this.db.runAsync(
        'UPDATE local_images SET local_path = ?, remote_url = ?, upload_status = ? WHERE id = ?',
        [persistedPath, photo.remoteUrl || null, photo.syncState.value, photo.id]
      );
      return this.withPersistedPath(photo, persistedPath);
    }

    await this.db.runAsync(
      `INSERT INTO local_images (
        id, animal_local_or_remote_id, local_path, remote_url, upload_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        photo.id,
        photo.animalId,
        persistedPath,
        photo.remoteUrl || null,
        photo.syncState.value,
        photo.createdAt,
      ]
    );
    return this.withPersistedPath(photo, persistedPath);
  }

  /**
   * Devolve a foto com o **destino definitivo** do arquivo (copiado para a
   * área segura do app). O chamador anexa essa entidade ao anúncio — nunca
   * a foto com a URI temporária da câmera/galeria (RNF01/RNF02).
   */
  private withPersistedPath(photo: AnimalPhoto, persistedPath: string): AnimalPhoto {
    if (persistedPath === photo.localPath) return photo;
    return new AnimalPhoto({
      id: photo.id,
      animalId: photo.animalId,
      localPath: persistedPath,
      remoteUrl: photo.remoteUrl,
      syncState: photo.syncState,
      createdAt: photo.createdAt,
    });
  }

  async listPendingUpload(): Promise<AnimalPhoto[]> {
    // Filtro em memória (e não no SQL) para comportar os dois drivers do
    // projeto: SQLite real e o InMemorySqliteDriver de testes.
    const rows = await this.db.getAllAsync<LocalImageRow>('SELECT * FROM local_images');
    return rows
      .filter((r) => r.upload_status === 'PENDING' || r.upload_status === 'FAILED')
      .map((r) => this.mapToEntity(r));
  }

  async uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    // Até a Fase 3 (Supabase Storage), o "upload" marca a foto com uma URL
    // de destino pendente de reconciliação remota, mantendo o mesmo
    // contrato do PhotoStorageFake.
    const remoteUrl = photo.remoteUrl || `https://storage.local/${photo.animalId}/${photo.id}.jpg`;
    photo.markUploaded(remoteUrl);

    await this.db.runAsync(
      'UPDATE local_images SET remote_url = ?, upload_status = ? WHERE id = ?',
      [remoteUrl, photo.syncState.value, photo.id]
    );
    // Mantém a foto do anúncio em `animal_photos` coerente com o registro.
    await this.db.runAsync(
      'UPDATE animal_photos SET remote_url = ?, upload_status = ? WHERE id = ?',
      [remoteUrl, photo.syncState.value, photo.id]
    );

    return photo;
  }

  async remove(photoId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM local_images WHERE id = ?', [photoId]);
  }

  private async findRow(photoId: string): Promise<LocalImageRow | null> {
    return this.db.getFirstAsync<LocalImageRow>(
      'SELECT * FROM local_images WHERE id = ?',
      [photoId]
    );
  }

  /**
   * Copia o arquivo para o armazenamento interno do app e devolve o novo
   * endereço. Arquivos de câmera/galeria morrem quando o app é encerrado;
   * copiar garante que o cache offline continue com a imagem após o
   * reinício (RNF01/RNF02).
   */
  private async copyToAppStorage(photo: AnimalPhoto): Promise<string> {
    const source = photo.localPath || '';
    if (!source) return source;

    const FileSystem = this.fileSystem ?? this.loadFileSystem();
    if (!FileSystem?.documentDirectory) {
      // Ambiente sem armazenamento operante (unit tests/demo, headless):
      // registra o endereço original — o vínculo foto ↔ anúncio não se perde
      // e não há arquivo real para copiar.
      return source;
    }

    try {
      // SDK 57 mantém a API antiga em `expo-file-system/legacy`. A API nova
      // (File/Directory/Paths) não expõe `documentDirectory`/`copyAsync`.
      const directory = `${FileSystem.documentDirectory}animal_photos/`;
      // Mantém a extensão de origem (o pipeline de fotos gera .webp).
      const extension = /\.([a-z0-9]{2,5})(?:\?.*)?$/i.exec(source)?.[1]?.toLowerCase() ?? 'jpg';
      const target = `${directory}${photo.id}.${extension}`;

      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }
      await FileSystem.copyAsync({ from: source, to: target });
      return target;
    } catch (err) {
      // MID-02 (ordem 5): com FileSystem operante (device real), falha de
      // cópia é erro explícito — NÃO registrar a URI de origem, que é
      // temporária e morre ao encerrar o app; o registro condicional
      // produziria perda silenciosa no próximo reinício.
      throw new PhotoCopyError(
        `Falha ao persistir a foto ${photo.id} no armazenamento do app (RNF01/RNF02).`,
        err
      );
    }
  }

  /** Carrega o módulo legacy; ausente (unit/demo) → null, degradação segura. */
  private loadFileSystem(): FileSystemLike | null {
    try {
      const FileSystem = require('expo-file-system/legacy');
      // Headless (pacote instalado, mas sem armazenamento nativo): renova
      // documentDirectory — devolver dados reais só no device.
      if (!FileSystem?.documentDirectory) return null;
      return FileSystem as FileSystemLike;
    } catch {
      return null;
    }
  }

  private mapToEntity(row: LocalImageRow): AnimalPhoto {
    const syncState =
      row.upload_status === 'SYNCED'
        ? SyncState.completed()
        : new SyncState(row.upload_status as SyncStateType);

    return new AnimalPhoto({
      id: row.id,
      animalId: row.animal_local_or_remote_id,
      localPath: row.local_path || undefined,
      remoteUrl: row.remote_url || undefined,
      syncState,
      createdAt: row.created_at,
    });
  }
}
