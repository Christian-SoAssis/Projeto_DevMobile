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

export interface FileSystemLike {
  documentDirectory: string | null;
  getInfoAsync(uri: string): Promise<{ exists: boolean }>;
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
}

export class PhotoCopyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PhotoCopyError';
  }
}

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
      if (photo.remoteUrl) return photo;
      throw new Error('A foto precisa de um caminho local para ser persistida.');
    }

    await this.db.runAsync(
      `INSERT OR REPLACE INTO local_images (
        id, animal_local_or_remote_id, local_path, remote_url, upload_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        photo.id,
        photo.animalId,
        persistedPath,
        photo.remoteUrl ?? null,
        photo.syncState.value,
        photo.createdAt,
      ]
    );

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
    const rows = await this.db.getAllAsync<LocalImageRow>('SELECT * FROM local_images');
    return rows
      .filter((r) => r.upload_status === 'PENDING' || r.upload_status === 'FAILED')
      .map(
        (r) =>
          new AnimalPhoto({
            id: r.id,
            animalId: r.animal_local_or_remote_id,
            localPath: r.local_path ?? undefined,
            remoteUrl: r.remote_url ?? undefined,
            syncState: new SyncState((r.upload_status as SyncStateType) || 'PENDING'),
            createdAt: r.created_at,
          })
      );
  }

  async uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    const remoteUrl = photo.remoteUrl || `https://storage.local/${photo.animalId}/${photo.id}.webp`;
    photo.markUploaded(remoteUrl);

    await this.db.runAsync(
      'UPDATE local_images SET remote_url = ?, upload_status = ? WHERE id = ?',
      [remoteUrl, photo.syncState.value, photo.id]
    );
    await this.db.runAsync(
      'UPDATE animal_photos SET remote_url = ?, upload_status = ? WHERE id = ?',
      [remoteUrl, photo.syncState.value, photo.id]
    );

    return photo;
  }

  async remove(photoId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM local_images WHERE id = ?', [photoId]);
  }

  /**
   * Remove registros de fotos locais cujo arquivo físico não existe mais
   * (órfãos por limpeza de cache do SO ou falha de cópia anterior).
   * Só remove quando o registro não tem remote_url (não foi enviado ao servidor).
   * MID-09, DAT-12.
   */
  async cleanupOrphanedFiles(): Promise<{ removed: number; errors: string[] }> {
    const errors: string[] = [];
    let removed = 0;

    const fs = this.fileSystem ?? this.loadFileSystem();
    if (!fs?.documentDirectory) {
      return { removed: 0, errors: ['Filesystem não disponível para limpeza.'] };
    }

    const rows = await this.db.getAllAsync<{
      id: string;
      local_path: string | null;
      remote_url: string | null;
      upload_status: string;
    }>('SELECT id, local_path, remote_url, upload_status FROM local_images');

    for (const row of rows) {
      // Se já foi enviado ao servidor, não remove (a referência remota mantém a foto).
      if (row.remote_url) continue;

      const localPath = row.local_path;
      if (!localPath) {
        // Sem caminho local e sem URL remota: registro órfão, pode remover.
        await this.db.runAsync('DELETE FROM local_images WHERE id = ?', [row.id]);
        removed += 1;
        continue;
      }

      try {
        const info = await fs.getInfoAsync(localPath);
        if (!info.exists) {
          await this.db.runAsync('DELETE FROM local_images WHERE id = ?', [row.id]);
          removed += 1;
        }
      } catch (err) {
        errors.push(`Falha ao verificar ${localPath}: ${err}`);
      }
    }

    return { removed, errors };
  }

  private async copyToAppStorage(photo: AnimalPhoto): Promise<string> {
    const source = photo.localPath || '';
    if (!source) return source;

    const fs = this.fileSystem ?? this.loadFileSystem();
    if (!fs?.documentDirectory) {
      return source;
    }

    try {
      const directory = `${fs.documentDirectory}animal_photos/`;
      const extension = /\.([a-z0-9]{2,5})(?:\?.*)?$/i.exec(source)?.[1]?.toLowerCase() ?? 'webp';
      const target = `${directory}${photo.id}.${extension}`;

      if (source === target) return target;

      const dirInfo = await fs.getInfoAsync(directory);
      if (!dirInfo.exists) {
        await fs.makeDirectoryAsync(directory, { intermediates: true });
      }
      await fs.copyAsync({ from: source, to: target });
      return target;
    } catch (err) {
      throw new PhotoCopyError(
        `Falha ao persistir a foto ${photo.id} no armazenamento do app (RNF01/RNF02).`,
        err
      );
    }
  }

  private loadFileSystem(): FileSystemLike | null {
    try {
      const FileSystem = require('expo-file-system/legacy');
      if (!FileSystem?.documentDirectory) return null;
      return FileSystem as FileSystemLike;
    } catch {
      return null;
    }
  }
}
