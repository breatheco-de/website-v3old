import CodeMirror from "@uiw/react-codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";

interface JsonViewerProps {
  value: string;
  className?: string;
}

export default function JsonViewer({ value, className }: JsonViewerProps) {
  return (
    <CodeMirror
      value={value}
      extensions={[jsonLang()]}
      theme={oneDark}
      readOnly={true}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: false,
      }}
      className={className}
    />
  );
}
