import type { FooterSection as FooterSectionType } from "@shared/schema";

interface FooterSectionProps {
  data: FooterSectionType;
}

export function FooterSection({ data }: FooterSectionProps) {
  return (
    <footer 
      className="bg-background border-t"
      data-testid="section-footer"
    >
      <div className="max-w-6xl mx-auto px-4 text-center mt-2">
        <p 
          className="text-sm text-muted-foreground"
          data-testid="text-copyright"
        >
          {data.copyright_text?.replace(/\d{4}/, String(new Date().getFullYear()))}
        </p>
      </div>
    </footer>
  );
}
