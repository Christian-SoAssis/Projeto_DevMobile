export interface SyncMetadataProps {
  key: string;
  lastSyncAt: string;
  cursorId?: string;
  version?: number;
}

export class SyncMetadata {
  public readonly key: string;
  public readonly lastSyncAt: string;
  public readonly cursorId?: string;
  public readonly version: number;

  constructor(props: SyncMetadataProps) {
    this.key = props.key;
    this.lastSyncAt = props.lastSyncAt;
    this.cursorId = props.cursorId;
    this.version = props.version ?? 1;
  }
}
