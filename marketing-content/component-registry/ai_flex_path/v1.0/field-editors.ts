export type EditorType = string;

export const fieldEditors: Record<string, EditorType> = {
  "default:icon": "icon-picker",
  "default:tools_marquee": "boolean-toggle",
  "default:cta.banner": "boolean-toggle",
  "default:cta.buttons[]": "cta-picker",

  "drag_and_drop:icon": "icon-picker",
  "drag_and_drop:tools_marquee": "boolean-toggle",
  "drag_and_drop:cta.banner": "boolean-toggle",
  "drag_and_drop:cta.buttons[]": "cta-picker",
  "drag_and_drop:courses[].color": "color-picker:courses",
};
