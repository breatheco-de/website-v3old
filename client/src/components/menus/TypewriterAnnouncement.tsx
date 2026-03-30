import { Megaphone } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { getIcon } from "@/lib/icons";
import type { MarqueeMessage } from "@/components/menus";
import { useInternalNav } from "@/hooks/useInternalNav";

export interface TypewriterAnnouncementProps {
  messages: MarqueeMessage[];
  icon?: string;
  charDelay?: number;
  startDelay?: number;
  displayTime?: number;
}

export function TypewriterAnnouncement({
  messages,
  icon,
  charDelay = 40,
  startDelay = 600,
  displayTime = 3000,
}: TypewriterAnnouncementProps) {
  const { displayText, ctaLabel, ctaUrl, icon: msgIcon } = useTypewriter(messages, charDelay, startDelay, displayTime);
  const handleLinkClick = useInternalNav();

  const resolvedIconName = msgIcon || icon || (messages[0]?.icon);
  const ResolvedIcon = resolvedIconName ? getIcon(resolvedIconName) : null;
  const Icon = ResolvedIcon ?? Megaphone;

  const safeMessages = messages && messages.length > 0 ? messages : [];
  const totalChars = safeMessages.reduce((sum, m) => sum + (m.text || "").length + (m.cta_label || "").length, 0);
  const tickerDuration = Math.max(8, totalChars * 0.14);

  const renderTickerMessages = (prefix: string) =>
    safeMessages.map((msg, i) => (
      <span key={`${prefix}-${i}`} className="inline-flex items-center">
        <span className="text-muted-foreground">
          {msg.text}
          {msg.cta_label && (
            <span className="text-primary ml-1">{msg.cta_label}</span>
          )}
        </span>
        <span className="mx-4 text-muted-foreground/40" aria-hidden="true">·</span>
      </span>
    ));

  return (
    <div
      className="flex-1 flex items-center justify-center gap-2 min-w-0"
      data-testid="typewriter-announcement"
    >
      {/* Mobile: sliding ticker */}
      <div className="md:hidden flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div
            className="logo-carousel-track inline-flex"
            style={{ animationDuration: `${tickerDuration}s` }}
          >
            {renderTickerMessages("a")}
            {renderTickerMessages("b")}
          </div>
        </div>
      </div>

      {/* Desktop: typewriter */}
      <div className="hidden md:inline-flex items-center w-min gap-1">
        <Icon className="w-5 h-5 text-primary shrink-0 my-1" />
        <span className="inline-flex items-center text-muted-foreground whitespace-nowrap overflow-hidden">
          {displayText}
          {ctaLabel && ctaUrl && (
            <a
              href={ctaUrl}
              onClick={handleLinkClick}
              className="text-primary hover:underline ml-1"
              data-testid="typewriter-cta-link"
            >
              {ctaLabel}
            </a>
          )}
          {ctaLabel && !ctaUrl && (
            <span className="text-primary ml-1">{ctaLabel}</span>
          )}
        </span>
        <span className="bg-primary inline-block w-px h-4 ml-[0.2px] animate-blink shrink-0" />
      </div>
    </div>
  );
}
