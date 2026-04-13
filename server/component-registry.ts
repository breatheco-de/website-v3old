import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { escapeTemplateVars } from "../shared/templateVars";

const REGISTRY_PATH = path.join(process.cwd(), "marketing-content", "component-registry");

export interface ComponentSchema {
  name: string;
  version: string;
  component: string;
  file: string;
  description: string;
  when_to_use: string;
  section_defaults?: Record<string, unknown>;
  props: Record<string, unknown>;
}

export interface ComponentExample {
  name: string;
  description: string;
  yaml: string;
  variant?: string;
}

export interface ComponentVersion {
  version: string;
  schema: ComponentSchema;
  examples: ComponentExample[];
}

export interface ComponentInfo {
  type: string;
  versions: ComponentVersion[];
  latestVersion: string;
}

export interface RegistryOverview {
  components: Array<{
    type: string;
    name: string;
    description: string;
    latestVersion: string;
    versions: string[];
  }>;
}

function parseVersion(version: string): number[] {
  return version.replace('v', '').split('.').map(Number);
}

function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return bVal - aVal;
  }
  return 0;
}

export function listComponents(): string[] {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      return [];
    }
    return fs.readdirSync(REGISTRY_PATH).filter(dir => {
      const dirPath = path.join(REGISTRY_PATH, dir);
      return fs.statSync(dirPath).isDirectory();
    });
  } catch (error) {
    console.error("Error listing components:", error);
    return [];
  }
}

export function listVersions(componentType: string): string[] {
  try {
    const componentPath = path.join(REGISTRY_PATH, componentType);
    if (!fs.existsSync(componentPath)) {
      return [];
    }
    const versions = fs.readdirSync(componentPath)
      .filter(dir => {
        const versionPath = path.join(componentPath, dir);
        return fs.statSync(versionPath).isDirectory() && dir.startsWith('v');
      })
      .sort(compareVersions);
    return versions;
  } catch (error) {
    console.error(`Error listing versions for ${componentType}:`, error);
    return [];
  }
}

export function loadSchema(componentType: string, version: string): ComponentSchema | null {
  try {
    const schemaPath = path.join(REGISTRY_PATH, componentType, version, "schema.yml");
    if (!fs.existsSync(schemaPath)) {
      return null;
    }
    const content = fs.readFileSync(schemaPath, "utf8");
    return yaml.load(content) as ComponentSchema;
  } catch (error) {
    console.error(`Error loading schema for ${componentType}/${version}:`, error);
    return null;
  }
}

