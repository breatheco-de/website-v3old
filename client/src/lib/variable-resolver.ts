const TEMPLATE_REGEX = /\{\{\s*([^|}]+?)\s*(?:\|\s*([\s\S]*?))?\s*\}\}/g;

export interface VariableCondition {
  query: Record<string, string>;
  value: string;
}

export interface VariableDefinition {
  default?: string;
  conditions?: VariableCondition[];
  by_locale?: Record<string, string>;
  by_region?: Record<string, string>;
  by_location?: Record<string, string>;
}

export interface VariableContext {
  location?: string;
  region?: string;
  locale?: string;
}

export interface ResolvedVariable {
  original: string;
  variableName: string;
  resolvedValue: string;
  source: "condition" | "location" | "region" | "locale" | "default" | "inline";
  defaultValue: string;
}

export function resolveVariable(
  name: string,
  definitions: Record<string, VariableDefinition>,
  context: VariableContext,
): { value: string; source: ResolvedVariable["source"] } | null {
  const def = definitions[name];
  if (!def) return null;

  if (def.conditions && def.conditions.length > 0) {
    for (const condition of def.conditions) {
      const matches = Object.entries(condition.query).every(([key, val]) => {
        const contextVal = (context as Record<string, string | undefined>)[key];
        return contextVal === val;
      });
      if (matches) {
        return { value: condition.value, source: "condition" };
      }
    }
  }

  if (context.location && def.by_location?.[context.location]) {
    return { value: def.by_location[context.location], source: "location" };
  }
  if (context.region && def.by_region?.[context.region]) {
    return { value: def.by_region[context.region], source: "region" };
  }
  if (context.locale && def.by_locale?.[context.locale]) {
    return { value: def.by_locale[context.locale], source: "locale" };
  }
  if (def.default !== undefined) {
    return { value: def.default, source: "default" };
  }
  return null;
}

export function resolveTemplateString(
  text: string,
  definitions: Record<string, VariableDefinition>,
  context: VariableContext,
): { text: string; variables: ResolvedVariable[] } {
  const variables: ResolvedVariable[] = [];
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);

  const resolved = text.replace(regex, (match, expression: string, inlineDefault: string) => {
    const name = expression.trim();
    const defVal = (inlineDefault || "").trim();
    const result = resolveVariable(name, definitions, context);
    const value = result?.value || defVal || name;
    const source = result?.source || "inline";

    variables.push({
      original: match,
      variableName: name,
      resolvedValue: value,
      source,
      defaultValue: defVal,
    });

    return value;
  });

  return { text: resolved, variables };
}

export function resolveDeep(
  data: unknown,
  definitions: Record<string, VariableDefinition>,
  context: VariableContext,
): { data: unknown; variables: ResolvedVariable[] } {
  const allVariables: ResolvedVariable[] = [];

  function walk(value: unknown): unknown {
    if (typeof value === "string") {
      const { text, variables } = resolveTemplateString(value, definitions, context);
      allVariables.push(...variables);
      return text;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = walk(v);
      }
      return result;
    }
    return value;
  }

  const resolved = walk(data);
  return { data: resolved, variables: allVariables };
}

export function hasTemplateVariables(text: string): boolean {
  return new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags).test(text);
}

export function extractTemplateTokens(text: string): Array<{ original: string; variableName: string; defaultValue: string; start: number; end: number }> {
  const tokens: Array<{ original: string; variableName: string; defaultValue: string; start: number; end: number }> = [];
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      original: match[0],
      variableName: match[1].trim(),
      defaultValue: (match[2] || "").trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}
