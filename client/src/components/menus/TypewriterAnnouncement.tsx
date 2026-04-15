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

  const resolvedIconName = msgIcon || icon;
  const ResolvedIcon = resolvedIconName ? getIcon(resolvedIconName) : null;
  const Icon = ResolvedIcon ?? Megaphone;

  const safeMessages = messages && messages.length > 0 ? messages : [];
  const widestDesktopMessage = safeMessages.reduce<MarqueeMessage>(
    (widest, candidate) => {
      const widestLength = (widest.text || "").length + (widest.cta_label || "").length;
      const candidateLength = (candidate.text || "").length + (candidate.cta_label || "").length;
      return candidateLength > widestLength ? candidate : widest;
    },
    safeMessages[0] || { text: "" },
  );

  return (
    <div
      className="flex-1 flex items-center justify-center gap-2 min-w-0 max-w-full overflow-hidden"
      data-testid="typewriter-announcement"
    >
      {/* Mobile: sliding ticker using react-fast-marquee */}
      <div className="lg:hidden flex-1 min-w-0 overflow-hidden">
        <Marquee speed={50} pauseOnHover={false} pauseOnClick={true} autoFill={true} gradient={false}>
          {safeMessages.map((msg, i) => {
            const msgIconName = msg.icon || icon;
            const MsgIcon = msgIconName ? (getIcon(msgIconName) ?? Megaphone) : Megaphone;
            return (
              <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap pe-8">
                <MsgIcon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground text-sm">{msg.text}</span>
                {msg.cta_label && msg.cta_url && (
                  <a
                    href={msg.cta_url}
                    onClick={handleLinkClick}
                    className="text-primary text-sm underline-offset-2 hover:underline"
                    data-testid={`typewriter-cta-link-mobile-${i}`}
                  >
                    {msg.cta_label}
                  </a>
                )}
                {msg.cta_label && !msg.cta_url && (
                  <span className="text-primary text-sm">{msg.cta_label}</span>
                )}
              </span>
            );
          })}
        </Marquee>
      </div>

      {/* Desktop: typewriter — text scrolls to always show the end; cursor stays visible */}
      <div className="hidden lg:inline-flex items-center max-w-full gap-1">
        <div className="relative max-w-full min-w-0 shrink overflow-hidden">
          {/* Reserve the widest message so typed characters don't grow the navbar. */}
          <div
            aria-hidden="true"
            className="invisible inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground leading-[20px]"
          >
            <Icon className="w-5 h-5 text-primary shrink-0 my-1" />
            <span>{widestDesktopMessage.text}</span>
            {widestDesktopMessage.cta_label && (
              <span className="text-primary ml-1">{widestDesktopMessage.cta_label}</span>
            )}
            <span className="inline-block w-px h-4 ml-1 shrink-0" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="inline-flex max-w-full items-center overflow-hidden whitespace-nowrap gap-1 text-muted-foreground leading-[20px]">
              <Icon className="w-5 h-5 text-primary shrink-0 my-1" />
              <span>{displayText}</span>
              {ctaLabel && ctaUrl && (
                <a
                  href={ctaUrl}
                  onClick={handleLinkClick}
                  className="text-primary hover:underline"
                  data-testid="typewriter-cta-link"
                >
                  {ctaLabel}
                </a>
              )}
              {ctaLabel && !ctaUrl && (
                <span className="text-primary">{ctaLabel}</span>
              )}
              <span className="bg-primary inline-block w-px h-4 animate-blink shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
