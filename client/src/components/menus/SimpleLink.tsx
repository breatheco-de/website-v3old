import { ChevronDown } from "lucide-react";

export interface SimpleLinkProps {
  label: string;
  href: string;
}

export function SimpleLink({ label, href }: SimpleLinkProps) {
  return (
    <a
      href={href}
      className="flex items-center gap-1 px-4 py-2 font-medium text-foreground hover-elevate rounded-md transition-all duration-150 ease-out"
      data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </a>
  );
}
