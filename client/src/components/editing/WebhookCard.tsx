import { IconCheck, IconCopy, IconPencil, IconWebhook, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type WebhookSource = "section" | "event" | "global" | "none";

export interface WebhookCardProps {
  url: string;
  method: "POST" | "GET";
  authHeader: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChange: (field: "url" | "method" | "authHeader", value: string) => void;
  hint?: string;
  testIdPrefix?: string;
  source?: WebhookSource;
  inheritedUrl?: string;
}

const SOURCE_LABELS: Record<WebhookSource, string> = {
  section: "Section override",
  event: "Event default",
  global: "Global webhook",
  none: "Not configured",
};

export function WebhookCard({
  url,
  method,
  authHeader,
  editing,
  onEditingChange,
  onChange,
  hint = "Overrides the global webhook for this event only. Leave URL blank to use the global webhook.",
  testIdPrefix = "event-webhook",
  source,
  inheritedUrl,
}: WebhookCardProps) {
  const [copied, setCopied] = useState(false);

  function copyUrl(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="rounded-md border bg-muted/20 p-3 space-y-3 overflow-hidden"
      data-testid={`card-${testIdPrefix}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <IconWebhook className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium">Webhook</span>
          {source !== undefined && (
            <Badge
              variant={
                source === "section"
                  ? "default"
                  : source === "none"
                  ? "outline"
                  : "secondary"
              }
              className="text-[11px] px-1.5 py-0 leading-4 font-normal"
              data-testid={`badge-${testIdPrefix}-source`}
            >
              {SOURCE_LABELS[source]}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => onEditingChange(!editing)}
          data-testid={`button-edit-${testIdPrefix}`}
        >
          {editing ? (
            <IconX className="h-3.5 w-3.5" />
          ) : (
            <IconPencil className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="space-y-1.5">
            <Label htmlFor={`${testIdPrefix}-url`} className="text-xs text-muted-foreground">
              URL
            </Label>
            <Input
              id={`${testIdPrefix}-url`}
              type="url"
              placeholder="https://hooks.example.com/..."
              value={url}
              onChange={(e) => onChange("url", e.target.value)}
              data-testid={`input-${testIdPrefix}-url`}
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${testIdPrefix}-method`} className="text-xs text-muted-foreground">
              Method
            </Label>
            <Select
              value={method}
              onValueChange={(val) => onChange("method", val)}
            >
              <SelectTrigger
                id={`${testIdPrefix}-method`}
                data-testid={`select-${testIdPrefix}-method`}
                className="text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${testIdPrefix}-auth`} className="text-xs text-muted-foreground">
              Authorization header{" "}
              <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id={`${testIdPrefix}-auth`}
              type="password"
              placeholder="Bearer sk-..."
              value={authHeader}
              onChange={(e) => onChange("authHeader", e.target.value)}
              data-testid={`input-${testIdPrefix}-auth`}
              autoComplete="off"
              className="text-xs"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {url ? (
              <button
                type="button"
                onClick={() => copyUrl(url)}
                className="flex items-center gap-1.5 min-w-0 overflow-hidden group cursor-pointer"
                data-testid={`button-${testIdPrefix}-copy-url`}
                title="Click to copy"
              >
                <Badge
                  variant="secondary"
                  className="text-[11px] px-1.5 py-0 leading-4 font-normal shrink-0"
                >
                  {method}
                </Badge>
                <span className="font-mono text-xs truncate text-foreground min-w-0">
                  {url}
                </span>
                <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                  {copied
                    ? <IconCheck className="h-3 w-3 text-green-600" />
                    : <IconCopy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  }
                </span>
              </button>
            ) : source === "event" || source === "global" ? (
              inheritedUrl ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground italic underline decoration-dashed underline-offset-2 cursor-pointer hover:text-foreground transition-colors text-left"
                      data-testid={`button-${testIdPrefix}-inherited-url`}
                    >
                      not set — falls back to {source === "event" ? "event default" : "global webhook"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto max-w-xs p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Inherited URL
                    </p>
                    <p className="font-mono text-xs break-all text-foreground">{inheritedUrl}</p>
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  not set — falls back to {source === "event" ? "event default" : "global webhook"}
                </span>
              )
            ) : source === "none" ? (
              <span className="text-xs text-muted-foreground italic">
                not set — no fallback configured
              </span>
            ) : (
              inheritedUrl ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground italic underline decoration-dashed underline-offset-2 cursor-pointer hover:text-foreground transition-colors text-left"
                      data-testid={`button-${testIdPrefix}-inherited-url`}
                    >
                      not set — uses global webhook
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto max-w-xs p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Inherited URL
                    </p>
                    <p className="font-mono text-xs break-all text-foreground">{inheritedUrl}</p>
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  not set — uses global webhook
                </span>
              )
            )}
          </div>
          {authHeader && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">
                Auth
              </span>
              <span className="text-xs text-muted-foreground italic">
                configured
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
