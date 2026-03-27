import { Star, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ListPressMentionsSection } from "@shared/schema";
import { UniversalImage } from "@/components/UniversalImage";

interface ListPressMentionsFeaturedShowcaseProps {
  data: ListPressMentionsSection;
}

export function ListPressMentionsFeaturedShowcase({ data }: ListPressMentionsFeaturedShowcaseProps) {
  const items = data.items || [];
  const showLinks = data.show_links ?? false;
  const showLogos = data.show_logos ?? true;
  const featuredBg = data.featured_background || "hsl(var(--primary))";
  const cardsBg = data.cards_background;
  const footerStats = data.footer_stats || [];
  const footerText = data.footer_text;

  const featured = items[0];
  const cards = items.slice(1, 4);
  const hasContent = featured || cards.length > 0;

  if (!hasContent) return null;

  const bgStyle: React.CSSProperties = {};
  if (data.background) {
    if (data.background.startsWith("linear-gradient") || data.background.startsWith("radial-gradient")) {
      bgStyle.backgroundImage = data.background;
    } else {
      bgStyle.backgroundColor = data.background;
    }
  }

  return (
    <section
      className="py-12 md:py-16"
      style={bgStyle}
      data-testid="section-press-mentions-showcase"
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col gap-8">

        {/* Header */}
        {(data.title || data.subtitle) && (
          <div className="text-center flex flex-col gap-3">
            {data.title && (
              <h2
                className="text-3xl md:text-4xl font-bold text-foreground leading-tight"
                style={data.title_color ? { color: data.title_color } : undefined}
                data-testid="text-press-showcase-title"
              >
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <p
                className="text-base text-muted-foreground max-w-2xl mx-auto"
                style={data.subtitle_color ? { color: data.subtitle_color } : undefined}
                data-testid="text-press-showcase-subtitle"
              >
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        {/* Featured card */}
        {featured && (
          <div
            className="rounded-[0.8rem] p-6 md:p-8 flex flex-row gap-6 items-center"
            style={{ backgroundColor: featuredBg }}
            data-testid="card-press-featured"
          >
            {/* Left: star + year */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2 w-16">
              <div className="bg-yellow-400/20 p-3 rounded-full">
                <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
              </div>
              {featured.year && (
                <span className="text-sm font-bold text-white" data-testid="text-press-featured-year">
                  {featured.year}
                </span>
              )}
            </div>

            {/* Center: title */}
            <div className="w-[560px] flex-shrink-0">
              {featured.title && (
                <h3
                  className="text-xl font-bold text-white leading-snug"
                  data-testid="text-press-featured-title"
                >
                  {featured.title}
                </h3>
              )}
            </div>

            {/* Right: logo + link + tags */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              {showLogos && featured.logo && (
                <div className="h-10 max-w-[120px]" data-testid="img-press-featured-logo">
                  <UniversalImage
                    id={featured.logo}
                    alt={featured.organization || featured.title}
                    className="h-full w-auto"
                    style={{ objectFit: "contain" }}
                    fieldContext={{ arrayPath: "items", index: 0, srcField: "logo" }}
                  />
                </div>
              )}
              {showLinks && featured.link_url && featured.link_text && (
                <a
                  href={featured.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-medium text-white/90 hover:underline"
                  data-testid="link-press-featured"
                >
                  {featured.link_text}
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
              {featured.tags && featured.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-between w-full">
                  {featured.tags.slice(0, 4).map((tag, i) => (
                    <span
                      key={i}
                      className="bg-white/10 text-white/90 text-xs px-3 py-0.5 rounded-full font-medium whitespace-nowrap border border-white/20"
                      data-testid={`tag-press-featured-${i}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cards row */}
        {cards.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4">
              {cards.map((card, i) => (
                <ShowcaseCard
                  key={i}
                  item={card}
                  index={i + 1}
                  showLinks={showLinks}
                  showLogos={showLogos}
                  cardsBg={cardsBg}
                />
              ))}
            </div>

            {/* Nav */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" data-testid="button-press-carousel-prev">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="w-2 h-2 rounded-full bg-muted" />
              </div>
              <Button variant="outline" size="icon" data-testid="button-press-carousel-next">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {(footerStats.length > 0 || footerText) && (
          <div
            className="flex flex-col sm:flex-row gap-6 items-start sm:items-center border-t border-border pt-6"
            data-testid="section-press-footer"
          >
            {footerStats.length > 0 && (
              <div className="flex gap-8 flex-1">
                {footerStats.map((stat, i) => (
                  <div key={i} className="flex flex-col gap-0.5" data-testid={`stat-press-footer-${i}`}>
                    {stat.value && (
                      <span className="text-3xl font-bold text-primary">
                        {stat.value}
                      </span>
                    )}
                    {stat.label && (
                      <span className="text-sm text-muted-foreground leading-snug max-w-[120px]">
                        {stat.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {footerText && (
              <p className="text-sm text-muted-foreground max-w-xs sm:text-right leading-relaxed">
                {footerText}
              </p>
            )}
          </div>
        )}

      </div>
    </section>
  );
}

interface ShowcaseCardProps {
  item: NonNullable<ListPressMentionsSection["items"]>[number];
  index: number;
  showLinks: boolean;
  showLogos: boolean;
  cardsBg?: string;
}

function ShowcaseCard({ item, index, showLinks, showLogos, cardsBg }: ShowcaseCardProps) {
  const cardStyle: React.CSSProperties = {};
  if (cardsBg) {
    cardStyle.backgroundColor = cardsBg;
  }

  return (
    <div
      className={`flex-1 border border-border rounded-[0.8rem] p-5 flex flex-col gap-1 ${!cardsBg ? "bg-card" : ""}`}
      style={cardStyle}
      data-testid={`card-press-showcase-${index}`}
    >
      {/* Header: category + logo */}
      <div className="flex items-center justify-between gap-2">
        {item.category && (
          <Badge className="w-fit text-xs rounded-full bg-primary/5 text-foreground border-transparent no-default-active-elevate">
            {item.category}
          </Badge>
        )}
        {showLogos && item.logo && (
          <div className="w-24 h-12 shrink-0 flex items-center justify-end" data-testid={`img-press-card-logo-${index}`}>
            <UniversalImage
              id={item.logo}
              alt={item.organization || item.title}
              className="max-w-full h-full"
              style={{ objectFit: "contain" }}
              fieldContext={{ arrayPath: "items", index, srcField: "logo" }}
            />
          </div>
        )}
      </div>

      {/* Org + title */}
      <div>
        {item.organization && (
          <span className="text-xl font-extrabold text-foreground">
            {item.organization}
          </span>
        )}
        {item.title && (
          <span className="text-lg text-foreground/80">
            {item.organization ? " · " : ""}{item.title}
          </span>
        )}
      </div>

      {/* Excerpt */}
      {item.excerpt && (
        <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">
          {item.excerpt}
        </p>
      )}

      {/* Bottom */}
      <div className="mt-auto flex flex-col gap-2">
        {(item.stat_value || item.stat_label) && (
          <div>
            {item.stat_value && (
              <span className="text-3xl font-bold text-primary" data-testid={`text-press-stat-value-${index}`}>
                {item.stat_value}
              </span>
            )}
            {item.stat_label && (
              <span className="text-base text-muted-foreground ml-1.5">
                {item.stat_label}
              </span>
            )}
          </div>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag, t) => (
              <span
                key={t}
                className="bg-muted text-foreground text-[11px] px-2 py-0.5 rounded-full"
                data-testid={`tag-press-card-${index}-${t}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {showLinks && item.link_url && item.link_text && (
          <a
            href={item.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-primary mt-1 hover:underline"
            data-testid={`link-press-card-${index}`}
          >
            {item.link_text}
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
