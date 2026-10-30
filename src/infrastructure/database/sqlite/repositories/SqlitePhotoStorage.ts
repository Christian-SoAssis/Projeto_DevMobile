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
 * Implementação SQLite do port `PhotoStorage` (Fase 2, doc §13 e §5.1).
 *
 * Critério "Acessando imagens locais e registrando o endereço no SQLite":
 * toda foto capturada/selecionada no app tem seu endereço local registrado
 * na tabela `local_images`, com estado de upload para a fila de
 * reconciliação (doc §14.1 passos 5–6: upload da imagem antes do reconcile).
 *
 * A cópia física do arquivo para o diretório do app usa `expo-file-system`
 * quando o pacote está disponível (device real — Fase 4). Sem o pacote
 * (unit tests/demo), o endereço originado da câmera/galeria é registrado
 * como está — o vínculo foto ↔ anúncio nunca é perdido (RNF02/RNF03).
 */
export class SqlitePhotoStorage implements PhotoStorage {
  constructor(private db: SqliteDatabaseDriver, private enableFileCopy: boolean = true) {}

  async persistLocal(photo: AnimalPhoto): Promise<void> {
    const localPath = this.enableFileCopy
      ? await this.copyToAppStorage(photo)
      : photo.localPath;
    if (!localPath) {
      // Foto já remota não tem o que registrar em `local_images`; a foto
      // puramente local continua obrigatória para o cache offline.
      if (photo.remoteUrl) return;
      throw new Error('A foto precisa de um caminho local para ser persistida.');
    }
    const existing = await this.findRow(photo.id);

    if (existing) {
      // Copiar a mesma foto de novo atualiza o endereço, não duplica registro.
      await this.db.runAsync(
        'UPDATE local_images SET local_path = ?, remote_url = ?, upload_status = ? WHERE id = ?',
        [localPath, photo.remoteUrl || null, photo.syncState.value, photo.id]
      );
      return;
    }

    await this.db.runAsync(
      `INSERT INTO local_images (
        id, animal_local_or_remote_id, local_path, remote_url, upload_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        photo.id,
        photo.animalId,
        localPath,
        photo.remoteUrl || null,
        photo.syncState.value,
        photo.createdAt,
      ]
    );
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

    try {
      // SDK 57 mantém a API antiga em `expo-file-system/legacy`. A API nova
      // (File/Directory/Paths) não expõe `documentDirectory`/`copyAsync`.
      const FileSystem = require('expo-file-system/legacy');
      const directory = `${FileSystem.documentDirectory}animal_photos/`;
      const target = `${directory}${photo.id}.jpg`;

      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }
      await FileSystem.copyAsync({ from: source, to: target });
      return target;
    } catch {
      // Sem FileSystem (tests/demo) ou falha de cópia: registra o endereço
      // original, sem perda silenciosa do vínculo.
      return source;
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
