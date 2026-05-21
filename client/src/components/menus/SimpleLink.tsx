import { InternalLink } from "@/components/InternalLink";

export interface SimpleLinkProps {
  label: string;
  href: string;
}

export function SimpleLink({ label, href }: SimpleLinkProps) {
  return (
    <InternalLink
      href={href}
      className="flex items-center gap-1 px-2 py-2 lg:px-4 font-medium text-foreground hover-elevate rounded-md transition-all duration-150 ease-out"
      data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </InternalLink>
  );
}
