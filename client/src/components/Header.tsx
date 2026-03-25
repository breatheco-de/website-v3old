import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Navbar, MobileNav, renderNavbarItem, type NavbarConfig } from "@/components/menus";
import { TypewriterAnnouncement } from "@/components/menus/TypewriterAnnouncement";

interface HeaderProps {
  menuId?: string;
}

export default function Header({ menuId = "main-navbar" }: HeaderProps) {
  const { i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPastThreshold, setIsPastThreshold] = useState(false);
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
      setIsPastThreshold(window.scrollY > 100);
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

  const stickyEnabled = menuConfig?.navbar?.sticky ?? true;
  const headerSlideOut = !stickyEnabled && isPastThreshold;

  const showMarquee = !!(menuConfig?.navbar?.marquee && menuConfig?.navbar?.marquee_text);
  const marqueeHeight = 49;
  const marqueeSticky = menuConfig?.navbar?.marquee_sticky ?? false;
  const marqueeCollapsed = isPastThreshold && !marqueeSticky;

  const totalHeight = navSize + (showMarquee ? marqueeHeight : 0);
  const spacerHeight = navSize + (showMarquee && !marqueeCollapsed ? marqueeHeight : 0);

  return (
    <>
      <div aria-hidden="true" style={{ height: `${spacerHeight}px` }} className="transition-[height] duration-300 ease-in-out" />

      <div
        className="fixed left-0 right-0 z-50 transition-[top] duration-300 ease-in-out"
        style={{ top: headerSlideOut ? `-${totalHeight}px` : '0px' }}
      >
        <header className={`w-full bg-background ${isScrolled ? 'border-b' : 'border-b border-background'}`}>
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
              {logoItem && renderNavbarItem(logoItem, undefined, undefined, menuConfig?.navbar?.constrained_margin)}
              <div className="flex items-center gap-3">
                {langItem && renderNavbarItem(langItem)}
                {menuConfig && <MobileNav config={menuConfig} />}
              </div>
            </div>
          </div>

          {showMarquee && (
            <div
              className={`overflow-hidden border-t transition-[max-height] duration-300 ease-in-out ${marqueeCollapsed ? "max-h-0" : "max-h-12"}`}
            >
              <div className={`${constrainClass} py-2`}>
                <TypewriterAnnouncement message={menuConfig!.navbar!.marquee_text!} />
              </div>
            </div>
          )}
        </header>
      </div>
    </>
  );
}
