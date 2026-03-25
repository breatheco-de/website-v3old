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
  const { displayText, ctaLabel, ctaUrl } = useTypewriter(messages, charDelay, startDelay, displayTime);
  const handleLinkClick = useInternalNav();

  const ResolvedIcon = icon ? getIcon(icon) : null;
  const Icon = ResolvedIcon ?? Megaphone;

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
