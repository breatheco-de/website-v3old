import crypto from "crypto";
import fs from "fs";
import path from "path";

const CODE_TTL_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const CLIENTS_FILE = path.join(process.cwd(), "mcp-server/data/oauth-clients.json");

// ─── Registered clients (persisted to JSON) ───────────────────────────────────

export interface RegisteredClient {
  clientSecret: string;
  redirectUris: string[];
  clientName: string;
  registeredAt: string;
  breathecodeUserId?: number;
  breathecodeFirstName?: string;
  breathecodeLastName?: string;
  breathecodeUsername?: string;
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
  username?: string,
): void {
  const client = clients.get(clientId);
  if (!client) return;
  client.breathecodeUserId = userId;
  client.breathecodeFirstName = firstName;
  client.breathecodeLastName = lastName;
  if (username) client.breathecodeUsername = username;
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

// ─── Breathecode token validation (via main app's centralized UserManager) ─────

export interface BreathecodeValidationResult {
  valid: boolean;
  userId?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  error?: string;
}

/**
 * Validate a Breathecode token by calling the main CMS app's validate-token endpoint.
 * This ensures MCP OAuth uses the same UserManager/UserStore as the CMS,
 * including first-user-webmaster bootstrap and role assignment.
 */
export async function validateBreathecodeToken(
  token: string,
): Promise<BreathecodeValidationResult> {
  const mainAppPort = process.env.PORT || "5000";
  const mainAppUrl = `http://localhost:${mainAppPort}/api/debug/validate-token`;

  try {
    const res = await fetch(mainAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return { valid: false, error: `Main app validation error (HTTP ${res.status})` };
    }

    const data = (await res.json()) as {
      valid: boolean;
      userName?: string;
      username?: string;
      expiresAt?: string;
      capabilities?: unknown[];
      error?: string;
    };

    if (!data.valid) {
      return { valid: false, error: data.error || "Token is not valid or lacks required permissions" };
    }

    // Enforce that the user has at least one internal platform capability.
    // A valid Breathecode identity alone is not sufficient — the user must be
    // assigned a role in the CMS before MCP OAuth grants them an access token.
    if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
      return {
        valid: false,
        error: "Your account does not have platform write access. Contact an administrator to be assigned a role.",
      };
    }

    // The main app returns userName (display) and username (breathecode slug)
    const username = data.username || data.userName || "";
    return {
      valid: true,
      username,
      // Attempt to split userName for backward-compat fields (firstName.lastName format)
      firstName: username.split(".")[0] || "",
      lastName: username.split(".").slice(1).join(".") || "",
    };
  } catch (err) {
    // Main app is unreachable — fail closed to keep authorization internal-only.
    // Do not fall back to direct Breathecode capability checks; instead deny access.
    console.warn("[MCP] Main app unreachable for token validation, denying MCP access —", (err as Error).message);
    return { valid: false, error: "Authorization service unavailable; cannot verify credentials" };
  }
}

// ─── Breathecode direct-token registry ───────────────────────────────────────
// Maps a raw Breathecode token (passed as Bearer / x-api-key) → resolved username.
// Populated by authMiddleware after a successful validateBreathecodeToken call so
// that getTokenUsername() works transparently for both OAuth and direct callers.

const breathecodeTokenUsernames = new Map<string, string>();

export function registerBreathecodeToken(token: string, username: string): void {
  breathecodeTokenUsernames.set(token, username);
}

// ─── Auth codes (in-memory only) ─────────────────────────────────────────────

interface AuthCode {
  clientId: string;
  redirectUri: string;
  expiresAt: number;
}

const authCodes = new Map<string, AuthCode>();
// Maps access token → clientId so we can look up Breathecode user info later
const accessTokens = new Map<string, string>();

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
  accessTokens.set(token, clientId);
  return token;
}

export function validateToken(token: string): boolean {
  return accessTokens.has(token);
}

/**
 * Look up which client issued the given access token.
 * Returns the client's Breathecode username (slug), falling back to
 * "firstname.lastname" if the slug is not stored.
 * Returns null if the token is unknown or no user is attached.
 */
export function getTokenUsername(token: string): string | null {
  // Check OAuth access-token registry first
  const clientId = accessTokens.get(token);
  if (clientId) {
    const client = clients.get(clientId);
    if (client) {
      if (client.breathecodeUsername) return client.breathecodeUsername;
      const first = client.breathecodeFirstName?.trim() || "";
      const last = client.breathecodeLastName?.trim() || "";
      if (first || last) return [first, last].filter(Boolean).join(".").toLowerCase();
    }
  }
  // Fall back to Breathecode direct-token registry
  return breathecodeTokenUsernames.get(token) ?? null;
}
