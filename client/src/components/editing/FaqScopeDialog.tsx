import { IconGlobe, IconLayout } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FaqScopeDialogProps {
  mode: "add" | "edit" | "delete";
  onSelectScope: (scope: "local" | "global") => void;
  onClose: () => void;
}

const COPY = {
  add: {
    title: "Where should this FAQ appear?",
    description: "Choose whether this FAQ applies only to this section or to all pages.",
    localLabel: "This section only",
    localDesc: "Creates a local copy visible only on this page.",
    globalLabel: "All pages (database)",
    globalDesc: "Saves to the database and may appear on other pages with similar topics.",
  },
  edit: {
    title: "How would you like to edit this FAQ?",
    description: "Choose whether to edit locally for this section only, or update the original in the database.",
    localLabel: "Edit for this section only",
    localDesc: "Creates a local override — the original in the database is unchanged.",
    globalLabel: "Edit in database (all pages)",
    globalDesc: "Updates the original. This affects all pages showing this FAQ.",
  },
  delete: {
    title: "How would you like to remove this FAQ?",
    description: "Choose to hide it from this section, or delete it from the database entirely.",
    localLabel: "Hide from this section",
    localDesc: "The FAQ stays in the database but won't appear here.",
    globalLabel: "Delete from database",
    globalDesc: "Permanently removes this FAQ. This affects all pages showing it.",
  },
} as const;

export function FaqScopeDialog({ mode, onSelectScope, onClose }: FaqScopeDialogProps) {
  const c = COPY[mode];
  const isDestructiveGlobal = mode === "delete";

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <button
            onClick={() => onSelectScope("local")}
            className="w-full text-left border rounded-lg p-3 hover-elevate"
            data-testid="button-scope-local"
          >
            <div className="flex items-center gap-2 font-medium text-sm mb-0.5">
              <IconLayout className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {c.localLabel}
            </div>
            <p className="text-xs text-muted-foreground pl-6">{c.localDesc}</p>
          </button>
          <button
            onClick={() => onSelectScope("global")}
            className={`w-full text-left border rounded-lg p-3 hover-elevate${isDestructiveGlobal ? " border-destructive/40" : ""}`}
            data-testid="button-scope-global"
          >
            <div className={`flex items-center gap-2 font-medium text-sm mb-0.5${isDestructiveGlobal ? " text-destructive" : ""}`}>
              <IconGlobe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {c.globalLabel}
            </div>
            <p className="text-xs text-muted-foreground pl-6">{c.globalDesc}</p>
          </button>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-scope-cancel">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
