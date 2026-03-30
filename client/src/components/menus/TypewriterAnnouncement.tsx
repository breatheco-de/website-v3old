import { useState, useEffect } from "react";
import { Megaphone } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { getIcon } from "@/lib/icons";
import type { MarqueeMessage } from "@/components/menus";
import { useInternalNav } from "@/hooks/useInternalNav";
import Marquee from "@/lib/marquee";

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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedIconName = msgIcon || icon;
  const ResolvedIcon = resolvedIconName ? getIcon(resolvedIconName) : null;
  const Icon = ResolvedIcon ?? Megaphone;

  const safeMessages = messages && messages.length > 0 ? messages : [];

  if (isMobile) {
    return (
      <div
        className="flex-1 min-w-0 overflow-hidden"
        data-testid="typewriter-announcement"
      >
        <Marquee speed={50} pauseOnHover={false} autoFill={true} gradient={false}>
          {safeMessages.map((msg, i) => {
            const msgIconName = msg.icon || icon;
            const MsgIcon = msgIconName ? (getIcon(msgIconName) ?? Megaphone) : Megaphone;
            return (
              <span key={i} className="inline-flex items-center gap-1.5 mx-4 whitespace-nowrap">
                <MsgIcon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground text-sm">{msg.text}</span>
                {msg.cta_label && (
                  <span className="text-primary text-sm">{msg.cta_label}</span>
                )}
              </span>
            );
          })}
        </Marquee>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-center gap-2 min-w-0"
      data-testid="typewriter-announcement"
    >
      <div className="inline-flex items-center w-min gap-1">
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
