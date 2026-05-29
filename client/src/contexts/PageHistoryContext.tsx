import { createContext, useContext, useEffect, useState, useRef } from "react";
import type { Section } from "@shared/schema";
import { usePageHistory } from "@/hooks/usePageHistory";
import { editContent } from "@/lib/contentApi";
import { emitContentUpdated } from "@/lib/contentEvents";
import { useToast } from "@/hooks/use-toast";

interface PageHistoryContextValue {
  pushSnapshot: (sections: Section[], description: string) => void;
  saveCurrentSnapshot: (description: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  clearHistory: () => void;
  isRestoring: boolean;
  setPageContext: (context: PageContext | null) => void;
}

interface PageContext {
  contentType: string;
  slug: string;
  locale: string;
  variant?: string;
  version?: number;
  onSectionsRestore: (sections: Section[]) => void;
  getCurrentSections: () => Section[];
}

const PageHistoryContext = createContext<PageHistoryContextValue | null>(null);

interface PageHistoryProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export function PageHistoryProvider({ children, enabled = true }: PageHistoryProviderProps) {
  const { toast } = useToast();
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const {
    pushSnapshot,
    pushToRedoStack,
    pushToUndoStackNoRedoClear,
    canUndo,
    canRedo,
    clearHistory,
    undoCount,
    redoCount,
  } = usePageHistory({ enabled, maxHistory: 30 });
  
  const pageContextRef = useRef<PageContext | null>(null);
  
  useEffect(() => {
    pageContextRef.current = pageContext;
  }, [pageContext]);
  
  const saveCurrentSnapshot = (description: string) => {
    const ctx = pageContextRef.current;
    if (!ctx) {
      console.warn("[PageHistory] No page context, cannot save snapshot");
      return;
    }
    const currentSections = ctx.getCurrentSections();
    if (currentSections && currentSections.length > 0) {
      pushSnapshot(currentSections, description);
    }
  };

  const handleRestore = async (event: CustomEvent<{ sections: Section[]; type: "undo" | "redo" }>) => {
    if (!pageContext) {
      console.warn("[PageHistory] No page context set, cannot restore");
      return;
    }

    const { sections, type } = event.detail;
    if (!sections || sections.length === 0) {
      return;
    }

    setIsRestoring(true);

    try {
      const currentSections = pageContext.getCurrentSections();
      
      // When undoing, push current state to redo stack
      // When redoing, push current state to undo stack (without clearing redo)
      if (type === "undo") {
        pushToRedoStack(currentSections, "Estado antes de deshacer");
      } else if (type === "redo") {
        pushToUndoStackNoRedoClear(currentSections, "Estado antes de rehacer");
      }

      const result = await editContent({
        contentType: pageContext.contentType,
        slug: pageContext.slug,
        locale: pageContext.locale,
        variant: pageContext.variant,
        version: pageContext.version,
        operations: [
          {
            action: "replace_all_sections",
            sections: sections as unknown as Record<string, unknown>[],
          },
        ],
      });

      if (result.success) {
        pageContext.onSectionsRestore(sections);
        emitContentUpdated({
          contentType: pageContext.contentType,
          slug: pageContext.slug,
          locale: pageContext.locale,
        });

        toast({
          title: type === "undo" ? "Cambio deshecho" : "Cambio rehecho",
          description: type === "undo" 
            ? "Se restauró el estado anterior de la página"
            : "Se restauró el estado siguiente de la página",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo restaurar el estado",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[PageHistory] Error restoring:", error);
      toast({
        title: "Error",
        description: "Error al restaurar el estado de la página",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      handleRestore(event as CustomEvent<{ sections: Section[]; type: "undo" | "redo" }>);
    };
    window.addEventListener("page-history-restore", handler);
    return () => {
      window.removeEventListener("page-history-restore", handler);
    };
  }, [pageContext, pushToRedoStack, pushToUndoStackNoRedoClear, toast]);

  const value: PageHistoryContextValue = {
    pushSnapshot,
    saveCurrentSnapshot,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    clearHistory,
    isRestoring,
    setPageContext,
  };

  return (
    <PageHistoryContext.Provider value={value}>
      {children}
    </PageHistoryContext.Provider>
  );
}

export function usePageHistoryContext() {
  const context = useContext(PageHistoryContext);
  if (!context) {
    throw new Error("usePageHistoryContext must be used within a PageHistoryProvider");
  }
  return context;
}

export function usePageHistoryOptional(): PageHistoryContextValue | null {
  return useContext(PageHistoryContext);
}
