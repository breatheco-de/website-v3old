import { useState, useMemo, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { IconSearch, IconCalendar, IconUser, IconArrowRight, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInternalNav } from "@/hooks/useInternalNav";

interface ListingItem {
  image?: string;
  title?: string;
  description?: string;
  badge?: string;
  url?: string;
  meta_left?: string;
  meta_right?: string;
  cta_text?: string;
}

interface ListingCardsData {
  type: string;
  title?: string;
  sub_heading?: string;
  items?: ListingItem[];
  layout?: {
    columns?: number;
  };
  search?: {
    enabled?: boolean;
    placeholder?: string;
  };
  category_filter?: {
    enabled?: boolean;
    all_label?: string;
  };
  pagination?: {
    page_size?: number;
    page_label?: string;
    of_label?: string;
    items_label?: string;
    empty_text?: string;
  };
  dynamic_entries?: Record<string, unknown>;
  columns?: number;
  show_search?: boolean;
  show_category_filter?: boolean;
  page_size?: number;
  search_placeholder?: string;
  all_label?: string;
  empty_text?: string;
  page_label?: string;
  of_label?: string;
  page_info_template?: string;
  items_label?: string;
  _dynamic_meta?: {
    content_type?: string;
    total?: number;
    locale?: string;
  };
}

function formatCategoryLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatAuthor(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const author = value as Record<string, unknown>;
    const name = `${author.first_name || ""} ${author.last_name || ""}`.trim();
    return name || String(author.name || "");
  }
  return String(value);
}

