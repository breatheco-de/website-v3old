import crypto from "crypto";

/**
 * Hash a visitor ID for storage (privacy protection)
 * We don't need to reverse this - just need consistent hashing
 */
export function hashVisitorId(visitorId: string): string {
  return crypto.createHash("sha256").update(visitorId).digest("hex").substring(0, 16);
}
