import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  IconAlertTriangle,
  IconMenu2,
  IconRefresh,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ContentTypeItem {
  name: string;
  label: string;
  layout?: {
    menu?: {
      top?: string | null;
      bottom?: string | null;
    };
  };
}

interface SlotAssignment {
  top: boolean;
  bottom: boolean;
}

interface CreateMenuModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateMenuModal({ open, onOpenChange }: CreateMenuModalProps) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [assignments, setAssignments] = useState<Record<string, SlotAssignment>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: contentTypes } = useQuery<ContentTypeItem[]>({
    queryKey: ["/api/content-types"],
    enabled: open,
  });

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const slugValid = name === "" || slugPattern.test(name);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/menus", { name });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create menu");
      }
      return res.json();
    },
    onSuccess: async (data: { name: string }) => {
      // Apply content type assignments
      const assignmentPromises: Promise<Response>[] = [];
      for (const [ctType, slots] of Object.entries(assignments)) {
        if (!slots.top && !slots.bottom) continue;
        const menuUpdate: { top?: string; bottom?: string } = {};
        if (slots.top) menuUpdate.top = data.name;
        if (slots.bottom) menuUpdate.bottom = data.name;
        assignmentPromises.push(
          apiRequest("PUT", `/api/content-types/${ctType}/layout`, {
            menu: menuUpdate,
          })
        );
      }

      // Wait for all assignments to complete (failures will throw)
      await Promise.all(assignmentPromises);

      queryClient.invalidateQueries({ queryKey: ["/api/menus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-types"] });

      onOpenChange(false);
      navigate(`/private/menu-editor/${data.name}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleClose = (open: boolean) => {
    if (!open) {
      setName("");
      setAssignments({});
      setError(null);
    }
    onOpenChange(open);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(toSlug(e.target.value));
    setError(null);
  };

  const toggleSlot = (ctType: string, slot: "top" | "bottom") => {
    setAssignments((prev) => {
      const current = prev[ctType] || { top: false, bottom: false };
      return {
        ...prev,
        [ctType]: { ...current, [slot]: !current[slot] },
      };
    });
  };

  const canSubmit = name.length > 0 && slugValid && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconMenu2 className="h-5 w-5" />
            Create new menu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label
              htmlFor="menu-name"
              className="text-sm font-medium leading-none"
            >
              Name
            </label>
            <input
              id="menu-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. main-nav"
              className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-menu-name"
              disabled={createMutation.isPending}
              autoFocus
            />
            {name && !slugValid && (
              <p className="text-xs text-destructive">
                Only lowercase letters, numbers, and hyphens are allowed.
              </p>
            )}
            {name && slugValid && (
              <p className="text-xs text-muted-foreground">
                File will be saved as{" "}
                <code className="bg-muted px-1 rounded">{name}.yml</code>
              </p>
            )}
          </div>

          {contentTypes && contentTypes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium leading-none">
                Assign to content types
              </p>
              <p className="text-xs text-muted-foreground">
                Choose which content types should use this menu at the top or bottom.
              </p>
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {contentTypes.map((ct) => {
                  const currentTop = ct.layout?.menu?.top || null;
                  const currentBottom = ct.layout?.menu?.bottom || null;
                  const slotState = assignments[ct.name] || { top: false, bottom: false };
                  return (
                    <div
                      key={ct.name}
                      className="flex items-center gap-3 px-3 py-2"
                      data-testid={`row-ct-assignment-${ct.name}`}
                    >
                      <span className="flex-1 text-sm font-medium truncate">
                        {ct.label || ct.name}
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={slotState.top}
                          onChange={() => toggleSlot(ct.name, "top")}
                          disabled={createMutation.isPending}
                          data-testid={`checkbox-ct-top-${ct.name}`}
                          className="rounded"
                        />
                        <span className="text-xs">Top</span>
                        {currentTop && (
                          <span className="text-xs text-muted-foreground">
                            currently: {currentTop}
                          </span>
                        )}
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={slotState.bottom}
                          onChange={() => toggleSlot(ct.name, "bottom")}
                          disabled={createMutation.isPending}
                          data-testid={`checkbox-ct-bottom-${ct.name}`}
                          className="rounded"
                        />
                        <span className="text-xs">Bottom</span>
                        {currentBottom && (
                          <span className="text-xs text-muted-foreground">
                            currently: {currentBottom}
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <IconAlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={createMutation.isPending}
            data-testid="button-cancel-create-menu"
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-confirm-create-menu"
          >
            {createMutation.isPending ? (
              <>
                <IconRefresh className="h-4 w-4 mr-1.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Create menu"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
