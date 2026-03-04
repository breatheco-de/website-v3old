import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconMenu2, IconPlus, IconPencil, IconArrowsExchange, IconTrash } from "@tabler/icons-react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { editCommonContent } from "@/lib/contentApi";
import { useLocation } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface MenuSlotPlaceholderProps {
  position: "top" | "bottom";
  currentMenuId: string | null | undefined;
  contentType: string;
  slug: string;
  locale: string;
  onMenuChange?: (menuId: string | null) => void;
}

export default function MenuSlotPlaceholder({
  position,
  currentMenuId,
  contentType,
  slug,
  locale,
  onMenuChange,
}: MenuSlotPlaceholderProps) {
  const editMode = useEditModeOptional();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: menusData } = useQuery<{ menus: { name: string; file: string }[] }>({
    queryKey: ["/api/menus"],
    queryFn: async () => {
      const response = await fetch("/api/menus");
      if (!response.ok) throw new Error("Failed to load menus");
      return response.json();
    },
    enabled: !!editMode?.isEditMode,
  });

  const menuIds = menusData?.menus?.map((m) => m.name) || [];

  const handleMenuSelect = useCallback(
    async (menuId: string | null) => {
      setIsSaving(true);
      setIsOpen(false);
      const fieldPath = position === "top" ? "layout.menu.top" : "layout.menu.bottom";
      const result = await editCommonContent({
        contentType,
        slug,
        operations: [{ action: "update_field", path: fieldPath, value: menuId }],
      });
      setIsSaving(false);
      if (result.success) {
        onMenuChange?.(menuId);
        queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });
      }
    },
    [contentType, slug, position, onMenuChange, queryClient],
  );

  if (!editMode?.isEditMode) return null;

  if (currentMenuId) {
    const positionClasses = position === "top" ? "bottom-2 right-2" : "top-2 right-2";

    return (
      <div
        className={`absolute z-30 flex items-center gap-1 transition-opacity duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto ${positionClasses}`}
        data-testid={`menu-slot-${position}-assigned`}
      >
        <button
          className="p-2 bg-primary text-primary-foreground rounded-md shadow-lg hover-elevate flex items-center gap-1.5 cursor-pointer"
          onClick={() => navigate(`/private/menu-editor/${currentMenuId}?locale=${locale}`)}
          disabled={isSaving}
          data-testid={`button-edit-menu-${position}`}
        >
          <IconPencil className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{currentMenuId}</span>
        </button>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              className="p-2 bg-muted text-muted-foreground rounded-md shadow-lg hover-elevate cursor-pointer"
              disabled={isSaving}
              data-testid={`button-change-menu-${position}`}
            >
              <IconArrowsExchange className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="center">
            <div className="flex flex-col">
              {menuIds.map((id) => (
                <Button
                  key={id}
                  variant="ghost"
                  size="sm"
                  className={`justify-start text-xs ${id === currentMenuId ? "toggle-elevate toggle-elevated" : ""}`}
                  onClick={() => handleMenuSelect(id)}
                  data-testid={`menu-option-${position}-${id}`}
                >
                  <IconMenu2 className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                  {id}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <button
          className="p-2 bg-muted text-destructive rounded-md shadow-lg hover-elevate cursor-pointer"
          onClick={() => handleMenuSelect(null)}
          disabled={isSaving}
          data-testid={`button-clear-menu-${position}`}
        >
          <IconTrash className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-muted-foreground/20 hover-elevate cursor-pointer transition-colors"
          disabled={isSaving}
          data-testid={`menu-slot-${position}-empty`}
        >
          <IconPlus className="w-4 h-4 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/50">
            Add a menu on the {position} of your page (optional)
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="center">
        <div className="flex flex-col">
          {menuIds.map((id) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              className="justify-start text-xs"
              onClick={() => handleMenuSelect(id)}
              data-testid={`menu-option-${position}-${id}`}
            >
              <IconMenu2 className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
              {id}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
