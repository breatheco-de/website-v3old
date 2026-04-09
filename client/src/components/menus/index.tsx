export { SimpleLink, type SimpleLinkProps } from "./SimpleLink";
export { Dropdown, type DropdownProps } from "./Dropdown";
export { EditableDropdownPreview, EditableLinkItem, EditableText } from "./EditableDropdownPreview";
export { MobileNav } from "./MobileNav";
export { TypewriterAnnouncement, type TypewriterAnnouncementProps } from "./TypewriterAnnouncement";

import { useState, useCallback } from "react";
import { SimpleLink } from "./SimpleLink";
import { Dropdown, type DropdownProps } from "./Dropdown";
import { TypewriterAnnouncement } from "./TypewriterAnnouncement";
import UniversalImage from "@/components/UniversalImage";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useInternalNav } from "@/hooks/useInternalNav";
import { useTranslation } from "react-i18next";
import { useMenuVisualContext } from "@/contexts/MenuVisualContext";

export type NavbarItem = {
  label: string;
  href: string;
  component: "SimpleLink" | "Dropdown" | "Logo" | "LanguageSwitcher" | "TypewriterAnnouncement";
  dropdown?: DropdownProps["dropdown"];
  imageId?: string;
  imageAlt?: string;
  imageObjectFit?: string;
  imageObjectPosition?: string;
  messages?: MarqueeMessage[];
  icon?: string;
  char_delay?: number;
  start_delay?: number;
  display_time?: number;
};

export type MarqueeMessage = {
  text: string;
  cta_label?: string;
  cta_url?: string;
  cta_url_overrides?: Record<string, string>;
  icon?: string;
};

export type MarqueeConfig = {
  enabled?: boolean;
  texts?: MarqueeMessage[];
  position?: "above" | "below";
  sticky?: boolean;
  background?: string;
  start_delay?: number;
  char_delay?: number;
  display_time?: number;
  show_on?: "desktop" | "mobile" | "";
};

export type NavbarConfig = {
  navbar: {
    items: NavbarItem[];
    constrained_margin?: boolean;
    size?: number;
    sticky?: boolean;
    subtle_at_top?: boolean;
    floating?: boolean;
    marquee?: MarqueeConfig;
  };
};

const componentMap: Record<string, React.ComponentType<any>> = {
  SimpleLink,
  Dropdown,
  TypewriterAnnouncement,
};

export function resolveComponent(componentName: string): React.ComponentType<any> | null {
  return componentMap[componentName] || null;
}

function LogoItem({ imageId, imageAlt, href, constrained_margin }: { imageId?: string; imageAlt?: string; href: string; constrained_margin?: boolean }) {
  const handleLinkClick = useInternalNav();
  const { t } = useTranslation();
  const { isCompact } = useMenuVisualContext();
  const logoId = imageId || "4geeks-devs-logo-1763162063433";

  return (
    <a
      href={href}
      onClick={handleLinkClick}
      className={`flex items-center hover-elevate rounded-md${constrained_margin ? "" : " px-3 py-2"}`}
      data-testid="link-home"
    >
      <UniversalImage
        id={logoId}
        alt={imageAlt || t('nav.brand')}
        className={`transition-all duration-150 ease-out ${isCompact ? "h-6" : "h-8"}`}
        loading="eager"
        style={{ objectFit: "contain", width: "auto", height: "100%" }}
      />
    </a>
  );
}

export function renderNavbarItem(
  item: NavbarItem,
  controlledOpen?: boolean,
  onOpenChange?: (open: boolean) => void,
  constrained_margin?: boolean,
) {
  if (item.component === "Logo") {
    return <LogoItem key="logo" imageId={item.imageId} imageAlt={item.imageAlt} href={item.href} constrained_margin={constrained_margin} />;
  }

  if (item.component === "LanguageSwitcher") {
    return <LanguageSwitcher key="language-switcher" />;
  }

  const Component = resolveComponent(item.component);
  
  if (!Component) {
    console.warn(`Unknown menu component: ${item.component}`);
    return null;
  }
  
  if (item.component === "TypewriterAnnouncement") {
    return (
      <TypewriterAnnouncement
        key={`typewriter-announcement-${item.label}`}
        messages={item.messages ?? []}
        icon={item.icon}
        charDelay={item.char_delay}
        startDelay={item.start_delay}
        displayTime={item.display_time}
      />
    );
  }

  if (item.component === "Dropdown" && item.dropdown) {
    return <Component key={item.label} label={item.label} href={item.href} dropdown={item.dropdown} controlledOpen={controlledOpen} onOpenChange={onOpenChange} />;
  }

  return <Component key={item.label} label={item.label} href={item.href} />;
}

export function Navbar({ config }: { config: NavbarConfig }) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { isCompact } = useMenuVisualContext();

  const handleOpenChange = useCallback((label: string) => (open: boolean) => {
    setActiveDropdown((prev) => {
      if (open) return label;
      return prev === label ? null : prev;
    });
  }, []);

  if (!config?.navbar?.items) {
    return null;
  }
  
  const navItems = config.navbar.items;
  const logoItems = navItems.filter((item) => item.component === "Logo");
  const announcementItems = navItems.filter((item) => item.component === "TypewriterAnnouncement");
  const navLinkItems = navItems.filter(
    (item) => item.component === "Dropdown" || item.component === "SimpleLink",
  );
  const trailingItems = navItems.filter((item) => item.component === "LanguageSwitcher");

  const constrained_margin = config.navbar.constrained_margin;

  return (
    <nav className="flex flex-wrap items-center justify-between w-full gap-1" data-testid="navbar">
      {logoItems.map((item) => renderNavbarItem(item, undefined, undefined, constrained_margin))}
      {announcementItems.map((item) => renderNavbarItem(item))}
      {navLinkItems.length > 0 && (
        <div className={`flex items-center gap-1 transition-all duration-150 ease-out ${isCompact ? "text-xs" : "text-sm"}`} data-testid="navbar-links">
          {navLinkItems.map((item) => {
            if (item.component === "Dropdown") {
              return renderNavbarItem(item, activeDropdown === item.label, handleOpenChange(item.label));
            }
            return renderNavbarItem(item);
          })}
        </div>
      )}
      {trailingItems.map((item) => renderNavbarItem(item))}
    </nav>
  );
}
