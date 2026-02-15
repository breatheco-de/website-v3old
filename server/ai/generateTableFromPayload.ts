import { getLLMService } from "./LLMService";

export interface TableColumnConfig {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "image" | "link" | "boolean";
  function?: string;
}

export interface TableConfig {
  columns: TableColumnConfig[];
  title?: string;
}

export interface GenerateTableInput {
  sampleData: Record<string, unknown>[];
  availableKeys: string[];
  userPrompt: string;
  locale?: string;
}

export interface RefineTableInput {
  currentConfig: TableConfig;
  sampleData: Record<string, unknown>[];
  availableKeys: string[];
  userFeedback: string;
  locale?: string;
}

const SYSTEM_PROMPT = `You are a data table configuration assistant. Given a sample of data items and a user's description of what columns they want, produce a JSON configuration for a data table.

Rules:
- Available keys use dot notation for nested fields (e.g. "academy.name", "syllabus_version.duration_in_days").
- Map the user's natural language descriptions to the correct data keys by examining the sample data values.
- Infer the best column type based on the sample values: "text" for strings, "number" for numeric values, "date" for ISO date strings, "image" for URLs ending in image extensions, "link" for other URLs, "boolean" for true/false values.
- Use the user's desired labels for column headers. If the user doesn't specify labels, generate clean human-readable labels from the key names.
- Preserve the order the user specifies.
- If the user says something vague like "show all columns", include the most meaningful top-level and nested keys (skip internal IDs, slugs, and redundant fields).
- FUNCTION SUPPORT: Every column MUST have a "function" property. This is a JavaScript arrow function string that receives the entire row object and returns the display value.
  - The function signature is always: (row) => { ... }
  - For simple field access: (row) => row.field_name
  - For nested fields: (row) => row.academy?.name || ""
  - For combining fields: (row) => (row.kickoff_date || "") + " - " + (row.ending_date || "")
  - For formatting: (row) => row.duration_in_days + " days (" + row.duration_in_hours + "h)"
  - For computed values: (row) => row.price ? "$" + Number(row.price).toFixed(2) : "-"
  - For dates: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"
  - For conditionals: (row) => row.status === "active" ? "Active" : "Inactive"
  - Always handle null/undefined gracefully with optional chaining (?.) or fallback values (|| "").
  - The function must be a valid JavaScript arrow function as a plain string. Do NOT wrap it in quotes inside the JSON string value.
- The "key" field should reference the primary data field the column is based on (used for sorting).
- Return ONLY valid JSON with this exact structure:
{
  "columns": [
    { "key": "field.path", "label": "Display Label", "type": "text|number|date|image|link|boolean", "function": "(row) => row.field || \\"\\""  }
  ],
  "title": "Optional Table Title"
}
Do not include any text outside the JSON object.`;

function encodeColumnsToBase64(config: TableConfig): TableConfig {
  return {
    ...config,
    columns: config.columns.map(col => ({
      ...col,
      function: col.function ? Buffer.from(col.function).toString("base64") : undefined,
    })),
  };
}

function decodeColumnsFromBase64(config: TableConfig): TableConfig {
  return {
    ...config,
    columns: config.columns.map(col => ({
      ...col,
      function: col.function ? Buffer.from(col.function, "base64").toString("utf-8") : undefined,
    })),
  };
}

function parseTableConfigResponse(content: string): TableConfig {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned) as TableConfig;

  if (!parsed.columns || !Array.isArray(parsed.columns) || parsed.columns.length === 0) {
    throw new Error("AI returned invalid table config: missing columns array");
  }

  for (const col of parsed.columns) {
    if (!col.key || !col.label || !col.type) {
      throw new Error(`Invalid column config: ${JSON.stringify(col)}`);
    }
  }

  return parsed;
}

export interface AnalyzeDataInput {
  sampleData: Record<string, unknown>[];
  availableKeys: string[];
  locale?: string;
}

export interface DataAnalysis {
  description: string;
  suggestedPrompts: string[];
}

const ANALYZE_SYSTEM_PROMPT = `You are a data analyst assistant. Given a sample of data items and their available keys, provide:
1. A short, friendly description of what this data appears to be about (1-2 sentences max).
2. 3-4 suggested prompts the user could use to create a useful table from this data.

Rules:
- The description should be conversational and helpful, e.g. "This data contains a list of coding bootcamp cohorts with details like schedule, location, and language."
- Suggested prompts should be practical and varied - some simple, some more advanced.
- Each prompt should be a natural language instruction like "Show me a table with the name, start date, and location" or "Create a summary with course name and duration in days".
- Return ONLY valid JSON with this exact structure:
{
  "description": "Your friendly description here",
  "suggestedPrompts": ["prompt 1", "prompt 2", "prompt 3", "prompt 4"]
}
Do not include any text outside the JSON object.`;

