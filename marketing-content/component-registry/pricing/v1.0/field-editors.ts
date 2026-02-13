/**
 * Field Editor Configuration for Pricing Component
 *
 * Defines which fields in this component should use special editors
 * in the Props tab of the section editor panel.
 *
 * EditorType options: "icon-picker" | "color-picker" | "image-picker" | "link-picker"
 */

export type EditorType =
  | "icon-picker"
  | "color-picker"
  | "image-picker"
  | "link-picker"
  | "rich-text-editor"

export const fieldEditors: Record<string, EditorType> = {
  "features[].icon": "icon-picker",
  "features[].text": "rich-text-editor"
};
