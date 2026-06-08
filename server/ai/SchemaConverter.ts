/**
 * Schema Converter - Transforms component registry YAML schemas to JSON Schema format
 * for use with OpenAI structured outputs
 */

import type { ComponentContext, PropDefinition } from "./types";
import { child } from "../logger";
const log = child({ module: "ai/SchemaConverter" });



export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: string[];
  description?: string;
  default?: unknown;
  additionalProperties?: boolean;
}

/**
 * Check if prop.items is a primitive type definition vs an object/array definition
 * 
 * Three patterns exist in YAML schemas:
 * 1. Primitive array: items: { type: string } - returns true
 * 2. Object array (shorthand): items: { text: {...}, url: {...} } - returns false  
 * 3. Object array (explicit): items: { type: object, properties: {...} } - returns false
 */
function isPrimitiveItemsDefinition(items: Record<string, PropDefinition>): boolean {
  const itemsAny = items as unknown as Record<string, unknown>;
  
  // If items has a 'properties' key, it's definitely an object schema
  if ('properties' in itemsAny) {
    return false;
  }
  
  // If items has a 'type' key at top level
  if ('type' in itemsAny && typeof itemsAny.type === 'string') {
    const itemType = itemsAny.type as string;
    // Only primitive types (string, number, boolean) qualify
    // 'object' and 'array' are complex types requiring nested handling
    if (itemType === 'string' || itemType === 'number' || itemType === 'boolean') {
      return true;
    }
    return false;
  }
  
  // No 'type' at top level means it's an object property map (shorthand pattern)
  return false;
}

/**
 * Convert a PropDefinition to JSON Schema format
 * Handles nested objects, arrays of primitives, and arrays of objects
 * 
 * IMPORTANT: OpenAI strict mode requires ALL properties to be in the 'required' array.
 * Properties that are semantically optional should use nullable types or have default values.
 */
function propToJsonSchema(prop: PropDefinition, collectRequired: boolean = true): JSONSchema {
  const schema: JSONSchema = { type: "string" };

  switch (prop.type) {
    case "string":
      schema.type = "string";
      break;
    case "number":
      schema.type = "number";
      break;
    case "boolean":
      schema.type = "boolean";
      break;
    case "array":
      schema.type = "array";
      if (prop.items) {
        // Check if items is a primitive type definition or object properties map
        if (isPrimitiveItemsDefinition(prop.items)) {
          // Primitive array: items: { type: string }
          const itemDef = prop.items as unknown as PropDefinition;
          schema.items = propToJsonSchema(itemDef, false);
        } else {
          // Object array - two patterns:
          // 1. Explicit: items: { type: object, properties: {...} }
          // 2. Shorthand: items: { text: {...}, url: {...} }
          const itemsAny = prop.items as unknown as Record<string, unknown>;
          
          schema.items = {
            type: "object",
            properties: {},
            additionalProperties: false,
          };
          // OpenAI strict mode: ALL properties must be in required array
          const allItemKeys: string[] = [];
          
          // Explicit object pattern: items has 'properties' key
          if ('properties' in itemsAny && typeof itemsAny.properties === 'object') {
            const propsMap = itemsAny.properties as Record<string, PropDefinition>;
            for (const [itemKey, itemProp] of Object.entries(propsMap)) {
              schema.items.properties![itemKey] = propToJsonSchema(itemProp as PropDefinition, true);
              allItemKeys.push(itemKey);
            }
          } else {
            // Shorthand pattern: items is the property map directly
            for (const [itemKey, itemProp] of Object.entries(prop.items)) {
              schema.items.properties![itemKey] = propToJsonSchema(itemProp as PropDefinition, true);
              allItemKeys.push(itemKey);
            }
          }
          
          // OpenAI strict mode requires ALL properties in required array
          if (allItemKeys.length > 0) {
            schema.items.required = allItemKeys;
          }
        }
      } else {
        schema.items = { type: "string" };
      }
      break;
    case "object":
      schema.type = "object";
      schema.additionalProperties = false;
      if (prop.properties) {
        schema.properties = {};
        // OpenAI strict mode: ALL properties must be in required array
        const allPropKeys: string[] = [];
        for (const [propKey, propValue] of Object.entries(prop.properties)) {
          schema.properties[propKey] = propToJsonSchema(propValue as PropDefinition, true);
          allPropKeys.push(propKey);
        }
        // OpenAI strict mode requires ALL properties in required array
        if (allPropKeys.length > 0) {
          schema.required = allPropKeys;
        }
      }
      break;
    default:
      schema.type = "string";
  }

  if (prop.description) {
    schema.description = prop.description;
  }
  if (prop.default !== undefined) {
    schema.default = prop.default;
  }

  return schema;
}

