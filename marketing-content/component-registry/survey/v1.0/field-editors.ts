export type EditorType = string;

export const fieldEditors: Record<string, EditorType> = {
  "default:icon": "icon-picker",
  "default:title": "rich-text-editor:custom-font-size,custom-letter-spacing,custom-line-height,custom-font-weight",
  "default:title_highlight": "rich-text-editor:custom-font-size,custom-letter-spacing,custom-line-height,custom-font-weight",
  "default:aggregation_method": "string-picker:concat,sum",
  "default:questions[].options[].action.url": "link-picker:allow-inline-render",
  "default:routes": "rich-text-editor",
};
