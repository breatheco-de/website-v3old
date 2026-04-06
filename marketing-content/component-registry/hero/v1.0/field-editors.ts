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
  | "boolean-toggle"
  | "string-picker";

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
  "showcase:cta_button.text": "text-input",
  "showcase:cta_button.url": "link-picker",
  "showcase:cta_button.variant": "string-picker:primary,secondary,outline" as EditorType,
  "showcase:cta_button.icon": "icon-picker",
  "simpleTwoColumn:image": "image-with-style-picker",
  "simpleTwoColumn:subtitle": "rich-text-editor",
  "singleColumn:title": "rich-text-editor",
  "singleColumn:subtitle": "rich-text-editor",
  "singleColumn:image.src": "image-picker",
  "singleColumn:cta_buttons[]": "cta-picker",
  "course:layout_reversed": "boolean-toggle",
  "course:signup_card.login_link.text": "rich-text-editor",
  "course:video.url": "video-picker",
  "productShowcase:video.url": "video-picker",
  "simpleTwoColumn:video.url": "video-picker",
  "ApplyFormProductShowcase:video.url": "video-picker",
  "ApplyFormProductShowcase:image": "image-with-style-picker",
  "productShowcase:form_vertical_align": "string-picker:top,center,bottom" as EditorType,
  "ApplyFormProductShowcase:form_vertical_align": "string-picker:top,center,bottom" as EditorType,
  "productShowcase:description": "rich-text-editor",
  "productShowcase:footer": "rich-text-editor",
  "ApplyFormProductShowcase:description": "rich-text-editor",
  "ApplyFormProductShowcase:footer": "rich-text-editor",
  "productShowcase:show_awards_marquee": "boolean-toggle",
  "ApplyFormProductShowcase:show_awards_marquee": "boolean-toggle",
  "productShowcase:awards_marquee.items[].logo": "image-picker:logo",
  "ApplyFormProductShowcase:awards_marquee.items[].logo": "image-picker:logo",
  "productShowcase:form_card_background": "color-picker",
  "ApplyFormProductShowcase:form_card_background": "color-picker",
  "productShowcase:form_card_image": "image-with-style-picker",
  "ApplyFormProductShowcase:form_card_image": "image-with-style-picker",
  "productShowcase:form_card_subtitle": "rich-text-editor",
  "productShowcase:form_card_text_color": "color-picker:text",
  "productShowcase:form_terms_color": "color-picker",
  "productShowcase:awards_marquee_at_left_column": "boolean-toggle",
  "ApplyFormProductShowcase:form_terms_color": "color-picker",
  "ApplyFormProductShowcase:cta_button.text": "text-input",
  "ApplyFormProductShowcase:cta_button.url": "link-picker",
  "ApplyFormProductShowcase:cta_button.variant": "string-picker:primary,secondary,outline" as EditorType,
  "ApplyFormProductShowcase:cta_button.icon": "icon-picker",

  // credibility variant
  "credibility:title": "rich-text-editor",
  "credibility:description": "rich-text-editor",
  "credibility:cta_buttons[]": "cta-picker",
  "credibility:show_marquee": "boolean-toggle",
  "credibility:pills[].logos[].image_id": "image-picker:logo",
  "credibility:pills[].background_color": "color-picker",
};
