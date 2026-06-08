/**
 * Content Adapter - Orchestrates AI-powered content adaptation
 * Uses OpenAI structured outputs for schema-enforced responses
 */

import * as yaml from "js-yaml";
import type { AdaptOptions, AdaptResult, FullContext } from "./types";
import { getContextManager, type ContextManager } from "./ContextManager";
import { getLLMService, type LLMService } from "./LLMService";
import { SYSTEM_PROMPT, buildAdaptationPrompt, buildContextBlock, buildTargetStructureBlock, extractConstraintsFromExample, buildConstraintsBlock } from "./prompts";
import { componentToJsonSchema, validateContentAgainstSchema } from "./SchemaConverter";
import { child } from "../logger";
const log = child({ module: "ai/ContentAdapter" });



// Singleton instance
let instance: ContentAdapter | null = null;

export class ContentAdapter {
  private contextManager: ContextManager;
  private llmService: LLMService;

  private constructor() {
    this.contextManager = getContextManager();
    this.llmService = getLLMService();
  }

  static getInstance(): ContentAdapter {
    if (!instance) {
      instance = new ContentAdapter();
    }
    return instance;
  }

  /**
   * Clean YAML output from LLM response
   * Removes markdown code blocks and extra whitespace
   */
  private cleanYamlOutput(content: string): string {
    let cleaned = content.trim();

    if (cleaned.startsWith("```yaml")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }

    return cleaned.trim();
  }

