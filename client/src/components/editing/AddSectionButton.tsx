import { useState } from "react";
import { Plus } from "lucide-react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import ComponentPickerModal from "./ComponentPickerModal";
import { SpacingControlPopover } from "./SpacingControlPopover";
import type { Section } from "@shared/schema";

interface AddSectionButtonProps {
  insertIndex: number;
  sections?: Section[];
  contentType?: string;
  slug?: string;
  locale?: string;
  isSharedTemplate?: boolean;
}

export function AddSectionButton({ 
  insertIndex,
  sections = [],
  contentType, 
  slug, 
  locale,
  isSharedTemplate,
}: AddSectionButtonProps) {
  const editMode = useEditModeOptional();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  if (!editMode || !editMode.isEditMode) {
    return null;
  }
  
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  return (
    <>
      <div 
        className="relative h-0 group z-30"
        data-testid={`add-section-zone-${insertIndex}`}
      >
        <div className="absolute inset-x-0 top-0 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex-1 h-px bg-primary/40" />
          <div className="mx-3 flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-primary text-primary bg-background shadow-sm hover:bg-primary/10 hover:px-4 hover:py-2 hover:gap-2 transition-all duration-200"
              data-testid={`button-add-section-${insertIndex}`}
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs font-medium">Add</span>
            </button>
            <SpacingControlPopover
              insertIndex={insertIndex}
              sections={sections}
              contentType={contentType}
              slug={slug}
              locale={locale}
            />
          </div>
          <div className="flex-1 h-px bg-primary/40" />
        </div>
      </div>
      {isModalOpen && (
        <ComponentPickerModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          insertIndex={insertIndex}
          contentType={contentType}
          slug={slug}
          locale={locale}
          isSharedTemplate={isSharedTemplate}
        />
      )}
    </>
  );
}
