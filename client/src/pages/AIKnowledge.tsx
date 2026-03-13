import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { IconArrowLeft, IconPlus, IconTrash, IconPlayerPlay, IconLoader2, IconCheck, IconEye, IconEyeOff, IconPhoto, IconSearch, IconUser, IconPencil, IconX, IconChevronDown, IconBrain } from "@tabler/icons-react";
import { Link } from "wouter";
import { getDebugToken } from "@/hooks/useDebugAuth";

interface KnowledgeData {
  system_prompt: string | null;
  prompt_role: string;
  prompt_personality: string;
  prompt_instructions: string;
  prompt_fallback: string;
  custom_knowledge: Array<{ content: string; tag?: string }>;
  pinned_qa: Array<{ question: string; answer: string; tag?: string }>;
  agent_tools: Array<{ name: string; description: string; enabled: boolean }>;
  chat_bubble: { enabled?: boolean; page_patterns?: string[]; content_types?: string[]; agent_name?: string; agent_icon?: string };
  question_tags: string[];
}

interface ImageEntry {
  src: string;
  alt?: string;
  tags?: string[];
}

interface ImageRegistryData {
  images: Record<string, ImageEntry>;
}

function compileSystemPrompt(name: string, role: string, personality: string, instructions: string, fallback: string): string {
  const parts: string[] = [];
  if (name) parts.push(`You are ${name}, a helpful AI assistant.`);
  if (role) parts.push(`\n## Role & Purpose\n${role}`);
  if (personality) parts.push(`\n## Personality & Tone\n${personality}`);
  if (instructions) parts.push(`\n## Key Instructions\n${instructions}`);
  if (fallback) parts.push(`\n## Fallback & Boundaries\n${fallback}`);
  return parts.join("\n").trim();
}

