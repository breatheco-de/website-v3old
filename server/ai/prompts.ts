/**
 * Prompt templates for AI Content Adaptation
 */

import * as yaml from "js-yaml";
import type { FullContext, ComponentContext } from "./types";
import { child } from "../logger";
const log = child({ module: "ai/prompts" });



// Known enum fields that should have their values extracted and enforced
const KNOWN_ENUM_FIELDS = ["color", "variant", "background", "theme", "size", "alignment"];

export interface ExampleConstraints {
  variant: string | null;
  enumValues: Record<string, string>; // e.g., { "brand_mark.color": "primary" }
  requiredPaths: string[]; // All nested paths found in the example
}

/**
 * Extract constraints from an example YAML string
 * This parses the example and extracts:
 * - The exact variant value
 * - Values for known enum fields (like color)
 * - All nested paths that exist in the example
 */
export function extractConstraintsFromExample(exampleYaml: string): ExampleConstraints {
  const constraints: ExampleConstraints = {
    variant: null,
    enumValues: {},
    requiredPaths: [],
  };

  try {
    let parsed = yaml.load(exampleYaml) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return constraints;
    }

    // Handle case where the example has a nested 'yaml' property containing the actual content
    // This happens when parsing example files from the registry which have structure:
    // { name: "...", description: "...", yaml: "- type: hero\n  variant: ..." }
    if (typeof parsed.yaml === "string") {
      const innerParsed = yaml.load(parsed.yaml);
      if (Array.isArray(innerParsed) && innerParsed.length > 0) {
        // It's an array of sections, use the first one
        parsed = innerParsed[0] as Record<string, unknown>;
      } else if (innerParsed && typeof innerParsed === "object") {
        parsed = innerParsed as Record<string, unknown>;
      }
    }
    
    // Also handle if the input is already an array (e.g., sections array)
    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed = parsed[0] as Record<string, unknown>;
    }

    // Recursively extract paths and enum values
    // Also capture the FIRST variant encountered at any depth
    const traverse = (obj: Record<string, unknown>, path: string = ""): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Add to required paths if it's a leaf value (not an object/array)
        if (value !== null && value !== undefined) {
          if (typeof value !== "object" || Array.isArray(value)) {
            constraints.requiredPaths.push(currentPath);
          }
          
          // Check if this is a known enum field (including variant)
          if (KNOWN_ENUM_FIELDS.includes(key) && typeof value === "string") {
            constraints.enumValues[currentPath] = value;
            
            // Capture the FIRST variant value encountered (at any depth)
            if (key === "variant" && constraints.variant === null) {
              constraints.variant = value;
            }
          }
          
          // Recurse into nested objects
          if (typeof value === "object" && !Array.isArray(value)) {
            traverse(value as Record<string, unknown>, currentPath);
          }
          
          // For arrays, traverse first item to get structure
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
            traverse(value[0] as Record<string, unknown>, `${currentPath}[]`);
          }
        }
      }
    };

    traverse(parsed);
  } catch (error) {
    log.warn("Failed to parse example YAML for constraints:", error);
  }

  return constraints;
}

/**
 * Build a constraints block for the prompt based on extracted example constraints
 * @param constraints - Constraints extracted from example YAML
 * @param explicitVariant - The variant explicitly selected by the user (takes priority)
 */
