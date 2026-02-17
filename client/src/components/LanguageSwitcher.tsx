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

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
];

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();

  const { data: localeUrls } = useQuery<{ urls: Record<string, string>; contentType: string; slug: string }>({
    queryKey: ["/api/locale-urls", location],
    queryFn: async () => {
      const res = await fetch(`/api/locale-urls?url=${encodeURIComponent(location)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: location !== "/" && location !== "/en" && location !== "/es" && location !== "/en/" && location !== "/es/",
    staleTime: 60000,
  });

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng;

    if (
      location === "/" ||
      location === "/en/" ||
      location === "/es/" ||
      location === "/en" ||
      location === "/es"
    ) {
      setLocation(`/${lng}/`);
      return;
    }

    if (localeUrls?.urls?.[lng]) {
      setLocation(localeUrls.urls[lng]);
      return;
    }

    setLocation(`/${lng}/`);
  };

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-language-switcher"
          aria-label={t("nav.changeLanguage")}
        >
          <IconWorld className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            data-testid={`menu-item-language-${language.code}`}
            className="cursor-pointer"
          >
            <span className="font-medium">{language.code.toUpperCase()}</span>
            <span className="ml-2">{language.name}</span>
            {currentLanguage.code === language.code && (
              <span className="ml-auto text-primary font-bold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
