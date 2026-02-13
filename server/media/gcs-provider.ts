import { Storage } from "@google-cloud/storage";
import type { StorageProvider } from "./types";

export class GCSProvider implements StorageProvider {
  readonly name = "gcs";
  private storage: Storage;
  private bucketName: string;
  private urlPrefix: string;

  constructor(config: { bucketName: string; projectId?: string; keyFilename?: string; credentialsJson?: string }) {
    this.bucketName = config.bucketName;
    this.urlPrefix = `https://storage.googleapis.com/${config.bucketName}/`;

    const storageOpts: Record<string, any> = {};
    if (config.projectId) storageOpts.projectId = config.projectId;

    if (config.credentialsJson) {
      try {
        storageOpts.credentials = JSON.parse(config.credentialsJson);
      } catch {
        console.error("[GCSProvider] Failed to parse GCS_CREDENTIALS_JSON, falling back to default auth");
      }
    } else if (config.keyFilename) {
      storageOpts.keyFilename = config.keyFilename;
    }

    this.storage = new Storage(storageOpts);
  }

  owns(src: string): boolean {
    return src.startsWith(this.urlPrefix) || src.startsWith(`gs://${this.bucketName}/`);
  }

  extractKey(src: string): string | null {
    if (src.startsWith(this.urlPrefix)) {
      return src.slice(this.urlPrefix.length);
    }
    const gsPrefix = `gs://${this.bucketName}/`;
    if (src.startsWith(gsPrefix)) {
      return src.slice(gsPrefix.length);
    }
    return null;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const [exists] = await this.storage.bucket(this.bucketName).file(key).exists();
      return exists;
    } catch {
      return false;
    }
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(key);
    await file.save(data, {
      contentType: contentType || "application/octet-stream",
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });
    return this.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.storage.bucket(this.bucketName).file(key).delete();
    } catch (err: any) {
      if (err?.code !== 404) throw err;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.urlPrefix}${key}`;
  }
}
