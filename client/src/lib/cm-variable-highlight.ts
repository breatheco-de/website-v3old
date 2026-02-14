import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSet, type Range } from "@codemirror/state";

const variablePattern = /\{\{[\s]*([^}|]+?)(?:\s*\|\s*([^}]*?))?\s*\}\}/g;

const variableMark = Decoration.mark({ class: "cm-variable-template" });
const variableNameMark = Decoration.mark({ class: "cm-variable-name" });
const variableDelimMark = Decoration.mark({ class: "cm-variable-delim" });
const variablePipeMark = Decoration.mark({ class: "cm-variable-pipe" });
const variableDefaultMark = Decoration.mark({ class: "cm-variable-default" });

function buildDecorations(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const ranges: Range<Decoration>[] = [];

  let match: RegExpExecArray | null;
  variablePattern.lastIndex = 0;
  while ((match = variablePattern.exec(text)) !== null) {
    const outerFrom = match.index;
    const outerTo = match.index + match[0].length;

    const innerStr = match[0].slice(2, -2);
    const innerStart = outerFrom + 2;

    const pipeIdx = innerStr.indexOf("|");

    let nameStart = innerStart;
    let nameEnd: number;

    ranges.push(variableMark.range(outerFrom, outerTo));
    ranges.push(variableDelimMark.range(outerFrom, outerFrom + 2));
    ranges.push(variableDelimMark.range(outerTo - 2, outerTo));

    if (pipeIdx !== -1) {
      const namePart = innerStr.slice(0, pipeIdx);
      nameStart = innerStart + (namePart.length - namePart.trimStart().length);
      nameEnd = innerStart + namePart.trimEnd().length;

      const pipeFrom = innerStart + pipeIdx;
      ranges.push(variablePipeMark.range(pipeFrom, pipeFrom + 1));

      const defaultPart = innerStr.slice(pipeIdx + 1);
      const defaultTrimmedStart = defaultPart.length - defaultPart.trimStart().length;
      const defaultFrom = pipeFrom + 1 + defaultTrimmedStart;
      const defaultTo = innerStart + innerStr.trimEnd().length;
      if (defaultTo > defaultFrom) {
        ranges.push(variableDefaultMark.range(defaultFrom, defaultTo));
      }
    } else {
      const trimmed = innerStr.trim();
      nameStart = innerStart + (innerStr.length - innerStr.trimStart().length);
      nameEnd = nameStart + trimmed.length;
    }

    if (nameStart < nameEnd) {
      ranges.push(variableNameMark.range(nameStart, nameEnd));
    }
  }

  return RangeSet.of(ranges, true);
}

export const variableHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
