/**
 * Encrypted GCS I/O helper for MCP auth token persistence.
 *
 * Uses AES-256-GCM with a random 12-byte IV per write.
 * Wire format: [12 bytes IV] [16 bytes auth tag] [N bytes ciphertext]
 *
 * Falls back to a no-op (returns null / skips) when GCS or the encryption
 * key is not configured, so dev environments work without GCS.
 *
 * Environment variables consumed (same as the main app's server/gcs.ts):
 *   GCS_BUCKET_NAME        – required for GCS to be available
 *   GCS_CREDENTIALS_JSON   – optional (inline service-account JSON)
 *   GCS_PROJECT_ID         – optional
 *   GCS_KEY_FILENAME       – optional
 *   MCP_TOKEN_ENCRYPTION_KEY – 64-char hex string (32 bytes), required for encryption
 */

import crypto from "crypto";
import { Storage } from "@google-cloud/storage";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const GCS_PREFIX = "mcp-auth/";

// ─── Internal state ────────────────────────────────────────────────────────────

let storage: Storage | null = null;
let bucketName: string = "";
let encryptionKey: Buffer | null = null;
let _ready = false;

function init(): void {
  if (_ready) return;
  _ready = true;

  const bucket = process.env.GCS_BUCKET_NAME;
  const rawKey = process.env.MCP_TOKEN_ENCRYPTION_KEY;

  if (!bucket) {
    console.log("[MCP] GCS store: GCS_BUCKET_NAME not set — token GCS persistence disabled (local JSON only)");
    return;
  }

  if (!rawKey) {
    console.warn("[MCP] GCS store: MCP_TOKEN_ENCRYPTION_KEY not set — token GCS persistence disabled (local JSON only). Set a 64-char hex key to enable durable GCS-backed token storage.");
    return;
  }

  if (rawKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(rawKey)) {
    console.warn("[MCP] GCS store: MCP_TOKEN_ENCRYPTION_KEY must be a 64-character hex string — token GCS persistence disabled");
    return;
  }

  encryptionKey = Buffer.from(rawKey, "hex");
  bucketName = bucket;

  const opts: Record<string, any> = {};
  const credJson = process.env.GCS_CREDENTIALS_JSON;
  const projectId = process.env.GCS_PROJECT_ID;
  const keyFilename = process.env.GCS_KEY_FILENAME;

  if (projectId) opts.projectId = projectId;
  if (credJson) {
    try {
      opts.credentials = JSON.parse(credJson);
    } catch {
      console.error("[MCP] GCS store: Failed to parse GCS_CREDENTIALS_JSON");
    }
  } else if (keyFilename) {
    opts.keyFilename = keyFilename;
  }

  storage = new Storage(opts);
  console.log(`[MCP] GCS store: initialized (bucket: ${bucketName}, prefix: ${GCS_PREFIX})`);
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function isGcsAvailable(): boolean {
  init();
  return storage !== null && encryptionKey !== null;
}

/**
 * Encrypt `plaintext` and upload to `mcp-auth/<filename>` in GCS.
 * No-op if GCS or the encryption key is not configured.
 */
export async function encryptedWrite(filename: string, plaintext: string): Promise<void> {
  init();
  if (!storage || !encryptionKey) return;

  try {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, encryptionKey, iv);
    const ciphertextChunks: Buffer[] = [];
    ciphertextChunks.push(cipher.update(plaintext, "utf-8"));
    ciphertextChunks.push(cipher.final());
    const ciphertext = Buffer.concat(ciphertextChunks);
    const authTag = cipher.getAuthTag();

    // Wire format: IV (12) | authTag (16) | ciphertext (N)
    const blob = Buffer.concat([iv, authTag, ciphertext]);
    const gcsKey = `${GCS_PREFIX}${filename}`;

    const file = storage.bucket(bucketName).file(gcsKey);
    await file.save(blob, {
      contentType: "application/octet-stream",
      resumable: false,
      metadata: { cacheControl: "no-store" },
    });
    console.log(`[MCP] GCS store: wrote encrypted blob → ${gcsKey} (${blob.length} bytes)`);
  } catch (err) {
    console.error(`[MCP] GCS store: encryptedWrite failed for "${filename}" —`, (err as Error).message);
  }
}

/**
 * Download and decrypt `mcp-auth/<filename>` from GCS.
 * Returns the plaintext string, or null if the file doesn't exist or GCS is unavailable.
 */
export async function encryptedRead(filename: string): Promise<string | null> {
  init();
  if (!storage || !encryptionKey) return null;

  try {
    const gcsKey = `${GCS_PREFIX}${filename}`;
    const file = storage.bucket(bucketName).file(gcsKey);
    const [exists] = await file.exists();
    if (!exists) return null;

    const [blob] = await file.download();

    if (blob.length < IV_BYTES + TAG_BYTES) {
      console.warn(`[MCP] GCS store: blob "${gcsKey}" is too short to be valid (${blob.length} bytes)`);
      return null;
    }

    const iv = blob.subarray(0, IV_BYTES);
    const authTag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);

    const decipher = crypto.createDecipheriv(ALGO, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log(`[MCP] GCS store: read and decrypted blob ← ${gcsKey}`);
    return plain.toString("utf-8");
  } catch (err) {
    console.error(`[MCP] GCS store: encryptedRead failed for "${filename}" —`, (err as Error).message);
    return null;
  }
}
