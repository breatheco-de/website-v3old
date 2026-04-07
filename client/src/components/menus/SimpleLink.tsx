export interface SimpleLinkProps {
  label: string;
  href: string;
  subtleAtTop?: boolean;
}

export function SimpleLink({ label, href, subtleAtTop }: SimpleLinkProps) {
  return (
    <a
      href={href}
      className={`flex items-center gap-1 px-4 py-2 font-medium text-foreground hover-elevate rounded-md transition-[font-size,color] duration-300 ease-in-out${subtleAtTop ? " text-xs" : " text-sm"}`}
      data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </a>
  );
}
