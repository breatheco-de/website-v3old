/**
 * Shared GCS (Google Cloud Storage) bucket client.
 *
 * Provides a single Storage instance initialized from environment variables.
 * Any module that needs bucket access imports from here — no basePath is
 * baked in, so each consumer supplies its own key prefix.
 *
 * Environment variables:
 *   GCS_BUCKET_NAME        – required for GCS to be available
 *   GCS_PROJECT_ID         – optional
 *   GCS_KEY_FILENAME       – optional (path to service-account JSON)
 *   GCS_CREDENTIALS_JSON   – optional (inline service-account JSON)
 */

import { Storage } from "@google-cloud/storage";

export interface GCSConfig {
  bucketName: string;
  projectId?: string;
  keyFilename?: string;
  credentialsJson?: string;
}

interface PendingUpload {
  timer: ReturnType<typeof setTimeout>;
  data: Buffer;
  contentType: string;
  options?: { cacheControl?: string };
}

const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_RETRY_BASE_MS = 2_000;
const DEBOUNCE_DEFAULT_MS = 4_000;

class GCSClient {
  private storage: Storage | null = null;
  private bucketName: string = "";
  private _available = false;
  private _pendingUploads = new Map<string, PendingUpload>();

  init(config: GCSConfig): void {
    this.bucketName = config.bucketName;

    const opts: Record<string, any> = {};
    if (config.projectId) opts.projectId = config.projectId;

    if (config.credentialsJson) {
      try {
        opts.credentials = JSON.parse(config.credentialsJson);
      } catch {
        console.error("[GCS] Failed to parse GCS_CREDENTIALS_JSON, falling back to default auth");
      }
    } else if (config.keyFilename) {
      opts.keyFilename = config.keyFilename;
    }

    this.storage = new Storage(opts);
    this._available = true;
    console.log(`[GCS] Initialized for bucket: ${this.bucketName}`);
  }

  initFromEnv(): void {
    const bucket = process.env.GCS_BUCKET_NAME;
    if (!bucket) {
      console.log("[GCS] GCS_BUCKET_NAME not set — GCS unavailable");
      return;
    }

    this.init({
      bucketName: bucket,
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILENAME,
      credentialsJson: process.env.GCS_CREDENTIALS_JSON,
    });
  }

  get available(): boolean {
    return this._available;
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getStorage(): Storage | null {
    return this.storage;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.storage) return false;
    try {
      const [exists] = await this.storage.bucket(this.bucketName).file(key).exists();
      return exists;
    } catch {
      return false;
    }
  }

  async upload(
    key: string,
    data: Buffer,
    contentType?: string,
    options?: { cacheControl?: string }
  ): Promise<string> {
    if (!this.storage) throw new Error("[GCS] Not initialized");
    const file = this.storage.bucket(this.bucketName).file(key);
    const saveOpts = {
      contentType: contentType || "application/octet-stream",
      resumable: false,
      metadata: {
        cacheControl: options?.cacheControl ?? "public, max-age=31536000",
      },
    };

    let attempt = 0;
    while (true) {
      try {
        await file.save(data, saveOpts);
        return this.getPublicUrl(key);
      } catch (err: any) {
        const is429 = err?.code === 429 || err?.response?.statusCode === 429;
        attempt++;
        if (!is429 || attempt >= UPLOAD_MAX_RETRIES) throw err;
        const delayMs = UPLOAD_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(`[GCS] 429 on upload "${key}", retry ${attempt}/${UPLOAD_MAX_RETRIES - 1} in ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  debouncedUpload(
    key: string,
    data: Buffer,
    contentType?: string,
    delayMs: number = DEBOUNCE_DEFAULT_MS,
    options?: { cacheControl?: string }
  ): void {
    const existing = this._pendingUploads.get(key);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(async () => {
      this._pendingUploads.delete(key);
      try {
        await this.upload(key, data, contentType, options);
      } catch (err) {
        console.error(`[GCS] debouncedUpload failed for "${key}":`, err);
      }
    }, delayMs);

    this._pendingUploads.set(key, { timer, data, contentType: contentType || "application/octet-stream", options });
  }

  async flushPending(): Promise<void> {
    if (this._pendingUploads.size === 0) return;

    console.log(`[GCS] Flushing ${this._pendingUploads.size} pending upload(s) before shutdown…`);
    const entries = Array.from(this._pendingUploads.entries());
    this._pendingUploads.clear();

    await Promise.allSettled(
      entries.map(async ([key, pending]) => {
        clearTimeout(pending.timer);
        try {
          await this.upload(key, pending.data, pending.contentType, pending.options);
          console.log(`[GCS] Flushed pending upload: "${key}"`);
        } catch (err) {
          console.error(`[GCS] Failed to flush pending upload for "${key}":`, err);
        }
      })
    );
  }

  async list(prefix: string): Promise<string[]> {
    if (!this.storage) return [];
    try {
      const [files] = await this.storage
        .bucket(this.bucketName)
        .getFiles({ prefix, versions: false });
      return files.map((f) => f.name);
    } catch {
      return [];
    }
  }

  async download(key: string): Promise<Buffer | null> {
    if (!this.storage) return null;
    try {
      const [data] = await this.storage.bucket(this.bucketName).file(key).download();
      return data;
    } catch (err: any) {
      if (err?.code === 404) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.bucket(this.bucketName).file(key).delete();
    } catch (err: any) {
      if (err?.code !== 404) throw err;
    }
  }

  getPublicUrl(key: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }
}

export const gcs = new GCSClient();
