-- Rename visitor_id column to user_id in the conversations table
-- This aligns with the GA4 standard user_id field naming
ALTER TABLE "conversations" RENAME COLUMN "visitor_id" TO "user_id";
