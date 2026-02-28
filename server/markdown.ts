const markdownCache = new Map<string, { content: string; fetched_at: number }>();

export async function fetchMarkdownContent(readmeUrl: string): Promise<string> {
  const ttlMs = 24 * 60 * 60 * 1000;

  const cached = markdownCache.get(readmeUrl);
  if (cached && Date.now() - cached.fetched_at < ttlMs) {
    return cached.content;
  }

  try {
    const response = await fetch(readmeUrl);
    if (!response.ok) return "";
    const text = await response.text();
    const frontmatterRegex = /^---[\s\S]*?---\s*/;
    const content = text.replace(frontmatterRegex, "").trim();
    markdownCache.set(readmeUrl, { content, fetched_at: Date.now() });
    return content;
  } catch (err) {
    console.error(`[Markdown] Failed to fetch from ${readmeUrl}:`, err);
    return cached?.content || "";
  }
}

export function clearMarkdownCache(slug?: string): void {
  if (!slug) {
    markdownCache.clear();
    console.log("[Markdown] Cleared all cache entries");
    return;
  }
  const keys = Array.from(markdownCache.keys());
  for (const url of keys) {
    if (url.includes(slug)) {
      markdownCache.delete(url);
      console.log(`[Markdown] Cleared cache for slug containing: ${slug}`);
    }
  }
}

export function clearMarkdownCacheByUrl(readmeUrl: string): boolean {
  return markdownCache.delete(readmeUrl);
}
