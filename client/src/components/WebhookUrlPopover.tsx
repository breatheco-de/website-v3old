import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconCopy, IconCheck, IconWebhook } from "@tabler/icons-react";

interface WebhookUrlResponse {
  configured: boolean;
  url?: string;
}

interface WebhookUrlPopoverProps {
  type?: string;
  variant?: "text" | "icon";
}

export function WebhookUrlPopover({ type, variant = "text" }: WebhookUrlPopoverProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<WebhookUrlResponse>({
    queryKey: ["/api/webhooks/clear-cache/url"],
    enabled: open,
    staleTime: 60_000,
  });

  function handleCopy() {
    if (data?.url) {
      navigator.clipboard.writeText(
        type ? `${data.url}&type=${encodeURIComponent(type)}` : data.url
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const fullUrl = data?.url
    ? type
      ? `${data.url}&type=${encodeURIComponent(type)}`
      : data.url
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground"
            title="Webhook URL — trigger a re-fetch via HTTP"
            data-testid="button-webhook-url-trigger-icon"
          >
            <IconWebhook className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <button
            className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity text-sm"
            data-testid="button-webhook-url-trigger"
          >
            webhook url
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[480px] max-w-[95vw]" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Cache-clear webhook URL</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.configured ? (
            <p className="text-sm text-muted-foreground">
              The <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">WEBHOOK_SECRET</code> environment variable is not set. Ask an administrator to configure it.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Send a <code className="font-mono bg-muted px-1 py-0.5 rounded">POST</code> request to this URL to trigger a re-fetch from any external system (e.g. after updating source data).
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={fullUrl ?? ""}
                  className="flex-1 font-mono text-xs bg-muted border rounded px-2 py-1.5 text-foreground outline-none min-w-0"
                  data-testid="input-webhook-url"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="button-copy-webhook-url"
                  title={copied ? "Copied!" : "Copy to clipboard"}
                >
                  {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-muted-foreground">Copied!</p>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
