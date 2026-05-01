/**
 * Fixer Framework Types
 *
 * Core interfaces for the validator→fixer system.
 * Fixers are invoked via POST /api/validation/fix/:fixerName
 */

export interface FixerContext {
  dryRun?: boolean;
  onProgress?: (event: ProgressEvent) => void;
  [key: string]: unknown;
}

export type ProgressEvent =
  | {
      type: "start";
      total: number;
    }
  | {
      type: "item";
      id: string;
      status: "ok" | "skipped" | "failed";
      message: string;
    };

export interface FixerResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface Fixer {
  name: string;
  description: string;
  runAfter?: string[];
  run(context: FixerContext): Promise<FixerResult>;
}
