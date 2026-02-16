import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiFetch } from "@/lib/queryClient";
import { IconLoader2, IconCalendar, IconUser, IconArrowLeft, IconClock } from "@tabler/icons-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/Header";
import { useInternalNav } from "@/hooks/useInternalNav";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  readme_url: string;
  author: BlogAuthor | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  cluster: string | null;
  tags: string[];
  duration: number;
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

export default function BlogPostPage() {
  const [location] = useLocation();
  const locale = location.startsWith("/es") ? "es" : "en";
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const handleLinkClick = useInternalNav();

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ["/api/blog/posts", slug],
    queryFn: async () => {
      const response = await apiFetch(`/api/blog/posts/${slug}`);
      if (!response.ok) throw new Error("Blog post not found");
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: markdownContent } = useQuery<string>({
    queryKey: ["blog-markdown", post?.readme_url],
    queryFn: async () => {
      if (!post?.readme_url) return "";
      const response = await fetch(post.readme_url);
      if (!response.ok) return "";
      const text = await response.text();
      const frontmatterRegex = /^---[\s\S]*?---\s*/;
      return text.replace(frontmatterRegex, "").trim();
    },
    enabled: !!post?.readme_url,
  });

  usePageMeta(
    post
      ? {
          page_title: `${post.title} | 4Geeks Academy`,
          description: post.description || "",
          og_image: post.preview || undefined,
        }
      : undefined
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-blog-post">
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div data-testid="error-blog-post">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {locale === "es" ? "Artículo no encontrado" : "Article not found"}
            </h1>
            <p className="text-muted-foreground mb-6">
              {locale === "es"
                ? "El artículo que buscas no existe."
                : "The article you're looking for doesn't exist."}
            </p>
            <a
              href={`/${locale}/blog`}
              onClick={handleLinkClick}
              className="text-primary hover:underline flex items-center justify-center gap-1"
              data-testid="link-back-to-blog"
            >
              <IconArrowLeft className="w-4 h-4" />
              {locale === "es" ? "Volver al blog" : "Back to blog"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`page-blog-post-${post.slug}`}>
      <Header />
      <article className="max-w-3xl mx-auto px-6 py-12">
        <a
          href={`/${locale}/blog`}
          onClick={handleLinkClick}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          data-testid="link-back-to-blog"
        >
          <IconArrowLeft className="w-4 h-4" />
          {locale === "es" ? "Volver al blog" : "Back to blog"}
        </a>

        {post.cluster && (
          <span className="inline-block text-xs font-medium text-primary uppercase tracking-wider mb-3" data-testid="text-blog-cluster">
            {post.cluster}
          </span>
        )}

        <h1
          className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight"
          data-testid="text-blog-post-title"
        >
          {post.title}
        </h1>

        {post.description && (
          <p className="text-lg text-muted-foreground mb-6" data-testid="text-blog-post-description">
            {post.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 flex-wrap">
          <span className="flex items-center gap-1" data-testid="text-blog-author">
            <IconUser className="w-4 h-4" />
            {getAuthorName(post.author)}
          </span>
          <span className="flex items-center gap-1" data-testid="text-blog-date">
            <IconCalendar className="w-4 h-4" />
            {formatDate(post.published_at || post.created_at, locale)}
          </span>
          {post.duration > 0 && (
            <span className="flex items-center gap-1" data-testid="text-blog-duration">
              <IconClock className="w-4 h-4" />
              {post.duration} min
            </span>
          )}
        </div>

        {post.preview && (
          <div className="mb-10 rounded-md overflow-hidden">
            <img
              src={post.preview}
              alt={post.title}
              className="w-full object-cover"
              data-testid="img-blog-post-hero"
            />
          </div>
        )}

        <div className="prose prose-neutral dark:prose-invert max-w-none" data-testid="content-blog-post-body">
          {markdownContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                ),
                img: ({ src, alt, ...props }) => (
                  <img src={src} alt={alt || ""} className="rounded-md" loading="lazy" {...props} />
                ),
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          ) : (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t" data-testid="section-blog-tags">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">
                {locale === "es" ? "Etiquetas:" : "Tags:"}
              </span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                  data-testid={`badge-tag-${tag}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
