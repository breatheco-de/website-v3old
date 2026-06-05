export type EditorType = "icon-picker" | "color-picker" | "image-picker" | "link-picker" | "rich-text-editor" | string;

export const fieldEditors: Record<string, EditorType> = {
  // default variant
  "cta.url": "link-picker",

  // marqueeBadges variant
  "marqueeBadges:title": "rich-text-editor",
  "marqueeBadges:cta_buttons[]": "cta-picker",
};
