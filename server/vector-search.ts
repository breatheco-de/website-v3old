import { QdrantClient } from "@qdrant/js-client-rest";
import { setJobState } from "./db-job-state";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const VECTOR_SIZE = 384;
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 32;

const AVAILABILITY_TTL_MS = 30_000;

let qdrantClient: QdrantClient | null = null;
let _embedder: ((texts: string[]) => Promise<number[][]>) | null = null;
let _embedderLoading: Promise<void> | null = null;
let _available: boolean | null = null;
let _availabilityCheckedAt = 0;

function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
  }
  return qdrantClient;
}

async function getEmbedder(): Promise<(texts: string[]) => Promise<number[][]>> {
  if (_embedder) return _embedder;

  if (!_embedderLoading) {
    _embedderLoading = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      env.cacheDir = ".cache/xenova-models";
      const pipe = await pipeline("feature-extraction", EMBEDDING_MODEL);

      _embedder = async (texts: string[]): Promise<number[][]> => {
        const output = await pipe(texts, { pooling: "mean", normalize: true });
        const data: number[][] = [];
        const dims = output.dims;
        const batchSize = dims[0];
        const vecSize = dims[dims.length - 1];
        for (let i = 0; i < batchSize; i++) {
          data.push(Array.from(output.data.slice(i * vecSize, (i + 1) * vecSize) as Float32Array));
        }
        return data;
      };

      console.log(`[vector-search] Local embedding model "${EMBEDDING_MODEL}" loaded`);
    })();
  }

  await _embedderLoading;
  return _embedder!;
}

export async function isAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_available !== null && now - _availabilityCheckedAt < AVAILABILITY_TTL_MS) {
    return _available;
  }
  try {
    const client = getQdrantClient();
    await client.getCollections();
    _available = true;
  } catch {
    _available = false;
  }
  _availabilityCheckedAt = Date.now();
  return _available;
}

function resetAvailabilityCache(): void {
  _available = null;
  _availabilityCheckedAt = 0;
}

function collectionName(dbName: string): string {
  return dbName;
}

async function ensureCollection(dbName: string): Promise<void> {
  const client = getQdrantClient();
  const name = collectionName(dbName);
  try {
    const info = await client.getCollection(name);
    const existingSize = (info.config?.params?.vectors as { size?: number } | undefined)?.size;
    if (existingSize !== undefined && existingSize !== VECTOR_SIZE) {
      console.log(`[vector-search] Collection "${name}" has vector size ${existingSize}, expected ${VECTOR_SIZE} — recreating`);
      await client.deleteCollection(name);
      throw new Error("recreate");
    }
  } catch {
    await client.createCollection(name, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log(`[vector-search] Created collection "${name}" (size=${VECTOR_SIZE})`);
  }
}

function buildText(item: Record<string, unknown>, fields: string[]): string {
  return fields
    .map((f) => {
      const val = item[f];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    })
    .filter(Boolean)
    .join(" ");
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embed = await getEmbedder();
  return embed(texts);
}

function itemId(item: Record<string, unknown>, index: number): string {
  const slug = item.slug ?? item.id;
  return slug !== undefined && slug !== null ? String(slug) : String(index);
}

export async function indexItems(
  dbName: string,
  items: Record<string, unknown>[],
  fields: string[]
): Promise<void> {
  if (!(await isAvailable())) {
    console.log(`[vector-search] Qdrant not available — skipping index for "${dbName}"`);
    return;
  }

  setJobState(dbName, "index", {
    status: "running",
    fetched: 0,
    total: items.length,
    startedAt: new Date().toISOString(),
  });

  try {
    await ensureCollection(dbName);
    const client = getQdrantClient();
    const name = collectionName(dbName);
    let indexed = 0;

    for (let start = 0; start < items.length; start += BATCH_SIZE) {
      const batch = items.slice(start, start + BATCH_SIZE);
      const texts = batch.map((item) => buildText(item, fields));
      const embeddings = await generateEmbeddings(texts);

      const points = batch.map((item, i) => ({
        id: itemId(item, start + i),
        vector: embeddings[i],
        payload: {
          slug: String(item.slug ?? item.id ?? start + i),
          locale: typeof item.locale === "string" ? item.locale
            : typeof item.language === "string" ? item.language
            : typeof item.lang === "string" ? item.lang
            : null,
        },
      }));

      await client.upsert(name, { points });
      indexed += batch.length;
      setJobState(dbName, "index", {
        status: "running",
        fetched: indexed,
        total: items.length,
      });
      console.log(
        `[vector-search] Indexed batch ${Math.floor(start / BATCH_SIZE) + 1} (${batch.length} items) for "${dbName}"`
      );
    }

    setJobState(dbName, "index", {
      status: "done",
      fetched: items.length,
      total: items.length,
      finishedAt: new Date().toISOString(),
    });
    console.log(`[vector-search] Indexed ${items.length} items for "${dbName}"`);
  } catch (err) {
    setJobState(dbName, "index", {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      finishedAt: new Date().toISOString(),
    });
    console.error(`[vector-search] Failed to index "${dbName}":`, err);
    resetAvailabilityCache();
  }
}

export interface SearchResult {
  slug: string;
  score: number;
}

export async function search(
  dbName: string,
  query: string,
  limit = 20,
  localeFilter?: string
): Promise<SearchResult[]> {
  if (!(await isAvailable())) {
    return [];
  }

  try {
    const client = getQdrantClient();
    const name = collectionName(dbName);

    const [queryEmbedding] = await generateEmbeddings([query]);

    const filter =
      localeFilter
        ? {
            must: [
              {
                key: "locale",
                match: { value: localeFilter },
              },
            ],
          }
        : undefined;

    const results = await client.search(name, {
      vector: queryEmbedding,
      limit,
      filter,
      with_payload: true,
    });

    return results.map((r) => ({
      slug: String((r.payload as Record<string, unknown>)?.slug ?? r.id),
      score: r.score,
    }));
  } catch (err) {
    console.error(`[vector-search] Search failed for "${dbName}":`, err);
    resetAvailabilityCache();
    return [];
  }
}