  /**
   * Validate that the output is valid YAML
   */
  private validateYaml(content: string): { valid: boolean; parsed?: unknown; error?: string } {
    try {
      const parsed = yaml.load(content);
      if (typeof parsed !== "object" || parsed === null) {
        return { valid: false, error: "YAML must be an object" };
      }
      return { valid: true, parsed };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid YAML",
      };
    }
  }


  /**
   * Adapt content using AI with structured output enforcement
   * Primary method - uses JSON schema to enforce valid output structure
   */
  async adaptStructured(options: AdaptOptions): Promise<AdaptResult> {
    const model = "gpt-4o";
    
    // Build full context
    const context = await this.contextManager.buildAdaptationContext(options);

    // Generate JSON schema for the component
    const jsonSchema = componentToJsonSchema(context.component, context.targetVariant);

    // Build the prompt (simpler since structure is enforced by schema)
    const contextBlock = buildContextBlock(context);
    const structureBlock = buildTargetStructureBlock(context.component, context.targetVariant);
    
    // Extract constraints from example YAML and build constraints block
    // Pass the explicit targetVariant selected by the user (takes priority over extracted variant)
    let constraintsBlock = "";
    if (options.targetExampleYaml) {
      const constraints = extractConstraintsFromExample(options.targetExampleYaml);
      constraintsBlock = buildConstraintsBlock(constraints, options.targetVariant);
    } else if (options.targetVariant) {
      // Even without example YAML, enforce the variant if specified
      constraintsBlock = buildConstraintsBlock({ variant: null, enumValues: {}, requiredPaths: [] }, options.targetVariant);
    }
    
    // Build example reference block if example YAML is provided
    let exampleBlock = "";
    if (options.targetExampleYaml) {
      exampleBlock = `

## REFERENCE EXAMPLE (USE THIS AS A TEMPLATE)

This is a working example of the target component. Your output MUST follow this exact structure:

\`\`\`yaml
${options.targetExampleYaml}
\`\`\`

CRITICAL: Copy the exact field names and nested structure from this example. Only change the text content to match the source.`;
    }
    
    const prompt = `${constraintsBlock}

${contextBlock}

${structureBlock}${exampleBlock}

## SOURCE CONTENT TO ADAPT

\`\`\`yaml
${options.sourceYaml}
\`\`\`

## INSTRUCTIONS

Transform the source content to match the target component structure while:
1. Maintaining the core message and value proposition
2. Adapting language to match brand voice guidelines
3. Ensuring ALL required properties are filled with appropriate content (check the example for exact field names)
4. Using appropriate content from the source or generating contextually appropriate content
5. Following the component's when_to_use guidance
6. IMPORTANT: Include all nested required properties listed in STRICT REQUIREMENTS above

Respond with a JSON object that matches the target component structure.`;

    try {
      // Try structured output first
      const result = await this.llmService.adaptContentStructured(
        SYSTEM_PROMPT,
        prompt,
        {
          jsonSchema: jsonSchema as unknown as Record<string, unknown>,
          schemaName: `${options.targetComponent}_${options.targetVariant || 'default'}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        }
      );

      // Validate the structured output against our schema (recursive validation)
      const validation = validateContentAgainstSchema(result.content, context.component, context.targetVariant);
      
      if (!validation.valid) {
        log.warn("Structured output missing required fields:", validation.errors);
        // Continue with cleaned content, letting downstream validation handle issues
      }

      // Force inject the variant field if targetVariant is specified
      // This ensures the output always has the correct variant regardless of LLM behavior
      const finalContent = validation.cleaned as Record<string, unknown>;
      if (context.targetVariant) {
        finalContent.variant = context.targetVariant;
      }

      // Convert to YAML
      const adaptedYaml = yaml.dump(finalContent, { 
        indent: 2, 
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });

      return {
        adaptedYaml,
        context: this.buildContextSummary(context),
        model,
        tokens: result.usage
          ? {
              prompt: result.usage.prompt_tokens,
              completion: result.usage.completion_tokens,
              total: result.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      // If structured output fails (e.g., schema too complex), fall back to text-based approach
      log.warn("Structured output failed, falling back to text-based adaptation:", error);
      return this.adapt(options);
    }
  }

  /**
   * Adapt content using AI (legacy text-based approach)
   * Fallback method when structured outputs aren't available
   */
  async adapt(options: AdaptOptions): Promise<AdaptResult> {
    const model = "gpt-4o";
    
    // Build full context
    const context = await this.contextManager.buildAdaptationContext(options);

    // Build the prompt
    const prompt = buildAdaptationPrompt(
      context,
      options.sourceYaml,
      options.targetStructure
    );

    // Call LLM
    const result = await this.llmService.adaptContent(SYSTEM_PROMPT, prompt);

    // Clean and validate output
    const cleanedYaml = this.cleanYamlOutput(result.content);
    const validation = this.validateYaml(cleanedYaml);

    if (!validation.valid) {
      // Try to fix by resending full context with error information
      log.warn("Invalid YAML output, attempting to fix:", validation.error);
      
      const fixPrompt = `${prompt}

---
CORRECTION REQUIRED:

Your previous response was:
\`\`\`
${result.content}
\`\`\`

This output is not valid YAML. Error: ${validation.error}

Please try again. Output ONLY valid YAML content that matches the ${options.targetComponent} component structure.
No explanations, no markdown code blocks, just the corrected YAML content:`;

      const retryResult = await this.llmService.adaptContent(SYSTEM_PROMPT, fixPrompt);
      const retryCleanedYaml = this.cleanYamlOutput(retryResult.content);
      const retryValidation = this.validateYaml(retryCleanedYaml);

      if (!retryValidation.valid) {
        throw new Error(`Failed to generate valid YAML: ${retryValidation.error}`);
      }

      // Additional schema validation for the retry
      const parsed = retryValidation.parsed as Record<string, unknown>;
      const schemaValidation = validateContentAgainstSchema(parsed, context.component, context.targetVariant);
      
      // Force inject the variant field if targetVariant is specified
      const retryFinalContent = schemaValidation.cleaned as Record<string, unknown>;
      if (context.targetVariant) {
        retryFinalContent.variant = context.targetVariant;
      }
      
      const finalYaml = yaml.dump(retryFinalContent, { 
        indent: 2, 
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });

      return {
        adaptedYaml: finalYaml,
        context: this.buildContextSummary(context),
        model,
        tokens: result.usage
          ? {
              prompt: result.usage.prompt_tokens + (retryResult.usage?.prompt_tokens || 0),
              completion: result.usage.completion_tokens + (retryResult.usage?.completion_tokens || 0),
              total: result.usage.total_tokens + (retryResult.usage?.total_tokens || 0),
            }
          : undefined,
      };
    }

    // Validate parsed YAML against component schema
    const parsed = validation.parsed as Record<string, unknown>;
    const schemaValidation = validateContentAgainstSchema(parsed, context.component, context.targetVariant);
    
    // Force inject the variant field if targetVariant is specified
    const finalContent = schemaValidation.cleaned as Record<string, unknown>;
    if (context.targetVariant) {
      finalContent.variant = context.targetVariant;
    }
    
    const finalYaml = yaml.dump(finalContent, { 
      indent: 2, 
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    return {
      adaptedYaml: finalYaml,
      context: this.buildContextSummary(context),
      model,
      tokens: result.usage
        ? {
            prompt: result.usage.prompt_tokens,
            completion: result.usage.completion_tokens,
            total: result.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Build a summary of the context used for the adaptation
   */
  private buildContextSummary(context: FullContext): AdaptResult["context"] {
    return {
      brand: `${context.brand.brand.name} - ${context.brand.voice.tone}`,
      content: `${context.content.type}/${context.content.slug}`,
      component: `${context.component.name} v${context.component.version}`,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.contextManager.clearCache();
  }
}

// Export singleton getter
export function getContentAdapter(): ContentAdapter {
  return ContentAdapter.getInstance();
}
