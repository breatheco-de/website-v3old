import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/queryClient";
import { IconLoader2, IconSearch, IconCalendar, IconUser, IconArrowRight } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useInternalNav } from "@/hooks/useInternalNav";

interface BlogAuthor {
  id: number;
  first_name: string;
  last_name: string;
  profile?: { avatar_url?: string };
}

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  lang: string;
  category: { slug: string };
  description: string;
  preview: string;
  author: BlogAuthor | null;
  published_at: string;
  created_at: string;
  cluster: string | null;
  tags: string[];
}

interface BlogResponse {
  count: number;
  results: BlogPost[];
}

function formatDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getAuthorName(author: BlogAuthor | null): string {
  if (!author) return "4Geeks Academy";
  return `${author.first_name || ""} ${author.last_name || ""}`.trim() || "4Geeks Academy";
}

export default function BlogListingPage() {
  const [location] = useLocation();
  const locale = location.startsWith("/es") ? "es" : "en";
  const handleLinkClick = useInternalNav();
  const [searchQuery, setSearchQuery] = useState("");

  usePageMeta({
    page_title: locale === "es" ? "Blog | 4Geeks Academy" : "Blog | 4Geeks Academy",
    description: locale === "es"
      ? "Lee las últimas noticias, tutoriales y artículos sobre programación, tecnología y educación en 4Geeks Academy."
      : "Read the latest news, tutorials and articles about coding, technology and education at 4Geeks Academy.",
  });

  const { data, isLoading, error } = useQuery<BlogResponse>({
    queryKey: ["/api/blog/posts", locale],
    queryFn: async () => {
      const response = await apiFetch(`/api/blog/posts?locale=${locale}`);
      if (!response.ok) throw new Error("Failed to load blog posts");
      return response.json();
    },
  });

  const filteredPosts = useMemo(() => {
    if (!data?.results) return [];
    if (!searchQuery.trim()) return data.results;
    const query = searchQuery.toLowerCase();
    return data.results.filter(
      (post) =>
        post.title?.toLowerCase().includes(query) ||
        post.description?.toLowerCase().includes(query) ||
        post.cluster?.toLowerCase().includes(query)
    );
  }, [data?.results, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-blog">
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="error-blog">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {locale === "es" ? "Error al cargar el blog" : "Error loading blog"}
          </h1>
          <p className="text-muted-foreground">
            {locale === "es" ? "Intenta de nuevo más tarde." : "Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-blog-listing">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-3" data-testid="text-blog-title">
            Blog
          </h1>
          <p className="text-lg text-muted-foreground mb-6" data-testid="text-blog-subtitle">
            {locale === "es"
              ? "Artículos, tutoriales y noticias sobre programación y tecnología"
              : "Articles, tutorials and news about coding and technology"}
          </p>
          <div className="relative max-w-md">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={locale === "es" ? "Buscar artículos..." : "Search articles..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-blog-search"
            />
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="text-center py-16" data-testid="text-blog-empty">
            <p className="text-muted-foreground text-lg">
              {searchQuery
                ? locale === "es"
                  ? "No se encontraron artículos."
                  : "No articles found."
                : locale === "es"
                  ? "No hay artículos disponibles."
                  : "No articles available."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-blog-posts">
            {filteredPosts.map((post) => (
              <a
                key={post.id}
                href={`/${locale}/blog/${post.slug}`}
                onClick={handleLinkClick}
                className="block group"
                data-testid={`link-blog-post-${post.slug}`}
              >
                <Card className="h-full overflow-hidden hover-elevate transition-all">
                  {post.preview && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={post.preview}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        data-testid={`img-blog-post-${post.slug}`}
                      />
                    </div>
                  )}
                  <div className="p-5">
                    {post.cluster && (
                      <Badge variant="secondary" className="mb-3" data-testid={`badge-cluster-${post.slug}`}>
                        {post.cluster}
                      </Badge>
                    )}
                    <h2
                      className="text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                      data-testid={`text-blog-post-title-${post.slug}`}
                    >
                      {post.title}
                    </h2>
                    <p
                      className="text-sm text-muted-foreground mb-4 line-clamp-3"
                      data-testid={`text-blog-post-desc-${post.slug}`}
                    >
                      {post.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <IconUser className="w-3 h-3" />
                        {getAuthorName(post.author)}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconCalendar className="w-3 h-3" />
                        {formatDate(post.published_at || post.created_at, locale)}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-sm text-primary font-medium">
                      {locale === "es" ? "Leer más" : "Read more"}
                      <IconArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
