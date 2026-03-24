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
        <Icon className="w-6 h-6 text-primary shrink-0" />
        <div className="inline-flex items-center">
          <span className="text-muted-foreground whitespace-nowrap overflow-hidden">
            {displayText}
          </span>
          <span className="bg-primary inline-block w-px h-4 ml-0.5 animate-blink shrink-0" />
        </div>
      </div>
    </div>
  );
}