export default function ListingCards({ data }: { data: ListingCardsData }) {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const handleLinkClick = useInternalNav();

  const items = data.items || [];
  const columns = data.layout?.columns ?? data.columns ?? 3;
  const perPage = data.pagination?.page_size ?? data.page_size ?? 0;
  const showSearch = data.search?.enabled ?? data.show_search ?? false;
  const searchPlaceholder = data.search?.placeholder ?? data.search_placeholder ?? "Search...";
  const showCategoryFilter = data.category_filter?.enabled ?? data.show_category_filter ?? false;
  const allLabel = data.category_filter?.all_label ?? data.all_label ?? "All";
  const emptyText = data.pagination?.empty_text ?? data.empty_text ?? "No items found.";
  const pageLabel = data.pagination?.page_label ?? data.page_label ?? "Page";
  const ofLabel = data.pagination?.of_label ?? data.of_label ?? "of";
  const itemsLabel = data.pagination?.items_label ?? data.items_label ?? "items";

  const params = new URLSearchParams(searchString);
  const currentPage = Math.max(1, parseInt(params.get("page") || "1", 10));
  const activeCategory = params.get("category") || "";
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => {
    if (!showCategoryFilter) return [];
    const cats = new Set<string>();
    for (const item of items) {
      const badge = typeof item.badge === "string" ? item.badge :
        (item.badge && typeof item.badge === "object" && "slug" in (item.badge as any))
          ? (item.badge as any).slug : "";
      if (badge) cats.add(badge);
    }
    return Array.from(cats).sort();
  }, [items, showCategoryFilter]);

  const filteredByCategory = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter(item => {
      const badge = typeof item.badge === "string" ? item.badge :
        (item.badge && typeof item.badge === "object" && "slug" in (item.badge as any))
          ? (item.badge as any).slug : "";
      return badge === activeCategory;
    });
  }, [items, activeCategory]);

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return filteredByCategory;
    const query = searchQuery.toLowerCase();
    return filteredByCategory.filter(item =>
      (item.title || "").toLowerCase().includes(query) ||
      (item.description || "").toLowerCase().includes(query) ||
      (typeof item.badge === "string" ? item.badge : "").toLowerCase().includes(query)
    );
  }, [filteredByCategory, searchQuery]);

  const totalItems = filteredBySearch.length;
  const totalPages = perPage > 0 ? Math.ceil(totalItems / perPage) : 1;
  const paginatedItems = perPage > 0
    ? filteredBySearch.slice((currentPage - 1) * perPage, currentPage * perPage)
    : filteredBySearch;

  const buildPageUrl = useCallback(
    (page: number, category?: string) => {
      const p = new URLSearchParams();
      if (page > 1) p.set("page", String(page));
      if (category) p.set("category", category);
      const qs = p.toString();
      return `${location.split("?")[0]}${qs ? `?${qs}` : ""}`;
    },
    [location]
  );

  const handleCategoryClick = (cat: string) => {
    const next = activeCategory === cat ? "" : cat;
    setLocation(buildPageUrl(1, next || undefined));
  };

  const handlePageChange = (page: number) => {
    setLocation(buildPageUrl(page, activeCategory || undefined));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const gridCols =
    columns === 1 ? "grid-cols-1"
    : columns === 2 ? "grid-cols-1 md:grid-cols-2"
    : columns === 4 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  const getBadgeText = (badge: unknown): string => {
    if (typeof badge === "string") return badge;
    if (badge && typeof badge === "object" && "slug" in (badge as any)) return (badge as any).slug;
    return "";
  };

  return (
    <div data-testid="section-listing-cards">
      {(data.title || showSearch || categories.length > 0) && (
        <div className="mb-10">
          {data.title && (
            <h2 className="text-4xl font-bold text-foreground mb-3" data-testid="text-listing-title">
              {data.title}
            </h2>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 flex-wrap">
            {data.sub_heading && (
              <p className="text-lg text-muted-foreground" data-testid="text-listing-subtitle">
                {data.sub_heading}
              </p>
            )}

            {showSearch && (
              <div className="relative max-w-md md:w-72 shrink-0">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-listing-search"
                />
              </div>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="section-category-cloud">
              <Badge
                variant={activeCategory === "" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleCategoryClick("")}
                data-testid="chip-category-all"
              >
                {allLabel}
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleCategoryClick(cat)}
                  data-testid={`chip-category-${cat}`}
                >
                  {formatCategoryLabel(cat)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {paginatedItems.length === 0 ? (
        <div className="text-center py-16" data-testid="text-listing-empty">
          <p className="text-muted-foreground text-lg">
            {emptyText}
          </p>
        </div>
      ) : (
        <>
          <div className={`grid ${gridCols} gap-6`} data-testid="grid-listing-cards">
            {paginatedItems.map((item, index) => {
              const badgeText = getBadgeText(item.badge);
              const metaLeft = formatAuthor(item.meta_left);
              const metaRight = item.meta_right ? formatDate(String(item.meta_right)) : "";
              const content = (
                <Card className="h-full overflow-visible hover-elevate transition-all">
                  {item.image && (
                    <div className="aspect-video w-full overflow-hidden rounded-t-md">
                      <img
                        src={String(item.image)}
                        alt={String(item.title || "")}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        data-testid={`img-listing-card-${index}`}
                      />
                    </div>
                  )}
                  <div className="p-5">
                    {badgeText && (
                      <Badge variant="secondary" className="mb-3" data-testid={`badge-listing-${index}`}>
                        {formatCategoryLabel(badgeText)}
                      </Badge>
                    )}
                    {item.title && (
                      <h3
                        className="text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                        data-testid={`text-listing-title-${index}`}
                      >
                        {String(item.title)}
                      </h3>
                    )}
                    {item.description && (
                      <p
                        className="text-sm text-muted-foreground mb-4 line-clamp-3"
                        data-testid={`text-listing-desc-${index}`}
                      >
                        {String(item.description)}
                      </p>
                    )}
                    {(metaLeft || metaRight) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {metaLeft && (
                          <span className="flex items-center gap-1">
                            <IconUser className="w-3 h-3" />
                            {metaLeft}
                          </span>
                        )}
                        {metaRight && (
                          <span className="flex items-center gap-1">
                            <IconCalendar className="w-3 h-3" />
                            {metaRight}
                          </span>
                        )}
                      </div>
                    )}
                    {item.cta_text && (
                      <div className="mt-4 flex items-center gap-1 text-sm text-primary font-medium">
                        {String(item.cta_text)}
                        <IconArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </Card>
              );

              if (item.url) {
                return (
                  <a
                    key={index}
                    href={String(item.url)}
                    onClick={handleLinkClick}
                    className="block group"
                    data-testid={`link-listing-card-${index}`}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <div key={index} data-testid={`card-listing-${index}`}>
                  {content}
                </div>
              );
            })}
          </div>

          {perPage > 0 && totalPages > 1 && (
            <>
              <nav className="flex items-center justify-center gap-1 mt-10" aria-label="Pagination" data-testid="nav-pagination">
                <a
                  href={currentPage > 1 ? buildPageUrl(currentPage - 1, activeCategory || undefined) : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) handlePageChange(currentPage - 1);
                  }}
                  aria-disabled={currentPage <= 1}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage <= 1}
                    data-testid="button-page-prev"
                  >
                    <IconChevronLeft className="w-4 h-4" />
                  </Button>
                </a>
                {pageNumbers.map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground select-none">
                      ...
                    </span>
                  ) : (
                    <a
                      key={p}
                      href={buildPageUrl(p as number, activeCategory || undefined)}
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(p as number);
                      }}
                    >
                      <Button
                        variant={p === currentPage ? "default" : "outline"}
                        size="icon"
                        data-testid={`button-page-${p}`}
                      >
                        {p}
                      </Button>
                    </a>
                  )
                )}
                <a
                  href={currentPage < totalPages ? buildPageUrl(currentPage + 1, activeCategory || undefined) : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) handlePageChange(currentPage + 1);
                  }}
                  aria-disabled={currentPage >= totalPages}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    data-testid="button-page-next"
                  >
                    <IconChevronRight className="w-4 h-4" />
                  </Button>
                </a>
              </nav>
              <div className="text-center mt-4 text-sm text-muted-foreground" data-testid="text-page-info">
                {data.page_info_template
                  ? data.page_info_template
                      .replace("{page}", String(currentPage))
                      .replace("{totalPages}", String(totalPages))
                      .replace("{total}", String(totalItems))
                  : <>{pageLabel} {currentPage} {ofLabel} {totalPages} · {totalItems} {itemsLabel}</>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
