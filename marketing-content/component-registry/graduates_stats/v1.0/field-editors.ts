export type EditorType =
  | "icon-picker"
  | "color-picker"
  | "image-picker"
  | "link-picker"
  | "rich-text-editor"
  | "boolean-toggle"

export const fieldEditors: Record<string, EditorType> = {
  "stats[].value": "rich-text-editor",
};
