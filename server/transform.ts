import vm from "vm";

export const FUNCTION_PREFIX = "function:";

const transformTimeoutLastWarn = new Map<string, number>();

function warnTransformTimeout(contentType: string, slug: string, fieldPath: string, message: string): void {
  const key = `${contentType}:${slug}:${fieldPath}`;
  const now = Date.now();
  const last = transformTimeoutLastWarn.get(key) ?? 0;
  if (now - last >= 60_000) {
    transformTimeoutLastWarn.set(key, now);
    console.warn(`[Transform] Runtime error in transformer (${contentType}/${slug} field=${fieldPath}): ${message}`);
  }
}

export function getValueByPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function isTransformer(value: string): boolean {
  return value.startsWith(FUNCTION_PREFIX);
}

export function extractFunctionBody(prefixedValue: string): string {
  const encoded = prefixedValue.slice(FUNCTION_PREFIX.length);
  return Buffer.from(encoded, "base64").toString("utf-8");
}

interface CompiledTransformer {
  source: string;
  script: vm.Script;
}

const compiledCache = new Map<string, CompiledTransformer | null>();

export function compileTransformer(prefixedValue: string): CompiledTransformer | null {
  if (compiledCache.has(prefixedValue)) {
    return compiledCache.get(prefixedValue)!;
  }

  try {
    const body = extractFunctionBody(prefixedValue);
    const wrappedSource = `(__fn_expr__ = ${body})(__value__, __item__)`;
    const script = new vm.Script(wrappedSource, { filename: "transformer.js" });
    const compiled: CompiledTransformer = { source: body, script };
    compiledCache.set(prefixedValue, compiled);
    return compiled;
  } catch (err) {
    console.warn(`[Transform] Failed to compile transformer: ${err}`);
    compiledCache.set(prefixedValue, null);
    return null;
  }
}

export function runTransformer(
  compiled: CompiledTransformer,
  value: unknown,
  item: Record<string, unknown>,
  context?: { contentType?: string; slug?: string; fieldPath?: string },
): unknown {
  try {
    const sandbox = { __value__: value, __item__: item, __fn_expr__: undefined as unknown };
    const vmContext = vm.createContext(sandbox);
    return compiled.script.runInContext(vmContext, { timeout: 50 });
  } catch (err) {
    const contentType = context?.contentType ?? "unknown";
    const slug = context?.slug ?? "unknown";
    const fieldPath = context?.fieldPath ?? "unknown";
    const errMsg = err instanceof Error ? err.message : String(err);
    warnTransformTimeout(contentType, slug, fieldPath, errMsg);
    return undefined;
  }
}

export function resolveFieldValue(
  sourcePath: string,
  item: Record<string, unknown>,
  targetKey?: string,
  context?: { contentType?: string; slug?: string; fieldPath?: string },
): unknown {
  if (isTransformer(sourcePath)) {
    const compiled = compileTransformer(sourcePath);
    if (!compiled) return undefined;
    const rawValue = targetKey ? item[targetKey] : undefined;
    const resolvedContext = context ?? {
      fieldPath: targetKey ?? sourcePath.slice(0, 40),
    };
    return runTransformer(compiled, rawValue, item, resolvedContext);
  }
  return getValueByPath(item, sourcePath);
}

export function applyTransformIfNeeded(sourceMapping: string, rawValue: string): string {
  if (!isTransformer(sourceMapping)) return rawValue;
  const compiled = compileTransformer(sourceMapping);
  if (!compiled) return rawValue;
  const result = runTransformer(compiled, rawValue, {});
  return result != null ? String(result) : rawValue;
}
