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
          <DialogTitle className="text-destructive">Eliminar página</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            Esta acción es irreversible y permanente. Si estás seguro de eliminar <span className="font-bold text-foreground">{deletingPage?.slug}</span> entonces escribe el nombre de la página acá abajo y dale click a confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-sm text-muted-foreground">
            Escribe <span className="font-mono font-bold text-foreground">{deletingPage?.slug}</span> para completar esta acción:
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
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleteConfirmInput !== deletingPage?.slug || isDeletingPage}
            onClick={onConfirm}
            data-testid="button-delete-confirm"
          >
            {isDeletingPage ? "Eliminando..." : "Confirmar eliminación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