export function buildConstraintsBlock(constraints: ExampleConstraints, explicitVariant?: string): string {
  const lines: string[] = [];
  
  lines.push("## STRICT REQUIREMENTS (MUST FOLLOW EXACTLY)");
  lines.push("");
  
  // Use explicit variant if provided, otherwise fall back to extracted variant
  const variantToUse = explicitVariant || constraints.variant;
  
  // Variant requirement
  if (variantToUse) {
    lines.push(`### VARIANT VALUE`);
    lines.push(`You MUST set: variant: "${variantToUse}"`);
    lines.push(`This is a LITERAL string value. Do not change or paraphrase it.`);
    lines.push("");
  }
  
  // Enum values
  if (Object.keys(constraints.enumValues).length > 0) {
    lines.push(`### ENUM FIELD VALUES`);
    lines.push(`The following fields have specific allowed values. Use ONLY these exact values:`);
    for (const [path, value] of Object.entries(constraints.enumValues)) {
      if (path !== "variant") { // Don't duplicate variant
        lines.push(`- ${path}: "${value}" (use this exact value from the example)`);
      }
    }
    lines.push("");
  }
  
  // Key required paths (show important nested ones)
  // Include paths with "[]" but normalize them to "[0]" for clarity
  const nestedPaths = constraints.requiredPaths
    .filter(p => p.includes("."))
    .map(p => p.replace(/\[\]/g, "[0]")); // Normalize array notation
  if (nestedPaths.length > 0) {
    lines.push(`### REQUIRED NESTED FIELDS`);
    lines.push(`Your output MUST include these nested fields (found in the example):`);
    // Group by parent and show first 25 most important
    const importantPaths = nestedPaths.slice(0, 25);
    for (const path of importantPaths) {
      lines.push(`- ${path}`);
    }
    if (nestedPaths.length > 25) {
      lines.push(`- ... and ${nestedPaths.length - 25} more nested fields (follow the example structure)`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}

// System prompt establishing the AI's role and constraints
export const SYSTEM_PROMPT = `You are a content adaptation specialist for 4Geeks Academy, a coding bootcamp. Your role is to transform content from one format to another while maintaining brand voice and messaging guidelines.

CRITICAL RULES:
1. Output ONLY valid YAML - no markdown code blocks, no explanations
2. Preserve the semantic meaning while adapting to the target structure
3. Follow the brand voice: professional yet approachable, encouraging but not pushy
4. Never use forbidden phrases or make unrealistic promises
5. Add required disclaimers when mentioning job guarantees or salary claims
6. Keep content concise and action-oriented
7. Address the reader directly using "you" and "your"`;

/**
 * Build the context block that provides layered context to the LLM
 */
export function buildContextBlock(context: FullContext): string {
  const { brand, content, component, userOverrides } = context;
  
  let contextBlock = `## CONTEXT HIERARCHY (priority: brand > content > component)

### 1. BRAND CONTEXT (highest priority)
Brand: ${brand.brand.name}
Voice: ${brand.voice.tone}
Style: ${brand.voice.style}

Key Differentiators:
${brand.key_differentiators.map(d => `- ${d}`).join("\n")}

Messaging Priorities:
${brand.messaging_priorities.map(p => `- ${p.name} (priority ${p.weight}): ${p.examples[0]}`).join("\n")}

Forbidden Phrases: ${brand.forbidden_phrases.slice(0, 5).join(", ")}

### 2. CONTENT CONTEXT
Content Type: ${content.type}
Slug: ${content.slug}`;

  if (content.context?.when_to_use) {
    contextBlock += `\nPurpose: ${content.context.when_to_use}`;
  }
  if (content.context?.target_audience) {
    contextBlock += `\nTarget Audience: ${content.context.target_audience}`;
  }

  contextBlock += `

### 3. COMPONENT CONTEXT
Component: ${component.name} v${component.version}`;

  if (component.description) {
    contextBlock += `\nDescription: ${component.description}`;
  }
  if (component.when_to_use) {
    contextBlock += `\nWhen to Use: ${component.when_to_use}`;
  }

  if (userOverrides) {
    contextBlock += `

### 4. USER OVERRIDES (apply these modifications)`;
    if (userOverrides.tone) {
      contextBlock += `\nTone Override: ${userOverrides.tone}`;
    }
    if (userOverrides.targetAudience) {
      contextBlock += `\nTarget Audience Override: ${userOverrides.targetAudience}`;
    }
    if (userOverrides.additionalGuidelines?.length) {
      contextBlock += `\nAdditional Guidelines:\n${userOverrides.additionalGuidelines.map(g => `- ${g}`).join("\n")}`;
    }
  }

  return contextBlock;
}

/**
 * Format a property definition for the prompt
 */
function formatProp(name: string, prop: { type: string; required?: boolean; description?: string; properties?: Record<string, unknown> }, isRequired: boolean): string {
  const reqStr = isRequired ? "" : " (optional)";
  const descStr = prop.description ? ` - ${prop.description}` : "";
  let propLine = `  ${name}: # ${prop.type}${reqStr}${descStr}`;
  
  if (prop.properties) {
    const nestedProps = Object.entries(prop.properties)
      .map(([n, p]) => `    ${n}: # ${(p as { type?: string }).type || 'string'}`)
      .join("\n");
    propLine += `\n${nestedProps}`;
  }
  
  return propLine;
}

/**
 * Build the target structure block describing the expected output format
 * Now includes variant-specific required properties
 */
export function buildTargetStructureBlock(component: ComponentContext, targetVariant?: string): string {
  const requiredProps = Object.entries(component.props)
    .filter(([_, prop]) => prop.required)
    .map(([name, prop]) => formatProp(name, prop, true));

  const optionalProps = Object.entries(component.props)
    .filter(([_, prop]) => !prop.required)
    .map(([name, prop]) => formatProp(name, prop, false));

  let structureBlock = `## TARGET STRUCTURE

The output must be valid YAML matching this structure:

Required properties (common):
${requiredProps.join("\n")}

Optional properties (common):
${optionalProps.join("\n")}`;

  if (targetVariant && component.variant_props?.[targetVariant]) {
    const variantProps = component.variant_props[targetVariant];
    const variantRequired = Object.entries(variantProps)
      .filter(([_, prop]) => prop.required)
      .map(([name, prop]) => formatProp(name, prop, true));
    
    const variantOptional = Object.entries(variantProps)
      .filter(([_, prop]) => !prop.required)
      .map(([name, prop]) => formatProp(name, prop, false));
    
    if (variantRequired.length > 0) {
      structureBlock += `

REQUIRED properties for variant "${targetVariant}" (YOU MUST INCLUDE THESE):
${variantRequired.join("\n")}`;
    }
    
    if (variantOptional.length > 0) {
      structureBlock += `

Optional properties for variant "${targetVariant}":
${variantOptional.join("\n")}`;
    }
  }

  return structureBlock;
}

/**
 * Build the complete adaptation prompt
 */
export function buildAdaptationPrompt(
  context: FullContext,
  sourceYaml: string,
  targetStructure?: Record<string, unknown>
): string {
  const contextBlock = buildContextBlock(context);
  const structureBlock = buildTargetStructureBlock(context.component, context.targetVariant);

  let prompt = `${contextBlock}

${structureBlock}

## SOURCE CONTENT TO ADAPT

\`\`\`yaml
${sourceYaml}
\`\`\`

## INSTRUCTIONS

Transform the source content to match the target structure while:
1. Maintaining the core message and value proposition
2. Adapting language to match brand voice guidelines
3. Ensuring all required properties are filled
4. Using appropriate content from the source or generating contextually appropriate content
5. Following the component's when_to_use guidance`;

  if (targetStructure) {
    prompt += `

## ADDITIONAL TARGET STRUCTURE HINTS
\`\`\`json
${JSON.stringify(targetStructure, null, 2)}
\`\`\``;
  }

  prompt += `

## OUTPUT

Respond with ONLY the adapted YAML content. No explanations, no markdown code blocks, just valid YAML:`;

  return prompt;
}

/**
 * Build a validation prompt to check if output matches schema
 */
export function buildValidationPrompt(yamlContent: string, component: ComponentContext, targetVariant?: string): string {
  const commonRequired = Object.entries(component.props)
    .filter(([_, prop]) => prop.required)
    .map(([name]) => name);
  
  let variantRequired: string[] = [];
  if (targetVariant && component.variant_props?.[targetVariant]) {
    variantRequired = Object.entries(component.variant_props[targetVariant])
      .filter(([_, prop]) => prop.required)
      .map(([name]) => name);
  }
  
  const allRequired = [...commonRequired, ...variantRequired];
  
  return `Validate this YAML content against the ${component.name} component schema${targetVariant ? ` (variant: ${targetVariant})` : ''}.

YAML to validate:
\`\`\`yaml
${yamlContent}
\`\`\`

Required properties: ${allRequired.join(", ")}

Respond with ONLY "VALID" if the YAML is valid, or respond with a corrected version of the YAML if there are issues.`;
}
