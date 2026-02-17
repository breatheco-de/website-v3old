import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconArrowLeft,
  IconSearch,
  IconArticle,
  IconCheck,
  IconClock,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconRefresh,
  IconWorld,
} from "@tabler/icons-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  lang: string;
  category: { slug: string };
  status: string;
  visibility: string;
  description: string;
  preview: string;
  author: { id: number; first_name: string; last_name: string; profile?: { avatar_url?: string } } | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  cluster: string | null;
  tags: string[];
}

interface BlogResponse {
  count: number;
  results: BlogPost[];
}

interface CacheStatus {
  exists: boolean;
  age_hours: number | null;
  post_count: number | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() || "unknown";
  if (normalized === "published") {
    return <Badge variant="default" data-testid="badge-status-published"><IconCheck className="h-3 w-3 mr-1" />Published</Badge>;
  }
  if (normalized === "draft") {
    return <Badge variant="secondary" data-testid="badge-status-draft"><IconClock className="h-3 w-3 mr-1" />Draft</Badge>;
  }
  return <Badge variant="outline" data-testid={`badge-status-${normalized}`}>{status}</Badge>;
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility?.toLowerCase() === "public") {
    return <IconEye className="h-4 w-4 text-muted-foreground" />;
  }
  return <IconEyeOff className="h-4 w-4 text-muted-foreground" />;
}

export default function BlogManagePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [localeFilter, setLocaleFilter] = useState<string>("all");
  const [clearing, setClearing] = useState(false);

  const { data: allPostsData, isLoading: allLoading } = useQuery<BlogResponse>({
    queryKey: ["/api/blog/posts"],
    staleTime: 60000,
  });

  const { data: cacheStatus } = useQuery<CacheStatus>({
    queryKey: ["/api/blog/cache-status"],
    staleTime: 30000,
  });

  const posts = allPostsData?.results || [];

  const kpis = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status?.toLowerCase() === "published").length;
    const draft = posts.filter((p) => p.status?.toLowerCase() === "draft").length;
    const other = total - published - draft;
    const enPosts = posts.filter((p) => p.lang === "us" || p.category?.slug === "blog-en");
    const esPosts = posts.filter((p) => p.lang === "es" || p.category?.slug === "blog-es");
    const publicPosts = posts.filter((p) => p.visibility?.toLowerCase() === "public").length;
    const privatePosts = total - publicPosts;

    return { total, published, draft, other, en: enPosts.length, es: esPosts.length, publicPosts, privatePosts };
  }, [posts]);

  const filtered = useMemo(() => {
    let result = posts;

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status?.toLowerCase() === statusFilter);
    }

    if (localeFilter !== "all") {
      if (localeFilter === "en") {
        result = result.filter((p) => p.lang === "us" || p.category?.slug === "blog-en");
      } else if (localeFilter === "es") {
        result = result.filter((p) => p.lang === "es" || p.category?.slug === "blog-es");
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          (p.author?.first_name + " " + p.author?.last_name).toLowerCase().includes(q)
      );
    }

    return result;
  }, [posts, statusFilter, localeFilter, search]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await apiRequest("POST", "/api/debug/clear-blog-cache");
      toast({ title: "Blog cache cleared", description: "Refreshing posts..." });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/cache-status"] });
    } catch {
      toast({ title: "Failed to clear cache", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const statuses = useMemo(() => {
    const set = new Set(posts.map((p) => p.status?.toLowerCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [posts]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/" className="inline-flex">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Blog Management</h1>
            <p className="text-sm text-muted-foreground">
              Overview of all blog articles and cache status
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cacheStatus?.exists && (
              <span className="text-xs text-muted-foreground" data-testid="text-cache-age">
                Cache: {cacheStatus.age_hours != null ? `${cacheStatus.age_hours}h old` : "—"}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              data-testid="button-clear-cache"
            >
              <IconRefresh className={`h-4 w-4 mr-1 ${clearing ? "animate-spin" : ""}`} />
              Refresh Cache
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-kpi-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Articles</CardTitle>
              <IconArticle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-total">{allLoading ? "..." : kpis.total}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-published">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
              <IconCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-published">{allLoading ? "..." : kpis.published}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-draft">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
              <IconClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-kpi-draft">{allLoading ? "..." : kpis.draft}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-kpi-locale">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By Language</CardTitle>
              <IconWorld className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div data-testid="text-kpi-en">
                  <span className="text-2xl font-bold">{allLoading ? "..." : kpis.en}</span>
                  <span className="text-xs text-muted-foreground ml-1">EN</span>
                </div>
                <div className="h-6 w-px bg-border" />
                <div data-testid="text-kpi-es">
                  <span className="text-2xl font-bold">{allLoading ? "..." : kpis.es}</span>
                  <span className="text-xs text-muted-foreground ml-1">ES</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles by title, slug, or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localeFilter} onValueChange={setLocaleFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-locale-filter">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {allLoading ? (
              <div className="flex items-center justify-center py-12" data-testid="loading-posts">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                <span className="ml-2 text-sm text-muted-foreground">Loading articles...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
                No articles found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-articles">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Author</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Lang</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Published</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((post) => {
                      const locale = (post.lang === "es" || post.category?.slug === "blog-es") ? "es" : "en";
                      const blogUrl = `/${locale}/blog/${post.slug}`;
                      return (
                        <tr
                          key={post.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          data-testid={`row-article-${post.id}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {post.preview && (
                                <img
                                  src={post.preview}
                                  alt=""
                                  className="w-10 h-10 rounded-md object-cover flex-shrink-0 hidden sm:block"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[300px]" title={post.title} data-testid={`text-title-${post.id}`}>
                                  {post.title || post.slug}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {post.slug}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {post.author ? `${post.author.first_name || ""} ${post.author.last_name || ""}`.trim() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={post.status} />
                              <VisibilityIcon visibility={post.visibility} />
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge variant="outline">{locale.toUpperCase()}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {formatDate(post.published_at)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {formatDate(post.updated_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a href={blogUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-view-${post.id}`}>
                              <Button variant="ghost" size="icon">
                                <IconExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!allLoading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t text-xs text-muted-foreground" data-testid="text-showing-count">
                Showing {filtered.length} of {posts.length} articles
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
