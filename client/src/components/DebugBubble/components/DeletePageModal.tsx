import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeletePageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletingPage: { slug: string; contentType: string } | null;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (v: string) => void;
  isDeletingPage: boolean;
  onConfirm: () => void;
}

export function DeletePageModal(props: DeletePageModalProps) {
  const {
    open,
    onOpenChange,
    deletingPage,
    deleteConfirmInput,
    setDeleteConfirmInput,
    isDeletingPage,
    onConfirm,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete page</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            This action is irreversible and permanent. If you are sure you want to delete <span className="font-bold text-foreground">{deletingPage?.slug}</span>, type the page name below and click confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-sm text-muted-foreground">
            Type <span className="font-mono font-bold text-foreground">{deletingPage?.slug}</span> to complete this action:
          </label>
          <input
            value={deleteConfirmInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmInput(e.target.value)}
            placeholder={deletingPage?.slug || ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            data-testid="input-delete-confirm-slug"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteConfirmInput !== deletingPage?.slug || isDeletingPage}
            onClick={onConfirm}
            data-testid="button-delete-confirm"
          >
            {isDeletingPage ? "Deleting..." : "Confirm deletion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
