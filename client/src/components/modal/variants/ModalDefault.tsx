import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import type { LeadFormData } from "@shared/schema";

const LeadForm = lazy(() => import("@/components/lead_form/variants/LeadFormDefault"));

export interface ModalData {
  type: "modal";
  section_id: string;
  heading?: string;
  description?: string;
  button_label?: string;
  show_close?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  form?: LeadFormData;
}

interface ModalProps {
  data: ModalData;
  landingLocations?: string[];
}

function FormSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="h-8 w-48 bg-muted rounded mb-4" />
      <div className="space-y-3">
        <div className="h-10 w-full bg-muted rounded" />
        <div className="h-10 w-full bg-muted rounded" />
        <div className="h-10 w-full bg-muted rounded" />
      </div>
    </div>
  );
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ data, landingLocations }: ModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const editMode = useEditModeOptional();
  const isEditMode = editMode?.isEditMode ?? false;

  const sectionId = data.section_id;
  const showClose = data.show_close !== false;
  const sizeClass = SIZE_CLASSES[data.size || "md"] || SIZE_CLASSES.md;

  const checkHash = useCallback(() => {
    const hash = window.location.hash.replace("#", "");
    setIsOpen(hash === sectionId);
  }, [sectionId]);

  useEffect(() => {
    checkHash();

    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, [checkHash]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (window.location.hash === `#${sectionId}`) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [sectionId]);

  if (isEditMode) {
    return (
      <div
        className="w-full py-8 px-4"
        data-testid={`modal-edit-placeholder-${sectionId}`}
      >
        <div className="max-w-4xl mx-auto border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 bg-muted/20">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <X className="h-5 w-5" />
            <span className="text-sm font-medium">
              This section represents a modal dialog that opens when visiting <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">#{sectionId}</code>
            </span>
            <X className="h-5 w-5" />
          </div>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm">
            {data.heading && (
              <span className="text-foreground font-medium">{data.heading}</span>
            )}
            {data.description && (
              <span className="text-muted-foreground text-xs">{data.description}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsOpen(true)}
              data-testid={`button-preview-modal-${sectionId}`}
            >
              Preview Modal
            </Button>
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setIsOpen(false); }}>
          <DialogContent
            className={sizeClass}
            hideClose={!showClose}
            data-testid={`modal-content-${sectionId}`}
          >
            {data.heading && (
              <DialogHeader>
                <DialogTitle data-testid={`text-modal-heading-${sectionId}`}>
                  {data.heading}
                </DialogTitle>
                {data.description && (
                  <DialogDescription data-testid={`text-modal-description-${sectionId}`}>
                    {data.description}
                  </DialogDescription>
                )}
              </DialogHeader>
            )}
            {data.form && (
              <Suspense fallback={<FormSkeleton />}>
                <LeadForm
                  data={{
                    ...data.form,
                    variant: data.form.variant || "stacked",
                  }}
                />
              </Suspense>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className={sizeClass}
        hideClose={!showClose}
        data-testid={`modal-content-${sectionId}`}
      >
        {data.heading && (
          <DialogHeader>
            <DialogTitle data-testid={`text-modal-heading-${sectionId}`}>
              {data.heading}
            </DialogTitle>
            {data.description && (
              <DialogDescription data-testid={`text-modal-description-${sectionId}`}>
                {data.description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        {data.form && (
          <Suspense fallback={<FormSkeleton />}>
            <LeadForm
              data={{
                ...data.form,
                variant: data.form.variant || "stacked",
              }}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default Modal;
