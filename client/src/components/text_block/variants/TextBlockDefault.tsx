import type { TextBlockSection } from "@shared/schema";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { cn } from "@/lib/utils";

interface TextBlockProps {
  data: TextBlockSection;
}

const alignmentClasses: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const maxWidthClasses: Record<string, string> = {
  narrow: "max-w-xl",
  default: "max-w-3xl",
  wide: "max-w-5xl",
};

export function TextBlockDefault({ data }: TextBlockProps) {
  const { eyebrow, heading, body, alignment = "left", max_width = "default" } = data;

  const alignClass = alignmentClasses[alignment] ?? alignmentClasses.left;
  const maxWidthClass = maxWidthClasses[max_width] ?? maxWidthClasses.default;
  const centerBlock = alignment === "center" ? "mx-auto" : alignment === "right" ? "ml-auto" : "";

  return (
    <section
      className="py-12 md:py-16"
      data-testid="section-text-block"
    >
      <div className={cn("px-4 w-full", maxWidthClass, centerBlock, alignClass)}>
        {eyebrow && (
          <p
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3"
            data-testid="text-text-block-eyebrow"
          >
            {eyebrow}
          </p>
        )}

        {heading && (
          <h2
            className="text-3xl md:text-4xl font-bold text-foreground mb-6"
            data-testid="text-text-block-heading"
          >
            {heading}
          </h2>
        )}

        <RichTextContent
          html={body}
          className={cn("text-foreground/80", alignClass)}
          data-testid="text-text-block-body"
        />
      </div>
    </section>
  );
}

export default TextBlockDefault;
