/**
 * Field Editor Configuration for Hero Component
 *
 * Defines which fields in this component should use special editors
 * in the Props tab of the section editor panel.
 *
 * EditorType options: "icon-picker" | "color-picker" | "image-picker" | "link-picker"
 *
 * Variant-specific fields use the format: "variantName:fieldPath"
 * Example: "productShowcase:left_images[].src" only applies to productShowcase variant
 */

export type EditorType =
  | "icon-picker"
  | "color-picker"
  | "image-picker"
  | "image-picker:logo"
  | "image-with-style-picker"
  | "link-picker"
  | "cta-picker"
  | "video-picker"
  | "text-input"
  | "rich-text-editor"
  | "boolean-toggle";

export const fieldEditors: Record<string, EditorType> = {
  // Global - applies to all variants that have this field
  "signup_card.features[].icon": "icon-picker",
  "simpleTwoColumn:cta_buttons[]": "cta-picker",

  // Variant-specific - prefixed with variant name
  "productShowcase:image": "image-with-style-picker",
  "productShowcase:left_images[].src": "image-picker",
  "productShowcase:right_images[].src": "image-picker",
  "productShowcase:marquee.items[].logo": "image-picker:logo",
  "productShowcase:marquee.items[].logoHeight": "text-input",
  "showcase:left_images[].src": "image-picker",
  "showcase:right_images[].src": "image-picker",
  "simpleTwoColumn:image": "image-with-style-picker",
  "simpleTwoColumn:subtitle": "rich-text-editor",
  "singleColumn:subtitle": "rich-text-editor",
  "singleColumn:image.src": "image-picker",
  "course:layout_reversed": "boolean-toggle",
  "course:signup_card.login_link.text": "rich-text-editor",
  "course:video.url": "video-picker",
  "productShowcase:video.url": "video-picker",
  "simpleTwoColumn:video.url": "video-picker",
  "ApplyFormProductShowcase:video.url": "video-picker",
  "ApplyFormProductShowcase:image": "image-with-style-picker",
};
