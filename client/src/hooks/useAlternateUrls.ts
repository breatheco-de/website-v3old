import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface LocaleUrlsResponse {
  urls: Record<string, string>;
  contentType: string;
  slug: string;
}

export function useAlternateUrls(urlPath: string | null): Record<string, string> | undefined {
  const { data } = useQuery<LocaleUrlsResponse>({
    queryKey: ["/api/locale-urls", urlPath],
    queryFn: async () => {
      if (!urlPath) return { urls: {}, contentType: "", slug: "" };
      const res = await fetch(`/api/locale-urls?url=${encodeURIComponent(urlPath)}`);
      if (!res.ok) return { urls: {}, contentType: "", slug: "" };
      return res.json();
    },
    enabled: !!urlPath,
    staleTime: Infinity,
  });

  return useMemo(() => {
    const urls = data?.urls;
    if (!urls || Object.keys(urls).length < 2) return undefined;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const alternates: Record<string, string> = {};
    for (const [locale, path] of Object.entries(urls)) {
      alternates[locale] = `${origin}${path}`;
    }
    if (urls["en"]) {
      alternates["x-default"] = `${origin}${urls["en"]}`;
    }
    return alternates;
  }, [data]);
}
