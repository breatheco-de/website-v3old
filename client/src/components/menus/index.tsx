export { SimpleLink, type SimpleLinkProps } from "./SimpleLink";
export { Dropdown, type DropdownProps } from "./Dropdown";
export { EditableDropdownPreview, EditableLinkItem, EditableText } from "./EditableDropdownPreview";
export { MobileNav } from "./MobileNav";

import { useState, useCallback } from "react";
import { SimpleLink, type SimpleLinkProps } from "./SimpleLink";
import { Dropdown, type DropdownProps } from "./Dropdown";
import UniversalImage from "@/components/UniversalImage";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useInternalNav } from "@/hooks/useInternalNav";
import { useTranslation } from "react-i18next";

export type NavbarItem = {
  label: string;
  href: string;
  component: "SimpleLink" | "Dropdown" | "Logo" | "LanguageSwitcher";
  dropdown?: DropdownProps["dropdown"];
  imageId?: string;
};

export type NavbarConfig = {
  navbar: {
    items: NavbarItem[];
  };
};

const componentMap: Record<string, React.ComponentType<any>> = {
  SimpleLink,
  Dropdown,
};

export function resolveComponent(componentName: string): React.ComponentType<any> | null {
  return componentMap[componentName] || null;
}

function LogoItem({ imageId, href }: { imageId?: string; href: string }) {
  const handleLinkClick = useInternalNav();
  const { t } = useTranslation();
  const logoId = imageId || "4geeks-devs-logo-1763162063433";

  return (
    <a
      href={href}
      onClick={handleLinkClick}
      className="flex items-center hover-elevate rounded-md px-3 py-2"
      data-testid="link-home"
    >
      <UniversalImage id={logoId} alt={t('nav.brand')} className="h-8" loading="eager" style={{ objectFit: "contain", width: "auto", height: "100%" }} />
    </a>
  );
}

export function renderNavbarItem(item: NavbarItem, controlledOpen?: boolean, onOpenChange?: (open: boolean) => void) {
  if (item.component === "Logo") {
    return <LogoItem key="logo" imageId={item.imageId} href={item.href} />;
  }

  if (item.component === "LanguageSwitcher") {
    return <LanguageSwitcher key="language-switcher" />;
  }

  const Component = resolveComponent(item.component);
  
  if (!Component) {
    console.warn(`Unknown menu component: ${item.component}`);
    return null;
  }
  
  if (item.component === "Dropdown" && item.dropdown) {
    return <Component key={item.label} label={item.label} href={item.href} dropdown={item.dropdown} controlledOpen={controlledOpen} onOpenChange={onOpenChange} />;
  }
  
  return <Component key={item.label} label={item.label} href={item.href} />;
}

export function Navbar({ config }: { config: NavbarConfig }) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleOpenChange = useCallback((label: string) => (open: boolean) => {
    setActiveDropdown((prev) => {
      if (open) return label;
      return prev === label ? null : prev;
    });
  }, []);

  if (!config?.navbar?.items) {
    return null;
  }
  
  return (
    <nav className="flex flex-wrap items-center justify-between w-full gap-1" data-testid="navbar">
      {config.navbar.items.map((item) => {
        if (item.component === "Dropdown") {
          return renderNavbarItem(item, activeDropdown === item.label, handleOpenChange(item.label));
        }
        return renderNavbarItem(item);
      })}
    </nav>
  );
}
