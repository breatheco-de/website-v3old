export type EditorType = "font-size-picker" | "image-with-style-picker";

export const fieldEditors: Record<string, EditorType> = {
  "value_size": "font-size-picker",
  "collage_images[].image_id": "image-with-style-picker",
  "featured_images[].image_id": "image-with-style-picker",
};
