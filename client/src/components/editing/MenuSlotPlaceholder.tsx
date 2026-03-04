import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconMenu2, IconPlus, IconPencil, IconArrowsExchange, IconTrash } from "@tabler/icons-react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { editCommonContent } from "@/lib/contentApi";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ menuId: string | null } | null>(null);

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

  const isRemoving = pendingAction?.menuId === null;
  const actionLabel = isRemoving ? "Remove" : (currentMenuId ? "Change" : "Add");

  const handleMenuOptionClick = useCallback((menuId: string | null) => {
    setIsOpen(false);
    setPendingAction({ menuId });
  }, []);

  const handleApplyToAll = useCallback(async () => {
    if (!pendingAction) return;
    setIsSaving(true);
    try {
      const body: Record<string, Record<string, string | null>> = {
        menu: { [position]: pendingAction.menuId },
      };
      await apiRequest("PUT", `/api/content-types/${contentType}/layout`, body);
      setPendingAction(null);
      onMenuChange?.(pendingAction.menuId);
      queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus"] });
    } catch (err) {
      toast({ title: "Failed to update layout", description: String(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [pendingAction, position, contentType, onMenuChange, queryClient, toast]);

  const handleApplyToEntry = useCallback(async () => {
    if (!pendingAction) return;
    setIsSaving(true);
    const fieldPath = position === "top" ? "layout.menu.top" : "layout.menu.bottom";
    const result = await editCommonContent({
      contentType,
      slug,
      operations: [{ action: "update_field", path: fieldPath, value: pendingAction.menuId }],
    });
    if (result.success) {
      setPendingAction(null);
      onMenuChange?.(pendingAction.menuId);
      queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus"] });
    } else {
      toast({ title: "Failed to update layout", description: result.error || "Unknown error", variant: "destructive" });
    }
    setIsSaving(false);
  }, [pendingAction, position, contentType, slug, onMenuChange, queryClient, toast]);

  if (!editMode?.isEditMode) return null;

  const scopeDialog = (
    <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
      <DialogContent data-testid="dialog-menu-scope">
        <DialogHeader>
          <DialogTitle data-testid="text-menu-scope-title">
            {actionLabel} menu — choose scope
          </DialogTitle>
          <DialogDescription data-testid="text-menu-scope-description">
            {isRemoving
              ? <>Remove the {position} menu from all <strong>{contentType}s</strong> or only from the <strong>{slug}</strong> {contentType}?</>
              : <>Add <strong>{pendingAction?.menuId}</strong> as the {position} menu to all <strong>{contentType}s</strong> or only to the <strong>{slug}</strong> {contentType}?</>}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="default"
            onClick={handleApplyToAll}
            disabled={isSaving}
            data-testid="button-apply-all"
          >
            {actionLabel} from all {contentType}s
          </Button>
          <Button
            variant="outline"
            onClick={handleApplyToEntry}
            disabled={isSaving}
            data-testid="button-apply-entry"
          >
            {actionLabel} only from {slug}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (currentMenuId) {
    const positionClasses = position === "top" ? "bottom-2 right-2" : "top-2 right-2";

    return (
      <>
        {scopeDialog}
        <div
          className={`absolute z-[60] flex items-center gap-1 transition-opacity duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto ${positionClasses}`}
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
                    onClick={() => handleMenuOptionClick(id)}
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
            onClick={() => handleMenuOptionClick(null)}
            disabled={isSaving}
            data-testid={`button-clear-menu-${position}`}
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {scopeDialog}
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
                onClick={() => handleMenuOptionClick(id)}
                data-testid={`menu-option-${position}-${id}`}
              >
                <IconMenu2 className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                {id}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
