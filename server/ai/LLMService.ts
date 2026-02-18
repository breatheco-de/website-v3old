/**
 * LLM Service - Factory pattern with retry/backoff for OpenAI calls
 * Reads provider config from marketing-content/llm.yml when available
 */

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import type { ILLMClient, LLMOptions, StructuredOutputOptions } from "./types";

interface LLMYamlConfig {
  provider?: {
    api_key_env?: string;
    base_url_env?: string;
  };
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

let instance: LLMService | null = null;
let yamlConfig: LLMYamlConfig | null = null;
let yamlConfigLoaded = false;

function loadYamlConfig(): LLMYamlConfig | null {
  if (yamlConfigLoaded) return yamlConfig;
  yamlConfigLoaded = true;
  try {
    const configPath = path.resolve("marketing-content/llm.yml");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      yamlConfig = yaml.load(raw) as LLMYamlConfig;
      return yamlConfig;
    }
  } catch (err) {
    console.warn("Failed to load llm.yml config, using env var fallback:", err);
  }
  return null;
}

export function getLLMConfig(): LLMYamlConfig {
  const cfg = loadYamlConfig();
  return {
    provider: cfg?.provider || {},
    model: cfg?.model || "gpt-4o",
    temperature: cfg?.temperature ?? 0.7,
    max_tokens: cfg?.max_tokens || 2000,
  };
}

export function reloadLLMConfig(): void {
  yamlConfigLoaded = false;
  yamlConfig = null;
  instance = null;
}

export class LLMService implements ILLMClient {
  private client: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  private constructor() {
    const cfg = loadYamlConfig();

    const apiKeyEnv = cfg?.provider?.api_key_env;
    const baseUrlEnv = cfg?.provider?.base_url_env;

    this.defaultModel = cfg?.model || "gpt-4o";
    this.defaultTemperature = cfg?.temperature ?? 0.7;
    this.defaultMaxTokens = cfg?.max_tokens || 2000;

    const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined;
    const baseUrl = baseUrlEnv ? process.env[baseUrlEnv] : undefined;

    if (apiKey && baseUrl) {
      this.client = new OpenAI({ baseURL: baseUrl, apiKey });
    } else if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      const customApiKey = process.env.OPENAI_API_KEY;
      const replitBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      const replitApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

      if (customApiKey) {
        this.client = new OpenAI({ apiKey: customApiKey });
      } else if (replitBaseURL && replitApiKey) {
        this.client = new OpenAI({ baseURL: replitBaseURL, apiKey: replitApiKey });
      } else {
        throw new Error(
          "OpenAI not configured. Set provider env vars in marketing-content/llm.yml, OPENAI_API_KEY in Secrets, or set up Replit AI Integrations."
        );
      }
    }
  }

  static getInstance(): LLMService {
    if (!instance) {
      instance = new LLMService();
    }
    return instance;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? this.defaultTemperature;
    const maxTokens = options?.maxTokens || this.defaultMaxTokens;

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

        if (
          errorMessage.includes("rate_limit") ||
          errorMessage.includes("429") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("network") ||
          errorMessage.includes("ECONNRESET")
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

  async adaptContent(
    systemPrompt: string,
    userPrompt: string,
    options?: Omit<LLMOptions, "systemPrompt">
  ): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.5;
    const maxTokens = options?.maxTokens || this.defaultMaxTokens;

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

  async adaptContentStructured(
    systemPrompt: string,
    userPrompt: string,
    options: StructuredOutputOptions
  ): Promise<{
    content: Record<string, unknown>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.5;
    const maxTokens = options?.maxTokens || this.defaultMaxTokens;

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

export function getLLMService(): LLMService {
  return LLMService.getInstance();
}
