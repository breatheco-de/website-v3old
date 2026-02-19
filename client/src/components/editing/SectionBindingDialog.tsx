import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconLink,
  IconLinkOff,
  IconLoader2,
  IconSearch,
  IconCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { getDebugToken } from "@/hooks/useDebugAuth";

interface SectionBindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: string;
  slug: string;
  sectionIndex: number;
  component: string;
  locale: string;
  existingGroup?: {
    id: string;
    component: string;
    locale: string;
    members: Array<{ contentType: string; slug: string; sectionIndex: number }>;
  } | null;
  onBindingChanged: () => void;
}

interface Candidate {
  contentType: string;
  slug: string;
  sectionIndex: number;
  title?: string;
  alreadyBound?: string;
}

function fetchWithAuth(url: string, options?: RequestInit) {
  const token = getDebugToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
}

export function SectionBindingDialog({
  open,
  onOpenChange,
  contentType,
  slug,
  sectionIndex,
  component,
  locale,
  existingGroup,
  onBindingChanged,
}: SectionBindingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  const candidateKey = (c: Candidate) => `${c.contentType}:${c.slug}:${c.sectionIndex}`;
  const currentKey = `${contentType}:${slug}:${sectionIndex}`;

  const { data: candidatesData, isLoading: loadingCandidates } = useQuery({
    queryKey: ["/api/bindings/candidates", component, locale],
    queryFn: async () => {
      const res = await fetch(`/api/bindings/candidates?component=${encodeURIComponent(component)}&locale=${encodeURIComponent(locale)}`);
      return res.json();
    },
    enabled: open && !!component && !!locale,
  });

  const candidates = (candidatesData?.candidates || []) as Candidate[];

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => candidateKey(c) !== currentKey)
      .filter(c => {
        if (!search) return true;
        const lower = search.toLowerCase();
        return (
          c.slug.toLowerCase().includes(lower) ||
          c.title?.toLowerCase().includes(lower) ||
          c.contentType.toLowerCase().includes(lower)
        );
      });
  }, [candidates, search, currentKey]);

  const existingMemberKeys = useMemo(() => {
    if (!existingGroup) return new Set<string>();
    return new Set(existingGroup.members.map(m => `${m.contentType}:${m.slug}:${m.sectionIndex}`));
  }, [existingGroup]);

  const createBindingMutation = useMutation({
    mutationFn: async (members: Array<{ contentType: string; slug: string; sectionIndex: number }>) => {
      const res = await fetchWithAuth("/api/bindings", {
        method: "POST",
        body: JSON.stringify({ component, locale, members }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create binding");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Binding created", description: "Sections are now linked." });
      queryClient.invalidateQueries({ queryKey: ["/api/bindings/section"] });
      onBindingChanged();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ groupId, member }: { groupId: string; member: { contentType: string; slug: string; sectionIndex: number } }) => {
      const res = await fetchWithAuth(`/api/bindings/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify(member),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bindings/section"] });
      onBindingChanged();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, member }: { groupId: string; member: { contentType: string; slug: string; sectionIndex: number } }) => {
      const res = await fetchWithAuth(`/api/bindings/${groupId}/members`, {
        method: "DELETE",
        body: JSON.stringify(member),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bindings/section"] });
      onBindingChanged();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unbindCurrentMutation = useMutation({
    mutationFn: async () => {
      if (!existingGroup) throw new Error("No binding to remove");
      const res = await fetchWithAuth(`/api/bindings/${existingGroup.id}/members`, {
        method: "DELETE",
        body: JSON.stringify({ contentType, slug, sectionIndex }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unbind");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Unbound", description: "This section is no longer linked to others." });
      queryClient.invalidateQueries({ queryKey: ["/api/bindings/section"] });
      onBindingChanged();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleCandidate = (c: Candidate) => {
    const key = candidateKey(c);
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreateBinding = () => {
    const selectedMembers = filteredCandidates
      .filter(c => selectedCandidates.has(candidateKey(c)))
      .map(c => ({ contentType: c.contentType, slug: c.slug, sectionIndex: c.sectionIndex }));

    const allMembers = [
      { contentType, slug, sectionIndex },
      ...selectedMembers,
    ];

    createBindingMutation.mutate(allMembers);
  };

  const handleAddToExisting = (c: Candidate) => {
    if (!existingGroup) return;
    addMemberMutation.mutate({
      groupId: existingGroup.id,
      member: { contentType: c.contentType, slug: c.slug, sectionIndex: c.sectionIndex },
    });
  };

  const handleRemoveFromExisting = (c: Candidate) => {
    if (!existingGroup) return;
    removeMemberMutation.mutate({
      groupId: existingGroup.id,
      member: { contentType: c.contentType, slug: c.slug, sectionIndex: c.sectionIndex },
    });
  };

  const isPending = createBindingMutation.isPending || addMemberMutation.isPending || removeMemberMutation.isPending || unbindCurrentMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconLink className="h-5 w-5" />
            Section Bindings
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          Bind this <Badge variant="secondary" className="text-xs">{component}</Badge> section to matching sections on other pages. 
          When you edit any bound section, the content changes sync automatically to all siblings. 
          Layout settings (padding, background, visibility) remain independent per page.
        </div>

        {existingGroup && (
          <div className="rounded-md border border-border p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">Current binding group</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive gap-1"
                onClick={() => unbindCurrentMutation.mutate()}
                disabled={isPending}
                data-testid="button-unbind-current"
              >
                <IconLinkOff className="h-3.5 w-3.5" />
                Unbind this section
              </Button>
            </div>
            <div className="space-y-1">
              {existingGroup.members.map(m => {
                const key = `${m.contentType}:${m.slug}:${m.sectionIndex}`;
                const isSelf = key === currentKey;
                return (
                  <div key={key} className="flex items-center justify-between text-sm py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">{m.contentType}</Badge>
                      <span className="truncate">{m.slug}</span>
                      <span className="text-muted-foreground text-xs">[{m.sectionIndex}]</span>
                      {isSelf && <Badge variant="secondary" className="text-xs">current</Badge>}
                    </div>
                    {!isSelf && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleRemoveFromExisting(m)}
                        disabled={isPending}
                        data-testid={`button-remove-member-${key}`}
                      >
                        <IconLinkOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-binding-search"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
          {loadingCandidates ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No matching sections found
            </div>
          ) : (
            <div className="space-y-1 pr-3">
              {filteredCandidates.map(c => {
                const key = candidateKey(c);
                const isMember = existingMemberKeys.has(key);
                const isBoundElsewhere = c.alreadyBound && (!existingGroup || c.alreadyBound !== existingGroup.id);
                const isSelected = selectedCandidates.has(key);

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-md text-sm ${
                      isBoundElsewhere ? "opacity-50" : "hover-elevate cursor-pointer"
                    }`}
                    onClick={() => {
                      if (isBoundElsewhere || isMember) return;
                      if (existingGroup) {
                        handleAddToExisting(c);
                      } else {
                        handleToggleCandidate(c);
                      }
                    }}
                    data-testid={`binding-candidate-${key}`}
                  >
                    {!existingGroup && !isBoundElsewhere && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleCandidate(c)}
                        disabled={isBoundElsewhere || false}
                        data-testid={`checkbox-candidate-${key}`}
                      />
                    )}
                    {existingGroup && isMember && (
                      <IconCheck className="h-4 w-4 text-primary shrink-0" />
                    )}
                    {existingGroup && !isMember && !isBoundElsewhere && (
                      <IconLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">{c.contentType}</Badge>
                        <span className="truncate font-medium">{c.title || c.slug}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.slug} — section [{c.sectionIndex}]
                      </p>
                    </div>
                    {isBoundElsewhere && (
                      <Badge variant="secondary" className="text-xs shrink-0">bound elsewhere</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {!existingGroup && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-binding-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBinding}
              disabled={selectedCandidates.size === 0 || isPending}
              data-testid="button-binding-create"
            >
              {isPending ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <IconLink className="h-4 w-4 mr-2" />
                  Bind {selectedCandidates.size + 1} sections
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
