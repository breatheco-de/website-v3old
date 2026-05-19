import crypto from "crypto";
import fs from "fs";
import path from "path";

const CODE_TTL_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const CLIENTS_FILE = path.join(process.cwd(), "mcp-server/data/oauth-clients.json");
const BREATHECODE_HOST = process.env.BREATHECODE_HOST || "https://breathecode.herokuapp.com";

// ─── Registered clients (persisted to JSON) ───────────────────────────────────

export interface RegisteredClient {
  clientSecret: string;
  redirectUris: string[];
  clientName: string;
  registeredAt: string;
  breathecodeUserId?: number;
  breathecodeFirstName?: string;
  breathecodeLastName?: string;
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

export function updateClientBreathecodeUser(
  clientId: string,
  userId: number,
  firstName: string,
  lastName: string,
): void {
  const client = clients.get(clientId);
  if (!client) return;
  client.breathecodeUserId = userId;
  client.breathecodeFirstName = firstName;
  client.breathecodeLastName = lastName;
  persistClients();
}

// ─── Pending auth store (in-memory, nonce-keyed) ──────────────────────────────

interface PendingAuth {
  clientId: string;
  redirectUri: string;
  state?: string;
  expiresAt: number;
}

const pendingAuths = new Map<string, PendingAuth>();

function purgeExpiredPendingAuths(): void {
  const now = Date.now();
  for (const [nonce, entry] of pendingAuths.entries()) {
    if (entry.expiresAt < now) pendingAuths.delete(nonce);
  }
}

export function createPendingAuth(
  clientId: string,
  redirectUri: string,
  state?: string,
): string {
  purgeExpiredPendingAuths();
  const nonce = crypto.randomBytes(24).toString("hex");
  pendingAuths.set(nonce, {
    clientId,
    redirectUri,
    state,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
  return nonce;
}

export function consumePendingAuth(nonce: string): PendingAuth | null {
  const entry = pendingAuths.get(nonce);
  if (!entry) return null;
  pendingAuths.delete(nonce);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

// ─── Breathecode token validation ─────────────────────────────────────────────

export interface BreathecodeValidationResult {
  valid: boolean;
  userId?: number;
  firstName?: string;
  lastName?: string;
  error?: string;
}

export async function validateBreathecodeToken(
  token: string,
): Promise<BreathecodeValidationResult> {
  try {
    // Step 1 — confirm the token exists and hasn't expired
    const tokenRes = await fetch(`${BREATHECODE_HOST}/v1/auth/token/${token}`);
    if (!tokenRes.ok) {
      return { valid: false, error: `Token check failed (HTTP ${tokenRes.status})` };
    }

    // Step 2 — verify the user holds the webmaster capability
    const capRes = await fetch(`${BREATHECODE_HOST}/v1/auth/user/me/capability/webmaster`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!capRes.ok) {
      return { valid: false, error: "Token does not have webmaster capability" };
    }

    // Step 3 — fetch user profile to store on the registered client
    const meRes = await fetch(`${BREATHECODE_HOST}/v1/auth/user/me`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!meRes.ok) {
      return { valid: false, error: `User profile fetch failed (HTTP ${meRes.status})` };
    }
    const meData = (await meRes.json()) as {
      id?: number;
      first_name?: string;
      last_name?: string;
      [key: string]: unknown;
    };

    return {
      valid: true,
      userId: meData.id,
      firstName: meData.first_name ?? "",
      lastName: meData.last_name ?? "",
    };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
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
