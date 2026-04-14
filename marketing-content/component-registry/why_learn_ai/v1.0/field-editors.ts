export type EditorType = "icon-picker" | "color-picker" | "image-picker" | "link-picker" | "rich-text-editor" | "boolean-toggle";

export const fieldEditors: Record<string, EditorType> = {
  "description": "rich-text-editor",
  "cta.url": "link-picker",
  "mobile_see_more": "boolean-toggle:default-true",
};
