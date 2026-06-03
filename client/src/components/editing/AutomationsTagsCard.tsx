import { useState } from "react";
import { IconPencil, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "./TagInput";

interface AutomationsTagsCardProps {
  automation: string;
  tags: string[];
  onAutomationChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  automationSuggestions?: string[];
  tagSuggestions?: string[];
}

export function AutomationsTagsCard({
  automation,
  tags,
  onAutomationChange,
  onTagsChange,
  automationSuggestions = [],
  tagSuggestions = [],
}: AutomationsTagsCardProps) {
  const [editing, setEditing] = useState(false);
  const automationArr = automation ? [automation] : [];

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3" data-testid="card-automations-tags">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Automations &amp; Tags</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setEditing((v) => !v)}
          data-testid="button-edit-automations-tags"
        >
          {editing ? <IconX className="h-3.5 w-3.5" /> : <IconPencil className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" data-testid="label-conversion-automations">
              Automation
            </Label>
            <TagInput
              values={automationArr}
              suggestions={automationSuggestions}
              onChange={(vals) => onAutomationChange(vals[0] ?? "")}
              placeholder="e.g. hubspot-lead-nurture"
              max={1}
              testId="input-conversion-automations"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" data-testid="label-conversion-tags">
              Tags
            </Label>
            <TagInput
              values={tags}
              suggestions={tagSuggestions}
              onChange={onTagsChange}
              placeholder="e.g. lead, bootcamp, latam"
              testId="input-conversion-tags"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">Automation</span>
            {automation ? (
              <span className="font-mono text-xs">{automation}</span>
            ) : (
              <span className="text-xs text-muted-foreground italic">not set</span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">Tags</span>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[11px] px-1.5 py-0 leading-4 font-normal font-mono">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">not set</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
