import { createContext, useContext, useMemo, useRef, useLayoutEffect, useCallback, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { useVariableDefinitions, useVariableContext } from "@/hooks/useVariables";
import {
  resolveVariable,
  type VariableDefinition,
  type VariableContext as VarCtx,
} from "@/lib/variable-resolver";
import { VariableDetailModal } from "./VariableDetailModal";

interface VariableHighlightContextValue {
  definitions: Record<string, VariableDefinition>;
  context: VarCtx;
  isEditMode: boolean;
}

const VariableHighlightContext = createContext<VariableHighlightContextValue | null>(null);

const TEMPLATE_REGEX = /\{\{\s*([^|}]+?)\s*(?:\|\s*([\s\S]*?))?\s*\}\}/g;

const VARIABLE_CLICK_EVENT = "variable-highlight-click";

interface VariableClickDetail {
  variableName: string;
  inlineDefault: string;
}

function highlightDomVariables(
  container: HTMLElement,
  definitions: Record<string, VariableDefinition>,
  context: VarCtx,
  isEditMode: boolean,
): (() => void) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent || "";
      TEMPLATE_REGEX.lastIndex = 0;
      if (TEMPLATE_REGEX.test(text)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  const replacements: { span: HTMLSpanElement; original: string }[] = [];

  for (const textNode of textNodes) {
    const text = textNode.textContent || "";
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    TEMPLATE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TEMPLATE_REGEX.exec(text)) !== null) {
      if (match.index > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, match.index)));
      }

      const varName = match[1].trim();
      const inlineDefault = match[2]?.trim() || "";
      const result = resolveVariable(varName, definitions, context);
      const resolvedValue = result?.value || inlineDefault || varName;
      const source = result?.source || (inlineDefault ? "inline" : "unresolved");

      const span = document.createElement("span");
      span.className = "variable-highlight-dom";
      span.textContent = resolvedValue;
      span.dataset.variableName = varName;
      span.dataset.variableSource = source;
      span.dataset.variableDefault = inlineDefault;
      span.dataset.testid = `variable-highlight-${varName}`;

      if (isEditMode) {
        span.style.backgroundColor = "rgba(250, 204, 21, 0.3)";
        span.style.outline = "2px solid rgb(239, 68, 68)";
        span.style.outlineOffset = "1px";
        span.style.borderRadius = "3px";
        span.style.cursor = "pointer";
        span.title = `Click to inspect {{ ${varName} }}`;

        span.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent<VariableClickDetail>(VARIABLE_CLICK_EVENT, {
              detail: { variableName: varName, inlineDefault },
            }),
          );
        });
      } else {
        span.style.textDecoration = "underline";
        span.style.textDecorationStyle = "dotted";
        span.style.textDecorationColor = "rgb(139, 92, 246)";
        span.style.textDecorationThickness = "2px";
        span.style.textUnderlineOffset = "3px";
        span.style.cursor = "help";
        span.title = `{{ ${varName} }}\nSource: ${source}${inlineDefault ? `\nDefault: ${inlineDefault}` : ""}`;
      }

      replacements.push({ span, original: match[0] });
      fragment.appendChild(span);
      lastEnd = match.index + match[0].length;
    }

    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return () => {
    for (const { span, original } of replacements) {
      if (span.parentNode) {
        span.parentNode.replaceChild(document.createTextNode(original), span);
      }
    }
  };
}

export function VariableHighlightProvider({
  children,
  sectionIndex: _sectionIndex,
}: {
  children: ReactNode;
  variables?: unknown[];
  sectionIndex: number;
}) {
  const editMode = useEditModeOptional();
  const isEditMode = editMode?.isEditMode ?? false;
  const { data: definitions } = useVariableDefinitions();
  const varContext = useVariableContext();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const contextValue = useMemo(() => ({
    definitions: definitions || {},
    context: varContext,
    isEditMode,
  }), [definitions, varContext, isEditMode]);

  useLayoutEffect(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!wrapperRef.current || !definitions || Object.keys(definitions).length === 0) {
      return;
    }

    cleanupRef.current = highlightDomVariables(
      wrapperRef.current,
      definitions,
      varContext,
      isEditMode,
    );

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [definitions, varContext, isEditMode, children]);

  return (
    <VariableHighlightContext.Provider value={contextValue}>
      <div ref={wrapperRef} style={{ display: "contents" }}>
        {children}
      </div>
    </VariableHighlightContext.Provider>
  );
}

export function VariableModalHost() {
  const [modalState, setModalState] = useState<{
    open: boolean;
    variableName: string;
    inlineDefault: string;
  }>({ open: false, variableName: "", inlineDefault: "" });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<VariableClickDetail>).detail;
      setModalState({
        open: true,
        variableName: detail.variableName,
        inlineDefault: detail.inlineDefault,
      });
    };

    window.addEventListener(VARIABLE_CLICK_EVENT, handler);
    return () => window.removeEventListener(VARIABLE_CLICK_EVENT, handler);
  }, []);

  return (
    <VariableDetailModal
      open={modalState.open}
      onOpenChange={(open) => setModalState((prev) => ({ ...prev, open }))}
      variableName={modalState.variableName}
      inlineDefault={modalState.inlineDefault}
    />
  );
}

export function useVariableText() {
  const ctx = useContext(VariableHighlightContext);

  return useCallback(
    (text: ReactNode, _path?: string): ReactNode => {
      return text;
    },
    [],
  );
}
