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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
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
      setIsPastThreshold(prev => {
        if (window.scrollY > 150) return true;
        if (window.scrollY < 50) return false;
        return prev;
      });
    };
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
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

  const subtleAtTopEnabled = menuConfig?.navbar?.subtle_at_top ?? false;
  const subtleAtTop = subtleAtTopEnabled && !isPastThreshold;

  const marquee = menuConfig?.navbar?.marquee;
  const showMarquee = !!(marquee?.enabled && marquee?.texts && marquee.texts.length > 0);
  const marqueeHeight = 49;
  const marqueeSticky = marquee?.sticky ?? false;
  const marqueeCollapsed = isPastThreshold && !marqueeSticky;
  const marqueePosition = marquee?.position ?? "below";
  const marqueeShowOn = marquee?.show_on ?? "";

  const marqueeVisibilityClass =
    marqueeShowOn === "mobile" ? "md:hidden" :
    marqueeShowOn === "desktop" ? "hidden md:block" :
    "";

  const marqueeHeightDesktop = showMarquee && marqueeShowOn !== "mobile" ? marqueeHeight : 0;
  const marqueeHeightMobile = showMarquee && marqueeShowOn !== "desktop" ? marqueeHeight : 0;
  const totalHeightDesktop = navSize + marqueeHeightDesktop;
  const totalHeightMobile = navSize + marqueeHeightMobile;

  const marqueeStrip = showMarquee ? (
    <div
      className={`${marqueeVisibilityClass} overflow-hidden transition-[max-height] duration-300 ease-in-out ${marqueeCollapsed ? "max-h-0" : "max-h-12"} ${marqueePosition === "below" ? "border-t" : "border-b"}`}
    >
      <div
        className={`${constrainClass} py-1`}
        style={marquee?.background ? { background: marquee.background } : { background: "hsl(var(--primary) / 0.05)" }}
      >
        <TypewriterAnnouncement
          messages={marquee!.texts!}
          charDelay={marquee?.char_delay}
          startDelay={marquee?.start_delay}
          displayTime={marquee?.display_time}
        />
      </div>
    </div>
  ) : null;

  const totalHeight = isMobile ? totalHeightMobile : totalHeightDesktop;

  return (
    <>
      <div aria-hidden="true" className="hidden md:block" style={{ height: `${totalHeightDesktop}px` }} />
      <div aria-hidden="true" className="md:hidden" style={{ height: `${totalHeightMobile}px` }} />

      <div
        className="fixed left-0 right-0 z-50 transition-[top] duration-300 ease-in-out"
        style={{ top: headerSlideOut ? `-${totalHeight}px` : '0px' }}
      >
        <header className={`w-full transition-[background-color,border-color] duration-300 ease-in-out ${subtleAtTop ? 'bg-transparent border-b border-transparent' : `bg-background ${isScrolled ? 'border-b' : 'border-b border-background'}`}`}>
          {marqueePosition === "above" && marqueeStrip}

          <div className={`flex items-center gap-4 ${constrainClass}`} style={{ height: `${navSize}px` }}>
            <div className="hidden md:flex flex-1">
              {isLoading ? (
                <div className="flex items-center gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-4 w-20 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : menuConfig ? (
                <Navbar config={menuConfig} subtleAtTop={subtleAtTop} />
              ) : null}
            </div>

            <div className="flex md:hidden flex-1 items-center justify-between gap-3">
              {logoItem && renderNavbarItem(logoItem, undefined, undefined, menuConfig?.navbar?.constrained_margin, subtleAtTop)}
              <div className="flex items-center gap-3">
                {langItem && renderNavbarItem(langItem)}
                {menuConfig && <MobileNav config={menuConfig} subtleAtTop={subtleAtTop} />}
              </div>
            </div>
          </div>

          {marqueePosition === "below" && marqueeStrip}
        </header>
      </div>
    </>
  );
}
