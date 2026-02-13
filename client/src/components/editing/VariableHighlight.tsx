import { createContext, useContext, useMemo, Children, isValidElement, cloneElement } from "react";
import type { ReactNode, ReactElement } from "react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVariableDefinitions, useVariableContext } from "@/hooks/useVariables";
import {
  resolveVariable,
  extractTemplateTokens,
  type VariableDefinition,
  type VariableContext as VarCtx,
} from "@/lib/variable-resolver";

interface VariableHighlightContextValue {
  definitions: Record<string, VariableDefinition>;
  context: VarCtx;
  isEditMode: boolean;
}

const VariableHighlightContext = createContext<VariableHighlightContextValue | null>(null);

function InlineHighlight({
  children,
  variable,
  source,
  defaultValue,
  isEditMode,
}: {
  children: ReactNode;
  variable: string;
  source: string;
  defaultValue: string;
  isEditMode: boolean;
}) {
  const editModeStyles: React.CSSProperties = {
    backgroundColor: "rgba(250, 204, 21, 0.25)",
    border: "1.5px solid rgb(239, 68, 68)",
    borderRadius: "4px",
    padding: "1px 4px",
    cursor: "help",
  };

  const previewStyles: React.CSSProperties = {
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: "rgb(139, 92, 246)",
    textDecorationThickness: "2px",
    textUnderlineOffset: "3px",
    borderRadius: "2px",
    cursor: "help",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="variable-highlight"
          style={isEditMode ? editModeStyles : previewStyles}
          data-testid={`variable-highlight-${variable}`}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-violet-600 text-white border-violet-700 max-w-xs"
      >
        <div className="text-xs space-y-0.5">
          <div className="font-mono font-semibold">{`{{ ${variable} }}`}</div>
          <div className="opacity-80">Source: {source}</div>
          {defaultValue && <div className="opacity-80">Default: {defaultValue}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const SKIP_ELEMENTS = new Set(["img", "video", "iframe", "svg", "input", "textarea", "select"]);

function resolveAndHighlightText(
  text: string,
  definitions: Record<string, VariableDefinition>,
  context: VarCtx,
  isEditMode: boolean,
): ReactNode {
  const tokens = extractTemplateTokens(text);
  if (tokens.length === 0) return text;

  const parts: ReactNode[] = [];
  let lastEnd = 0;

  for (const token of tokens) {
    if (token.start > lastEnd) {
      parts.push(text.slice(lastEnd, token.start));
    }

    const result = resolveVariable(token.variableName, definitions, context);
    const value = result?.value || token.defaultValue || token.variableName;
    const source = result?.source || (token.defaultValue ? "inline" : "unresolved");

    parts.push(
      <InlineHighlight
        key={`var-${token.start}`}
        variable={token.variableName}
        source={source}
        defaultValue={token.defaultValue}
        isEditMode={isEditMode}
      >
        {value}
      </InlineHighlight>
    );

    lastEnd = token.end;
  }

  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function processChildren(
  children: ReactNode,
  definitions: Record<string, VariableDefinition>,
  context: VarCtx,
  isEditMode: boolean,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string" && child.trim().length > 0) {
      return resolveAndHighlightText(child, definitions, context, isEditMode);
    }

    if (isValidElement(child)) {
      const el = child as ReactElement<Record<string, unknown>>;
      const type = el.type;

      if (typeof type === "string" && SKIP_ELEMENTS.has(type)) {
        return child;
      }

      if (el.props && el.props.children != null) {
        const newChildren = processChildren(el.props.children as ReactNode, definitions, context, isEditMode);
        return cloneElement(el, { children: newChildren });
      }
    }

    return child;
  });
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

  const contextValue = useMemo(() => ({
    definitions: definitions || {},
    context: varContext,
    isEditMode,
  }), [definitions, varContext, isEditMode]);

  const processedChildren = useMemo(() => {
    if (!definitions || Object.keys(definitions).length === 0) return children;
    return processChildren(children, definitions, varContext, isEditMode);
  }, [children, definitions, varContext, isEditMode]);

  return (
    <VariableHighlightContext.Provider value={contextValue}>
      {processedChildren}
    </VariableHighlightContext.Provider>
  );
}

export function useVariableText() {
  const ctx = useContext(VariableHighlightContext);

  return useMemo(() => {
    if (!ctx || Object.keys(ctx.definitions).length === 0) {
      return (text: ReactNode) => text;
    }

    return (text: ReactNode, _path?: string): ReactNode => {
      if (typeof text === "string") {
        return resolveAndHighlightText(text, ctx.definitions, ctx.context, ctx.isEditMode);
      }
      return text;
    };
  }, [ctx]);
}
