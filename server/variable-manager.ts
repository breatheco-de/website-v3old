import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  parseTemplateTokens,
  resolveTokens,
  type ResolvedToken,
} from "./template-parser";

const VARIABLES_PATH = path.join(
  process.cwd(),
  "marketing-content",
  "variables.yml",
);

export interface VariableDefinition {
  default?: string;
  by_locale?: Record<string, string>;
  by_region?: Record<string, string>;
  by_location?: Record<string, string>;
}

export interface VariableContext {
  location?: string;
  region?: string;
  locale?: string;
}

export interface ResolveResult {
  data: unknown;
  variableMap: VariableMapEntry[];
}

export interface VariableMapEntry {
  path: string;
  variableName: string;
  resolvedValue: string;
  source: ResolvedToken["source"];
  defaultValue: string;
}

class VariableManager {
  private static instance: VariableManager;
  private variables: Record<string, VariableDefinition> = {};
  private lastModified: number = 0;
  private initialized = false;

  static getInstance(): VariableManager {
    if (!VariableManager.instance) {
      VariableManager.instance = new VariableManager();
    }
    return VariableManager.instance;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.load();
    } else {
      this.reloadIfChanged();
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(VARIABLES_PATH)) {
        console.warn("[VariableManager] variables.yml not found");
        this.variables = {};
        this.initialized = true;
        return;
      }

      const stat = fs.statSync(VARIABLES_PATH);
      const raw = fs.readFileSync(VARIABLES_PATH, "utf-8");
      const parsed = yaml.load(raw) as Record<string, VariableDefinition> | null;
      this.variables = parsed || {};
      this.lastModified = stat.mtimeMs;
      this.initialized = true;

      const count = Object.keys(this.variables).length;
      console.log(`[VariableManager] Loaded ${count} variable definitions`);
    } catch (err) {
      console.error("[VariableManager] Failed to load variables.yml:", err);
      this.variables = {};
      this.initialized = true;
    }
  }

  private reloadIfChanged(): void {
    try {
      if (!fs.existsSync(VARIABLES_PATH)) return;
      const stat = fs.statSync(VARIABLES_PATH);
      if (stat.mtimeMs > this.lastModified) {
        console.log("[VariableManager] variables.yml changed, reloading...");
        this.load();
      }
    } catch {
      // ignore
    }
  }

  resolveVariable(
    name: string,
    context: VariableContext,
  ): { value: string; source: ResolvedToken["source"] } | null {
    this.ensureInitialized();

    const def = this.variables[name];
    if (!def) return null;

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

  resolveString(text: string, context: VariableContext): {
    text: string;
    resolvedTokens: ResolvedToken[];
  } {
    const tokens = parseTemplateTokens(text);
    if (tokens.length === 0) return { text, resolvedTokens: [] };

    return resolveTokens(text, tokens, (expression) =>
      this.resolveVariable(expression, context),
    );
  }

  resolveDeep(
    data: unknown,
    context: VariableContext,
    currentPath: string = "",
  ): ResolveResult {
    const variableMap: VariableMapEntry[] = [];

    const resolved = this.resolveValue(data, context, currentPath, variableMap);

    return { data: resolved, variableMap };
  }

  private resolveValue(
    value: unknown,
    context: VariableContext,
    currentPath: string,
    variableMap: VariableMapEntry[],
  ): unknown {
    if (typeof value === "string") {
      const { text, resolvedTokens } = this.resolveString(value, context);
      for (const token of resolvedTokens) {
        variableMap.push({
          path: currentPath,
          variableName: token.expression,
          resolvedValue: token.resolvedValue,
          source: token.source,
          defaultValue: token.defaultValue,
        });
      }
      return text;
    }

    if (Array.isArray(value)) {
      return value.map((item, i) =>
        this.resolveValue(item, context, `${currentPath}[${i}]`, variableMap),
      );
    }

    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const childPath = currentPath ? `${currentPath}.${key}` : key;
        result[key] = this.resolveValue(val, context, childPath, variableMap);
      }
      return result;
    }

    return value;
  }

  getDefinitions(): Record<string, VariableDefinition> {
    this.ensureInitialized();
    return { ...this.variables };
  }

  getDefinition(name: string): VariableDefinition | null {
    this.ensureInitialized();
    return this.variables[name] || null;
  }

  updateVariable(
    name: string,
    level: string,
    key: string | undefined,
    value: string,
  ): void {
    this.ensureInitialized();

    if (!this.variables[name]) {
      this.variables[name] = {};
    }

    const def = this.variables[name];

    if (level === "default") {
      def.default = value;
    } else {
      const bucket = level as "by_locale" | "by_region" | "by_location";
      if (!def[bucket]) {
        def[bucket] = {};
      }
      if (key) {
        def[bucket]![key] = value;
      }
    }

    this.save();
  }

  deleteVariableEntry(
    name: string,
    level: string,
    key: string | undefined,
  ): boolean {
    this.ensureInitialized();

    const def = this.variables[name];
    if (!def) return false;

    if (level === "default") {
      delete def.default;
    } else {
      const bucket = level as "by_locale" | "by_region" | "by_location";
      if (key && def[bucket]) {
        delete def[bucket]![key];
        if (Object.keys(def[bucket]!).length === 0) {
          delete def[bucket];
        }
      }
    }

    this.save();
    return true;
  }

  private save(): void {
    try {
      const content = yaml.dump(this.variables, {
        lineWidth: -1,
        quotingType: '"',
        forceQuotes: true,
      });
      fs.writeFileSync(VARIABLES_PATH, content, "utf-8");
      const stat = fs.statSync(VARIABLES_PATH);
      this.lastModified = stat.mtimeMs;
      console.log("[VariableManager] Saved variables.yml");
    } catch (err) {
      console.error("[VariableManager] Failed to save variables.yml:", err);
      throw err;
    }
  }

  refresh(): void {
    this.load();
  }
}

export const variableManager = VariableManager.getInstance();
