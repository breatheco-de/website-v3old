import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useInternalNav } from "@/hooks/useInternalNav";
import { useQuery } from "@tanstack/react-query";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Navbar, MobileNav, type NavbarConfig } from "@/components/menus";
import UniversalImage from "@/components/UniversalImage";

interface HeaderProps {
  menuId?: string;
}

export default function Header({ menuId = "main-navbar" }: HeaderProps) {
  const handleLinkClick = useInternalNav();
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const locale = i18n.language || 'en';

  const { data: menuResponse, isLoading } = useQuery<{ name: string; data: NavbarConfig }>({
    queryKey: ["/api/menus", menuId, locale],
    queryFn: async () => {
      const response = await fetch(`/api/menus/${menuId}?locale=${locale}`);
      if (!response.ok) throw new Error("Failed to load menu");
      return response.json();
    },
  });
  
  const menuConfig = menuResponse?.data;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const urlParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  if (urlParams.get('navbar') === 'false') {
    return null;
  }
  
  return (
    <header className={`sticky top-0 z-50 w-full bg-background transition-colors ${isScrolled ? 'border-b' : 'border-b border-background'}`}>
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        <a 
          href="/" 
          onClick={handleLinkClick}
          className="flex items-center hover-elevate rounded-md px-3 py-2" 
          data-testid="link-home"
        >
          <UniversalImage id="4geeks-devs-logo-1763162063433" alt={t('nav.brand')} className="h-8" loading="eager" style={{ objectFit: "contain", width: "auto", height: "100%" }} />
        </a>

        <div className="hidden md:flex flex-1 justify-center">
          {isLoading ? (
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 w-20 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : menuConfig ? (
            <Navbar config={menuConfig} />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {menuConfig && <MobileNav config={menuConfig} />}
        </div>
      </div>
    </header>
  );
}
