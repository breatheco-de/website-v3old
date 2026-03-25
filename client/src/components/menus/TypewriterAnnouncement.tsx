import { Megaphone } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { getIcon } from "@/lib/icons";

export interface TypewriterAnnouncementProps {
  message: string;
  icon?: string;
}

export function TypewriterAnnouncement({ message, icon }: TypewriterAnnouncementProps) {
  const { displayText } = useTypewriter(message, 40, 700);

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
        </span>
        <span className="bg-primary inline-block w-px h-4 ml-[0.2px] animate-blink shrink-0" />
      </div>
    </div>
  );
}