/**
 * Convert a ComponentContext to JSON Schema format
 * Merges common props with variant-specific props
 * 
 * NOTE: Only properties with propDef.required === true go into the 'required' array.
 * This allows the LLM to omit optional properties and follow the example more closely.
 */
export function componentToJsonSchema(
  component: ComponentContext,
  targetVariant?: string
): JSONSchema {
  const schema: JSONSchema = {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  };

  // Add type property (always required for sections)
  schema.properties!["type"] = {
    type: "string",
    description: "Section type identifier",
  };
  schema.required!.push("type");

  // Add version property (optional - many examples omit it)
  schema.properties!["version"] = {
    type: "string",
    description: "Component version",
  };
  // Note: version is NOT added to required array - it's optional

  // Add variant property (required when targeting a specific variant)
  if (targetVariant) {
    schema.properties!["variant"] = {
      type: "string",
      description: "Component variant identifier",
      enum: [targetVariant], // Enforce the exact variant value
    };
    schema.required!.push("variant");
  }

  // Add common props - only mark as required if propDef.required === true
  for (const [propName, propDef] of Object.entries(component.props)) {
    schema.properties![propName] = propToJsonSchema(propDef);
    // Only add to required array if the schema marks it as required
    if (propDef.required && !schema.required!.includes(propName)) {
      schema.required!.push(propName);
    }
  }

  // Add variant-specific props - only mark as required if propDef.required === true
  if (targetVariant && component.variant_props?.[targetVariant]) {
    const variantProps = component.variant_props[targetVariant];
    for (const [propName, propDef] of Object.entries(variantProps)) {
      schema.properties![propName] = propToJsonSchema(propDef);
      // Only add to required array if the schema marks it as required
      if (propDef.required && !schema.required!.includes(propName)) {
        schema.required!.push(propName);
      }
    }
  }

  return schema;
}

/**
 * Get the list of all required properties for a component/variant
 */
export function getRequiredProperties(
  component: ComponentContext,
  targetVariant?: string
): string[] {
  const required: string[] = [];

  // Add common required props
  for (const [propName, propDef] of Object.entries(component.props)) {
    if (propDef.required) {
      required.push(propName);
    }
  }

  // Add variant-specific required props
  if (targetVariant && component.variant_props?.[targetVariant]) {
    for (const [propName, propDef] of Object.entries(component.variant_props[targetVariant])) {
      if (propDef.required && !required.includes(propName)) {
        required.push(propName);
      }
    }
  }

  return required;
}

/**
 * Get all valid property names for a component/variant
 */
export function getValidProperties(
  component: ComponentContext,
  targetVariant?: string
): string[] {
  const validProps = new Set<string>(["type", "version"]);

  // Add variant to valid props if a target variant is specified
  if (targetVariant) {
    validProps.add("variant");
  }

  // Add common props
  for (const propName of Object.keys(component.props)) {
    validProps.add(propName);
  }

  // Add variant-specific props
  if (targetVariant && component.variant_props?.[targetVariant]) {
    for (const propName of Object.keys(component.variant_props[targetVariant])) {
      validProps.add(propName);
    }
  }

  return Array.from(validProps);
}

/**
 * Recursively validate an object against a PropDefinition
 * Returns cleaned object and any validation errors
 */
