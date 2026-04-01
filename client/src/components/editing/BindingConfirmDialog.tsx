import { IconAlertTriangle, IconLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BoundSibling {
  contentType: string;
  slug: string;
  sectionIndex: number;
}

interface BindingConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boundSiblings: BoundSibling[];
  onConfirm: () => void;
  confirmLabel?: string;
  confirmIcon?: React.ReactNode;
}

export function BindingConfirmDialog({
  open,
  onOpenChange,
  boundSiblings,
  onConfirm,
  confirmLabel = "Save to all",
  confirmIcon,
}: BindingConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconAlertTriangle className="h-5 w-5 text-amber-500" />
            Synced Section
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            This section is synced with {boundSiblings.length} other page{boundSiblings.length !== 1 ? "s" : ""}. Your changes will also be applied to:
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {boundSiblings.map((sibling, i) => (
              <li key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-muted">
                <IconLink className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="font-medium">{sibling.slug}</span>
                <span className="text-muted-foreground">({sibling.contentType}, section {sibling.sectionIndex + 1})</span>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-binding-confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              onOpenChange(false);
              await onConfirm();
            }}
            data-testid="button-binding-confirm-save"
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
