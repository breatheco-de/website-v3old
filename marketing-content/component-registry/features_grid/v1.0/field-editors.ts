/**
 * Field Editor Configuration for FeaturesGrid Component
 * 
 * Defines which fields in this component should use special editors
 * in the Props tab of the section editor panel.
 * 
 * EditorType options: "icon-picker" | "color-picker" | "image-picker" | "image-with-style-picker" | "link-picker"
 */

export type EditorType = "icon-picker" | "color-picker" | "image-picker" | "image-with-style-picker" | "link-picker" | "rich-text-editor";

export const fieldEditors: Record<string, EditorType> = {
  "items[].icon": "icon-picker",
  "stats-text:description": "rich-text-editor",
  "stats-cards:description": "rich-text-editor",
  "highlight:subtitle": "rich-text-editor",
  "cta.url": "link-picker",
  "stats-charts:card_bars_accent": "color-picker",
  "stats-charts:card_gauge_accent": "color-picker",
  "stats-charts:card_trend_accent": "color-picker",
};
