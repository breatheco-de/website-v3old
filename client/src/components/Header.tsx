import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Navbar, MobileNav, renderNavbarItem, type NavbarConfig } from "@/components/menus";

interface HeaderProps {
  menuId?: string;
}

export default function Header({ menuId = "main-navbar" }: HeaderProps) {
  const { i18n } = useTranslation();
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

  const logoItem = menuConfig?.navbar?.items?.find(item => item.component === "Logo");
  const langItem = menuConfig?.navbar?.items?.find(item => item.component === "LanguageSwitcher");

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
  
  const navSize = menuConfig?.navbar?.size ?? 64;
  const constrainClass = menuConfig?.navbar?.constrained_margin
    ? "max-w-6xl mx-auto px-4"
    : "px-6";

  return (
    <header className={`sticky top-0 z-50 w-full bg-background transition-colors ${isScrolled ? 'border-b' : 'border-b border-background'}`}>
      <div className={`flex items-center gap-4 ${constrainClass}`} style={{ height: `${navSize}px` }}>
        <div className="hidden md:flex flex-1">
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

        <div className="flex md:hidden flex-1 items-center justify-between gap-3">
          {logoItem && renderNavbarItem(logoItem)}
          <div className="flex items-center gap-3">
            {langItem && renderNavbarItem(langItem)}
            {menuConfig && <MobileNav config={menuConfig} />}
          </div>
        </div>
      </div>
    </header>
  );
}
