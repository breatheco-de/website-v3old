/**
 * Validation Framework Types
 * 
 * Core interfaces for the modular validation system.
 * Used by both CLI and API.
 */

export interface FixHint {
  type: "api" | "script" | "llm" | "manual";
  label: string;
  fixerName?: string;
  command?: string;
  promptTemplate?: string;
}

export interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  fix?: FixHint;
}

export interface ValidatorResult {
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  duration: number;
  artifacts?: Record<string, unknown>;
}

export interface ValidatorMetadata {
  name: string;
  description: string;
  apiExposed: boolean;
  estimatedDuration: "fast" | "medium" | "slow";
  category: "content" | "seo" | "integrity" | "components";
}

export interface Validator extends ValidatorMetadata {
  run(context: ValidationContext): Promise<ValidatorResult>;
}

export interface ContentMeta {
  page_title?: string;
  description?: string;
  robots?: string;
  og_image?: string;
  canonical_url?: string;
  priority?: number;
  change_frequency?: string;
  redirects?: string[];
}

export interface SchemaRef {
  include?: string[];
  overrides?: Record<string, Record<string, unknown>>;
}

export interface ContentSeo {
  intent?: string;
  pillar?: string;
  focus_features?: string[];
}

export interface ContentFile {
  slug: string;
  title: string;
  meta?: ContentMeta;
  schema?: SchemaRef;
  seo?: ContentSeo;
  type: string;
  locale: string;
  filePath: string;
  variant?: string;
  version?: number;
}

export interface RedirectEntry {
  from: string;
  to: string | Record<string, string>;
  source: ContentFile;
}

export interface SitemapEntry {
  loc: string;
  type: string;
  slug?: string;
  locale?: string;
}

export interface ValidationContext {
  contentFiles: ContentFile[];
  redirectMap: Map<string, RedirectEntry>;
  validUrls: Set<string>;
  availableSchemas: Set<string>;
  sitemapEntries: SitemapEntry[];
}

export interface ValidationRunOptions {
  validators?: string[];
  mode?: "strict" | "fast";
  output?: "detailed" | "summary";
  includeArtifacts?: boolean;
}

export interface ValidationRunResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    duration: number;
  };
  validators: ValidatorResult[];
}
