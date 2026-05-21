/**
 * Validators Registry
 * 
 * Exports all available validators and provides discovery utilities.
 */

import type { Validator, ValidatorMetadata } from "../shared/types";
import { redirectValidator } from "./redirects";
import { metaValidator } from "./meta";
import { schemaValidator } from "./schema";
import { sitemapValidator } from "./sitemap";
import { componentsValidator } from "./components";
import { backgroundsValidator } from "./backgrounds";
import { faqsValidator } from "./faqs";
import { seoDepthValidator } from "./seo-depth";
import { schemaCompletenessValidator } from "./schema-completeness";
import { imagesValidator } from "./images";
import { contentQualityValidator } from "./content-quality";
import { databaseSinglesValidator } from "./database-singles";
import { slugConflictsValidator } from "./slug-conflicts";
import { seoIntentValidator } from "./seo-intent";
import { imageOptimizationValidator } from "./image-optimization";
import { heroImageTagsValidator } from "./hero-image-tags";
import { imageTagsValidator } from "./image-tags";
import { lighthouseValidator } from "./lighthouse";
import { fieldMappingsValidator } from "./field-mappings";

export const validators: Validator[] = [
  redirectValidator,
  metaValidator,
  schemaValidator,
  sitemapValidator,
  componentsValidator,
  backgroundsValidator,
  faqsValidator,
  seoDepthValidator,
  schemaCompletenessValidator,
  imagesValidator,
  contentQualityValidator,
  databaseSinglesValidator,
  slugConflictsValidator,
  seoIntentValidator,
  imageOptimizationValidator,
  heroImageTagsValidator,
  imageTagsValidator,
  fieldMappingsValidator,
];

export const slowValidators: Validator[] = [lighthouseValidator];

export const allValidators = [...validators, ...slowValidators];

export const validatorMap = new Map<string, Validator>(
  validators.map((v) => [v.name, v])
);

export function getValidator(name: string): Validator | undefined {
  return validatorMap.get(name) ?? slowValidators.find((v) => v.name === name);
}

export function listValidators(): ValidatorMetadata[] {
  return allValidators.map((v) => ({
    name: v.name,
    description: v.description,
    apiExposed: v.apiExposed,
    estimatedDuration: v.estimatedDuration,
    category: v.category,
  }));
}

export function getApiExposedValidators(): Validator[] {
  return validators.filter((v) => v.apiExposed);
}

export {
  redirectValidator,
  metaValidator,
  schemaValidator,
  sitemapValidator,
  componentsValidator,
  backgroundsValidator,
  faqsValidator,
  seoDepthValidator,
  schemaCompletenessValidator,
  imagesValidator,
  contentQualityValidator,
  databaseSinglesValidator,
  slugConflictsValidator,
  seoIntentValidator,
  imageOptimizationValidator,
  heroImageTagsValidator,
  imageTagsValidator,
  lighthouseValidator,
  fieldMappingsValidator,
};
