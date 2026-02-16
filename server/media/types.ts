export interface StorageProvider {
  readonly name: string;
  exists(key: string): Promise<boolean>;
  upload(key: string, data: Buffer, contentType?: string): Promise<string>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  extractKey(src: string): string | null;
  owns(src: string): boolean;
}

export type ProviderName = "local" | "gcs";

export interface MediaConfig {
  defaultProvider: ProviderName;
  gcs?: {
    bucketName: string;
    projectId?: string;
    keyFilename?: string;
    credentialsJson?: string;
    basePath?: string;
  };
}
