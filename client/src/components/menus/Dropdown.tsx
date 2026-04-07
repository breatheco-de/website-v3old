import { useState, useRef, useLayoutEffect as _useLayoutEffect, useCallback, useEffect } from "react";
import { ChevronDown, ChevronRight, Code, BarChart3, Shield, Brain, Medal, GraduationCap, Building } from "lucide-react";
import { useInternalNav } from "@/hooks/useInternalNav";

// Falls back to useEffect during SSR to suppress the useLayoutEffect server warning
const useLayoutEffect = typeof window !== "undefined" ? _useLayoutEffect : useEffect;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code,
  chart: BarChart3,
  shield: Shield,
  brain: Brain,
  medal: Medal,
  "graduation-cap": GraduationCap,
  building: Building,
};

interface CardItem {
  title: string;
  description: string;
  cta: string;
  href: string;
  icon?: string;
}

interface ColumnItem {
  label: string;
  href: string;
}

interface Column {
  title: string;
  items: ColumnItem[];
}

interface GroupItem {
  label: string;
  href: string;
}

interface Group {
  title: string;
  items: GroupItem[];
}

interface CardsDropdownData {
  type: "cards";
  title?: string;
  description?: string;
  items: CardItem[];
  footer?: {
    text: string;
    linkText?: string;
    href: string;
  };
}

interface ColumnsDropdownData {
  type: "columns";
  title?: string;
  description?: string;
  icon?: string;
  columns: Column[];
}

interface SimpleListDropdownData {
  type: "simple-list";
  title?: string;
  description?: string;
  icon?: string;
  items: ColumnItem[];
}

interface GroupedListDropdownData {
  type: "grouped-list";
  title?: string;
  description?: string;
  icon?: string;
  groups: Group[];
}

type DropdownData = CardsDropdownData | ColumnsDropdownData | SimpleListDropdownData | GroupedListDropdownData;

export interface DropdownProps {
  label: string;
  href: string;
  dropdown: DropdownData;
  subtleAtTop?: boolean;
}

