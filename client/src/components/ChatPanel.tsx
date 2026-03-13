import { useRef, useEffect, type ReactNode, type RefObject } from "react";
import { IconMessageCircle, IconSend, IconLoader2 } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps<T extends ChatMessage = ChatMessage> {
  messages: T[];
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  agentName?: string | null;
  agentIcon?: string | null;
  renderAfterAssistant?: (message: T, index: number) => ReactNode;
  onClose?: () => void;
  inputRef?: RefObject<HTMLInputElement>;
  inputDisabled?: boolean;
  className?: string;
}

export function ChatPanel<T extends ChatMessage = ChatMessage>({
  messages,
  isLoading,
  input,
  onInputChange,
  onSend,
  agentName,
  agentIcon,
  renderAfterAssistant,
  onClose,
  inputRef: externalInputRef,
  inputDisabled,
  className,
}: ChatPanelProps<T>) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRefToUse = externalInputRef || internalInputRef;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className={`flex flex-col overflow-hidden ${className || ""}`} data-testid="chat-panel">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          {agentIcon ? (
            <img src={agentIcon} alt={agentName || "Agent"} className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <IconMessageCircle className="h-5 w-5" />
          )}
          <span className="font-semibold text-sm">{agentName || "Chat with us"}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-primary-foreground/20 transition-colors"
            data-testid="button-close-chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
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
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            data-testid={`chat-message-${msg.role}-${i}`}
          >
            <div
              className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "bg-muted text-foreground chat-markdown"
              }`}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "assistant" && renderAfterAssistant?.(msg, i)}
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
            ref={inputRefToUse}
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={inputDisabled || isLoading}
            data-testid="input-chat-message"
          />
          <button
            onClick={onSend}
            disabled={isLoading || !input.trim() || inputDisabled}
            className="p-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
            data-testid="button-send-chat"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
