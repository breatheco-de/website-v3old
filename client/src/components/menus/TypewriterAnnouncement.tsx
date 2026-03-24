import { Megaphone } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { getIcon } from "@/lib/icons";

export interface TypewriterAnnouncementProps {
  message: string;
  icon?: string;
}

export function TypewriterAnnouncement({ message, icon }: TypewriterAnnouncementProps) {
  const { displayText, isDone } = useTypewriter(message, 40, 700);

  const ResolvedIcon = icon ? getIcon(icon) : null;
  const Icon = ResolvedIcon ?? Megaphone;

  return (
    <div
      className="flex-1 flex items-center justify-center gap-2 min-w-0"
      data-testid="typewriter-announcement"
    >
      <div className="inline-flex w-min gap-1">
        <Icon className="w-6 h-6 text-primary shrink-0" />
        <span className="text-muted-foreground whitespace-nowrap overflow-hidden">
          {displayText}
            <span
              className={`bg-primary inline-block w-px h-4 ml-1 transition-opacity ${
                isDone ? "animate-pulse" : "opacity-100"
              }`}
            />
        </span>

      </div>

    </div>
  );
}