export default function AIKnowledge() {
  const { toast } = useToast();
  const [agentName, setAgentName] = useState("");
  const [agentIcon, setAgentIcon] = useState("");
  const [promptRole, setPromptRole] = useState("");
  const [promptPersonality, setPromptPersonality] = useState("");
  const [promptInstructions, setPromptInstructions] = useState("");
  const [promptFallback, setPromptFallback] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
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
  const [draftBubbleEnabled, setDraftBubbleEnabled] = useState(true);
  const [draftPagePatterns, setDraftPagePatterns] = useState<string[]>([]);
  const [draftContentTypes, setDraftContentTypes] = useState<string[]>([]);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [editingPatternIdx, setEditingPatternIdx] = useState<number | null>(null);
  const [editingPatternVal, setEditingPatternVal] = useState("");
  const [urlPatternsOpen, setUrlPatternsOpen] = useState(false);
  const [addCtSelectKey, setAddCtSelectKey] = useState(0);
  const [identityCoreOpen, setIdentityCoreOpen] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [draftAgentName, setDraftAgentName] = useState("");
  const [draftAgentIcon, setDraftAgentIcon] = useState("");
  const [draftPromptRole, setDraftPromptRole] = useState("");
  const [draftPromptPersonality, setDraftPromptPersonality] = useState("");
  const [draftPromptInstructions, setDraftPromptInstructions] = useState("");
  const [draftPromptFallback, setDraftPromptFallback] = useState("");
  const [identitySecOpen, setIdentitySecOpen] = useState(false);
  const [roleSecOpen, setRoleSecOpen] = useState(false);
  const [personalitySecOpen, setPersonalitySecOpen] = useState(false);
  const [instructionsSecOpen, setInstructionsSecOpen] = useState(false);
  const [fallbackSecOpen, setFallbackSecOpen] = useState(false);
  const [iconPickerForDraft, setIconPickerForDraft] = useState(false);

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

  const { data: imageRegistry } = useQuery<ImageRegistryData>({
    queryKey: ["/api/image-registry"],
    queryFn: async () => {
      const res = await fetch("/api/image-registry");
      if (!res.ok) return { images: [] };
      return res.json();
    },
  });

  const { data: contentTypesData } = useQuery<Array<{ name: string; label: string }>>({
    queryKey: ["/api/content-types"],
    queryFn: async () => {
      const res = await fetch("/api/content-types");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredIcons = Object.entries(imageRegistry?.images || {})
    .map(([handle, img]) => ({ handle, src: img.src, alt: img.alt, tags: img.tags }))
    .filter(img => {
      if (!iconSearch) return true;
      const q = iconSearch.toLowerCase();
      return img.handle.toLowerCase().includes(q) || (img.alt || "").toLowerCase().includes(q);
    });

  useEffect(() => {
    if (data) {
      setAgentName(data.chat_bubble?.agent_name || "");
      setAgentIcon(data.chat_bubble?.agent_icon || "");
      setPromptRole(data.prompt_role || "");
      setPromptPersonality(data.prompt_personality || "");
      setPromptInstructions(data.prompt_instructions || "");
      setPromptFallback(data.prompt_fallback || "");
      setCustomKnowledge((data.custom_knowledge || []).map(k => ({ content: k.content, tag: k.tag || "" })));
      setPinnedQA((data.pinned_qa || []).map(q => ({ question: q.question, answer: q.answer, tag: q.tag || "" })));
      setAgentTools(data.agent_tools || []);
      setPagePatterns(data.chat_bubble?.page_patterns || []);
      setContentTypes(data.chat_bubble?.content_types || []);
      setBubbleEnabled(data.chat_bubble?.enabled !== false);
    }
  }, [data]);

  useEffect(() => {
    if (visibilityOpen) {
      setDraftBubbleEnabled(bubbleEnabled);
      setDraftPagePatterns([...pagePatterns]);
      setDraftContentTypes([...contentTypes]);
    }
  }, [visibilityOpen]);

  useEffect(() => {
    if (identityCoreOpen) {
      setDraftAgentName(agentName);
      setDraftAgentIcon(agentIcon);
      setDraftPromptRole(promptRole);
      setDraftPromptPersonality(promptPersonality);
      setDraftPromptInstructions(promptInstructions);
      setDraftPromptFallback(promptFallback);
      setIdentitySecOpen(false);
      setRoleSecOpen(false);
      setPersonalitySecOpen(false);
      setInstructionsSecOpen(false);
      setFallbackSecOpen(false);
    }
  }, [identityCoreOpen]);

  const handleIdentityCoreSave = async () => {
    setSavingIdentity(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;
      const compiled = compileSystemPrompt(draftAgentName, draftPromptRole, draftPromptPersonality, draftPromptInstructions, draftPromptFallback);
      const res = await fetch("/api/admin/ai/knowledge", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          system_prompt: compiled,
          prompt_role: draftPromptRole,
          prompt_personality: draftPromptPersonality,
          prompt_instructions: draftPromptInstructions,
          prompt_fallback: draftPromptFallback,
          chat_bubble: { enabled: bubbleEnabled, page_patterns: pagePatterns, content_types: contentTypes, agent_name: draftAgentName, agent_icon: draftAgentIcon },
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setAgentName(draftAgentName);
      setAgentIcon(draftAgentIcon);
      setPromptRole(draftPromptRole);
      setPromptPersonality(draftPromptPersonality);
      setPromptInstructions(draftPromptInstructions);
      setPromptFallback(draftPromptFallback);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/knowledge"] });
      toast({ title: "Identity Core saved" });
      setIdentityCoreOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save identity settings.", variant: "destructive" });
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleVisibilitySave = async () => {
    setSavingVisibility(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;
      const res = await fetch("/api/admin/ai/knowledge", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          chat_bubble: { enabled: draftBubbleEnabled, page_patterns: draftPagePatterns, content_types: draftContentTypes, agent_name: agentName, agent_icon: agentIcon },
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setBubbleEnabled(draftBubbleEnabled);
      setPagePatterns(draftPagePatterns);
      setContentTypes(draftContentTypes);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/knowledge"] });
      toast({ title: "Page targeting saved" });
      setVisibilityOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save targeting settings.", variant: "destructive" });
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;

      const compiled = compileSystemPrompt(agentName, promptRole, promptPersonality, promptInstructions, promptFallback);
      const res = await fetch("/api/admin/ai/knowledge", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          system_prompt: compiled,
          prompt_role: promptRole,
          prompt_personality: promptPersonality,
          prompt_instructions: promptInstructions,
          prompt_fallback: promptFallback,
          custom_knowledge: customKnowledge,
          pinned_qa: pinnedQA,
          agent_tools: agentTools,
          chat_bubble: { enabled: bubbleEnabled, page_patterns: pagePatterns, content_types: contentTypes, agent_name: agentName, agent_icon: agentIcon },
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
          <Button variant="outline" onClick={() => setIdentityCoreOpen(true)} data-testid="button-open-identity-core">
            <IconBrain className="h-4 w-4 mr-2" />
            Identity Core
          </Button>
          <Button variant="outline" onClick={() => setVisibilityOpen(true)} data-testid="button-open-visibility">
            <IconEye className="h-4 w-4 mr-2" />
            Visibility
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-knowledge">
            {saving ? <IconLoader2 className="h-4 w-4 animate-spin mr-2" /> : <IconCheck className="h-4 w-4 mr-2" />}
            Save All
          </Button>
        </div>

        {/* Icon picker dialog */}
        <Dialog open={iconPickerOpen} onOpenChange={open => { setIconPickerOpen(open); if (!open) { setIconSearch(""); setIconPickerForDraft(false); } }}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-icon-picker">
            <DialogHeader>
              <DialogTitle>Select Agent Icon</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <IconSearch className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={iconSearch}
                onChange={e => setIconSearch(e.target.value)}
                placeholder="Search images..."
                className="flex-1 bg-transparent text-sm outline-none"
                data-testid="input-icon-search"
              />
            </div>
            <div className="overflow-y-auto grid grid-cols-4 gap-2 mt-1">
              {filteredIcons.slice(0, 60).map(img => (
                <button
                  key={img.handle}
                  onClick={() => { if (iconPickerForDraft) { setDraftAgentIcon(img.src); } else { setAgentIcon(img.src); } setIconPickerOpen(false); setIconSearch(""); }}
                  className="aspect-square rounded-md overflow-hidden border focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid={`button-icon-${img.handle}`}
                >
                  <img src={img.src} alt={img.alt || img.handle} className="w-full h-full object-cover" />
                </button>
              ))}
              {filteredIcons.length === 0 && (
                <div className="col-span-4 py-12 text-center text-sm text-muted-foreground">No images found</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Identity Core Dialog */}
        <Dialog open={identityCoreOpen} onOpenChange={setIdentityCoreOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden" data-testid="dialog-identity-core">
            <DialogHeader>
              <DialogTitle data-testid="text-identity-core-title">Identity Core</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-1">Define who this agent is. Each section shapes a different aspect of its behavior.</p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">

              {/* Identity section */}
              <Card className="p-4">
                <Collapsible open={identitySecOpen} onOpenChange={setIdentitySecOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left rounded-md hover-elevate px-1 py-0.5" data-testid="button-toggle-identity">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold">Identity</p>
                        {!identitySecOpen && (
                          <p className="text-xs text-muted-foreground truncate">{draftAgentName || "No name set"}</p>
                        )}
                      </div>
                      <IconPencil className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">The agent's name and avatar shown in the chat bubble header.</p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => { setIconPickerForDraft(true); setIconPickerOpen(true); }}
                        className="relative shrink-0 w-16 h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
                        data-testid="button-change-icon-draft"
                      >
                        {draftAgentIcon ? (
                          <img src={draftAgentIcon} alt="Agent icon" className="w-full h-full object-cover" />
                        ) : (
                          <IconUser className="h-7 w-7 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <IconPhoto className="h-5 w-5 text-white" />
                        </div>
                      </button>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Agent Name</label>
                        <input
                          type="text"
                          value={draftAgentName}
                          onChange={e => setDraftAgentName(e.target.value)}
                          placeholder="e.g. Alex, Aria, Support Bot"
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                          data-testid="input-draft-agent-name"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Role & Purpose */}
              <Card className="p-4">
                <Collapsible open={roleSecOpen} onOpenChange={setRoleSecOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left rounded-md hover-elevate px-1 py-0.5" data-testid="button-toggle-role">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold">Role & Purpose</p>
                        {!roleSecOpen && (
                          <p className="text-xs text-muted-foreground truncate">{draftPromptRole || "Not configured"}</p>
                        )}
                      </div>
                      <IconPencil className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">What is this agent here to help with? Who does it serve and what topics does it cover?</p>
                    <Textarea
                      value={draftPromptRole}
                      onChange={e => setDraftPromptRole(e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="e.g. You help prospective students learn about 4Geeks Academy's programs, admissions process, and tuition options."
                      data-testid="textarea-draft-prompt-role"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Personality & Tone */}
              <Card className="p-4">
                <Collapsible open={personalitySecOpen} onOpenChange={setPersonalitySecOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left rounded-md hover-elevate px-1 py-0.5" data-testid="button-toggle-personality">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold">Personality & Tone</p>
                        {!personalitySecOpen && (
                          <p className="text-xs text-muted-foreground truncate">{draftPromptPersonality || "Not configured"}</p>
                        )}
                      </div>
                      <IconPencil className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">How should the agent communicate? Describe the communication style, level of formality, and emotional character.</p>
                    <Textarea
                      value={draftPromptPersonality}
                      onChange={e => setDraftPromptPersonality(e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="e.g. Friendly and encouraging, but professional. Keep answers concise and clear."
                      data-testid="textarea-draft-prompt-personality"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Key Instructions */}
              <Card className="p-4">
                <Collapsible open={instructionsSecOpen} onOpenChange={setInstructionsSecOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left rounded-md hover-elevate px-1 py-0.5" data-testid="button-toggle-instructions">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold">Key Instructions</p>
                        {!instructionsSecOpen && (
                          <p className="text-xs text-muted-foreground truncate">{draftPromptInstructions || "Not configured"}</p>
                        )}
                      </div>
                      <IconPencil className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Specific rules for the agent — what it should always do, recommend, or prioritize when answering.</p>
                    <Textarea
                      value={draftPromptInstructions}
                      onChange={e => setDraftPromptInstructions(e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="e.g. Always link to the relevant program page. Recommend booking a free consultation for detailed questions."
                      data-testid="textarea-draft-prompt-instructions"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Fallback & Boundaries */}
              <Card className="p-4">
                <Collapsible open={fallbackSecOpen} onOpenChange={setFallbackSecOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left rounded-md hover-elevate px-1 py-0.5" data-testid="button-toggle-fallback">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold">Fallback & Boundaries</p>
                        {!fallbackSecOpen && (
                          <p className="text-xs text-muted-foreground truncate">{draftPromptFallback || "Not configured"}</p>
                        )}
                      </div>
                      <IconPencil className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">What should the agent do when it doesn't know the answer? What topics or promises should it avoid?</p>
                    <Textarea
                      value={draftPromptFallback}
                      onChange={e => setDraftPromptFallback(e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="e.g. If you're unsure, say so honestly and direct the student to our admissions team."
                      data-testid="textarea-draft-prompt-fallback"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </Card>

            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setIdentityCoreOpen(false)} data-testid="button-identity-core-cancel">
                Cancel
              </Button>
              <Button onClick={handleIdentityCoreSave} disabled={savingIdentity} data-testid="button-identity-core-save">
                {savingIdentity ? <IconLoader2 className="h-4 w-4 animate-spin mr-1" /> : <IconCheck className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <DialogTitle data-testid="text-visibility-dialog-title">Chat Agent Visibility</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-3 ${draftBubbleEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {draftBubbleEnabled
                      ? <IconEye className="h-6 w-6" />
                      : <IconEyeOff className="h-6 w-6" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium">Chat bubble</p>
                    <p className="text-xs text-muted-foreground">{draftBubbleEnabled ? "Visible to visitors" : "Hidden from visitors"}</p>
                  </div>
                </div>
                <Switch
                  checked={draftBubbleEnabled}
                  onCheckedChange={setDraftBubbleEnabled}
                  data-testid="switch-bubble-enabled"
                />
              </div>
              {/* Specific URLs — collapsible card */}
              <Card className="p-4">
                <Collapsible open={urlPatternsOpen} onOpenChange={setUrlPatternsOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      className="flex items-center justify-between w-full text-left rounded-md hover-elevate px-1 py-0.5"
                      data-testid="button-toggle-url-patterns"
                    >
                      <div>
                        <p className="text-sm font-medium">Specific URLs</p>
                        {!urlPatternsOpen && (
                          <p className="text-xs text-muted-foreground">Show the chat agent only on specific groups of URLs</p>
                        )}
                      </div>
                      <IconChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${urlPatternsOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-1">
                    {draftPagePatterns.map((pattern, i) =>
                      editingPatternIdx === i ? (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            value={editingPatternVal}
                            onChange={e => setEditingPatternVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                const updated = [...draftPagePatterns];
                                updated[i] = editingPatternVal;
                                setDraftPagePatterns(updated);
                                setEditingPatternIdx(null);
                              } else if (e.key === "Escape") {
                                if (!pattern) setDraftPagePatterns(prev => prev.filter((_, j) => j !== i));
                                setEditingPatternIdx(null);
                              }
                            }}
                            className="flex-1 px-2.5 py-1.5 text-sm border rounded-md bg-background font-mono"
                            data-testid={`input-pattern-${i}`}
                          />
                          <Button size="icon" variant="ghost" onClick={() => {
                            const updated = [...draftPagePatterns];
                            updated[i] = editingPatternVal;
                            setDraftPagePatterns(updated);
                            setEditingPatternIdx(null);
                          }} data-testid={`button-confirm-pattern-${i}`}>
                            <IconCheck className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => {
                            if (!pattern) setDraftPagePatterns(prev => prev.filter((_, j) => j !== i));
                            setEditingPatternIdx(null);
                          }} data-testid={`button-cancel-pattern-${i}`}>
                            <IconX className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div key={i} className="flex items-center gap-1.5">
                          <code className="flex-1 min-w-0 truncate text-xs bg-muted px-2.5 py-1.5 rounded-md font-mono" data-testid={`text-pattern-${i}`}>{pattern || <span className="text-muted-foreground italic">empty</span>}</code>
                          <Button size="icon" variant="ghost" onClick={() => { setEditingPatternIdx(i); setEditingPatternVal(pattern); }} data-testid={`button-edit-pattern-${i}`}>
                            <IconPencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDraftPagePatterns(prev => prev.filter((_, j) => j !== i))} data-testid={`button-delete-pattern-${i}`}>
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = [...draftPagePatterns, ""];
                        setDraftPagePatterns(next);
                        setEditingPatternIdx(next.length - 1);
                        setEditingPatternVal("");
                      }}
                      data-testid="button-add-pattern"
                    >
                      <IconPlus className="h-4 w-4 mr-1" />
                      Add Pattern
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Content Type Targeting — tag cloud card */}
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium" data-testid="text-content-types-heading">Content Type Targeting</h3>
                  <p className="text-xs text-muted-foreground">Show the chat bubble on pages matching these content types</p>
                </div>
                <div className="flex flex-wrap gap-1.5" data-testid="tag-cloud-content-types">
                  {draftContentTypes.map((ct, i) => {
                    const label = (contentTypesData || []).find(c => c.name === ct)?.label || ct;
                    return (
                      <Badge key={ct} variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-0.5" data-testid={`badge-content-type-${ct}`}>
                        <span className="text-xs">{label}</span>
                        <button
                          onClick={() => setDraftContentTypes(prev => prev.filter((_, j) => j !== i))}
                          className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                          data-testid={`button-delete-content-type-${i}`}
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  {(contentTypesData || []).filter(ct => !draftContentTypes.includes(ct.name)).length > 0 && (
                    <Select
                      key={addCtSelectKey}
                      onValueChange={val => {
                        if (!draftContentTypes.includes(val)) {
                          setDraftContentTypes(prev => [...prev, val]);
                        }
                        setAddCtSelectKey(k => k + 1);
                      }}
                    >
                      <SelectTrigger className="h-6 w-auto gap-1 px-2 text-xs border-dashed" data-testid="select-add-content-type">
                        <IconPlus className="h-3 w-3" />
                        <SelectValue placeholder="Add type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(contentTypesData || [])
                          .filter(ct => !draftContentTypes.includes(ct.name))
                          .map(ct => (
                            <SelectItem key={ct.name} value={ct.name} data-testid={`option-content-type-${ct.name}`}>
                              {ct.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </Card>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setVisibilityOpen(false)} data-testid="button-visibility-cancel">
                Cancel
              </Button>
              <Button onClick={handleVisibilitySave} disabled={savingVisibility} data-testid="button-visibility-save">
                {savingVisibility ? <IconLoader2 className="h-4 w-4 animate-spin mr-1" /> : <IconCheck className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </DialogFooter>
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
