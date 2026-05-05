import CodeMirror from "@uiw/react-codemirror";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";

interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  highlightActiveLine?: boolean;
  className?: string;
}

export default function YamlEditor({
  value,
  onChange,
  readOnly = false,
  highlightActiveLine = true,
  className,
}: YamlEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[yamlLang()]}
      theme={oneDark}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine,
      }}
      className={className}
    />
  );
}
