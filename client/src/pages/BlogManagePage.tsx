import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  IconDatabase,
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

interface ApiSourceConfig {
  endpoint: string;
  params: Record<string, string | number>;
  token_env_var: string;
  academy_header: string;
}

interface BlogConfig {
  data_source: {
    type: string;
    api?: ApiSourceConfig;
  };
  cache: {
    ttl_hours: number;
    file_path: string;
  };
  url_pattern: Record<string, string>;
  categories: Record<string, string>;
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

function DataSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery<BlogConfig>({
    queryKey: ["/api/blog/config"],
    enabled: open,
  });

  const [sourceType, setSourceType] = useState("api");
  const [endpoint, setEndpoint] = useState("");
  const [paramsCategory, setParamsCategory] = useState("");
  const [paramsStatus, setParamsStatus] = useState("");
  const [paramsVisibility, setParamsVisibility] = useState("");
  const [paramsLimit, setParamsLimit] = useState("500");
  const [tokenEnvVar, setTokenEnvVar] = useState("");
  const [academyHeader, setAcademyHeader] = useState("");
  const [ttlHours, setTtlHours] = useState("24");

  useEffect(() => {
    if (config) {
      setSourceType(config.data_source?.type || "api");
      if (config.data_source?.api) {
        const api = config.data_source.api;
        setEndpoint(api.endpoint || "");
        setParamsCategory(String(api.params?.category || ""));
        setParamsStatus(String(api.params?.status || ""));
        setParamsVisibility(String(api.params?.visibility || ""));
        setParamsLimit(String(api.params?.limit || "500"));
        setTokenEnvVar(api.token_env_var || "");
        setAcademyHeader(api.academy_header || "");
      }
      setTtlHours(String(config.cache?.ttl_hours || 24));
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: BlogConfig = {
        data_source: {
          type: sourceType,
          ...(sourceType === "api" && {
            api: {
              endpoint,
              params: {
                limit: Number(paramsLimit) || 500,
                offset: 0,
                category: paramsCategory,
                status: paramsStatus,
                visibility: paramsVisibility,
              },
              token_env_var: tokenEnvVar,
              academy_header: academyHeader,
            },
          }),
        },
        cache: {
          ttl_hours: Number(ttlHours) || 24,
          file_path: config?.cache?.file_path || ".cache/blog-posts.json",
        },
        url_pattern: config?.url_pattern || { en: "/en/blog/:slug", es: "/es/blog/:slug" },
        categories: config?.categories || { en: "blog-us", es: "blog-es" },
      };

      await apiRequest("PUT", "/api/blog/config", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/blog/config"] });
      toast({ title: "Data source saved" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save data source", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blog Data Source</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Loading configuration...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-type">Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger id="source-type" data-testid="select-source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">REST API</SelectItem>
                  <SelectItem value="rss" disabled>RSS Feed (coming soon)</SelectItem>
                  <SelectItem value="csv" disabled>CSV File (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === "api" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="api-endpoint">API Endpoint</Label>
                  <Input
                    id="api-endpoint"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://api.example.com/posts"
                    data-testid="input-api-endpoint"
                  />
                  <p className="text-xs text-muted-foreground">
                    REST endpoint that returns a JSON array or object with a results array
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="params-category">Categories</Label>
                    <Input
                      id="params-category"
                      value={paramsCategory}
                      onChange={(e) => setParamsCategory(e.target.value)}
                      placeholder="blog-es,blog-us"
                      data-testid="input-params-category"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="params-limit">Limit</Label>
                    <Input
                      id="params-limit"
                      type="number"
                      value={paramsLimit}
                      onChange={(e) => setParamsLimit(e.target.value)}
                      placeholder="500"
                      data-testid="input-params-limit"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="params-status">Status Filter</Label>
                    <Input
                      id="params-status"
                      value={paramsStatus}
                      onChange={(e) => setParamsStatus(e.target.value)}
                      placeholder="published"
                      data-testid="input-params-status"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="params-visibility">Visibility Filter</Label>
                    <Input
                      id="params-visibility"
                      value={paramsVisibility}
                      onChange={(e) => setParamsVisibility(e.target.value)}
                      placeholder="public"
                      data-testid="input-params-visibility"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="token-env-var">Auth Token Env Var</Label>
                    <Input
                      id="token-env-var"
                      value={tokenEnvVar}
                      onChange={(e) => setTokenEnvVar(e.target.value)}
                      placeholder="BREATHECODE_TOKEN"
                      data-testid="input-token-env-var"
                    />
                    <p className="text-xs text-muted-foreground">
                      Name of the environment variable holding the Bearer token
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academy-header">Academy Header</Label>
                    <Input
                      id="academy-header"
                      value={academyHeader}
                      onChange={(e) => setAcademyHeader(e.target.value)}
                      placeholder="4"
                      data-testid="input-academy-header"
                    />
                    <p className="text-xs text-muted-foreground">
                      Value for the custom Academy HTTP header
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="cache-ttl">Cache TTL (hours)</Label>
                <Input
                  id="cache-ttl"
                  type="number"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(e.target.value)}
                  placeholder="24"
                  className="w-32"
                  data-testid="input-cache-ttl"
                />
                <p className="text-xs text-muted-foreground">
                  How long to keep cached responses before re-fetching from the source
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-datasource">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading} data-testid="button-save-datasource">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BlogManagePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [localeFilter, setLocaleFilter] = useState<string>("all");
  const [clearing, setClearing] = useState(false);
  const [dsDialogOpen, setDsDialogOpen] = useState(false);

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDsDialogOpen(true)}
              data-testid="button-data-source"
            >
              <IconDatabase className="h-4 w-4 mr-1" />
              Data Source
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

      <DataSourceDialog open={dsDialogOpen} onOpenChange={setDsDialogOpen} />
    </div>
  );
}
