import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { IconArrowLeft, IconPlus, IconTrash, IconPlayerPlay, IconLoader2, IconCheck, IconEye } from "@tabler/icons-react";
import { Link } from "wouter";
import { getDebugToken } from "@/hooks/useDebugAuth";

interface KnowledgeData {
  system_prompt: string | null;
  custom_knowledge: Array<{ content: string; tag?: string }>;
  pinned_qa: Array<{ question: string; answer: string; tag?: string }>;
  agent_tools: Array<{ name: string; description: string; enabled: boolean }>;
  chat_bubble: { enabled?: boolean; page_patterns?: string[]; content_types?: string[] };
  question_tags: string[];
}

export default function AIKnowledge() {
  const { toast } = useToast();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [customKnowledge, setCustomKnowledge] = useState<Array<{ content: string; tag: string }>>([]);
  const [pinnedQA, setPinnedQA] = useState<Array<{ question: string; answer: string; tag: string }>>([]);
  const [agentTools, setAgentTools] = useState<Array<{ name: string; description: string; enabled: boolean }>>([]);
  const [pagePatterns, setPagePatterns] = useState<string[]>([]);
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [bubbleEnabled, setBubbleEnabled] = useState(true);
  const [previewQuestion, setPreviewQuestion] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewResult, setPreviewResult] = useState<{ context: Record<string, unknown>; response: string; question_tag: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  const { data, isLoading } = useQuery<KnowledgeData>({
    queryKey: ["/api/admin/ai/knowledge"],
    queryFn: async () => {
      const token = getDebugToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Token ${token}`;
      const res = await fetch("/api/admin/ai/knowledge", { headers });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setSystemPrompt(data.system_prompt || "");
      setCustomKnowledge((data.custom_knowledge || []).map(k => ({ content: k.content, tag: k.tag || "" })));
      setPinnedQA((data.pinned_qa || []).map(q => ({ question: q.question, answer: q.answer, tag: q.tag || "" })));
      setAgentTools(data.agent_tools || []);
      setPagePatterns(data.chat_bubble?.page_patterns || []);
      setContentTypes(data.chat_bubble?.content_types || []);
      setBubbleEnabled(data.chat_bubble?.enabled !== false);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;

      const res = await fetch("/api/admin/ai/knowledge", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          system_prompt: systemPrompt,
          custom_knowledge: customKnowledge,
          pinned_qa: pinnedQA,
          agent_tools: agentTools,
          chat_bubble: { enabled: bubbleEnabled, page_patterns: pagePatterns, content_types: contentTypes },
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/knowledge"] });
      toast({ title: "Knowledge saved", description: "Your changes have been saved successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save knowledge.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!previewQuestion.trim()) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;

      const res = await fetch("/api/admin/ai/knowledge/preview", {
        method: "POST",
        headers,
        body: JSON.stringify({ question: previewQuestion, url: previewUrl }),
      });
      const result = await res.json();
      setPreviewResult(result);
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button size="icon" variant="ghost" data-testid="button-back-knowledge">
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-knowledge-title">Knowledge Editor</h1>
            <p className="text-sm text-muted-foreground">Configure the AI chat agent's knowledge and behavior</p>
          </div>
          <Button variant="outline" onClick={() => setVisibilityOpen(true)} data-testid="button-open-visibility">
            <IconEye className="h-4 w-4 mr-2" />
            Visibility
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-knowledge">
            {saving ? <IconLoader2 className="h-4 w-4 animate-spin mr-2" /> : <IconCheck className="h-4 w-4 mr-2" />}
            Save All
          </Button>
        </div>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg" data-testid="text-system-prompt-heading">System Prompt</h2>
          <p className="text-sm text-muted-foreground">The foundational instructions that shape the agent's personality, tone, and behavior. This text is injected at the start of every conversation before any user message.</p>
          <Textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            className="min-h-[150px] text-sm"
            placeholder="Enter the system prompt for the chat agent..."
            data-testid="textarea-system-prompt"
          />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-semibold text-lg" data-testid="text-knowledge-blocks-heading">Custom Knowledge Blocks</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCustomKnowledge(prev => [...prev, { content: "", tag: "" }])}
              data-testid="button-add-knowledge-block"
            >
              <IconPlus className="h-4 w-4 mr-1" />
              Add Block
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Freeform text the agent can reference when answering questions. Add an optional tag to each block so the AI can apply it selectively based on the topic or page context.</p>
          {customKnowledge.map((block, i) => (
            <div key={i} className="space-y-2 border-b pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={block.tag}
                  onChange={e => {
                    const updated = [...customKnowledge];
                    updated[i] = { ...updated[i], tag: e.target.value };
                    setCustomKnowledge(updated);
                  }}
                  placeholder="Tag (optional)"
                  className="px-2 py-1 text-sm border rounded-md bg-background"
                  data-testid={`input-knowledge-tag-${i}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCustomKnowledge(prev => prev.filter((_, j) => j !== i))}
                  data-testid={`button-delete-knowledge-${i}`}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={block.content}
                onChange={e => {
                  const updated = [...customKnowledge];
                  updated[i] = { ...updated[i], content: e.target.value };
                  setCustomKnowledge(updated);
                }}
                className="text-sm min-h-[80px]"
                placeholder="Knowledge content..."
                data-testid={`textarea-knowledge-content-${i}`}
              />
            </div>
          ))}
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-semibold text-lg" data-testid="text-pinned-qa-heading">Pinned Q&A Pairs</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPinnedQA(prev => [...prev, { question: "", answer: "", tag: "" }])}
              data-testid="button-add-qa"
            >
              <IconPlus className="h-4 w-4 mr-1" />
              Add Pair
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Exact question-and-answer pairs that take priority over the agent's general reasoning. Use these for FAQs or any information that must always be answered precisely and consistently.</p>
          {pinnedQA.map((qa, i) => (
            <div key={i} className="space-y-2 border-b pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={qa.tag}
                  onChange={e => {
                    const updated = [...pinnedQA];
                    updated[i] = { ...updated[i], tag: e.target.value };
                    setPinnedQA(updated);
                  }}
                  placeholder="Question tag"
                  className="px-2 py-1 text-sm border rounded-md bg-background"
                  data-testid={`input-qa-tag-${i}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPinnedQA(prev => prev.filter((_, j) => j !== i))}
                  data-testid={`button-delete-qa-${i}`}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
              <input
                type="text"
                value={qa.question}
                onChange={e => {
                  const updated = [...pinnedQA];
                  updated[i] = { ...updated[i], question: e.target.value };
                  setPinnedQA(updated);
                }}
                placeholder="Question"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                data-testid={`input-qa-question-${i}`}
              />
              <Textarea
                value={qa.answer}
                onChange={e => {
                  const updated = [...pinnedQA];
                  updated[i] = { ...updated[i], answer: e.target.value };
                  setPinnedQA(updated);
                }}
                className="text-sm min-h-[60px]"
                placeholder="Answer"
                data-testid={`textarea-qa-answer-${i}`}
              />
            </div>
          ))}
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg" data-testid="text-tools-heading">Agent Tools</h2>
          <p className="text-sm text-muted-foreground">External capabilities the agent can invoke while responding, such as live program lookups or location queries. Enable only the tools relevant to the conversations you want to support.</p>
          {agentTools.map((tool, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b last:border-b-0">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={tool.enabled}
                  onChange={e => {
                    const updated = [...agentTools];
                    updated[i] = { ...updated[i], enabled: e.target.checked };
                    setAgentTools(updated);
                  }}
                  className="rounded"
                  data-testid={`checkbox-tool-${tool.name}`}
                />
                <div>
                  <span className="text-sm font-medium">{tool.name}</span>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
              </label>
            </div>
          ))}
        </Card>

        <Dialog open={visibilityOpen} onOpenChange={setVisibilityOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-visibility">
            <DialogHeader>
              <DialogTitle data-testid="text-visibility-dialog-title">Page Targeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bubbleEnabled}
                  onChange={e => setBubbleEnabled(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-bubble-enabled"
                />
                <span className="text-sm">Enable chat bubble</span>
              </label>
              <div className="space-y-2">
                {pagePatterns.map((pattern, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pattern}
                      onChange={e => {
                        const updated = [...pagePatterns];
                        updated[i] = e.target.value;
                        setPagePatterns(updated);
                      }}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background font-mono"
                      data-testid={`input-pattern-${i}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPagePatterns(prev => prev.filter((_, j) => j !== i))}
                      data-testid={`button-delete-pattern-${i}`}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPagePatterns(prev => [...prev, ""])}
                  data-testid="button-add-pattern"
                >
                  <IconPlus className="h-4 w-4 mr-1" />
                  Add Pattern
                </Button>
              </div>
              <div className="pt-3 border-t space-y-2">
                <h3 className="text-sm font-medium" data-testid="text-content-types-heading">Content Type Targeting</h3>
                <p className="text-xs text-muted-foreground">Show the chat bubble on pages matching these content types (e.g. program, location)</p>
                {contentTypes.map((ct, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ct}
                      onChange={e => {
                        const updated = [...contentTypes];
                        updated[i] = e.target.value;
                        setContentTypes(updated);
                      }}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                      data-testid={`input-content-type-${i}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setContentTypes(prev => prev.filter((_, j) => j !== i))}
                      data-testid={`button-delete-content-type-${i}`}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setContentTypes(prev => [...prev, ""])}
                  data-testid="button-add-content-type"
                >
                  <IconPlus className="h-4 w-4 mr-1" />
                  Add Content Type
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg" data-testid="text-preview-heading">Live Preview</h2>
          <p className="text-sm text-muted-foreground">Test how the agent responds to a specific question, simulating a given page URL. Useful for verifying your knowledge blocks and Q&A pairs before saving.</p>
          <div className="space-y-2">
            <input
              type="text"
              value={previewUrl}
              onChange={e => setPreviewUrl(e.target.value)}
              placeholder="Test URL (e.g., /en/career-programs/full-stack)"
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              data-testid="input-preview-url"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={previewQuestion}
                onChange={e => setPreviewQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePreview()}
                placeholder="Test question..."
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                data-testid="input-preview-question"
              />
              <Button onClick={handlePreview} disabled={previewLoading || !previewQuestion.trim()} data-testid="button-run-preview">
                {previewLoading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPlayerPlay className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {previewResult && (
            <div className="space-y-3 mt-3">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Tag: {previewResult.question_tag}</p>
                <p className="text-sm whitespace-pre-wrap" data-testid="text-preview-response">{previewResult.response}</p>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground font-medium" data-testid="button-preview-context-toggle">Show full context</summary>
                <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto text-xs max-h-[300px]" data-testid="text-preview-context">
                  {JSON.stringify(previewResult.context, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
