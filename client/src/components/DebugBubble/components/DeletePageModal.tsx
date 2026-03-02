import { useState, useEffect } from "react";
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
  onConfirm: (localesToDelete: string[]) => void;
  availableLocales?: string[];
  currentLocale?: string;
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
    availableLocales,
    currentLocale,
  } = props;

  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && availableLocales && availableLocales.length > 0) {
      if (currentLocale && availableLocales.includes(currentLocale)) {
        setSelectedLocales(new Set([currentLocale]));
      } else {
        setSelectedLocales(new Set(availableLocales));
      }
    } else if (!open) {
      setSelectedLocales(new Set());
    }
  }, [open, availableLocales, currentLocale]);

  const hasLocaleSelection = availableLocales && availableLocales.length > 0;
  const allSelected = hasLocaleSelection && selectedLocales.size === availableLocales.length;
  const selectedList = Array.from(selectedLocales).sort();

  const toggleLocale = (locale: string) => {
    setSelectedLocales(prev => {
      const next = new Set(prev);
      if (next.has(locale)) {
        next.delete(locale);
      } else {
        next.add(locale);
      }
      return next;
    });
  };

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

          {hasLocaleSelection && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground">Select locales to delete:</p>
              <div className="flex flex-col gap-1.5">
                {availableLocales.map((locale) => (
                  <label key={locale} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLocales.has(locale)}
                      onChange={() => toggleLocale(locale)}
                      className="h-4 w-4 rounded border-input accent-destructive"
                      data-testid={`checkbox-delete-locale-${locale}`}
                    />
                    <span className="font-mono text-xs">{locale}.yml</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedLocales.size === 0 ? (
                  <span className="text-destructive">Select at least one locale</span>
                ) : allSelected ? (
                  <>Will delete: {selectedList.map(l => `${l}.yml`).join(', ')} — <span className="font-medium">entire folder will be removed</span></>
                ) : (
                  <>Will delete: {selectedList.map(l => `${l}.yml`).join(', ')}</>
                )}
              </p>
            </div>
          )}
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
            disabled={deleteConfirmInput !== deletingPage?.slug || isDeletingPage || (hasLocaleSelection && selectedLocales.size === 0)}
            onClick={() => onConfirm(selectedList)}
            data-testid="button-delete-confirm"
          >
            {isDeletingPage ? "Deleting..." : "Confirm deletion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
