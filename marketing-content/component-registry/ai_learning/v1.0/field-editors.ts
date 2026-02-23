export type EditorType = "icon-picker" | "color-picker" | "image-picker" | "link-picker" | "rich-text-editor";

export const fieldEditors: Record<string, EditorType> = {
  "cta.url": "link-picker",
  "features[].cta.url": "link-picker",
};
