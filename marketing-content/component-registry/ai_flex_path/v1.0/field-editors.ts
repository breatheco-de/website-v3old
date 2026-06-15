export type EditorType = string;

export const fieldEditors: Record<string, EditorType> = {
  "default:icon": "icon-picker",
  "default:tools_marquee": "boolean-toggle",
  "default:cta.banner": "boolean-toggle",
  "default:cta.buttons[]": "cta-picker",
};
