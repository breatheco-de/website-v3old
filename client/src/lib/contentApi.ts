import { getDebugToken, resolveAuthorName } from "@/hooks/useDebugAuth";
import type { EditOperation } from "@shared/schema";

export interface ContentEditRequest {
  contentType: string;
  slug: string;
  locale: string;
  operations: EditOperation[];
  variant?: string;
  version?: number;
}

export interface ContentEditResponse {
  success: boolean;
  updatedSections?: unknown[];
  warning?: string;
  error?: string;
}

export async function editContent(request: ContentEditRequest): Promise<ContentEditResponse> {
  const token = getDebugToken();
  const author = await resolveAuthorName();

  const response = await fetch("/api/content/edit-sections", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: JSON.stringify({
      ...request,
      author,
    }),
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    return {
      success: false,
      error: errorData.error || `Request failed with status ${response.status}`,
    };
  }
}
