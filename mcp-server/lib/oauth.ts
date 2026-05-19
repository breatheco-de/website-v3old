import crypto from "crypto";

const CODE_TTL_MS = 5 * 60 * 1000;

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
    if (entry.expiresAt < now) {
      authCodes.delete(code);
    }
  }
}

export function generateCode(clientId: string, redirectUri: string): string {
  purgeExpiredCodes();
  const code = crypto.randomBytes(32).toString("hex");
  authCodes.set(code, {
    clientId,
    redirectUri,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  return code;
}

export function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  expectedClientId: string,
  expectedClientSecret: string
): string | null {
  const entry = authCodes.get(code);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  if (
    entry.clientId !== clientId ||
    entry.redirectUri !== redirectUri ||
    clientId !== expectedClientId ||
    clientSecret !== expectedClientSecret
  ) {
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
