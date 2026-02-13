import { createContext, useContext, useMemo, Children, isValidElement, cloneElement } from "react";
import type { ReactNode, ReactElement } from "react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VariableInfo {
  path: string;
  variable: string;
  value: string;
  source: string;
  defaultValue: string;
}

interface VariableHighlightContextValue {
  variables: VariableInfo[];
  sectionIndex: number;
}

const VariableHighlightContext = createContext<VariableHighlightContextValue | null>(null);

function InlineHighlight({
  children,
  variable,
  source,
  defaultValue,
}: {
  children: ReactNode;
  variable: string;
  source: string;
  defaultValue: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="variable-highlight"
          style={{
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textDecorationColor: "rgb(139, 92, 246)",
            textDecorationThickness: "2px",
            textUnderlineOffset: "3px",
            borderRadius: "2px",
            cursor: "help",
          }}
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
          <div className="opacity-80">Default: {defaultValue}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const SKIP_ELEMENTS = new Set(["img", "video", "iframe", "svg", "input", "textarea", "select"]);

function highlightChildren(children: ReactNode, variablesByValue: Map<string, VariableInfo>): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string" && child.trim().length > 0) {
      const match = variablesByValue.get(child);
      if (match) {
        return (
          <InlineHighlight
            variable={match.variable}
            source={match.source}
            defaultValue={match.defaultValue}
          >
            {child}
          </InlineHighlight>
        );
      }
      return child;
    }

    if (isValidElement(child)) {
      const el = child as ReactElement<Record<string, unknown>>;
      const type = el.type;

      if (typeof type === "string" && SKIP_ELEMENTS.has(type)) {
        return child;
      }

      if (el.props && el.props.children != null) {
        const newChildren = highlightChildren(el.props.children as ReactNode, variablesByValue);
        return cloneElement(el, { children: newChildren });
      }
    }

    return child;
  });
}

export function VariableHighlightProvider({
  children,
  variables,
  sectionIndex,
}: {
  children: ReactNode;
  variables: VariableInfo[];
  sectionIndex: number;
}) {
  const editMode = useEditModeOptional();
  const isEditMode = editMode?.isEditMode ?? false;

  const contextValue = useMemo(() => ({ variables, sectionIndex }), [variables, sectionIndex]);

  const processedChildren = useMemo(() => {
    if (!isEditMode || variables.length === 0) return children;

    const variablesByValue = new Map<string, VariableInfo>();
    for (const v of variables) {
      variablesByValue.set(v.value, v);
    }

    return highlightChildren(children, variablesByValue);
  }, [children, variables, isEditMode]);

  return (
    <VariableHighlightContext.Provider value={contextValue}>
      {processedChildren}
    </VariableHighlightContext.Provider>
  );
}

export function useVariableText() {
  const ctx = useContext(VariableHighlightContext);
  const editMode = useEditModeOptional();
  const isEditMode = editMode?.isEditMode ?? false;

  return useMemo(() => {
    if (!isEditMode || !ctx || ctx.variables.length === 0) {
      return (text: ReactNode) => text;
    }

    const variablesByValue = new Map<string, VariableInfo>();
    for (const v of ctx.variables) {
      variablesByValue.set(v.value, v);
    }

    return (text: ReactNode, path?: string): ReactNode => {
      if (path) {
        const sectionPrefix = `sections[${ctx.sectionIndex}].`;
        const fullPath = `${sectionPrefix}${path}`;
        const match = ctx.variables.find(v => v.path === fullPath);
        if (match) {
          return (
            <InlineHighlight
              variable={match.variable}
              source={match.source}
              defaultValue={match.defaultValue}
            >
              {text}
            </InlineHighlight>
          );
        }
      }

      if (typeof text === "string") {
        const match = variablesByValue.get(text);
        if (match) {
          return (
            <InlineHighlight
              variable={match.variable}
              source={match.source}
              defaultValue={match.defaultValue}
            >
              {text}
            </InlineHighlight>
          );
        }
      }

      return text;
    };
  }, [isEditMode, ctx]);
}
