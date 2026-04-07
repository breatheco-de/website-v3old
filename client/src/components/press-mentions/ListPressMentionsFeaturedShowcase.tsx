import { useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ListPressMentionsSection } from "@shared/schema";
import { UniversalImage } from "@/components/UniversalImage";
import { DotsIndicator } from "@/components/DotsIndicator";

type PressMentionItem = NonNullable<ListPressMentionsSection["items"]>[number];

interface ListPressMentionsFeaturedShowcaseProps {
  data: ListPressMentionsSection;
}

function useCardsPerPage(): number {
  const getCardsPerPage = () => {
    if (typeof window === "undefined") return 3;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  };

  const [cardsPerPage, setCardsPerPage] = useState(getCardsPerPage);

  useEffect(() => {
    const handleResize = () => setCardsPerPage(getCardsPerPage());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return cardsPerPage;
}

export function ListPressMentionsFeaturedShowcase({ data }: ListPressMentionsFeaturedShowcaseProps) {
  const items = data.items || [];
  const showLinks = data.show_links ?? false;
  const showLogos = data.show_logos ?? true;
  const footerStats = data.footer_stats || [];
  const footerText = data.footer_text;

  const featured = items[0];
  const allCards = items.slice(1);

  const cardsPerPage = useCardsPerPage();

  const pageGroups: PressMentionItem[][] = [];
  for (let i = 0; i < allCards.length; i += cardsPerPage) {
    pageGroups.push(allCards.slice(i, i + cardsPerPage));
  }
  const totalPages = pageGroups.length;

  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (totalPages > 0 && currentPage >= totalPages) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

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
      className="py-16"
      style={bgStyle}
      data-testid="section-press-mentions-showcase"
    >
      <div className="flex flex-col gap-8">

        {/* Header */}
        {(data.title || data.subtitle) && (
          <div className="text-center flex flex-col gap-3">
            {data.title && (
              <h2
                className="text-3xl md:text-4xl font-bold text-foreground leading-tight whitespace-pre-line"
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

        {/* Featured Card */}
        {featured && (
          <div
            className="bg-primary rounded-[0.8rem] p-6 md:p-8 flex flex-col md:flex-row gap-3 md:gap-4 md:items-center"
            data-testid="card-press-featured"
          >
            {/* Star + year — row on mobile, column on md+ */}
            <div className="flex-shrink-0 flex flex-row md:flex-col items-center gap-2 md:w-16">
              <div
                className="p-3 rounded-full"
                style={{ backgroundColor: "hsl(var(--accent) / 0.4)" }}
              >
                <Star className="w-6 h-6" style={{ color: "hsl(var(--accent))" }} fill="currentColor" />
              </div>
              {featured.year && (
                <span className="text-sm font-bold text-white" data-testid="text-press-featured-year">
                  {featured.year}
                </span>
              )}
            </div>

            {/* Center: org label + title */}
            <div className="flex-1 min-w-0 min-w-[370px] lg:min-w-[650px] xl:min-w-[720px]">
              {featured.organization && (
                <p
                  className="text-xs font-medium uppercase tracking-wide text-white/70 mb-1.5"
                  data-testid="text-press-featured-org"
                >
                  {featured.organization}
                </p>
              )}
              {featured.title && (
                <h3
                  className="text-xl font-extrabold text-white leading-snug  max-w-[720px]"
                  data-testid="text-press-featured-title"
                >
                  {featured.title}
                </h3>
              )}
            </div>

            {/* Right: logo + link + tags */}
            <div className="flex flex-col items-start md:items-center justify-center md:shrink-0 gap-1 flex-1">
              {showLogos && featured.logo && (
                <div className="h-9" data-testid="img-press-featured-logo">
                  <UniversalImage
                    id={featured.logo}
                    alt={featured.organization || featured.title || ""}
                    className="h-full w-auto object-contain"
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
                <div className={`grid grid-cols-2 w-full ${featured.logo ? "gap-2" : "gap-6"}`}>
                  {featured.tags.slice(0, 4).map((tag, i) => (
                    <span
                      key={i}
                      className="bg-background text-center text-foreground text-xs px-3 py-0.5 rounded-full font-medium whitespace-nowrap m"
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

        {/* Carousel */}
        {allCards.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentPage * 100}%)` }}
              >
                {pageGroups.map((group, pageIdx) => (
                  <div key={pageIdx} className="flex gap-4 w-full flex-shrink-0">
                    {group.map((card, i) => {
                      const globalIndex = pageIdx * cardsPerPage + i + 1;
                      return (
                        <ShowcaseCard
                          key={globalIndex}
                          item={card}
                          index={globalIndex}
                          showLinks={showLinks}
                          showLogos={showLogos}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Nav dots — hidden when only 1 page */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted text-foreground"
                  onClick={() => setCurrentPage((p) => (p - 1 + totalPages) % totalPages)}
                  data-testid="button-press-carousel-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <DotsIndicator
                  count={totalPages}
                  activeIndex={currentPage}
                  onDotClick={setCurrentPage}
                />
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-full text-foreground"
                  onClick={() => setCurrentPage((p) => (p + 1) % totalPages)}
                  data-testid="button-press-carousel-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer stats */}
        {(footerStats.length > 0 || footerText) && (
          <div
            className="flex flex-col sm:flex-row items-center gap-6 items-start sm:items-center pt-2"
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
  item: PressMentionItem;
  index: number;
  showLinks: boolean;
  showLogos: boolean;
}

function ShowcaseCard({ item, index, showLinks, showLogos }: ShowcaseCardProps) {
  return (
    <div
      className="flex-1 bg-card border border-border rounded-[0.8rem] p-5 flex flex-col gap-2"
      data-testid={`card-press-showcase-${index}`}
    >
      {/* Header: category badge + logo */}
      <div className="flex items-center gap-2">
        {item.organization && (
          <span
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            data-testid={`text-press-card-org-${index}`}
          >
            {item.organization}
          </span>
        )}
        {item.category && (
          <Badge className="w-fit text-xs rounded-full bg-primary/20 text-foreground border-transparent">
            {item.category}
          </Badge>
        )}
        {showLogos && item.logo && (
          <div className="w-24 h-12 shrink-0 flex items-center justify-end" data-testid={`img-press-card-logo-${index}`}>
            <UniversalImage
              id={item.logo}
              alt={item.organization || item.title || ""}
              className="max-w-full h-full object-contain rounded-md bg-white p-1"
              fieldContext={{ arrayPath: "items", index, srcField: "logo" }}
            />
          </div>
        )}
      </div>

      {/* Org (context label) + title (headline) — separate lines */}
      <div className="flex flex-col gap-0.5">
        {item.title && (
          <span
            className="text-lg font-bold text-foreground leading-snug"
            data-testid={`text-press-card-title-${index}`}
          >
            {item.title}
          </span>
        )}
      </div>

      {/* Excerpt */}
      {item.excerpt && (
        <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-2">
          {item.excerpt}
        </p>
      )}

      {/* Bottom stats + tags + link */}
      <div className="mt-auto flex flex-col gap-2">
        {(item.stat_value || item.stat_label) && (
          <Badge
            className="bg-primary/10 text-foreground rounded-full hover:bg-primary/10 text-sm font-semibold px-3 py-1 w-fit"
            data-testid={`badge-press-stat-${index}`}
            style={{ backgroundColor: "hsl(var(--accent) / 0.7)" }}
          >
            {item.stat_value && <span data-testid={`text-press-stat-value-${index}`}>{item.stat_value}</span>}
            {item.stat_value && item.stat_label && <span className="mx-1 font-normal opacity-70">·</span>}
            {item.stat_label && <span className="font-normal opacity-80">{item.stat_label}</span>}
          </Badge>
        )}
        {item.tags && item.tags.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid={`tags-press-card-${index}`}>
            {item.tags.slice(0, 3).map((tag, t) => (
              <span key={t}>
                {t > 0 && <span className="mx-1">·</span>}
                <span data-testid={`tag-press-card-${index}-${t}`}>{tag}</span>
              </span>
            ))}
          </p>
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
