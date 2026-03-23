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
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm text-muted-foreground whitespace-nowrap overflow-hidden">
        {displayText}
        <span
          className={`inline-block w-px h-[14px] ml-0.5 bg-primary align-middle transition-opacity ${
            isDone ? "animate-pulse" : "opacity-100"
          }`}
        />
      </span>
    </div>
  );
}