export async function analyzeDataPayload(input: AnalyzeDataInput): Promise<DataAnalysis> {
  const llm = getLLMService();

  const samplePreview = JSON.stringify(input.sampleData.slice(0, 3), null, 2);
  const userPrompt = `Available data keys: ${JSON.stringify(input.availableKeys)}

Sample data (first 3 items):
${samplePreview}

Analyze this data and provide a friendly description and suggested prompts. Always respond in English.`;

  const result = await llm.adaptContent(
    ANALYZE_SYSTEM_PROMPT,
    userPrompt,
    {
      temperature: 0.4,
      maxTokens: 600,
    }
  );

  let cleaned = result.content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned) as DataAnalysis;
  if (!parsed.description || !parsed.suggestedPrompts || !Array.isArray(parsed.suggestedPrompts)) {
    throw new Error("AI returned invalid analysis format");
  }

  return parsed;
}

export async function generateTableFromPayload(input: GenerateTableInput): Promise<TableConfig> {
  const llm = getLLMService();

  const samplePreview = JSON.stringify(input.sampleData.slice(0, 3), null, 2);
  const langNote = input.locale === "es"
    ? "\nIMPORTANT: The page is in Spanish. Use Spanish for all column labels and the title."
    : "\nIMPORTANT: The page is in English. Use English for all column labels and the title.";

  const userPrompt = `Available data keys: ${JSON.stringify(input.availableKeys)}

Sample data (first 3 items):
${samplePreview}

User's request: "${input.userPrompt}"
${langNote}

Generate the table column configuration as JSON based on the user's request. Every column MUST include a "function" property with a JavaScript arrow function string. Pay close attention to any formatting instructions the user provides.`;

  const result = await llm.adaptContent(
    SYSTEM_PROMPT,
    userPrompt,
    {
      temperature: 0.3,
      maxTokens: 1500,
    }
  );

  const config = parseTableConfigResponse(result.content);
  return encodeColumnsToBase64(config);
}

const REFINE_SYSTEM_PROMPT = `You are a data table configuration assistant. The user has an existing table configuration and wants to make changes to it. Apply their requested changes and return the updated configuration.

Rules:
- Start from the current configuration provided and modify it according to the user's feedback.
- Available keys use dot notation for nested fields (e.g. "academy.name", "syllabus_version.duration_in_days").
- Every column MUST have a "function" property. This is a JavaScript arrow function string that receives the entire row object and returns the display value.
  - For simple field access: (row) => row.field_name
  - For nested fields: (row) => row.academy?.name || ""
  - For combining fields: (row) => (row.kickoff_date || "") + " - " + (row.ending_date || "")
  - For computed values: (row) => row.price ? "$" + Number(row.price).toFixed(2) : "-"
  - Always handle null/undefined gracefully.
- The "key" field references the primary data field (used for sorting).
- Return ONLY valid JSON with this exact structure:
{
  "columns": [
    { "key": "field.path", "label": "Display Label", "type": "text|number|date|image|link|boolean", "function": "(row) => row.field || \\"\\""  }
  ],
  "title": "Optional Table Title"
}
Do not include any text outside the JSON object.`;

export async function refineTableConfig(input: RefineTableInput): Promise<TableConfig> {
  const llm = getLLMService();

  const decodedConfig = decodeColumnsFromBase64(input.currentConfig);

  const samplePreview = JSON.stringify(input.sampleData.slice(0, 3), null, 2);
  const langNote = input.locale === "es"
    ? "\nIMPORTANT: The page is in Spanish. Use Spanish for all column labels and the title."
    : "\nIMPORTANT: The page is in English. Use English for all column labels and the title.";

  const userPrompt = `Current table configuration:
${JSON.stringify(decodedConfig, null, 2)}

Available data keys: ${JSON.stringify(input.availableKeys)}

Sample data (first 3 items):
${samplePreview}

User's requested changes: "${input.userFeedback}"
${langNote}

Apply the user's requested changes to the current configuration and return the updated JSON. Every column MUST include a "function" property with a JavaScript arrow function string.`;

  const result = await llm.adaptContent(
    REFINE_SYSTEM_PROMPT,
    userPrompt,
    {
      temperature: 0.3,
      maxTokens: 1500,
    }
  );

  const config = parseTableConfigResponse(result.content);
  return encodeColumnsToBase64(config);
}
