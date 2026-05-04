import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface ColumnConfig {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "image" | "link" | "boolean";
  template?: string;
}

interface TableConfig {
  columns: ColumnConfig[];
  title?: string;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  config?: TableConfig;
}

interface DynamicTableChatProps {
  endpoint: string;
  dataPath?: string;
  currentColumns: ColumnConfig[];
  currentTitle?: string;
  locale?: string;
  onApplyConfig: (config: { columns: ColumnConfig[]; title?: string }) => void;
}

function flattenKeys(obj: Record<string, unknown>, prefix = "", maxDepth = 3): string[] {
  if (maxDepth <= 0) return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, path, maxDepth - 1));
    }
  }
  return keys;
}

function formatConfigSummary(config: TableConfig): string {
  const cols = config.columns.map((c) => c.label).join(", ");
  return `${config.title ? `"${config.title}" — ` : ""}${config.columns.length} columns: ${cols}`;
}

function resolvePreviewValue(col: ColumnConfig, sample: Record<string, unknown>): string {
  if (col.template) {
    const val = col.template.replace(/\{([^}]+)\}/g, (_, k: string) => {
      const parts = k.trim().split(".");
      let cur: unknown = sample;
      for (const p of parts) {
        if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
        else return "";
      }
      if (typeof cur === "string" && /^\d{4}-\d{2}-\d{2}(T|\s)/.test(cur)) {
        try { return new Date(cur).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { /* */ }
      }
      return cur != null ? String(cur) : "";
    });
    return val || "-";
  }
  const parts = col.key.split(".");
  let cur: unknown = sample;
  for (const p of parts) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
    else return "-";
  }
  return cur != null ? String(cur).slice(0, 40) : "-";
}

export function DynamicTableChat({
  endpoint,
  dataPath,
  currentColumns,
  currentTitle,
  locale,
  onApplyConfig,
}: DynamicTableChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataArray, setDataArray] = useState<Record<string, unknown>[]>([]);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeConfig, setActiveConfig] = useState<TableConfig>({
    columns: currentColumns,
    title: currentTitle,
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    setDataLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      let arr: Record<string, unknown>[];
      if (Array.isArray(raw)) {
        arr = raw as Record<string, unknown>[];
      } else if (dataPath && raw[dataPath] && Array.isArray(raw[dataPath])) {
        arr = raw[dataPath] as Record<string, unknown>[];
      } else {
        const firstArrayKey = Object.keys(raw).find((k) => Array.isArray(raw[k]) && raw[k].length > 0);
        if (firstArrayKey) {
          arr = raw[firstArrayKey] as Record<string, unknown>[];
        } else {
          setError("Could not find array data in endpoint response");
          return;
        }
      }
      if (arr.length === 0) {
        setError("Endpoint returned empty data");
        return;
      }
      setDataArray(arr);
      const keys = flattenKeys(arr[0]);
      setAvailableKeys(keys);
      setDataLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setDataLoading(false);
    }
  }, [endpoint, dataPath]);

  const prevEndpointRef = useRef(endpoint);
  useEffect(() => {
    if (prevEndpointRef.current !== endpoint) {
      prevEndpointRef.current = endpoint;
      setDataLoaded(false);
      setDataArray([]);
      setAvailableKeys([]);
      setMessages([]);
      setError(null);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!dataLoaded && endpoint) {
      fetchData();
    }
  }, [endpoint, dataLoaded, fetchData]);

  useEffect(() => {
    setActiveConfig({ columns: currentColumns, title: currentTitle });
  }, [currentColumns, currentTitle]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !dataLoaded) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);
    setError(null);
    scrollToBottom();

    try {
      const response = await apiRequest("POST", "/api/ai/refine-table-config", {
        currentConfig: activeConfig,
        sampleData: dataArray.slice(0, 5),
        availableKeys,
        userFeedback: input,
        locale: locale || "en",
      });
      const config = await response.json() as TableConfig;
      const aiMsg: ChatMessage = {
        role: "ai",
        content: formatConfigSummary(config),
        config,
      };
      setMessages([...updatedMessages, aiMsg]);
      setActiveConfig(config);
      onApplyConfig(config);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setSending(false);
    }
  }, [input, sending, dataLoaded, messages, activeConfig, dataArray, availableKeys, locale, onApplyConfig, scrollToBottom]);

  if (dataLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading endpoint data...
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="space-y-2 p-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" variant="outline" onClick={fetchData} data-testid="button-retry-fetch">
          <RefreshCw className="w-4 h-4 mr-1" />
          Retry loading data
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="dynamic-table-chat">
      <div>
        <Label className="text-sm font-medium">AI Table Assistant</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locale === "es"
            ? "Chatea con la IA para modificar las columnas de la tabla"
            : "Chat with AI to modify the table columns"}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">
          {locale === "es" ? "Columnas actuales:" : "Current columns:"}
        </p>
        <div className="flex flex-wrap gap-1">
          {activeConfig.columns.map((col, i) => (
            <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-current-col-${col.key}`}>
              {col.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="border rounded-md flex flex-col" style={{ maxHeight: "280px" }}>
        <div className="flex-1 overflow-y-auto p-2 space-y-2" data-testid="chat-messages-panel">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {locale === "es"
                ? 'Escribe un mensaje como "Agrega una columna de ubicación" o "Filtra por región de la sesión"'
                : 'Type a message like "Add a location column" or "Filter by session region"'}
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-md px-2.5 py-1.5 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
                data-testid={`chat-msg-${msg.role}-${i}`}
              >
                <p>{msg.content}</p>
                {msg.config && dataArray[0] && (
                  <div className="mt-1.5 space-y-0.5">
                    {msg.config.columns.map((col, ci) => (
                      <div key={ci} className="flex items-center gap-1.5 opacity-90">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{col.type}</Badge>
                        <span className="font-medium">{col.label}</span>
                        <span className="opacity-70 truncate text-[10px]">
                          {resolvePreviewValue(col, dataArray[0])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-md px-2.5 py-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t p-1.5 flex gap-1.5 items-end">
          <Textarea
            placeholder={locale === "es"
              ? "Pide cambios a la IA..."
              : "Ask AI for changes..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[36px] max-h-[60px] flex-1 resize-none text-xs"
            disabled={sending}
            data-testid="input-table-chat"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            data-testid="button-table-chat-send"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="text-[10px] text-muted-foreground">
        {locale === "es"
          ? `${availableKeys.length} campos disponibles del endpoint`
          : `${availableKeys.length} fields available from endpoint`}
      </p>
    </div>
  );
}
