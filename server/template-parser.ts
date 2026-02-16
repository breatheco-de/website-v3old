const TEMPLATE_REGEX = /\{\{\s*([^|}]+?)\s*(?:\|\s*([\s\S]*?))?\s*\}\}/g;

export interface TemplateToken {
  original: string;
  expression: string;
  defaultValue: string;
  start: number;
  end: number;
}

export function parseTemplateTokens(text: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      original: match[0],
      expression: match[1].trim(),
      defaultValue: (match[2] || "").trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

export interface ResolvedToken extends TemplateToken {
  resolvedValue: string;
  source: "condition" | "location" | "region" | "locale" | "default" | "inline";
}

export function resolveTokens(
  text: string,
  tokens: TemplateToken[],
  resolveValue: (expression: string) => { value: string; source: ResolvedToken["source"] } | null,
): { text: string; resolvedTokens: ResolvedToken[] } {
  const resolvedTokens: ResolvedToken[] = [];
  let result = text;
  let offset = 0;

  for (const token of tokens) {
    const resolved = resolveValue(token.expression);
    const value = resolved?.value || token.defaultValue || token.expression;
    const source = resolved?.source || "inline";

    resolvedTokens.push({
      ...token,
      resolvedValue: value,
      source,
      start: token.start + offset,
      end: token.start + offset + value.length,
    });

    result =
      result.slice(0, token.start + offset) +
      value +
      result.slice(token.end + offset);

    offset += value.length - token.original.length;
  }

  return { text: result, resolvedTokens };
}

export function hasTemplateVariables(text: string): boolean {
  return TEMPLATE_REGEX.test(text);
}
