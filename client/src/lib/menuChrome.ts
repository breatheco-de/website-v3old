import type { NavbarConfig } from "@/components/menus";

export const DEFAULT_NAVBAR_HEIGHT = 64;
export const DEFAULT_MARQUEE_HEIGHT = 40;

interface MenuChromeHeights {
  navHeight: number;
  marqueeHeightDesktop: number;
  marqueeHeightMobile: number;
  totalHeightDesktop: number;
  totalHeightMobile: number;
  showMarquee: boolean;
}

export function getMenuChromeHeights(menuConfig?: NavbarConfig): MenuChromeHeights {
  const navHeight = menuConfig?.navbar?.size ?? DEFAULT_NAVBAR_HEIGHT;
  const marquee = menuConfig?.navbar?.marquee;
  const showMarquee = !!(marquee?.enabled && marquee?.texts && marquee.texts.length > 0);
  const marqueeShowOn = marquee?.show_on ?? "";

  const marqueeHeightDesktop = showMarquee && marqueeShowOn !== "mobile" ? DEFAULT_MARQUEE_HEIGHT : 0;
  const marqueeHeightMobile = showMarquee && marqueeShowOn !== "desktop" ? DEFAULT_MARQUEE_HEIGHT : 0;

  return {
    navHeight,
    marqueeHeightDesktop,
    marqueeHeightMobile,
    totalHeightDesktop: navHeight + marqueeHeightDesktop,
    totalHeightMobile: navHeight + marqueeHeightMobile,
    showMarquee,
  };
}
