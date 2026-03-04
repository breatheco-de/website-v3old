import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconMenu2, IconX, IconPlus } from "@tabler/icons-react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { editCommonContent } from "@/lib/contentApi";
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
  onMenuChange?: (menuId: string | null) => void;
}

export default function MenuSlotPlaceholder({
  position,
  currentMenuId,
  contentType,
  slug,
  onMenuChange,
}: MenuSlotPlaceholderProps) {
  const editMode = useEditModeOptional();
  const queryClient = useQueryClient();
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

  const label = position === "top" ? "Top menu" : "Bottom menu";

  if (currentMenuId) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-1 bg-blue-500/10 border border-dashed border-blue-400/40"
        data-testid={`menu-slot-${position}-assigned`}
      >
        <IconMenu2 className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
          {label}: {currentMenuId}
        </span>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="toggle-elevate"
              disabled={isSaving}
              data-testid={`button-change-menu-${position}`}
            >
              <IconMenu2 className="w-3.5 h-3.5" />
            </Button>
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
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleMenuSelect(null)}
          disabled={isSaving}
          data-testid={`button-clear-menu-${position}`}
        >
          <IconX className="w-3.5 h-3.5" />
        </Button>
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
