import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import { escapeTemplateVars, unescapeObjectVars } from "../../shared/templateVars";
import type {
  ExperimentConfig,
  ExperimentsFile,
  ExperimentAssignment,
  VisitorContext,
  ExperimentVariant,
  CareerProgram,
} from "@shared/schema";
import { experimentsFileSchema, experimentConfigSchema, type ExperimentUpdate } from "@shared/schema";
import { hashUserId } from "./cookie-utils";
import { deepMerge } from "../utils/deepMerge";
import { getFolder } from "../content-types";
import { gcs } from "../gcs";

const CONTENT_DIR = path.join(process.cwd(), "marketing-content");
const STATE_FILE = path.join(CONTENT_DIR, ".experiments-state.json");
const GCS_EXPERIMENTS_STATE_KEY = "sync/experiments-state.json";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const FLUSH_INTERVAL = 30000; // 30 seconds

interface ExperimentState {
  counts: Record<string, Record<string, number>>; // experiment -> variant -> count
  visitors: Record<string, string[]>; // experiment -> array of hashed visitor IDs (persisted)
  lastFlushed: number;
}

// In-memory Set for O(1) visitor dedup lookups
const visitorSets: Map<string, Set<string>> = new Map();

interface VariantContent {
  slug: string;
  version: number;
  content: unknown;
}

class ExperimentManager {
  private configCache: Map<string, ExperimentsFile> = new Map();
  private contentCache: Map<string, VariantContent> = new Map();
  private state: ExperimentState = { counts: {}, visitors: {}, lastFlushed: Date.now() };
  private flushTimer: NodeJS.Timeout | null = null;
  private experimentContentMap: Map<string, { contentType: string; contentSlug: string }> = new Map();

