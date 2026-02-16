export { SimpleLink, type SimpleLinkProps } from "./SimpleLink";
export { Dropdown, type DropdownProps } from "./Dropdown";
export { EditableDropdownPreview, EditableLinkItem, EditableText } from "./EditableDropdownPreview";
export { MobileNav } from "./MobileNav";

import { useState, useCallback } from "react";
import { SimpleLink, type SimpleLinkProps } from "./SimpleLink";
import { Dropdown, type DropdownProps } from "./Dropdown";

export type NavbarItem = {
  label: string;
  href: string;
  component: "SimpleLink" | "Dropdown";
  dropdown?: DropdownProps["dropdown"];
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

export function renderNavbarItem(item: NavbarItem, controlledOpen?: boolean, onOpenChange?: (open: boolean) => void) {
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
    <nav className="flex flex-wrap items-center gap-1" data-testid="navbar">
      {config.navbar.items.map((item) => {
        if (item.component === "Dropdown") {
          return renderNavbarItem(item, activeDropdown === item.label, handleOpenChange(item.label));
        }
        return renderNavbarItem(item);
      })}
    </nav>
  );
}
