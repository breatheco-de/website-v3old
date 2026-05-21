import crypto from "crypto";

/**
 * Hash a user ID for storage (privacy protection)
 * We don't need to reverse this - just need consistent hashing
 */
export function hashUserId(userId: string): string {
  return crypto.createHash("sha256").update(userId).digest("hex").substring(0, 16);
}
