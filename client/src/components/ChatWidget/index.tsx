import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { IconMessageCircle, IconX, IconSend, IconLoader2 } from "@tabler/icons-react";

interface ChatConfig {
  enabled: boolean;
  page_patterns: string[];
  content_types: string[];
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  question_tag?: string | null;
}

function detectContentFromUrl(pathname: string): { contentType: string | null; contentSlug: string | null; locale: string } {
  const programEnMatch = pathname.match(/^\/en\/career-programs\/([^/?#]+)/);
  if (programEnMatch) return { contentType: "program", contentSlug: programEnMatch[1], locale: "en" };

  const programEsMatch = pathname.match(/^\/es\/programas-de-carrera\/([^/?#]+)/);
  if (programEsMatch) return { contentType: "program", contentSlug: programEsMatch[1], locale: "es" };

  const locationEnMatch = pathname.match(/^\/en\/location\/([^/?#]+)/);
  if (locationEnMatch) return { contentType: "location", contentSlug: locationEnMatch[1], locale: "en" };

  const locationEsMatch = pathname.match(/^\/es\/ubicacion\/([^/?#]+)/);
  if (locationEsMatch) return { contentType: "location", contentSlug: locationEsMatch[1], locale: "es" };

  const localeMatch = pathname.match(/^\/(en|es)\//);
  const locale = localeMatch?.[1] || "en";

  const pageSlugMatch = pathname.match(/^\/(en|es)\/([^/?#]+(?:\/[^/?#]+)*)/);
  if (pageSlugMatch) {
    return { contentType: "page", contentSlug: pageSlugMatch[2], locale };
  }

  return { contentType: null, contentSlug: null, locale };
}

export function ChatWidget() {
  const [pathname] = useLocation();
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/chat/config")
      .then(r => r.json())
      .then(setConfig)
      .catch(() => setConfig({ enabled: false, page_patterns: [], content_types: [] }));
  }, []);

  const shouldShow = useCallback(() => {
    if (!config?.enabled) return false;
    if (pathname.startsWith("/private/")) return false;

    const hasPatterns = config.page_patterns && config.page_patterns.length > 0;
    const hasContentTypes = config.content_types && config.content_types.length > 0;

    if (!hasPatterns && !hasContentTypes) return true;

    let matchesPattern = false;
    if (hasPatterns) {
      matchesPattern = config.page_patterns.some(pattern => {
        try {
          return new RegExp(pattern).test(pathname);
        } catch {
          return false;
        }
      });
    }

    let matchesContentType = false;
    if (hasContentTypes) {
      const { contentType } = detectContentFromUrl(pathname);
      if (contentType) {
        matchesContentType = config.content_types.includes(contentType);
      }
    }

    return matchesPattern || matchesContentType;
  }, [config, pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    if (conversationId || isStarting) return;
    setIsStarting(true);

    const { contentType, contentSlug, locale } = detectContentFromUrl(pathname);

    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_url: pathname,
          content_type: contentType,
          content_slug: contentSlug,
          locale,
        }),
      });
      const data = await res.json();
      setConversationId(data.conversation_id);
    } catch (err) {
      console.error("Failed to start conversation:", err);
    } finally {
      setIsStarting(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!conversationId) {
      startConversation();
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !conversationId) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const { contentType, contentSlug, locale } = detectContentFromUrl(pathname);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: trimmed,
          content_type: contentType,
          content_slug: contentSlug,
          locale,
        }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        id: data.id,
        role: "assistant",
        content: data.content,
        question_tag: data.question_tag,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!shouldShow()) return null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 w-[380px] max-w-[calc(100vw-2rem)] bg-background border border-border rounded-md shadow-lg flex flex-col overflow-hidden"
          style={{ height: "500px", zIndex: 9998 }}
          data-testid="chat-widget-panel"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <IconMessageCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">Chat with us</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-primary-foreground/20 transition-colors"
              data-testid="button-close-chat"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <p className="font-medium mb-1">Welcome!</p>
                <p>Ask us anything about our programs, locations, or admissions process.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`chat-message-${msg.role}-${i}`}
              >
                <div
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start" data-testid="chat-typing-indicator">
                <div className="bg-muted rounded-md px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  <span>Typing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={isLoading || !conversationId}
                data-testid="input-chat-message"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || !conversationId}
                className="p-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
                data-testid="button-send-chat"
              >
                <IconSend className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        style={{ zIndex: 9999 }}
        data-testid="button-chat-bubble"
      >
        {isOpen ? (
          <IconX className="h-6 w-6" />
        ) : (
          <IconMessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
