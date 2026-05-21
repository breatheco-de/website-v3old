/**
 * UserManager — Breathecode identity singleton with TTL cache.
 *
 * Centralizes all Breathecode token → user profile resolution.
 * Caches results for 5 minutes to avoid hammering the Breathecode API.
 */

const BREATHECODE_HOST =
  process.env.VITE_BREATHECODE_HOST || "https://breathecode.herokuapp.com";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface BreathecodeProfile {
  valid: boolean;
  userId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  expiresAt?: string | null;
  error?: string;
}

interface CacheEntry {
  profile: BreathecodeProfile;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(token: string): BreathecodeProfile | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(token);
    return null;
  }
  return entry.profile;
}

function setCached(token: string, profile: BreathecodeProfile): void {
  cache.set(token, { profile, cachedAt: Date.now() });
}

/**
 * Validate a Breathecode token and return the user profile.
 * Results are cached for 5 minutes.
 */
export async function validateToken(token: string): Promise<BreathecodeProfile> {
  const cached = getCached(token);
  if (cached) return cached;

  try {
    // Step 1 — Check token existence + expiry
    let expiresAt: string | null = null;
    try {
      const tokenRes = await fetch(`${BREATHECODE_HOST}/v1/auth/token/${token}`);
      if (!tokenRes.ok) {
        const profile: BreathecodeProfile = {
          valid: false,
          error: `Token check failed (HTTP ${tokenRes.status})`,
        };
        setCached(token, profile);
        return profile;
      }
      const tokenData = (await tokenRes.json()) as { expires_at?: string };
      expiresAt = tokenData.expires_at ?? null;
    } catch {
      // Token info fetch failed — continue to user/me check
    }

    // Step 2 — Fetch user profile
    const meRes = await fetch(`${BREATHECODE_HOST}/v1/auth/user/me`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!meRes.ok) {
      const profile: BreathecodeProfile = {
        valid: false,
        error: `User profile fetch failed (HTTP ${meRes.status})`,
        expiresAt,
      };
      setCached(token, profile);
      return profile;
    }
    const meData = (await meRes.json()) as {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
    };

    const profile: BreathecodeProfile = {
      valid: true,
      userId: meData.id,
      username: meData.username,
      firstName: meData.first_name ?? "",
      lastName: meData.last_name ?? "",
      email: meData.email,
      expiresAt,
    };

    setCached(token, profile);
    return profile;
  } catch (err) {
    const profile: BreathecodeProfile = {
      valid: false,
      error: (err as Error).message,
    };
    return profile;
  }
}

/**
 * Resolve the git commit author string for a token.
 * Prefers Breathecode `username`, falls back to "firstname.lastname", then "unknown".
 */
export async function resolveCommitAuthor(token: string): Promise<string> {
  const profile = await validateToken(token);
  if (!profile.valid) return "unknown";

  if (profile.username) return profile.username;

  const first = profile.firstName?.trim() || "";
  const last = profile.lastName?.trim() || "";
  if (first || last) {
    return [first, last].filter(Boolean).join(".").toLowerCase();
  }
  return "unknown";
}

/**
 * Invalidate a cached token (e.g. on logout).
 */
export function invalidateToken(token: string): void {
  cache.delete(token);
}
