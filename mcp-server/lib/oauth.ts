import crypto from "crypto";
import fs from "fs";
import path from "path";

const CODE_TTL_MS = 5 * 60 * 1000;
const CLIENTS_FILE = path.join(process.cwd(), "mcp-server/data/oauth-clients.json");

// ─── Registered clients (persisted to JSON) ───────────────────────────────────

export interface RegisteredClient {
  clientSecret: string;
  redirectUris: string[];
  clientName: string;
  registeredAt: string;
}

const clients = new Map<string, RegisteredClient>();

function loadClients(): void {
  try {
    if (!fs.existsSync(CLIENTS_FILE)) return;
    const raw = fs.readFileSync(CLIENTS_FILE, "utf-8");
    const obj = JSON.parse(raw) as Record<string, RegisteredClient>;
    for (const [id, client] of Object.entries(obj)) {
      clients.set(id, client);
    }
    console.log(`[MCP] OAuth: loaded ${clients.size} registered client(s) from disk`);
  } catch (err) {
    console.warn("[MCP] OAuth: could not load oauth-clients.json —", (err as Error).message);
  }
}

function persistClients(): void {
  try {
    const dir = path.dirname(CLIENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj: Record<string, RegisteredClient> = {};
    for (const [id, client] of clients.entries()) {
      obj[id] = client;
    }
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("[MCP] OAuth: failed to persist oauth-clients.json —", (err as Error).message);
  }
}

function ensureDataDir(): void {
  try {
    const dir = path.dirname(CLIENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(CLIENTS_FILE)) {
      fs.writeFileSync(CLIENTS_FILE, "{}\n", "utf-8");
    }
  } catch (err) {
    console.warn("[MCP] OAuth: could not create oauth-clients.json —", (err as Error).message);
  }
}

ensureDataDir();
loadClients();

export function registerClient(
  clientName: string,
  redirectUris: string[],
): { clientId: string; clientSecret: string } {
  const clientId = crypto.randomBytes(16).toString("hex");
  const clientSecret = crypto.randomBytes(32).toString("hex");
  clients.set(clientId, {
    clientSecret,
    redirectUris,
    clientName: clientName || "Unknown client",
    registeredAt: new Date().toISOString(),
  });
  persistClients();
  return { clientId, clientSecret };
}

export function lookupClient(clientId: string): RegisteredClient | null {
  return clients.get(clientId) ?? null;
}

// ─── Auth codes (in-memory only) ─────────────────────────────────────────────

interface AuthCode {
  clientId: string;
  redirectUri: string;
  expiresAt: number;
}

const authCodes = new Map<string, AuthCode>();
const accessTokens = new Set<string>();

function purgeExpiredCodes(): void {
  const now = Date.now();
  for (const [code, entry] of authCodes.entries()) {
    if (entry.expiresAt < now) authCodes.delete(code);
  }
}

export function generateCode(clientId: string, redirectUri: string): string {
  purgeExpiredCodes();
  const code = crypto.randomBytes(32).toString("hex");
  authCodes.set(code, { clientId, redirectUri, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

export function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  staticClientId?: string,
  staticClientSecret?: string,
): string | null {
  const entry = authCodes.get(code);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  if (entry.clientId !== clientId || entry.redirectUri !== redirectUri) return null;

  const registered = clients.get(clientId);
  if (registered) {
    if (registered.clientSecret !== clientSecret) return null;
  } else if (staticClientId && staticClientSecret) {
    if (clientId !== staticClientId || clientSecret !== staticClientSecret) return null;
  } else {
    return null;
  }

  authCodes.delete(code);
  const token = crypto.randomBytes(48).toString("hex");
  accessTokens.add(token);
  return token;
}

export function validateToken(token: string): boolean {
  return accessTokens.has(token);
}