function validatePropValue(
  value: unknown,
  propDef: PropDefinition,
  path: string
): { valid: boolean; cleaned: unknown; errors: string[] } {
  const errors: string[] = [];

  if (value === null || value === undefined) {
    if (propDef.required) {
      errors.push(`Missing required property: ${path}`);
    }
    return { valid: errors.length === 0, cleaned: value, errors };
  }

  switch (propDef.type) {
    case "string":
      if (typeof value !== "string") {
        return { valid: true, cleaned: String(value), errors };
      }
      return { valid: true, cleaned: value, errors };

    case "number":
      if (typeof value !== "number") {
        const num = Number(value);
        if (!isNaN(num)) {
          return { valid: true, cleaned: num, errors };
        }
        errors.push(`${path} should be a number`);
        return { valid: false, cleaned: value, errors };
      }
      return { valid: true, cleaned: value, errors };

    case "boolean":
      if (typeof value !== "boolean") {
        return { valid: true, cleaned: Boolean(value), errors };
      }
      return { valid: true, cleaned: value, errors };

    case "array":
      if (!Array.isArray(value)) {
        errors.push(`${path} should be an array`);
        return { valid: false, cleaned: [], errors };
      }
      if (propDef.items) {
        const cleanedArray: unknown[] = [];
        if (isPrimitiveItemsDefinition(propDef.items)) {
          // Primitive array
          const itemDef = propDef.items as unknown as PropDefinition;
          for (let i = 0; i < value.length; i++) {
            const itemResult = validatePropValue(value[i], itemDef, `${path}[${i}]`);
            cleanedArray.push(itemResult.cleaned);
            errors.push(...itemResult.errors);
          }
        } else {
          // Object array - two patterns:
          // 1. Explicit: items: { type: object, properties: {...} }
          // 2. Shorthand: items: { text: {...}, url: {...} }
          const itemsAny = propDef.items as unknown as Record<string, unknown>;
          
          // Determine which property map to use for validation
          let propsMap: Record<string, PropDefinition>;
          if ('properties' in itemsAny && typeof itemsAny.properties === 'object') {
            propsMap = itemsAny.properties as Record<string, PropDefinition>;
          } else {
            propsMap = propDef.items;
          }
          
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (typeof item === "object" && item !== null) {
              const cleanedItem: Record<string, unknown> = {};
              for (const [itemKey, itemProp] of Object.entries(propsMap)) {
                const itemValue = (item as Record<string, unknown>)[itemKey];
                const itemResult = validatePropValue(itemValue, itemProp as PropDefinition, `${path}[${i}].${itemKey}`);
                if (itemResult.cleaned !== undefined) {
                  cleanedItem[itemKey] = itemResult.cleaned;
                }
                errors.push(...itemResult.errors);
              }
              cleanedArray.push(cleanedItem);
            } else {
              cleanedArray.push(item);
            }
          }
        }
        return { valid: errors.length === 0, cleaned: cleanedArray, errors };
      }
      return { valid: true, cleaned: value, errors };

    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${path} should be an object`);
        return { valid: false, cleaned: {}, errors };
      }
      if (propDef.properties) {
        const cleanedObj: Record<string, unknown> = {};
        const valueObj = value as Record<string, unknown>;
        
        for (const [propKey, propValue] of Object.entries(propDef.properties)) {
          const nestedValue = valueObj[propKey];
          const nestedResult = validatePropValue(nestedValue, propValue as PropDefinition, `${path}.${propKey}`);
          if (nestedResult.cleaned !== undefined) {
            cleanedObj[propKey] = nestedResult.cleaned;
          }
          errors.push(...nestedResult.errors);
        }
        return { valid: errors.length === 0, cleaned: cleanedObj, errors };
      }
      return { valid: true, cleaned: value, errors };

    default:
      return { valid: true, cleaned: value, errors };
  }
}

/**
 * Recursively validate content against component schema
 * Checks required properties at all levels and cleans invalid nested data
 */
export function validateContentAgainstSchema(
  content: Record<string, unknown>,
  component: ComponentContext,
  targetVariant?: string
): { valid: boolean; cleaned: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const cleaned: Record<string, unknown> = {};
  const validProps = getValidProperties(component, targetVariant);

  // Copy type, version, and variant
  if (content.type) cleaned.type = content.type;
  if (content.version) cleaned.version = content.version;
  if (content.variant) cleaned.variant = content.variant;

  // Validate common props
  for (const [propName, propDef] of Object.entries(component.props)) {
    const value = content[propName];
    const result = validatePropValue(value, propDef, propName);
    if (result.cleaned !== undefined) {
      cleaned[propName] = result.cleaned;
    }
    errors.push(...result.errors);
  }

  // Validate variant-specific props
  if (targetVariant && component.variant_props?.[targetVariant]) {
    for (const [propName, propDef] of Object.entries(component.variant_props[targetVariant])) {
      const value = content[propName];
      const result = validatePropValue(value, propDef, propName);
      if (result.cleaned !== undefined) {
        cleaned[propName] = result.cleaned;
      }
      errors.push(...result.errors);
    }
  }

  // Warn about unknown properties
  for (const key of Object.keys(content)) {
    if (!validProps.includes(key)) {
      log.warn(`Removing unknown property not in schema: ${key}`);
    }
  }

  return { valid: errors.length === 0, cleaned, errors };
}
