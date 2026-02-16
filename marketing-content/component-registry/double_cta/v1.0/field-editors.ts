export type EditorType = "icon-picker" | "color-picker:courses" | "color-picker:accent" | "image-picker" | "link-picker" | "image-with-style-picker";

export const fieldEditors: Record<string, EditorType> = {
  "left.image_id": "image-with-style-picker",
  "right.image_id": "image-with-style-picker",
};
