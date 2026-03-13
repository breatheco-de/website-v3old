/**
 * Fixer Framework Types
 *
 * Core interfaces for the validator→fixer system.
 * Fixers are invoked via POST /api/validation/fix/:fixerName
 */

export interface FixerContext {
  dryRun?: boolean;
  [key: string]: unknown;
}

export interface FixerResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface Fixer {
  name: string;
  description: string;
  run(context: FixerContext): Promise<FixerResult>;
}