function CardsDropdown({ dropdown, onLinkClick }: { dropdown: CardsDropdownData; onLinkClick: React.MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <div className="p-6 bg-white dark:bg-zinc-900">
      {(dropdown.title || dropdown.description) && (
        <div className="mb-6">
          {dropdown.title && (
            <h3 className="text-lg font-semibold text-foreground mb-1">{dropdown.title}</h3>
          )}
          {dropdown.description && (
            <p className="text-sm text-muted-foreground">{dropdown.description}</p>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-4 gap-6">
        {dropdown.items.map((item, index) => {
          const IconComponent = item.icon ? iconMap[item.icon] : null;
          return (
            <a
              key={index}
              href={item.href}
              className="block hover-elevate rounded-lg p-2 -m-2"
              onClick={onLinkClick}
              data-testid={`dropdown-card-${(item.title || "card").toLowerCase().replace(/\s+/g, "-")}`}
            >
              {IconComponent && (
                <div className="mb-3 w-12 h-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconComponent className="w-6 h-6" />
                </div>
              )}
              <h4 className="font-semibold text-foreground mb-2">
                {item.title}
              </h4>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-4">
                {item.description}
              </p>
              <span className="inline-flex items-center text-sm font-medium border border-border rounded-md px-4 py-2 hover-elevate">
                {item.cta}
              </span>
            </a>
          );
        })}
      </div>
      
      {dropdown.footer && (
        <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
          {dropdown.footer.text}{" "}
          <a href={dropdown.footer.href} className="text-primary hover:underline" onClick={onLinkClick}>
            {dropdown.footer.linkText || "here"}
          </a>
          .
        </div>
      )}
    </div>
  );
}

function ColumnsDropdown({ dropdown, onLinkClick }: { dropdown: ColumnsDropdownData; onLinkClick: React.MouseEventHandler<HTMLAnchorElement> }) {
  const IconComponent = dropdown.icon ? iconMap[dropdown.icon] : null;
  
  return (
    <div className="w-full max-w-4xl p-6 bg-white dark:bg-zinc-900">
      {(dropdown.title || dropdown.description) && (
        <div className="flex items-start gap-4 mb-6 pb-4 border-b">
          {IconComponent && (
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <IconComponent className="w-6 h-6" />
            </div>
          )}
          <div>
            {dropdown.title && (
              <span className="flex items-center gap-1 text-lg font-semibold text-foreground hover-elevate rounded-md">
                {dropdown.title}
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
            {dropdown.description && (
              <p className="text-sm text-muted-foreground mt-1">{dropdown.description}</p>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {dropdown.columns.map((column, colIndex) => (
          <div key={colIndex}>
            <h4 className="font-semibold text-foreground mb-3">{column.title}</h4>
            <ul className="space-y-2">
              {column.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <a
                    href={item.href}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover-elevate rounded-md px-1 -mx-1"
                    onClick={onLinkClick}
                    data-testid={`dropdown-column-item-${(item.label || "item").toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {item.label}
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleListDropdown({ dropdown, onLinkClick }: { dropdown: SimpleListDropdownData; onLinkClick: React.MouseEventHandler<HTMLAnchorElement> }) {
  const IconComponent = dropdown.icon ? iconMap[dropdown.icon] : null;
  
  return (
    <div className="p-4 bg-white dark:bg-zinc-900">
      {(dropdown.title || dropdown.description) && (
        <div className="flex items-start gap-3 mb-4 pb-4 border-b">
          {IconComponent && (
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <IconComponent className="w-5 h-5" />
            </div>
          )}
          <div>
            {dropdown.title && (
              <h3 className="font-semibold text-foreground">{dropdown.title}</h3>
            )}
            {dropdown.description && (
              <p className="text-xs text-muted-foreground mt-1">{dropdown.description}</p>
            )}
          </div>
        </div>
      )}
      
      <ul className="space-y-1">
        {dropdown.items.map((item, index) => (
          <li key={index}>
            <a
              href={item.href}
              className="flex items-center justify-between px-2 py-2 rounded-md text-sm text-foreground hover-elevate"
              onClick={onLinkClick}
              data-testid={`dropdown-list-item-${(item.label || "item").toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.label}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupedListDropdown({ dropdown, onLinkClick }: { dropdown: GroupedListDropdownData; onLinkClick: React.MouseEventHandler<HTMLAnchorElement> }) {
  const [activeGroup, setActiveGroup] = useState(0);
  const IconComponent = dropdown.icon ? iconMap[dropdown.icon] : null;
  
  return (
    <div className="w-full max-w-xl p-4 bg-white dark:bg-zinc-900">
      {(dropdown.title || dropdown.description) && (
        <div className="flex items-start gap-3 mb-4 pb-4 border-b">
          {IconComponent && (
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <IconComponent className="w-5 h-5" />
            </div>
          )}
          <div>
            {dropdown.title && (
              <h3 className="font-semibold text-foreground">{dropdown.title}</h3>
            )}
            {dropdown.description && (
              <p className="text-xs text-muted-foreground mt-1">{dropdown.description}</p>
            )}
          </div>
        </div>
      )}
      
      <div className="flex gap-6">
        <div className="w-32 flex-shrink-0 space-y-1">
          {dropdown.groups.map((group, index) => (
            <button
              key={index}
              onClick={() => setActiveGroup(index)}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors toggle-elevate ${
                activeGroup === index
                  ? "text-foreground bg-muted toggle-elevated"
                  : "text-muted-foreground"
              }`}
              data-testid={`dropdown-group-tab-${(group.title || "group").toLowerCase().replace(/\s+/g, "-")}`}
            >
              {group.title}
            </button>
          ))}
        </div>
        
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {dropdown.groups[activeGroup]?.items.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className="flex items-center gap-1 py-1.5 text-sm text-muted-foreground hover-elevate rounded-md px-1 -mx-1"
                onClick={onLinkClick}
                data-testid={`dropdown-group-item-${(item.label || "item").toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
                <ChevronRight className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DROPDOWN_WIDTH_PX: Record<string, number> = {
  cards: 900,
  columns: 800,
  "simple-list": 288,
  "grouped-list": 550,
};

const VIEWPORT_PADDING = 16;

export function Dropdown({ label, href, dropdown, controlledOpen, onOpenChange, subtleAtTop }: DropdownProps & { controlledOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen;

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const isWideDropdown = dropdown.type === "cards" || dropdown.type === "columns";

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);
  
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };
  
  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 75);
  };
  
  const getDropdownWidth = () => {
    switch (dropdown.type) {
      case "cards":
        return "w-[900px]";
      case "columns":
        return "w-[800px]";
      case "simple-list":
        return "w-72";
      case "grouped-list":
        return "w-[550px]";
      default:
        return "";
    }
  };

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const maxAvailable = viewportW - VIEWPORT_PADDING * 2;
    const nominalW = DROPDOWN_WIDTH_PX[dropdown.type] || panel.offsetWidth;
    const dropdownW = Math.min(nominalW, maxAvailable);

    if (dropdownW < nominalW) {
      panel.style.maxWidth = `${maxAvailable}px`;
    } else {
      panel.style.maxWidth = "";
    }

    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let idealLeft = triggerCenter - dropdownW / 2;
    idealLeft = Math.max(VIEWPORT_PADDING, Math.min(idealLeft, viewportW - dropdownW - VIEWPORT_PADDING));

    const relativeLeft = idealLeft - triggerRect.left;
    panel.style.left = `${relativeLeft}px`;
  }, [dropdown.type]);

  useLayoutEffect(() => {
    if (!isOpen || isWideDropdown) return;
    positionPanel();

    window.addEventListener("resize", positionPanel);
    return () => window.removeEventListener("resize", positionPanel);
  }, [isOpen, isWideDropdown, positionPanel]);
  
  const handleLinkClick = useInternalNav(useCallback(() => {
    setIsOpen(false);
  }, []));

  const renderDropdownContent = () => {
    switch (dropdown.type) {
      case "cards":
        return <CardsDropdown dropdown={dropdown} onLinkClick={handleLinkClick} />;
      case "columns":
        return <ColumnsDropdown dropdown={dropdown} onLinkClick={handleLinkClick} />;
      case "simple-list":
        return <SimpleListDropdown dropdown={dropdown} onLinkClick={handleLinkClick} />;
      case "grouped-list":
        return <GroupedListDropdown dropdown={dropdown} onLinkClick={handleLinkClick} />;
      default:
        return null;
    }
  };
  
  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={`flex items-center gap-1 px-4 py-2 font-medium text-foreground hover-elevate rounded-md transition-[font-size] duration-300 ease-in-out no-default-hover-elevate no-default-active-elevate${subtleAtTop ? " text-xs" : " text-sm"}`}
        data-testid={`nav-dropdown-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        isWideDropdown ? (
          <>
            <div
              className="absolute left-0 right-0 top-full z-50"
              style={{ height: "1rem" }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
            <div 
              className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none"
            >
              <div 
                className={`pointer-events-auto bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-lg ${getDropdownWidth()}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {renderDropdownContent()}
              </div>
            </div>
          </>
        ) : (
          <div
            ref={panelRef}
            className={`absolute top-full z-50 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-lg ${getDropdownWidth()}`}
            style={{ left: 0 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {renderDropdownContent()}
          </div>
        )
      )}
    </div>
  );
}
