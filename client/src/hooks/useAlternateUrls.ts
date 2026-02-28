import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export function useAlternateUrls(urlPath: string | null): Record<string, string> | undefined {
  const { data } = useQuery<Record<string, string>>({
    queryKey: ["/api/locale-urls", urlPath],
    queryFn: async () => {
      if (!urlPath) return {};
      const res = await fetch(`/api/locale-urls?url=${encodeURIComponent(urlPath)}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!urlPath,
    staleTime: Infinity,
  });

  return useMemo(() => {
    if (!data || Object.keys(data).length < 2) return undefined;
    const origin = window.location.origin;
    const alternates: Record<string, string> = {};
    for (const [locale, path] of Object.entries(data)) {
      alternates[locale] = `${origin}${path}`;
    }
    if (data["en"]) {
      alternates["x-default"] = `${origin}${data["en"]}`;
    }
    return alternates;
  }, [data]);
}
