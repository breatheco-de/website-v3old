/**
 * Field Editor Configuration for CardsDeck Component
 * 
 * Defines which fields in this component should use special editors
 * in the Props tab of the section editor panel.
 * 
 * EditorType options: "icon-picker" | "color-picker" | "image-picker" | "image-with-style-picker" | "link-picker" | "video-picker"
 */

export type EditorType = "icon-picker" | "color-picker" | "image-picker" | "image-with-style-picker" | "link-picker" | "video-picker";

export const fieldEditors: Record<string, EditorType> = {
  "cards[].video.url": "video-picker",
  "cards[].image": "image-picker",
  "cards[].brandImage": "image-picker"
};
