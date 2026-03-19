import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  IconRefresh,
  IconMenu2,
  IconChevronDown,
  IconChevronRight,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import type { MenuFileItem, MenuData } from "../types";
import { CreateMenuModal } from "./CreateMenuModal";

export function MenusView() {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, navigate] = useLocation();
  
  const { data: menusData, isLoading } = useQuery<{ menus: MenuFileItem[] }>({
    queryKey: ["/api/menus"],
  });
  
  const { data: menuDetailData, isFetching: isMenuLoading } = useQuery<{ name: string; data: MenuData }>({
    queryKey: ["/api/menus", expandedMenu],
    enabled: !!expandedMenu,
  });

  const menus = menusData?.menus || [];
  const menuData = menuDetailData?.data;

  const toggleMenu = (name: string) => {
    setExpandedMenu(expandedMenu === name ? null : name);
  };

  const handleEditMenu = (e: React.MouseEvent, menuName: string) => {
    e.stopPropagation();
    navigate(`/private/menu-editor/${menuName}`);
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 border-b mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Menus
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="p-1 rounded hover-elevate"
          title="Create new menu"
          data-testid="button-create-menu"
        >
          <IconPlus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : menus.length === 0 ? (
        <div className="text-center py-8 px-4">
          <IconMenu2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">No menus found</p>
          <p className="text-xs text-muted-foreground">
            Add <code className="bg-muted px-1 rounded">.yml</code> files to{" "}
            <code className="bg-muted px-1 rounded">marketing-content/menus/</code>{" "}
            or use the + button above.
          </p>
        </div>
      ) : (
        menus.map((menu) => (
          <div key={menu.name} className="mb-1">
            <div className="flex items-center">
              <button
                onClick={() => toggleMenu(menu.name)}
                className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md text-sm hover-elevate cursor-pointer"
                data-testid={`button-menu-${menu.name}`}
              >
                {isMenuLoading && expandedMenu === menu.name ? (
                  <IconRefresh className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
                ) : expandedMenu === menu.name ? (
                  <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <IconChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <IconMenu2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">{menu.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{menu.file}</span>
              </button>
              <button
                onClick={(e) => handleEditMenu(e, menu.name)}
                className="p-2 rounded-md hover-elevate cursor-pointer"
                title="Edit menu"
                data-testid={`button-edit-menu-${menu.name}`}
              >
                <IconPencil className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {expandedMenu === menu.name && menuData && (
              <div className="ml-4 border-l pl-2 space-y-1 mt-1">
                {menuData?.navbar?.items?.map((item, index) => (
                  <a
                    key={index}
                    href={item.href}
                    className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-muted-foreground hover-elevate cursor-pointer"
                    data-testid={`link-menu-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs opacity-60">{item.component}</span>
                  </a>
                ))}
                {menuData?.footer?.columns?.map((column: { title: string; items?: { label: string; href: string }[] }, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-muted-foreground"
                    data-testid={`debug-footer-column-${index}`}
                  >
                    <span>{column.title}</span>
                    <span className="text-xs opacity-60">{column.items?.length || 0} links</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <CreateMenuModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
