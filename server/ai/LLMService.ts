/**
 * LLM Service - Factory pattern with retry/backoff for OpenAI calls
 */

import OpenAI from "openai";
import type { ILLMClient, LLMOptions, StructuredOutputOptions } from "./types";

// Default configuration
const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// Singleton instance
let instance: LLMService | null = null;

export class LLMService implements ILLMClient {
  private client: OpenAI;

  private constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error(
        "OpenAI not configured. Please set OPENAI_API_KEY in Secrets."
      );
    }

    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }

  static getInstance(): LLMService {
    if (!instance) {
      instance = new LLMService();
    }
    return instance;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Complete a prompt with retry logic
   */
  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    let lastError: Error | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

        if (options?.systemPrompt) {
          messages.push({ role: "system", content: options.systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const response = await this.client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from LLM");
        }

        return content.trim();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || "";

        // Check if it's a rate limit error
        if (
          errorMessage.includes("rate_limit") ||
          errorMessage.includes("429")
        ) {
          console.warn(
            `Rate limited (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms...`
          );
          await this.sleep(backoffMs);
          backoffMs *= 2; // Exponential backoff
          continue;
        }

        // Check if it's a transient error
        if (
          errorMessage.includes("timeout") ||
          errorMessage.includes("network") ||
          errorMessage.includes("ECONNRESET")
        ) {
          console.warn(
            `Transient error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms...`
          );
          await this.sleep(backoffMs);
          backoffMs *= 2;
          continue;
        }

        // Non-retryable error, throw immediately
        throw error;
      }
    }

    throw lastError || new Error("Failed after max retries");
  }

  /**
   * Adapt content with structured output
   */
  async adaptContent(
    systemPrompt: string,
    userPrompt: string,
    options?: Omit<LLMOptions, "systemPrompt">
  ): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature ?? 0.5; // Lower for more consistent output
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    let lastError: Error | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from LLM");
        }

        return {
          content: content.trim(),
          usage: response.usage
            ? {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                total_tokens: response.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || "";

        if (
          errorMessage.includes("rate_limit") ||
          errorMessage.includes("429") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("network")
        ) {
          console.warn(
            `LLM error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms...`
          );
          await this.sleep(backoffMs);
          backoffMs *= 2;
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error("Failed after max retries");
  }

  /**
   * Adapt content with structured output enforcement using JSON schema
   * This uses OpenAI's structured output feature to ensure schema compliance
   */
  async adaptContentStructured(
    systemPrompt: string,
    userPrompt: string,
    options: StructuredOutputOptions
  ): Promise<{
    content: Record<string, unknown>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature ?? 0.5;
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    let lastError: Error | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: options.schemaName || "component_content",
              strict: true,
              schema: options.jsonSchema,
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Empty response from LLM");
        }

        const parsed = JSON.parse(content);

        return {
          content: parsed,
          usage: response.usage
            ? {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                total_tokens: response.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || "";

        if (
          errorMessage.includes("rate_limit") ||
          errorMessage.includes("429") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("network")
        ) {
          console.warn(
            `LLM error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${backoffMs}ms...`
          );
          await this.sleep(backoffMs);
          backoffMs *= 2;
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error("Failed after max retries");
  }
}

// Export singleton getter
export function getLLMService(): LLMService {
  return LLMService.getInstance();
}
