import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const VECTOR_SIZE = 1536;
const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 64;

const AVAILABILITY_TTL_MS = 30_000;

let qdrantClient: QdrantClient | null = null;
let openaiClient: OpenAI | null = null;
let _available: boolean | null = null;
let _availabilityCheckedAt = 0;

function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
  }
  return qdrantClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
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
    await client.getCollection(name);
  } catch {
    await client.createCollection(name, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log(`[vector-search] Created collection "${name}"`);
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
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
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

  try {
    await ensureCollection(dbName);
    const client = getQdrantClient();
    const name = collectionName(dbName);

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
      console.log(
        `[vector-search] Indexed batch ${Math.floor(start / BATCH_SIZE) + 1} (${batch.length} items) for "${dbName}"`
      );
    }

    console.log(`[vector-search] Indexed ${items.length} items for "${dbName}"`);
  } catch (err) {
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
