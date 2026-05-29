import { useState, useEffect, useRef } from "react";
import type { Section } from "@shared/schema";

interface PageSnapshot {
  sections: Section[];
  timestamp: number;
  description: string;
}

interface UsePageHistoryOptions {
  maxHistory?: number;
  enabled?: boolean;
}

interface UsePageHistoryReturn {
  pushSnapshot: (sections: Section[], description: string) => void;
  pushToRedoStack: (sections: Section[], description: string) => void;
  pushToUndoStackNoRedoClear: (sections: Section[], description: string) => void;
  undo: () => Section[] | null;
  redo: () => Section[] | null;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  undoCount: number;
  redoCount: number;
}

function deepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

export function usePageHistory(
  options: UsePageHistoryOptions = {}
): UsePageHistoryReturn {
  const { maxHistory = 50, enabled = true } = options;

  const [undoStack, setUndoStack] = useState<PageSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<PageSnapshot[]>([]);
  
  const isEditableElementFocused = (): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }

    if (activeElement.getAttribute("contenteditable") === "true") {
      return true;
    }

    const isCodeMirror =
      activeElement.classList.contains("cm-content") ||
      activeElement.closest(".cm-editor") !== null;
    if (isCodeMirror) return true;

    const radixRoles = ["combobox", "listbox", "menu", "menuitem", "option"];
    const role = activeElement.getAttribute("role");
    if (role && radixRoles.includes(role)) return true;

    return false;
  };

  const pushSnapshot = (sections: Section[], description: string) => {
    if (!enabled) return;

    const snapshot: PageSnapshot = {
      sections: deepClone(sections),
      timestamp: Date.now(),
      description,
    };

    setUndoStack((prev) => {
      const newStack = [...prev, snapshot];
      if (newStack.length > maxHistory) {
        return newStack.slice(-maxHistory);
      }
      return newStack;
    });

    setRedoStack([]);
  };

  const pushToRedoStack = (sections: Section[], description: string) => {
    const snapshot: PageSnapshot = {
      sections: deepClone(sections),
      timestamp: Date.now(),
      description,
    };
    setRedoStack((prev) => [...prev, snapshot]);
  };
  
  // Push to undo stack without clearing redo stack (used during redo operation)
  const pushToUndoStackNoRedoClear = (sections: Section[], description: string) => {
    if (!enabled) return;

    const snapshot: PageSnapshot = {
      sections: deepClone(sections),
      timestamp: Date.now(),
      description,
    };

    setUndoStack((prev) => {
      const newStack = [...prev, snapshot];
      if (newStack.length > maxHistory) {
        return newStack.slice(-maxHistory);
      }
      return newStack;
    });
  };
  
  const undo = (): Section[] | null => {
    if (undoStack.length === 0) return null;

    const lastSnapshot = undoStack[undoStack.length - 1];
    
    setUndoStack((prev) => prev.slice(0, -1));
    
    return deepClone(lastSnapshot.sections);
  };

  const redo = (): Section[] | null => {
    if (redoStack.length === 0) return null;

    const lastSnapshot = redoStack[redoStack.length - 1];
    
    setRedoStack((prev) => prev.slice(0, -1));
    
    return deepClone(lastSnapshot.sections);
  };

  const clearHistory = () => {
    setUndoStack([]);
    setRedoStack([]);
  };

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElementFocused()) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const sections = redo();
          if (sections) {
            window.dispatchEvent(
              new CustomEvent("page-history-restore", { detail: { sections, type: "redo" } })
            );
          }
        } else {
          e.preventDefault();
          e.stopPropagation();
          const sections = undo();
          if (sections) {
            window.dispatchEvent(
              new CustomEvent("page-history-restore", { detail: { sections, type: "undo" } })
            );
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, undo, redo, isEditableElementFocused]);

  return {
    pushSnapshot,
    pushToRedoStack,
    pushToUndoStackNoRedoClear,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    clearHistory,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
  };
}