  constructor() {
    this.loadState();
    this.loadStateFromBucket();
    this.startFlushTimer();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, "utf-8");
        this.applyLoadedState(JSON.parse(data));
      }
    } catch (error) {
      console.error("[Experiments] Error loading state:", error);
    }
  }

  private applyLoadedState(loaded: any): void {
    this.state = {
      counts: loaded.counts || {},
      visitors: loaded.visitors || {},
      lastFlushed: loaded.lastFlushed || Date.now(),
    };

    visitorSets.clear();
    for (const [expSlug, visitorIds] of Object.entries(this.state.visitors)) {
      visitorSets.set(expSlug, new Set(visitorIds as string[]));
    }

    console.log("[Experiments] Loaded state:", Object.keys(this.state.counts).length, "experiments");
  }

  /**
   * In production: load from GCS bucket, overriding local file.
   * In development: skip bucket, use local file only.
   */
  private async loadStateFromBucket(): Promise<void> {
    if (!IS_PRODUCTION || !gcs.available) {
      if (!IS_PRODUCTION) console.log("[Experiments] Development mode, using local file only");
      return;
    }

    try {
      const exists = await gcs.exists(GCS_EXPERIMENTS_STATE_KEY);
      if (!exists) {
        console.log("[Experiments] No state found in bucket, using local file");
        return;
      }

      const data = await gcs.download(GCS_EXPERIMENTS_STATE_KEY);
      if (!data) {
        console.log("[Experiments] Empty download from bucket, using local file");
        return;
      }

      const loaded = JSON.parse(data.toString("utf-8"));
      this.applyLoadedState(loaded);
      this.saveStateLocal();
      console.log("[Experiments] Loaded state from GCS bucket");
    } catch (error) {
      console.error("[Experiments] Error loading from bucket:", error);
    }
  }

  private saveStateLocal(): void {
    try {
      this.state.lastFlushed = Date.now();
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error("[Experiments] Error saving state locally:", error);
    }
  }

  private async saveStateToBucket(): Promise<void> {
    if (!IS_PRODUCTION || !gcs.available) return;

    try {
      const content = JSON.stringify(this.state, null, 2);
      await gcs.upload(GCS_EXPERIMENTS_STATE_KEY, Buffer.from(content, "utf-8"), "application/json");
    } catch (error) {
      console.error("[Experiments] Error saving to bucket:", error);
    }
  }

  private saveState(): void {
    this.saveStateLocal();
    this.saveStateToBucket().catch(err => {
      console.error("[Experiments] Background bucket save failed:", err);
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.saveState();
    }, FLUSH_INTERVAL);
  }

  public shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.saveState();
  }

  /**
   * Load experiments config for a program
   */
  private loadExperimentsConfig(programSlug: string): ExperimentsFile | null {
    const cacheKey = `program:${programSlug}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    const configPath = path.join(CONTENT_DIR, getFolder("program"), programSlug, "experiments.yml");
    
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const { escaped, map } = escapeTemplateVars(content);
      const rawParsed = yaml.load(escaped);
      const parsed = rawParsed ? unescapeObjectVars(rawParsed, map) : rawParsed;
      const validated = experimentsFileSchema.parse(parsed);
      this.configCache.set(cacheKey, validated);
      return validated;
    } catch (error) {
      console.error(`[Experiments] Error loading config for ${programSlug}:`, error);
      return null;
    }
  }

  /**
   * Load variant content file
   */
  private loadVariantContent(
    slug: string,
    variantSlug: string,
    version: number,
    locale: string,
    contentType: string = "program"
  ): unknown | null {
    const cacheKey = `${contentType}:${slug}:${variantSlug}.v${version}.${locale}`;
    
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!.content;
    }

    const contentDir = path.join(CONTENT_DIR, getFolder(contentType), slug);
    const commonPath = path.join(contentDir, "_common.yml");
    const filePath = path.join(contentDir, `${variantSlug}.v${version}.${locale}.yml`);

    if (!fs.existsSync(filePath)) {
      console.warn(`[Experiments] Variant file not found: ${filePath}`);
      return null;
    }

    try {
      // Load _common.yml if it exists (contains slug, title, schema)
      let commonData: Record<string, unknown> = {};
      if (fs.existsSync(commonPath)) {
        const commonContent = fs.readFileSync(commonPath, "utf-8");
        const { escaped: cEsc, map: cMap } = escapeTemplateVars(commonContent);
        const cParsed = yaml.load(cEsc) as Record<string, unknown>;
        commonData = (cParsed ? unescapeObjectVars(cParsed, cMap) : {}) as Record<string, unknown>;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const { escaped: vEsc, map: vMap } = escapeTemplateVars(content);
      const vParsed = yaml.load(vEsc) as Record<string, unknown>;
      const variantData = (vParsed ? unescapeObjectVars(vParsed, vMap) : {}) as Record<string, unknown>;

      // Deep merge common data with variant data (variant takes precedence)
      const merged = deepMerge(commonData, variantData);

      this.contentCache.set(cacheKey, {
        slug: variantSlug,
        version,
        content: merged,
      });
      return merged;
    } catch (error) {
      console.error(`[Experiments] Error loading variant content:`, error);
      return null;
    }
  }

  /**
   * Deterministic hash for consistent bucketing
   */
  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if visitor matches targeting rules
   */
  private matchesTargeting(
    targeting: ExperimentConfig["targeting"],
    context: VisitorContext
  ): boolean {
    if (!targeting) return true;

    if (targeting.regions?.length && context.region) {
      if (!targeting.regions.includes(context.region)) return false;
    }

    if (targeting.countries?.length && context.country) {
      if (!targeting.countries.includes(context.country)) return false;
    }

    if (targeting.languages?.length && context.language) {
      if (!targeting.languages.includes(context.language)) return false;
    }

    if (targeting.utm_sources?.length && context.utm_source) {
      if (!targeting.utm_sources.includes(context.utm_source)) return false;
    }

    if (targeting.utm_campaigns?.length && context.utm_campaign) {
      if (!targeting.utm_campaigns.includes(context.utm_campaign)) return false;
    }

    if (targeting.utm_mediums?.length && context.utm_medium) {
      if (!targeting.utm_mediums.includes(context.utm_medium)) return false;
    }

    if (targeting.devices?.length && context.device) {
      if (!targeting.devices.includes(context.device)) return false;
    }

    if (targeting.hours?.length && context.hour !== undefined) {
      if (!targeting.hours.includes(context.hour)) return false;
    }

    if (targeting.days_of_week?.length && context.day_of_week !== undefined) {
      if (!targeting.days_of_week.includes(context.day_of_week)) return false;
    }

    return true;
  }

  /**
   * Select a variant based on allocation percentages and session hash
   */
  private selectVariant(
    experiment: ExperimentConfig,
    sessionId: string
  ): ExperimentVariant | null {
    const hashKey = `${sessionId}:${experiment.slug}`;
    const hashValue = this.hash(hashKey) % 100;

    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.allocation;
      if (hashValue < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return experiment.variants[0] || null;
  }

  /**
   * Get current unique visitor count for an experiment
   * Uses in-memory Set for accurate count
   */
  public getExperimentVisitorCount(experimentSlug: string): number {
    return visitorSets.get(experimentSlug)?.size || this.state.visitors[experimentSlug]?.length || 0;
  }

  /**
   * Get variant-level exposure counts (for analytics)
   */
  public getExperimentVariantCounts(experimentSlug: string): Record<string, number> {
    return this.state.counts[experimentSlug] || {};
  }

  /**
   * Check if a visitor has already been counted for an experiment
   */
  private isVisitorCounted(experimentSlug: string, userId: string): boolean {
    const hashedId = hashUserId(userId);
    return this.state.visitors[experimentSlug]?.includes(hashedId) || false;
  }

  /**
   * Record an experiment exposure for a unique visitor
   * Returns true if this was a new visitor, false if returning visitor
   * Uses in-memory Set for O(1) lookups to prevent performance degradation
   */
  private recordExposure(
    experimentSlug: string,
    variantSlug: string,
    userId: string,
    contentType: string,
    contentSlug: string,
    maxVisitors?: number
  ): boolean {
    const hashedId = hashUserId(userId);
    
    // Get or create the in-memory Set for this experiment
    if (!visitorSets.has(experimentSlug)) {
      visitorSets.set(experimentSlug, new Set());
    }
    const visitorSet = visitorSets.get(experimentSlug)!;
    
    // O(1) check if this visitor was already counted
    if (visitorSet.has(hashedId)) {
      return false; // Returning visitor - skip all state operations
    }
    
    // New unique visitor - add to Set and persist
    visitorSet.add(hashedId);
    
    // Initialize persistence structures if needed
    if (!this.state.counts[experimentSlug]) {
      this.state.counts[experimentSlug] = {};
    }
    if (!this.state.counts[experimentSlug][variantSlug]) {
      this.state.counts[experimentSlug][variantSlug] = 0;
    }
    if (!this.state.visitors[experimentSlug]) {
      this.state.visitors[experimentSlug] = [];
    }
    
    // Persist the new visitor
    this.state.visitors[experimentSlug].push(hashedId);
    this.state.counts[experimentSlug][variantSlug]++;
    
    // Store content mapping for auto-stop
    this.experimentContentMap.set(experimentSlug, { contentType, contentSlug });
    
    // Check if we need to auto-stop
    const visitorCount = visitorSet.size;
    if (maxVisitors && visitorCount >= maxVisitors) {
      console.log(`[Experiments] Auto-stopping ${experimentSlug}: reached ${visitorCount}/${maxVisitors} visitors`);
      this.autoStopExperiment(experimentSlug, contentType, contentSlug);
    }
    
    return true;
  }

  /**
   * Auto-stop an experiment when max_visitors is reached
   * Sets status to "archived" and marks auto_stopped: true
   */
  private autoStopExperiment(
    experimentSlug: string,
    contentType: string,
    contentSlug: string
  ): void {
    try {
      // Immediately save state to prevent data loss
      this.saveState();
      
      // Update the experiment status to "archived" with auto-stop flag
      this.updateExperiment(
        contentType,
        contentSlug,
        experimentSlug,
        { 
          status: "archived",
          auto_stopped: true,
          description: `Auto-stopped: reached max_visitors limit on ${new Date().toISOString().split('T')[0]}`
        }
      );
      
      // Clear config cache to ensure fresh read reflects new status
      this.configCache.delete(`${contentType}:${contentSlug}`);
      
      console.log(`[Experiments] Experiment ${experimentSlug} auto-stopped and archived`);
    } catch (error) {
      console.error(`[Experiments] Failed to auto-stop experiment ${experimentSlug}:`, error);
    }
  }

  /**
   * Get experiment assignment for a visitor
   */
  public getAssignment(
    programSlug: string,
    context: VisitorContext,
    existingAssignments: ExperimentAssignment[] = []
  ): ExperimentAssignment | null {
    const config = this.loadExperimentsConfig(programSlug);
    if (!config) return null;

    // Find first active experiment that matches targeting
    for (const experiment of config.experiments) {
      // Skip non-active experiments
      if (experiment.status !== "active") continue;

      // Check if max visitors reached (using unique visitor count)
      if (experiment.max_visitors) {
        const currentCount = this.getExperimentVisitorCount(experiment.slug);
        if (currentCount >= experiment.max_visitors) continue;
      }

      // Check targeting
      if (!this.matchesTargeting(experiment.targeting, context)) continue;

      // Check existing assignment
      const existing = existingAssignments.find(
        (a) => a.experiment_slug === experiment.slug
      );
      if (existing) {
        // Returning visitor with existing assignment - still record for tracking
        // but don't increment count (recordExposure handles this)
        this.recordExposure(
          experiment.slug,
          existing.variant_slug,
          context.session_id,
          "program",
          programSlug,
          experiment.max_visitors
        );
        return existing;
      }

      // Select variant
      const variant = this.selectVariant(experiment, context.session_id);
      if (!variant) continue;

      // Record exposure (only counts new unique visitors)
      this.recordExposure(
        experiment.slug,
        variant.slug,
        context.session_id,
        "program",
        programSlug,
        experiment.max_visitors
      );

      return {
        experiment_slug: experiment.slug,
        variant_slug: variant.slug,
        variant_version: variant.version,
        assigned_at: Date.now(),
      };
    }

    return null;
  }

  /**
   * Get variant content for an assignment
   */
  public getVariantContent(
    slug: string,
    assignment: ExperimentAssignment,
    locale: string,
    contentType: string = "program"
  ): unknown | null {
    return this.loadVariantContent(
      slug,
      assignment.variant_slug,
      assignment.variant_version,
      locale,
      contentType
    );
  }

  /**
   * Get experiment statistics (variant counts)
   */
  public getStats(): Record<string, Record<string, number>> {
    return { ...this.state.counts };
  }

  /**
   * Get extended statistics including unique visitor counts
   */
  public getExtendedStats(): {
    experiments: Record<string, {
      unique_visitors: number;
      variant_counts: Record<string, number>;
    }>;
  } {
    const experiments: Record<string, {
      unique_visitors: number;
      variant_counts: Record<string, number>;
    }> = {};

    // Merge all experiment slugs from both counts and visitors
    const allSlugs = Array.from(new Set([
      ...Object.keys(this.state.counts),
      ...Object.keys(this.state.visitors),
    ]));

    for (const slug of allSlugs) {
      experiments[slug] = {
        unique_visitors: this.state.visitors[slug]?.length || 0,
        variant_counts: this.state.counts[slug] || {},
      };
    }

    return { experiments };
  }

  /**
   * Clear config cache (for hot reload in dev)
   */
  public clearCache(): void {
    this.configCache.clear();
    this.contentCache.clear();
    console.log("[Experiments] Cache cleared");
  }

  /**
   * Get experiments list for a content type and slug
   * Used by debug panel to show available experiments
   */
  public getExperimentsForContent(
    contentType: string,
    slug: string
  ): ExperimentsFile | null {
    const configPath = path.join(CONTENT_DIR, getFolder(contentType), slug, "experiments.yml");
    
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const { escaped, map } = escapeTemplateVars(content);
      const rawParsed = yaml.load(escaped);
      const parsed = rawParsed ? unescapeObjectVars(rawParsed, map) : rawParsed;
      const validated = experimentsFileSchema.parse(parsed);
      return validated;
    } catch (error) {
      console.error(`[Experiments] Error loading experiments for ${contentType}/${slug}:`, error);
      return null;
    }
  }

  /**
   * Get the file path for experiments config
   */
  public getExperimentsFilePath(
    contentType: string,
    slug: string
  ): string {
    return path.join(CONTENT_DIR, getFolder(contentType), slug, "experiments.yml");
  }

  /**
   * Get available variants for a content type and slug
   * Parses YAML files in the content folder following naming conventions:
   * - {locale}.yml = base/default variant (e.g., en.yml, es.yml)
   * - {variant-slug}.v{version}.{locale}.yml = named variant (e.g., salary-focus.v1.en.yml)
   */
  public getAvailableVariants(
    contentType: string,
    slug: string
  ): {
    variants: Array<{
      filename: string;
      name: string;
      variantSlug: string;
      version: number | null;
      locale: string;
      displayName: string;
      isPromoted: boolean;
    }>;
    contentType: string;
    slug: string;
    folderPath: string;
  } | null {
    const contentDir = path.join(CONTENT_DIR, getFolder(contentType), slug);
    
    if (!fs.existsSync(contentDir)) {
      return null;
    }
    
    try {
      const files = fs.readdirSync(contentDir);
      
      const variants = files
        .filter(file => file.endsWith('.yml') && file !== 'experiments.yml' && !file.startsWith('_'))
        .map(file => {
          const name = file.replace('.yml', '');
          const parts = name.split('.');
          
          // Simple locale file like "en.yml" or "es.yml" = promoted variant
          if (parts.length === 1) {
            return {
              filename: file,
              name,
              variantSlug: 'promoted',
              version: null,
              locale: parts[0],
              displayName: `Promoted (${parts[0].toUpperCase()})`,
              isPromoted: true
            };
          }
          
          // Pattern: {variant-slug}.v{version}.{locale}.yml
          // e.g., salary-focus.v1.en.yml
          const locale = parts[parts.length - 1];
          const versionMatch = parts[parts.length - 2]?.match(/^v(\d+)$/);
          
          if (versionMatch) {
            const version = parseInt(versionMatch[1], 10);
            const variantSlug = parts.slice(0, -2).join('.');
            return {
              filename: file,
              name,
              variantSlug,
              version,
              locale,
              displayName: `${variantSlug} v${version} (${locale.toUpperCase()})`,
              isPromoted: false
            };
          }
          
          // Fallback for other patterns
          return {
            filename: file,
            name,
            variantSlug: parts.slice(0, -1).join('.') || parts[0],
            version: null,
            locale: parts[parts.length - 1],
            displayName: name,
            isPromoted: false
          };
        })
        .sort((a, b) => {
          // Sort promoted variants first, then by variant slug, then by version
          if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1;
          if (a.variantSlug !== b.variantSlug) return a.variantSlug.localeCompare(b.variantSlug);
          if (a.version !== b.version) return (a.version || 0) - (b.version || 0);
          return a.locale.localeCompare(b.locale);
        });
      
      return {
        variants,
        contentType,
        slug,
        folderPath: `marketing-content/${getFolder(contentType)}/${slug}`
      };
    } catch (error) {
      console.error(`[Experiments] Error getting variants for ${contentType}/${slug}:`, error);
      return null;
    }
  }

  /**
   * Update an experiment's settings
   */
  public updateExperiment(
    contentType: string,
    contentSlug: string,
    experimentSlug: string,
    updates: ExperimentUpdate
  ): { success: boolean; experiment: ExperimentConfig } {
    const configPath = this.getExperimentsFilePath(contentType, contentSlug);
    
    if (!fs.existsSync(configPath)) {
      throw new Error("Experiments file not found");
    }
    
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const rawParsed = yaml.load(content);
      
      // Validate loaded YAML structure before accessing
      const parsedResult = experimentsFileSchema.safeParse(rawParsed);
      if (!parsedResult.success) {
        throw new Error("Experiments file has invalid structure");
      }
      
      const parsed = parsedResult.data;
      
      const experimentIndex = parsed.experiments.findIndex(
        (exp: ExperimentConfig) => exp.slug === experimentSlug
      );
      
      if (experimentIndex === -1) {
        throw new Error("Experiment not found");
      }
      
      // Validate variants allocation sum if variants are being updated
      if (updates.variants) {
        const allocationSum = updates.variants.reduce((sum, v) => sum + v.allocation, 0);
        if (allocationSum !== 100) {
          throw new Error(`Variant allocations must sum to 100, got ${allocationSum}`);
        }
      }
      
      // Deep clone existing experiment to avoid mutation
      const existingExperiment = JSON.parse(JSON.stringify(parsed.experiments[experimentIndex]));
      
      // Merge updates with existing experiment (deep merge for targeting)
      const updatedExperiment = {
        ...existingExperiment,
        ...updates,
        slug: existingExperiment.slug, // Prevent slug modification
        // Deep merge targeting to preserve unmodified fields
        targeting: updates.targeting !== undefined 
          ? { ...existingExperiment.targeting, ...updates.targeting }
          : existingExperiment.targeting,
      };
      
      // Validate the merged experiment against schema before saving
      const validationResult = experimentConfigSchema.safeParse(updatedExperiment);
      if (!validationResult.success) {
        throw new Error(`Invalid experiment data: ${validationResult.error.message}`);
      }
      
      parsed.experiments[experimentIndex] = validationResult.data;
      
      // Validate entire file before writing
      const fileValidation = experimentsFileSchema.safeParse(parsed);
      if (!fileValidation.success) {
        throw new Error(`File validation failed: ${fileValidation.error.message}`);
      }
      
      // Write back to file using validated data
      const yamlContent = yaml.dump(fileValidation.data, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"',
        forceQuotes: false,
      });
      
      fs.writeFileSync(configPath, yamlContent, "utf-8");
      
      // Clear cache for this content
      const cacheKey = `${contentType}:${contentSlug}`;
      this.configCache.delete(cacheKey);
      
      console.log(`[Experiments] Updated experiment ${experimentSlug} for ${contentType}/${contentSlug}`);
      
      return {
        success: true,
        experiment: updatedExperiment,
      };
    } catch (error) {
      console.error(`[Experiments] Error updating experiment:`, error);
      throw error;
    }
  }

  /**
   * Create a new experiment and optionally create a new variant file
   */
  public createExperiment(
    contentType: string,
    contentSlug: string,
    experimentConfig: {
      experimentName: string;
      experimentSlug: string;
      variantA: { filename: string; slug: string; version: number };
      variantB: { filename: string; slug: string; version: number } | null;
      newVariant: { title: string; slug: string } | null;
      allocationA: number;
      maxVisitors: number;
      targeting: {
        regions?: string[];
        devices?: ("mobile" | "desktop" | "tablet")[];
        locations?: string[];
        utm_sources?: string[];
        utm_campaigns?: string[];
        utm_mediums?: string[];
        countries?: string[];
      };
    }
  ): { success: boolean; experimentSlug: string; newVariantFilename?: string } {
    const contentDir = path.join(CONTENT_DIR, getFolder(contentType), contentSlug);
    const configPath = path.join(contentDir, "experiments.yml");
    
    if (!fs.existsSync(contentDir)) {
      throw new Error(`Content folder not found: ${contentType}/${contentSlug}`);
    }
    
    // Determine variant B details
    let variantBSlug: string;
    let variantBVersion: number;
    let newVariantFilename: string | undefined;
    
    if (experimentConfig.variantB) {
      // Use existing variant B
      variantBSlug = experimentConfig.variantB.slug;
      variantBVersion = experimentConfig.variantB.version;
    } else if (experimentConfig.newVariant) {
      // Create new variant by copying from variant A
      const variantAPath = path.join(contentDir, experimentConfig.variantA.filename);
      if (!fs.existsSync(variantAPath)) {
        throw new Error(`Variant A file not found: ${experimentConfig.variantA.filename}`);
      }
      
      // Extract locale from variant A filename
      const localeMatch = experimentConfig.variantA.filename.match(/\.([a-z]{2})\.yml$/);
      const locale = localeMatch ? localeMatch[1] : "en";
      
      // Create new variant filename: {slug}.v1.{locale}.yml
      variantBSlug = experimentConfig.newVariant.slug;
      variantBVersion = 1;
      newVariantFilename = `${variantBSlug}.v${variantBVersion}.${locale}.yml`;
      const newVariantPath = path.join(contentDir, newVariantFilename);
      
      // Check if file already exists
      if (fs.existsSync(newVariantPath)) {
        throw new Error(`Variant file already exists: ${newVariantFilename}`);
      }
      
      // Copy content from variant A and update title
      const variantAContent = fs.readFileSync(variantAPath, "utf-8");
      const variantAData = yaml.load(variantAContent) as Record<string, unknown>;
      
      // Update title if provided
      if (experimentConfig.newVariant.title) {
        variantAData.title = experimentConfig.newVariant.title;
      }
      
      // Write new variant file
      const newVariantContent = yaml.dump(variantAData, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"',
        forceQuotes: false,
      });
      fs.writeFileSync(newVariantPath, newVariantContent, "utf-8");
      
      console.log(`[Experiments] Created new variant file: ${newVariantFilename}`);
    } else {
      throw new Error("Either variantB or newVariant must be provided");
    }
    
    // Build the experiment config
    const allocationB = 100 - experimentConfig.allocationA;
    
    const newExperiment: ExperimentConfig = {
      slug: experimentConfig.experimentSlug,
      status: "planned",
      description: experimentConfig.experimentName,
      max_visitors: experimentConfig.maxVisitors,
      variants: [
        {
          slug: experimentConfig.variantA.slug,
          version: experimentConfig.variantA.version,
          allocation: experimentConfig.allocationA,
        },
        {
          slug: variantBSlug,
          version: variantBVersion,
          allocation: allocationB,
        },
      ],
      targeting: this.buildTargetingObject(experimentConfig.targeting),
    };
    
    // Validate the new experiment
    const experimentValidation = experimentConfigSchema.safeParse(newExperiment);
    if (!experimentValidation.success) {
      throw new Error(`Invalid experiment config: ${experimentValidation.error.message}`);
    }
    
    // Load or create experiments.yml
    let experimentsFile: ExperimentsFile;
    
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = yaml.load(content);
      const validated = experimentsFileSchema.safeParse(parsed);
      
      if (!validated.success) {
        throw new Error(`Invalid experiments file: ${validated.error.message}`);
      }
      
      experimentsFile = validated.data;
      
      // Check if experiment slug already exists
      if (experimentsFile.experiments.some(exp => exp.slug === experimentConfig.experimentSlug)) {
        throw new Error(`Experiment with slug "${experimentConfig.experimentSlug}" already exists`);
      }
      
      // Add new experiment
      experimentsFile.experiments.push(experimentValidation.data);
    } else {
      // Create new experiments file
      experimentsFile = {
        experiments: [experimentValidation.data],
      };
    }
    
    // Validate entire file
    const fileValidation = experimentsFileSchema.safeParse(experimentsFile);
    if (!fileValidation.success) {
      throw new Error(`File validation failed: ${fileValidation.error.message}`);
    }
    
    // Write experiments.yml
    const yamlContent = yaml.dump(fileValidation.data, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"',
      forceQuotes: false,
    });
    
    fs.writeFileSync(configPath, yamlContent, "utf-8");
    
    // Clear cache
    const cacheKey = `${contentType}:${contentSlug}`;
    this.configCache.delete(cacheKey);
    
    console.log(`[Experiments] Created experiment ${experimentConfig.experimentSlug} for ${contentType}/${contentSlug}`);
    
    return {
      success: true,
      experimentSlug: experimentConfig.experimentSlug,
      newVariantFilename,
    };
  }
  
  /**
   * Build targeting object, filtering out empty arrays
   */
  private buildTargetingObject(targeting: {
    regions?: string[];
    devices?: ("mobile" | "desktop" | "tablet")[];
    locations?: string[];
    utm_sources?: string[];
    utm_campaigns?: string[];
    utm_mediums?: string[];
    countries?: string[];
  }): ExperimentConfig["targeting"] | undefined {
    const result: ExperimentConfig["targeting"] = {};
    
    if (targeting.regions?.length) result.regions = targeting.regions;
    if (targeting.devices?.length) result.devices = targeting.devices;
    if (targeting.locations?.length) result.locations = targeting.locations;
    if (targeting.utm_sources?.length) result.utm_sources = targeting.utm_sources;
    if (targeting.utm_campaigns?.length) result.utm_campaigns = targeting.utm_campaigns;
    if (targeting.utm_mediums?.length) result.utm_mediums = targeting.utm_mediums;
    if (targeting.countries?.length) result.countries = targeting.countries;
    
    // Return undefined if no targeting rules
    if (Object.keys(result).length === 0) {
      return undefined;
    }
    
    return result;
  }
}

// Singleton instance
let instance: ExperimentManager | null = null;

function getExperimentManager(): ExperimentManager {
  if (!instance) {
    instance = new ExperimentManager();
  }
  return instance;
}
