import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { IconWorld } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

interface LocaleEntry {
  code: string;
  label: string;
}

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [location, setLocation] = useLocation();

  const { data: settingsLocales } = useQuery<LocaleEntry[]>({
    queryKey: ["/api/settings/locales"],
    queryFn: async () => {
      const res = await fetch("/api/settings/locales");
      if (!res.ok) return [];
      const data = await res.json();
      return data.supported_locales ?? [];
    },
    staleTime: Infinity,
  });

  const { data: localeUrls } = useQuery<{ urls: Record<string, string>; contentType: string; slug: string }>({
    queryKey: ["/api/locale-urls", location],
    queryFn: async () => {
      if (!location || location === "/" || location === "/en" || location === "/es" || location === "/en/" || location === "/es/") return null;
      const res = await fetch(`/api/locale-urls?url=${encodeURIComponent(location)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!location,
    staleTime: 60000,
  });

  const availableUrls = localeUrls?.urls ?? {};

  const visibleLocales: LocaleEntry[] = (settingsLocales ?? []).filter((entry) => {
    if (!localeUrls) return true;
    return Object.prototype.hasOwnProperty.call(availableUrls, entry.code);
  });

  const currentLocaleCode = (() => {
    const match = location.split("?")[0].match(/^\/([a-z]{2}(?:-[a-z]{2})?)\//i);
    return match ? match[1].toLowerCase() : "en";
  })();

  const currentLocale = visibleLocales.find((l) => l.code === currentLocaleCode)
    ?? settingsLocales?.find((l) => l.code === currentLocaleCode)
    ?? { code: currentLocaleCode, label: currentLocaleCode.toUpperCase() };

  const changeLanguage = (code: string) => {
    const baseCode = code.split("-")[0];
    i18n.changeLanguage(baseCode);
    document.documentElement.lang = baseCode;

    if (!location || location === "/" || location === "/en/" || location === "/es/" || location === "/en" || location === "/es") {
      setLocation(`/${code}/`);
      return;
    }

    if (availableUrls[code]) {
      setLocation(availableUrls[code]);
      return;
    }

    setLocation(`/${code}/`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-language-switcher"
          className="gap-1 px-2"
        >
          <span className="text-xs font-semibold">{currentLocale.code.toUpperCase()}</span>
          <IconWorld className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visibleLocales.map((entry) => (
          <DropdownMenuItem
            key={entry.code}
            onClick={() => changeLanguage(entry.code)}
            data-testid={`menu-item-language-${entry.code}`}
            className="cursor-pointer"
          >
            <span className="font-medium">{entry.code.toUpperCase()}</span>
            <span className="ml-2">{entry.label}</span>
            {currentLocaleCode === entry.code && (
              <span className="ml-auto text-primary font-bold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
