import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import type { Validator, ValidatorResult, ValidationContext, ValidationIssue } from "../shared/types";

const CONTENT_DIRS = [
  "marketing-content/landings",
  "marketing-content/programs",
  "marketing-content/locations",
  "marketing-content/pages",
];

const REGISTRY_PATH = path.join(process.cwd(), "marketing-content", "image-registry.json");

interface ImageRegistryEntry {
  src: string;
  alt: string;
  focal_point?: string;
  tags?: string[];
  usage_count?: number;
}

interface ImageRegistry {
  presets: Record<string, unknown>;
  images: Record<string, ImageRegistryEntry>;
}

function extractImageRefs(obj: unknown, refs: Set<string>): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractImageRefs(item, refs);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if ((key === "image_id" || key === "image") && typeof value === "string" && value) {
      refs.add(value);
    } else if (typeof value === "object" && value !== null) {
      extractImageRefs(value, refs);
    }
  }
}

function scanAllContentFiles(): Set<string> {
  const refs = new Set<string>();

  for (const dir of CONTENT_DIRS) {
    const fullDir = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullDir)) continue;

    const walkDir = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const parsed = yaml.load(content);
            extractImageRefs(parsed, refs);
          } catch {
          }
        }
      }
    };

    walkDir(fullDir);
  }

  return refs;
}

export const imagesValidator: Validator = {
  name: "images",
  description: "Validates image integrity: registry references, file existence, alt text, and orphaned entries",
  apiExposed: true,
  estimatedDuration: "medium",
  category: "content",

  async run(_context: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    let registry: ImageRegistry;
    try {
      const rawContent = fs.readFileSync(REGISTRY_PATH, "utf-8");
      registry = JSON.parse(rawContent) as ImageRegistry;
    } catch (err) {
      errors.push({
        type: "error",
        code: "REGISTRY_LOAD_ERROR",
        message: `Failed to load image registry: ${err instanceof Error ? err.message : String(err)}`,
        file: REGISTRY_PATH,
        suggestion: "Ensure marketing-content/image-registry.json exists and is valid JSON",
      });

      return {
        name: this.name,
        description: this.description,
        status: "failed",
        errors,
        warnings,
        duration: Date.now() - startTime,
      };
    }

    const images = registry.images || {};
    const referencedIds = scanAllContentFiles();

    let missingFromRegistry = 0;
    referencedIds.forEach((id) => {
      if (!images[id]) {
        missingFromRegistry++;
        errors.push({
          type: "error",
          code: "IMAGE_ID_NOT_IN_REGISTRY",
          message: `Referenced image_id "${id}" not found in image registry`,
          suggestion: "Add this image to marketing-content/image-registry.json or fix the reference",
          fix: {
            type: "api",
            label: "Sync image registry (scan for new images)",
            fixerName: "image-registry-sync",
          },
        });
      }
    });

    let missingFromDisk = 0;
    let placeholderAlts = 0;
    let missingAlts = 0;
    for (const [id, entry] of Object.entries(images)) {
      if (entry.src) {
        const srcPath = path.join(process.cwd(), entry.src);
        if (!fs.existsSync(srcPath)) {
          missingFromDisk++;
          errors.push({
            type: "error",
            code: "IMAGE_SRC_FILE_MISSING",
            message: `Image file not found on disk: ${entry.src}`,
            file: REGISTRY_PATH,
            suggestion: `Check that the file exists at ${srcPath} or update the registry entry for "${id}"`,
            fix: {
              type: "api",
              label: "Sync image registry (detect updated paths)",
              fixerName: "image-registry-sync",
            },
          });
        }
      }

      if (!entry.alt || entry.alt.trim() === "") {
        missingAlts++;
        errors.push({
          type: "error",
          code: "IMAGE_ALT_MISSING",
          message: `Image "${id}" has no alt text`,
          file: REGISTRY_PATH,
          suggestion: "Add descriptive alt text for accessibility",
        });
      } else if (entry.alt.match(/todo/i)) {
        placeholderAlts++;
        warnings.push({
          type: "warning",
          code: "IMAGE_ALT_PLACEHOLDER",
          message: `Image "${id}" has placeholder alt text: "${entry.alt}"`,
          file: REGISTRY_PATH,
          suggestion: "Replace TODO placeholder with actual descriptive alt text",
        });
      }
    }

    let orphanedEntries = 0;
    for (const id of Object.keys(images)) {
      if (!referencedIds.has(id)) {
        orphanedEntries++;
        warnings.push({
          type: "warning",
          code: "ORPHANED_REGISTRY_ENTRY",
          message: `Registry image "${id}" is not referenced by any content file`,
          file: REGISTRY_PATH,
          suggestion: "Consider removing unused registry entries or adding references in content",
        });
      }
    }

    const duration = Date.now() - startTime;
    return {
      name: this.name,
      description: this.description,
      status: errors.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed",
      errors,
      warnings,
      duration,
      artifacts: {
        registryEntries: Object.keys(images).length,
        referencedIds: referencedIds.size,
        missingFromRegistry,
        missingFromDisk,
        placeholderAlts,
        orphanedEntries,
      },
    };
  },
};
