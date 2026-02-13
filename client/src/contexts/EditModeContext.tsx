import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import type { Section, EditOperation } from "@shared/schema";
import { editContent } from "@/lib/contentApi";

export type PreviewBreakpoint = 'desktop' | 'mobile';

const PREVIEW_BREAKPOINT_KEY = '4geeks_preview_breakpoint';
const EDIT_MODE_KEY = '4geeks_edit_mode';

function getStoredPreviewBreakpoint(): PreviewBreakpoint {
  if (typeof localStorage === 'undefined') return 'desktop';
  const stored = localStorage.getItem(PREVIEW_BREAKPOINT_KEY);
  if (stored === 'mobile' || stored === 'desktop') return stored;
  return 'desktop';
}

function getStoredEditMode(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(EDIT_MODE_KEY) === 'true';
}

interface EditModeContextValue {
  isEditMode: boolean;
  enableEditMode: () => void;
  disableEditMode: () => void;
  toggleEditMode: () => void;
  selectedSectionIndex: number | null;
  setSelectedSectionIndex: (index: number | null) => void;
  pendingChanges: Map<string, EditOperation[]>;
  addPendingChange: (pageKey: string, operation: EditOperation) => void;
  clearPendingChanges: (pageKey: string) => void;
  hasPendingChanges: boolean;
  isSaving: boolean;
  saveChanges: (pageKey: string, contentType: "program" | "landing" | "location", slug: string, locale: string) => Promise<boolean>;
  previewBreakpoint: PreviewBreakpoint;
  setPreviewBreakpoint: (breakpoint: PreviewBreakpoint) => void;
  togglePreviewBreakpoint: () => void;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

interface EditModeProviderProps {
  children: React.ReactNode;
}

// Check if edit_mode=true is in URL params
function shouldAutoEnableEditMode(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('edit_mode') === 'true';
}

export function EditModeProvider({ children }: EditModeProviderProps) {
  const [isEditMode, setIsEditMode] = useState(() => shouldAutoEnableEditMode() || getStoredEditMode());
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, EditOperation[]>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [previewBreakpoint, setPreviewBreakpointState] = useState<PreviewBreakpoint>(getStoredPreviewBreakpoint);

  const setPreviewBreakpoint = useCallback((breakpoint: PreviewBreakpoint) => {
    setPreviewBreakpointState(breakpoint);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREVIEW_BREAKPOINT_KEY, breakpoint);
    }
  }, []);

  const togglePreviewBreakpoint = useCallback(() => {
    setPreviewBreakpointState(prev => {
      const next = prev === 'desktop' ? 'mobile' : 'desktop';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREVIEW_BREAKPOINT_KEY, next);
      }
      return next;
    });
  }, []);

  const persistEditMode = useCallback((value: boolean) => {
    if (typeof localStorage !== 'undefined') {
      if (value) {
        localStorage.setItem(EDIT_MODE_KEY, 'true');
      } else {
        localStorage.removeItem(EDIT_MODE_KEY);
      }
    }
  }, []);

  const enableEditMode = useCallback(() => {
    setIsEditMode(true);
    persistEditMode(true);
  }, [persistEditMode]);

  const disableEditMode = useCallback(() => {
    setIsEditMode(false);
    persistEditMode(false);
    setSelectedSectionIndex(null);
  }, [persistEditMode]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => {
      const next = !prev;
      persistEditMode(next);
      if (prev) {
        setSelectedSectionIndex(null);
      }
      return next;
    });
  }, [persistEditMode]);

  const addPendingChange = useCallback((pageKey: string, operation: EditOperation) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(pageKey) || [];
      next.set(pageKey, [...existing, operation]);
      return next;
    });
  }, []);

  const clearPendingChanges = useCallback((pageKey: string) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      next.delete(pageKey);
      return next;
    });
  }, []);

  const hasPendingChanges = useMemo(() => {
    return pendingChanges.size > 0 && Array.from(pendingChanges.values()).some(ops => ops.length > 0);
  }, [pendingChanges]);

  const saveChanges = useCallback(async (
    pageKey: string,
    contentType: "program" | "landing" | "location",
    slug: string,
    locale: string
  ): Promise<boolean> => {
    const operations = pendingChanges.get(pageKey);
    if (!operations || operations.length === 0) {
      return true;
    }

    setIsSaving(true);
    try {
      const result = await editContent({
        contentType,
        slug,
        locale,
        operations,
      });

      if (result.success) {
        clearPendingChanges(pageKey);
        return true;
      } else {
        console.error("Failed to save changes:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, clearPendingChanges]);

  const value = useMemo(() => ({
    isEditMode,
    enableEditMode,
    disableEditMode,
    toggleEditMode,
    selectedSectionIndex,
    setSelectedSectionIndex,
    pendingChanges,
    addPendingChange,
    clearPendingChanges,
    hasPendingChanges,
    isSaving,
    saveChanges,
    previewBreakpoint,
    setPreviewBreakpoint,
    togglePreviewBreakpoint,
  }), [
    isEditMode,
    enableEditMode,
    disableEditMode,
    toggleEditMode,
    selectedSectionIndex,
    pendingChanges,
    addPendingChange,
    clearPendingChanges,
    hasPendingChanges,
    isSaving,
    saveChanges,
    previewBreakpoint,
    setPreviewBreakpoint,
    togglePreviewBreakpoint,
  ]);

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error("useEditMode must be used within an EditModeProvider");
  }
  return context;
}

// Safe hook that returns null if not within provider (for lazy loading)
export function useEditModeOptional(): EditModeContextValue | null {
  return useContext(EditModeContext);
}
