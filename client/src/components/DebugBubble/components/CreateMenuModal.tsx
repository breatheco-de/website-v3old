import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const [type, setType] = useState<"navbar" | "footer">("navbar");
  const [error, setError] = useState<string | null>(null);

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const slugValid = name === "" || slugPattern.test(name);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/menus", { name, type });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create menu");
      }
      return res.json();
    },
    onSuccess: (data: { name: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menus"] });
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
      setType("navbar");
      setError(null);
    }
    onOpenChange(open);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(toSlug(e.target.value));
    setError(null);
  };

  const canSubmit = name.length > 0 && slugValid && !mutation.isPending;

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
              disabled={mutation.isPending}
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

          <div className="space-y-1.5">
            <label
              htmlFor="menu-type"
              className="text-sm font-medium leading-none"
            >
              Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "navbar" | "footer")}
              disabled={mutation.isPending}
            >
              <SelectTrigger
                id="menu-type"
                data-testid="select-menu-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="navbar">Navbar</SelectItem>
                <SelectItem value="footer">Footer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type === "navbar"
                ? "A navigation bar with links and optional dropdowns."
                : "A footer with columns of links."}
            </p>
          </div>

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
            disabled={mutation.isPending}
            data-testid="button-cancel-create-menu"
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-confirm-create-menu"
          >
            {mutation.isPending ? (
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
