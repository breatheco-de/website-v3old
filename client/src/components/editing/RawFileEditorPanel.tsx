import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { IconX, IconDeviceFloppy, IconLoader2, IconAlertTriangle, IconFile } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";

interface RawFileEditorPanelProps {
  contentType: string;
  slug: string;
  locale: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface FileInfo {
  path: string;
  content: string;
}

export default function RawFileEditorPanel({ contentType, slug, locale, onClose, onSaved }: RawFileEditorPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFile, setActiveFile] = useState<"locale" | "common">("locale");
  const [localeFile, setLocaleFile] = useState<FileInfo | null>(null);
  const [commonFile, setCommonFile] = useState<FileInfo | null>(null);
  const [localeContent, setLocaleContent] = useState("");
  const [commonContent, setCommonContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/content/raw-file?contentType=${contentType}&slug=${slug}&locale=${locale}`);
        if (!res.ok) {
          setError("Could not load YAML files");
          return;
        }
        const data = await res.json();
        if (!data.exists) {
          setError("No YAML files found for this content");
          return;
        }
        if (data.files.locale) {
          setLocaleFile(data.files.locale);
          setLocaleContent(data.files.locale.content);
        }
        if (data.files.common) {
          setCommonFile(data.files.common);
          setCommonContent(data.files.common.content);
        }
        if (data.files.locale) {
          setActiveFile("locale");
        } else if (data.files.common) {
          setActiveFile("common");
        }
      } catch {
        setError("Failed to load files");
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [contentType, slug, locale]);

  const handleChange = useCallback((value: string) => {
    if (activeFile === "locale") {
      setLocaleContent(value);
    } else {
      setCommonContent(value);
    }
    setHasChanges(true);
  }, [activeFile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const filesToSave: { filePath: string; content: string }[] = [];

      if (localeFile && localeContent !== localeFile.content) {
        filesToSave.push({ filePath: localeFile.path, content: localeContent });
      }
      if (commonFile && commonContent !== commonFile.content) {
        filesToSave.push({ filePath: commonFile.path, content: commonContent });
      }

      if (filesToSave.length === 0) {
        toast({ title: "No changes to save" });
        setSaving(false);
        return;
      }

      for (const file of filesToSave) {
        await apiRequest("PUT", "/api/content/raw-file", file);
      }

      if (localeFile) setLocaleFile({ ...localeFile, content: localeContent });
      if (commonFile) setCommonFile({ ...commonFile, content: commonContent });
      setHasChanges(false);

      toast({ title: "YAML saved successfully" });
      onSaved?.();
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [localeFile, commonFile, localeContent, commonContent, toast, onSaved]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirm = window.confirm("You have unsaved changes. Close without saving?");
      if (!confirm) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  const currentContent = activeFile === "locale" ? localeContent : commonContent;
  const currentFile = activeFile === "locale" ? localeFile : commonFile;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-background border-l shadow-xl z-[9999] flex flex-col" data-testid="raw-file-editor-panel">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold" data-testid="text-editor-title">Edit Raw YAML</h2>
          {currentFile && (
            <p className="text-xs text-muted-foreground truncate mt-0.5" data-testid="text-file-path">
              {currentFile.path}
            </p>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={handleClose} data-testid="button-close-raw-editor">
          <IconX className="h-4 w-4" />
        </Button>
      </div>

      {(localeFile && commonFile) && (
        <div className="flex border-b">
          <button
            type="button"
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeFile === "locale" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveFile("locale")}
            data-testid="tab-locale-file"
          >
            <IconFile className="h-3.5 w-3.5 inline mr-1.5" />
            {locale}.yml
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeFile === "common" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveFile("common")}
            data-testid="tab-common-file"
          >
            <IconFile className="h-3.5 w-3.5 inline mr-1.5" />
            _common.yml
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full" data-testid="loading-editor">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6" data-testid="error-editor">
            <IconAlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </div>
        ) : currentFile ? (
          <CodeMirror
            value={currentContent}
            height="100%"
            extensions={[yaml()]}
            theme={oneDark}
            onChange={handleChange}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
            }}
            className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6" data-testid="no-file">
            <p className="text-sm text-muted-foreground">No file available for this tab</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-3 border-t gap-2">
        {hasChanges && (
          <span className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-unsaved">
            Unsaved changes
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-raw-editor">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving} data-testid="button-save-raw-editor">
            {saving ? (
              <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}