function extractVariantFromYaml(yamlContent: string): string | undefined {
  try {
    const { escaped } = escapeTemplateVars(yamlContent);
    const parsed = yaml.load(escaped);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.variant) {
      return parsed[0].variant as string;
    }
    if (parsed && typeof parsed === 'object' && 'variant' in parsed) {
      return (parsed as { variant?: string }).variant;
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

export function loadExamples(componentType: string, version: string): ComponentExample[] {
  try {
    const examplesPath = path.join(REGISTRY_PATH, componentType, version, "examples");
    if (!fs.existsSync(examplesPath)) {
      return [];
    }
    const exampleFiles = fs.readdirSync(examplesPath)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    return exampleFiles.map(file => {
      const filePath = path.join(examplesPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const { escaped } = escapeTemplateVars(content);
      const data = yaml.load(escaped) as { name?: string; description?: string; yaml?: string; variant?: string };
      
      const yamlContent = data.yaml || content;
      const inferredVariant = extractVariantFromYaml(yamlContent);
      
      return {
        name: data.name || file.replace(/\.(yml|yaml)$/, ''),
        description: data.description || '',
        yaml: yamlContent,
        variant: inferredVariant || data.variant,
      };
    });
  } catch (error) {
    console.error(`Error loading examples for ${componentType}/${version}:`, error);
    return [];
  }
}

export function getComponentInfo(componentType: string): ComponentInfo | null {
  const versions = listVersions(componentType);
  if (versions.length === 0) {
    return null;
  }
  
  const componentVersions: ComponentVersion[] = versions.map(version => {
    const schema = loadSchema(componentType, version);
    const examples = loadExamples(componentType, version);
    return {
      version,
      schema: schema!,
      examples,
    };
  }).filter(v => v.schema !== null);
  
  return {
    type: componentType,
    versions: componentVersions,
    latestVersion: versions[0],
  };
}

export function getRegistryOverview(): RegistryOverview {
  const components = listComponents();
  
  return {
    components: components.map(type => {
      const versions = listVersions(type);
      const latestVersion = versions[0] || 'v1.0';
      const schema = loadSchema(type, latestVersion);
      
      return {
        type,
        name: schema?.name || type,
        description: schema?.description || '',
        latestVersion,
        versions,
      };
    }),
  };
}

export function createNewVersion(componentType: string, baseVersion: string): { success: boolean; newVersion: string; error?: string } {
  try {
    const versions = listVersions(componentType);
    if (!versions.includes(baseVersion)) {
      return { success: false, newVersion: '', error: `Base version ${baseVersion} not found` };
    }
    
    const baseParts = parseVersion(baseVersion);
    const newVersionStr = `v${baseParts[0]}.${(baseParts[1] || 0) + 1}`;
    
    const basePath = path.join(REGISTRY_PATH, componentType, baseVersion);
    const newPath = path.join(REGISTRY_PATH, componentType, newVersionStr);
    
    if (fs.existsSync(newPath)) {
      return { success: false, newVersion: '', error: `Version ${newVersionStr} already exists` };
    }
    
    fs.mkdirSync(newPath, { recursive: true });
    fs.mkdirSync(path.join(newPath, "examples"), { recursive: true });
    
    const schemaPath = path.join(basePath, "schema.yml");
    if (fs.existsSync(schemaPath)) {
      let schemaContent = fs.readFileSync(schemaPath, "utf8");
      schemaContent = schemaContent.replace(/version:\s*["']?[\d.]+["']?/, `version: "${newVersionStr.replace('v', '')}"`);
      fs.writeFileSync(path.join(newPath, "schema.yml"), schemaContent);
    }
    
    const examplesPath = path.join(basePath, "examples");
    if (fs.existsSync(examplesPath)) {
      const examples = fs.readdirSync(examplesPath);
      for (const example of examples) {
        const srcPath = path.join(examplesPath, example);
        const destPath = path.join(newPath, "examples", example);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    
    return { success: true, newVersion: newVersionStr };
  } catch (error) {
    console.error(`Error creating new version for ${componentType}:`, error);
    return { success: false, newVersion: '', error: String(error) };
  }
}

export function getExampleFilePath(componentType: string, version: string): string {
  return path.join("marketing-content", "component-registry", componentType, version, "examples");
}

export type EditorType = "icon-picker" | "color-picker" | "image-picker" | "link-picker" | "video-picker";

export interface AllFieldEditors {
  [componentType: string]: Record<string, EditorType>;
}

/**
 * Load all field editors from component registry
 * Scans all component folders for field-editors.ts files
 */
export function loadAllFieldEditors(): AllFieldEditors {
  const result: AllFieldEditors = {};
  
  try {
    const components = listComponents();
    
    for (const componentType of components) {
      // Skip common folder
      if (componentType === "common") continue;
      
      const versions = listVersions(componentType);
      if (versions.length === 0) continue;
      
      // Use latest version
      const latestVersion = versions[0];
      const fieldEditorsPath = path.join(
        REGISTRY_PATH, 
        componentType, 
        latestVersion, 
        "field-editors.ts"
      );
      
      if (fs.existsSync(fieldEditorsPath)) {
        try {
          const content = fs.readFileSync(fieldEditorsPath, "utf8");
          
          // Parse the TypeScript file to extract fieldEditors object
          // Look for: export const fieldEditors: Record<string, EditorType> = { ... };
          const match = content.match(/export\s+const\s+fieldEditors\s*[^=]*=\s*(\{[\s\S]*?\});/);
          
          if (match) {
            // Simple parser for the object literal
            const objStr = match[1];
            const entries: Record<string, EditorType> = {};
            
            // Match patterns like: "features[].icon": "icon-picker",
            const entryRegex = /"([^"]+)":\s*"([^"]+)"/g;
            let entryMatch;
            
            while ((entryMatch = entryRegex.exec(objStr)) !== null) {
              const [, fieldPath, editorType] = entryMatch;
              // Parse base type (e.g., "color-picker:background" -> "color-picker")
              const baseType = editorType.split(":")[0];
              if (["icon-picker", "color-picker", "image-picker", "image-with-style-picker", "link-picker", "rich-text-editor", "markdown", "boolean-toggle", "variant-picker", "video-picker", "cta-picker", "string-picker", "font-size-picker"].includes(baseType)) {
                entries[fieldPath] = editorType as EditorType;
              }
            }
            
            if (Object.keys(entries).length > 0) {
              result[componentType] = entries;
            }
          }
        } catch (parseError) {
          console.error(`Error parsing field-editors for ${componentType}:`, parseError);
        }
      }
    }
  } catch (error) {
    console.error("Error loading field editors:", error);
  }
  
  return result;
}

export function saveExample(
  componentType: string, 
  version: string, 
  exampleName: string, 
  yamlContent: string
): { success: boolean; error?: string } {
  try {
    const examplesPath = path.join(REGISTRY_PATH, componentType, version, "examples");
    
    if (!fs.existsSync(examplesPath)) {
      return { success: false, error: `Examples path not found for ${componentType}/${version}` };
    }
    
    // Find the example file by name
    const exampleFiles = fs.readdirSync(examplesPath)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    let targetFile: string | null = null;
    
    for (const file of exampleFiles) {
      const filePath = path.join(examplesPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const data = yaml.load(content) as { name?: string };
      
      if (data.name === exampleName) {
        targetFile = file;
        break;
      }
    }
    
    if (!targetFile) {
      return { success: false, error: `Example "${exampleName}" not found` };
    }
    
    const filePath = path.join(examplesPath, targetFile);
    const existingContent = fs.readFileSync(filePath, "utf8");
    const existingData = yaml.load(existingContent) as { name?: string; description?: string; variant?: string };
    
    // Preserve the example metadata and update the yaml content
    const newContent = {
      name: existingData.name || exampleName,
      description: existingData.description || '',
      variant: existingData.variant,
      yaml: yamlContent,
    };
    
    // Remove undefined variant
    if (!newContent.variant) {
      delete (newContent as { variant?: string }).variant;
    }
    
    const yamlOutput = yaml.dump(newContent, { 
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
    });
    
    fs.writeFileSync(filePath, yamlOutput);
    
    return { success: true };
  } catch (error) {
    console.error(`Error saving example for ${componentType}/${version}:`, error);
    return { success: false, error: String(error) };
  }
}

function normalizeVariantName(v: string): string {
  return v.toLowerCase().replace(/[-_\s]/g, "");
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}

function resolveVariantTsxPath(componentType: string, variantName: string): string {
  const typePascal = toPascalCase(componentType);
  const variantPascal = toPascalCase(variantName);
  const fileName = `${typePascal}${variantPascal}.tsx`;
  return path.join(process.cwd(), "client", "src", "components", componentType, "variants", fileName);
}

export function getVariantByExample(
  componentType: string,
  version: string,
  exampleName: string
): string | null {
  // loadExamples already applies escapeTemplateVars + extractVariantFromYaml
  const examples = loadExamples(componentType, version);
  const found = examples.find((e) => e.name === exampleName);
  // If the example exists in the requested version, use that result only.
  // Don't fall back to other versions — this is a destructive action and
  // picking a different version's variant could delete the wrong thing.
  if (found) return found.variant ?? "default";

  // Example not found in specified version — search other versions
  for (const v of listVersions(componentType)) {
    if (v === version) continue;
    const vFound = loadExamples(componentType, v).find((e) => e.name === exampleName);
    if (vFound?.variant) return vFound.variant;
  }
  return null;
}

export function getVariantExamples(
  componentType: string,
  variantName: string
): Array<{ version: string; name: string }> {
  const result: Array<{ version: string; name: string }> = [];
  const versions = listVersions(componentType);
  const normalizedTarget = normalizeVariantName(variantName);

  for (const v of versions) {
    const examples = loadExamples(componentType, v);
    for (const ex of examples) {
      const exVariant = ex.variant || "default";
      if (normalizeVariantName(exVariant) === normalizedTarget) {
        result.push({ version: v, name: ex.name });
      }
    }
  }
  return result;
}

export function deleteExample(
  componentType: string,
  version: string,
  exampleName: string
): { success: boolean; error?: string } {
  try {
    const examplesPath = path.join(REGISTRY_PATH, componentType, version, "examples");
    if (!fs.existsSync(examplesPath)) {
      return { success: false, error: `Examples path not found for ${componentType}/${version}` };
    }

    const exampleFiles = fs.readdirSync(examplesPath).filter(
      (file) => file.endsWith(".yml") || file.endsWith(".yaml")
    );

    let targetFile: string | null = null;
    for (const file of exampleFiles) {
      const filePath = path.join(examplesPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      const data = yaml.load(content) as { name?: string };
      if (data.name === exampleName) {
        targetFile = file;
        break;
      }
    }

    if (!targetFile) {
      return { success: false, error: `Example "${exampleName}" not found` };
    }

    fs.unlinkSync(path.join(examplesPath, targetFile));
    return { success: true };
  } catch (error) {
    console.error(`Error deleting example ${exampleName} for ${componentType}/${version}:`, error);
    return { success: false, error: String(error) };
  }
}

function deleteVariantExamples(
  componentType: string,
  variantName: string
): { deleted: string[]; errors: string[] } {
  const deleted: string[] = [];
  const errors: string[] = [];
  const versions = listVersions(componentType);
  const normalizedTarget = normalizeVariantName(variantName);

  for (const v of versions) {
    const examplesPath = path.join(REGISTRY_PATH, componentType, v, "examples");
    if (!fs.existsSync(examplesPath)) continue;

    const exampleFiles = fs.readdirSync(examplesPath).filter(
      (file) => file.endsWith(".yml") || file.endsWith(".yaml")
    );

    for (const file of exampleFiles) {
      const filePath = path.join(examplesPath, file);
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const data = yaml.load(content) as { name?: string; variant?: string; yaml?: string };
        const exVariant = data.variant || extractVariantFromYaml(data.yaml || "") || "default";
        if (normalizeVariantName(exVariant) === normalizedTarget) {
          fs.unlinkSync(filePath);
          deleted.push(data.name || file);
        }
      } catch (e) {
        errors.push(`${v}/${file}: ${String(e)}`);
      }
    }
  }
  return { deleted, errors };
}

export function deleteVariant(
  componentType: string,
  variantName: string
): { success: boolean; deletedExamples: string[]; error?: string } {
  try {
    const tsxPath = resolveVariantTsxPath(componentType, variantName);
    if (fs.existsSync(tsxPath)) {
      fs.unlinkSync(tsxPath);
    }
    const { deleted } = deleteVariantExamples(componentType, variantName);

    // If no variant TSX files remain, clean up the orphaned directories
    const variantsDir = path.join(process.cwd(), "client", "src", "components", componentType, "variants");
    if (fs.existsSync(variantsDir)) {
      const remaining = fs.readdirSync(variantsDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
      if (remaining.length === 0) {
        fs.rmSync(variantsDir, { recursive: true, force: true });
        // Also remove the parent component folder if it's now empty
        const componentDir = path.join(process.cwd(), "client", "src", "components", componentType);
        if (fs.existsSync(componentDir) && fs.readdirSync(componentDir).length === 0) {
          fs.rmSync(componentDir, { recursive: true, force: true });
        }
      }
    }

    return { success: true, deletedExamples: deleted };
  } catch (error) {
    console.error(`Error deleting variant ${variantName} for ${componentType}:`, error);
    return { success: false, deletedExamples: [], error: String(error) };
  }
}

let _sectionDefaultsCache: Record<string, Record<string, unknown>> | null = null;

export function applyComponentSectionDefaults(sections: unknown[]): void {
  const allDefaults = getComponentSectionDefaults();
  if (Object.keys(allDefaults).length === 0) return;

  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const s = section as Record<string, unknown>;
    const sectionType = s.type as string;
    if (!sectionType || !allDefaults[sectionType]) continue;
    const defaults = allDefaults[sectionType];
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in s)) {
        s[key] = value;
      }
    }
  }
}

export function getComponentSectionDefaults(): Record<string, Record<string, unknown>> {
  if (_sectionDefaultsCache) return _sectionDefaultsCache;

  const defaults: Record<string, Record<string, unknown>> = {};
  try {
    const components = listComponents();
    for (const componentType of components) {
      if (componentType === "_common") continue;
      const versions = listVersions(componentType);
      if (versions.length === 0) continue;
      const schema = loadSchema(componentType, versions[0]);
      if (schema?.section_defaults && typeof schema.section_defaults === "object") {
        defaults[componentType] = schema.section_defaults;
      }
    }
  } catch (error) {
    console.error("Error loading component section defaults:", error);
  }

  _sectionDefaultsCache = defaults;
  return defaults;
}
