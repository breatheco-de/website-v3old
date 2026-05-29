import { useState, useEffect, useRef } from "react";

interface UndoRedoState<T> {
  undoStack: T[];
  redoStack: T[];
}

interface UndoRedoResult<T> {
  pushState: (state: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

const MAX_HISTORY_SIZE = 50;

function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (element.getAttribute("contenteditable") === "true") return true;
  
  const isCodeMirror = element.closest(".cm-editor") !== null;
  if (isCodeMirror) return true;
  
  const isRadixSelect = element.closest("[data-radix-select-viewport]") !== null;
  if (isRadixSelect) return true;
  
  return false;
}

function safeClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    if (typeof value === "string") {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }
}

export function useUndoRedo<T>(
  currentState: T,
  onRestore: (state: T) => void,
  options: { enableKeyboardShortcuts?: boolean } = {}
): UndoRedoResult<T> {
  const { enableKeyboardShortcuts = true } = options;
  
  const [history, setHistory] = useState<UndoRedoState<T>>({
    undoStack: [],
    redoStack: [],
  });
  
  const currentStateRef = useRef<T>(currentState);
  const isRestoringRef = useRef(false);
  
  useEffect(() => {
    if (!isRestoringRef.current) {
      currentStateRef.current = currentState;
    }
  }, [currentState]);

  const pushState = (state: T) => {
    if (isRestoringRef.current) return;
    
    setHistory(prev => {
      const newUndoStack = [...prev.undoStack, safeClone(state)];
      if (newUndoStack.length > MAX_HISTORY_SIZE) {
        newUndoStack.shift();
      }
      return {
        undoStack: newUndoStack,
        redoStack: [],
      };
    });
  };

  const undo = (): T | null => {
    let restoredState: T | null = null;
    
    setHistory(prev => {
      if (prev.undoStack.length === 0) return prev;
      
      const newUndoStack = [...prev.undoStack];
      const stateToRestore = newUndoStack.pop()!;
      
      const newRedoStack = [...prev.redoStack, safeClone(currentStateRef.current)];
      if (newRedoStack.length > MAX_HISTORY_SIZE) {
        newRedoStack.shift();
      }
      
      restoredState = stateToRestore;
      
      return {
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
    
    if (restoredState !== null) {
      isRestoringRef.current = true;
      onRestore(restoredState);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    }
    
    return restoredState;
  };

  const redo = (): T | null => {
    let restoredState: T | null = null;
    
    setHistory(prev => {
      if (prev.redoStack.length === 0) return prev;
      
      const newRedoStack = [...prev.redoStack];
      const stateToRestore = newRedoStack.pop()!;
      
      const newUndoStack = [...prev.undoStack, safeClone(currentStateRef.current)];
      if (newUndoStack.length > MAX_HISTORY_SIZE) {
        newUndoStack.shift();
      }
      
      restoredState = stateToRestore;
      
      return {
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
    
    if (restoredState !== null) {
      isRestoringRef.current = true;
      onRestore(restoredState);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    }
    
    return restoredState;
  };

  const clear = () => {
    setHistory({ undoStack: [], redoStack: [] });
  };

  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(document.activeElement)) {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo]);

  return {
    pushState,
    undo,
    redo,
    canUndo: history.undoStack.length > 0,
    canRedo: history.redoStack.length > 0,
    clear,
  };
}
