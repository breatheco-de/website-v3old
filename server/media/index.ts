import type { StorageProvider, MediaConfig, ProviderName } from "./types";
import { LocalProvider } from "./local-provider";
import { GCSProvider } from "./gcs-provider";

export type { StorageProvider, MediaConfig, ProviderName };
export { LocalProvider } from "./local-provider";
export { GCSProvider } from "./gcs-provider";

class Media {
  private providers: Map<string, StorageProvider> = new Map();
  private defaultProviderName: ProviderName = "local";
  private initialized = false;

  init(config?: Partial<MediaConfig>): void {
    this.providers.clear();

    const local = new LocalProvider();
    this.providers.set("local", local);

    if (config?.gcs?.bucketName) {
      const gcs = new GCSProvider(config.gcs);
      this.providers.set("gcs", gcs);
      console.log(`[Media] GCS provider configured for bucket: ${config.gcs.bucketName}`);
    }

    this.defaultProviderName = config?.defaultProvider || "local";
    this.initialized = true;
    console.log(`[Media] Initialized with default provider: ${this.defaultProviderName}, ${this.providers.size} provider(s) active`);
  }

  initFromEnv(): void {
    const config: Partial<MediaConfig> = {
      defaultProvider: (process.env.MEDIA_DEFAULT_PROVIDER as ProviderName) || "local",
    };

    const gcsBucket = process.env.GCS_BUCKET_NAME;
    if (gcsBucket) {
      config.gcs = {
        bucketName: gcsBucket,
        projectId: process.env.GCS_PROJECT_ID,
        keyFilename: process.env.GCS_KEY_FILENAME,
        credentialsJson: process.env.GCS_CREDENTIALS_JSON,
        basePath: process.env.GCS_BASE_PATH || "media",
      };
    }

    this.init(config);
  }

  private ensureInit(): void {
    if (!this.initialized) {
      this.initFromEnv();
    }
  }

  getProvider(name: ProviderName): StorageProvider | undefined {
    this.ensureInit();
    return this.providers.get(name);
  }

  getDefaultProvider(): StorageProvider {
    this.ensureInit();
    const provider = this.providers.get(this.defaultProviderName);
    if (!provider) {
      return this.providers.get("local")!;
    }
    return provider;
  }

  resolveProvider(src: string): StorageProvider {
    this.ensureInit();
    for (const provider of this.providers.values()) {
      if (provider.owns(src)) {
        return provider;
      }
    }
    return this.providers.get("local")!;
  }

  async exists(src: string): Promise<boolean> {
    const provider = this.resolveProvider(src);
    const key = provider.extractKey(src);
    if (key === null) return false;
    return provider.exists(key);
  }

  async upload(data: Buffer, key: string, contentType?: string, providerName?: ProviderName): Promise<string> {
    this.ensureInit();
    const provider = providerName
      ? this.providers.get(providerName) || this.getDefaultProvider()
      : this.getDefaultProvider();
    return provider.upload(key, data, contentType);
  }

  async delete(src: string): Promise<void> {
    const provider = this.resolveProvider(src);
    const key = provider.extractKey(src);
    if (key === null) return;
    return provider.delete(key);
  }

  getProviderName(src: string): string {
    return this.resolveProvider(src).name;
  }

  getAllProviderNames(): string[] {
    this.ensureInit();
    return Array.from(this.providers.keys());
  }

  getStatus(): {
    defaultProvider: string;
    providers: string[];
    gcs?: { bucket: string; basePath: string; projectId?: string };
  } {
    this.ensureInit();
    const status: ReturnType<Media["getStatus"]> = {
      defaultProvider: this.defaultProviderName,
      providers: this.getAllProviderNames(),
    };
    if (this.providers.has("gcs")) {
      status.gcs = {
        bucket: process.env.GCS_BUCKET_NAME || "",
        basePath: process.env.GCS_BASE_PATH || "media",
        projectId: process.env.GCS_PROJECT_ID,
      };
    }
    return status;
  }
}

export const media = new Media();
