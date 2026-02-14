const VAR_PATTERN = /\{\{[\s]*([^}|]+?)(?:\s*\|\s*([^}]*?))?\s*\}\}/g;

export interface EscapeResult {
  escaped: string;
  map: Map<string, string>;
}

export function escapeTemplateVars(yamlStr: string): EscapeResult {
  const map = new Map<string, string>();
  let counter = 0;
  const escaped = yamlStr.replace(VAR_PATTERN, (match) => {
    const placeholder = `TPLVAR_${counter++}`;
    map.set(placeholder, match);
    return placeholder;
  });
  return { escaped, map };
}

export function unescapeStringVars(str: string, map: Map<string, string>): string {
  let result = str;
  for (const [placeholder, original] of map) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

export function unescapeObjectVars(obj: unknown, map: Map<string, string>): unknown {
  if (map.size === 0) return obj;
  if (typeof obj === "string") {
    return unescapeStringVars(obj, map);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => unescapeObjectVars(item, map));
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = unescapeObjectVars(value, map);
    }
    return result;
  }
  return obj;
}

export function unescapeYamlDump(yamlStr: string, map: Map<string, string>): string {
  let result = yamlStr;
  for (const [placeholder, original] of map) {
    result = result.split(`"${placeholder}"`).join(original);
    result = result.split(`'${placeholder}'`).join(original);
    result = result.split(placeholder).join(original);
  }
  return result;
}
