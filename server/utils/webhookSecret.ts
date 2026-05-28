export function getWebhookSecret(): string | null {
  return process.env.WEBHOOK_SECRET || null;
}
