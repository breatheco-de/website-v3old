import type { ListPressMentionsSection } from "@shared/schema";
import { UniversalImage } from "@/components/UniversalImage";

interface PressMentionsProps {
  data: ListPressMentionsSection;
}

export function PressMentions({ data }: PressMentionsProps) {
  const items = data.items || [];
  const title = data.title;
  const subtitle = data.subtitle;
  const defaultBoxColor = data.default_box_color || "hsl(var(--muted))";
  const defaultTitleColor = data.default_title_color;
  const defaultExcerptColor = data.default_excerpt_color;
  const defaultLinkColor = data.default_link_color;
  const defaultLogoHeight = data.default_logo_height;
  const columns = data.columns || 3;
  const background = data.background;

  if (items.length === 0) return null;

  const bgStyle: React.CSSProperties = {};
  if (background) {
    if (background.startsWith("linear-gradient") || background.startsWith("radial-gradient")) {
      bgStyle.backgroundImage = background;
    } else {
      bgStyle.backgroundColor = background;
    }
  }

  return (
    <section
      className="py-12 md:py-16"
      style={bgStyle}
      data-testid="section-press-mentions"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title && (
              <h2
                className="text-h2 mb-3 text-foreground"
                style={data.title_color ? { color: data.title_color } : undefined}
                data-testid="text-press-mentions-title"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className="text-body text-muted-foreground max-w-2xl mx-auto"
                style={data.subtitle_color ? { color: data.subtitle_color } : undefined}
                data-testid="text-press-mentions-subtitle"
              >
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div
          className="gap-4 md:gap-5"
          style={{
            columnCount: 1,
            columnGap: "1.25rem",
          }}
          data-testid="press-mentions-container"
        >
          <style>{`
            @media (min-width: 768px) {
              [data-testid="press-mentions-container"] {
                column-count: ${Math.min(columns, 2)} !important;
              }
            }
            @media (min-width: 1024px) {
              [data-testid="press-mentions-container"] {
                column-count: ${columns} !important;
              }
            }
          `}</style>
          {items.map((item, index) => (
            <PressMentionCard
              key={index}
              item={item}
              defaultBoxColor={defaultBoxColor}
              defaultTitleColor={defaultTitleColor}
              defaultExcerptColor={defaultExcerptColor}
              defaultLinkColor={defaultLinkColor}
              defaultLogoHeight={defaultLogoHeight}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface PressMentionCardProps {
  item: NonNullable<PressMentionsSectionType["items"]>[number];
  defaultBoxColor: string;
  defaultTitleColor?: string;
  defaultExcerptColor?: string;
  defaultLinkColor?: string;
  defaultLogoHeight?: number;
  index: number;
}

function PressMentionCard({
  item,
  defaultBoxColor,
  defaultTitleColor,
  defaultExcerptColor,
  defaultLinkColor,
  defaultLogoHeight,
  index,
}: PressMentionCardProps) {
  const boxColor = item.box_color || defaultBoxColor;
  const titleColor = item.title_color || defaultTitleColor;
  const excerptColor = item.excerpt_color || defaultExcerptColor;
  const linkColor = item.link_color || defaultLinkColor || "hsl(var(--primary))";

  return (
    <div
      className="break-inside-avoid mb-4 md:mb-5 rounded-[0.8rem] overflow-hidden"
      style={{ backgroundColor: boxColor }}
      data-testid={`card-press-mention-${index}`}
    >
      <div className="p-5 md:p-6 flex flex-col gap-4">
        {item.logo && (
          <div
            className={`flex items-start ${!(item.logo_height || defaultLogoHeight) ? "h-6 md:h-7" : ""}`}
            style={(item.logo_height || defaultLogoHeight) ? { height: `${item.logo_height || defaultLogoHeight}px` } : undefined}
            data-testid={`img-press-logo-${index}`}
          >
            <UniversalImage
              id={item.logo}
              alt={item.title}
              className="!overflow-visible h-full w-auto max-w-[140px]"
              style={{ objectFit: "contain", objectPosition: "left center" }}
              loading="lazy"
              fieldContext={{ arrayPath: "items", index, srcField: "logo" }}
            />
          </div>
        )}

        <h3
          className="text-lg md:text-xl font-bold text-foreground leading-tight"
          style={titleColor ? { color: titleColor } : undefined}
          data-testid={`text-press-title-${index}`}
        >
          {item.title}
        </h3>

        <p
          className="text-sm text-muted-foreground leading-relaxed"
          style={excerptColor ? { color: excerptColor } : undefined}
          data-testid={`text-press-excerpt-${index}`}
        >
          {item.excerpt}
        </p>

        {item.link_text && item.link_url && (
          <a
            href={item.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold hover:underline"
            style={{ color: linkColor }}
            data-testid={`link-press-article-${index}`}
          >
            {item.link_text}
          </a>
        )}
      </div>
    </div>
  );
}

export default PressMentions;
