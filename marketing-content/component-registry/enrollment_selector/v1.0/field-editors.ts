export type EditorType = string;

export const fieldEditors: Record<string, EditorType> = {
  "default:title": "rich-text-editor:custom-font-size,custom-letter-spacing,custom-line-height,custom-font-weight",
  "default:programs[].selection_card.icon": "icon-picker",
  "default:programs[].benefits[].icon": "icon-picker",
  "default:programs[].summary.cta": "cta-picker",
  "default:programs[].summary.rows[].value": "rich-text-editor",
  "default:programs[].plans[].summary.cta": "cta-picker",
  "default:programs[].plans[].summary.rows[].value": "rich-text-editor",
};
