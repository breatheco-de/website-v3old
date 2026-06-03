import { useState } from "react";
import { IconInfoCircle, IconPencil, IconShieldCheck, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

export interface ConsentValues {
  marketing: boolean;
  sms: boolean;
  whatsapp: boolean;
  smsUsaOnly: boolean;
  showTerms: boolean;
  termsUrl: string;
  privacyUrl: string;
}

interface ConsentCardProps {
  values: ConsentValues;
  onChange: (field: keyof ConsentValues, value: boolean | string) => void;
}

function ConsentVariableInfo({ variable }: { variable: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-5 w-5"
        onClick={() => setOpen((v) => !v)}
        data-testid={`button-consent-info-${variable}`}
      >
        <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      {open && (
        <span className="absolute left-6 top-0 z-10 flex flex-col gap-2 w-56 rounded-md border bg-popover p-3 shadow-md text-popover-foreground">
          <span className="text-xs text-muted-foreground">
            Default text comes from{" "}
            <code className="font-mono text-foreground bg-muted px-1 rounded text-[11px]">
              {variable}
            </code>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              window.location.href = "/en/admin/settings?tab=legal";
            }}
            data-testid="button-consent-edit-settings"
          >
            Edit in Settings
          </Button>
        </span>
      )}
    </span>
  );
}

export function ConsentCard({ values, onChange }: ConsentCardProps) {
  const [editing, setEditing] = useState(false);

  const activeChannels = [
    values.marketing ? "Marketing" : null,
    values.sms ? "SMS" : null,
    values.whatsapp ? "WhatsApp" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3" data-testid="card-consents">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <IconShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Consents</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setEditing((v) => !v)}
          data-testid="button-edit-consents"
        >
          {editing ? <IconX className="h-3.5 w-3.5" /> : <IconPencil className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {!editing ? (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">Channels</span>
            {activeChannels.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {activeChannels.map((ch) => (
                  <Badge key={ch} variant="secondary" className="text-[11px] px-1.5 py-0 leading-4 font-normal">
                    {ch}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">none enabled</span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">Terms</span>
            <span className="text-xs text-muted-foreground italic">{values.showTerms ? "shown" : "hidden"}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Marketing */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">Marketing</Label>
              {values.marketing && (
                <ConsentVariableInfo variable="reserved.consent_general" />
              )}
            </div>
            <Switch
              checked={values.marketing}
              onCheckedChange={(v) => onChange("marketing", v)}
              data-testid="switch-consent-marketing"
            />
          </div>

          {/* SMS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs">SMS</Label>
                {values.sms && (
                  <ConsentVariableInfo variable="reserved.consent_sms" />
                )}
              </div>
              <Switch
                checked={values.sms}
                onCheckedChange={(v) => onChange("sms", v)}
                data-testid="switch-consent-sms"
              />
            </div>
            {values.sms && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">US-only</Label>
                <Checkbox
                  checked={values.smsUsaOnly}
                  onCheckedChange={(v) => onChange("smsUsaOnly", !!v)}
                  data-testid="checkbox-consent-sms-usa-only"
                />
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">WhatsApp</Label>
            <Switch
              checked={values.whatsapp}
              onCheckedChange={(v) => onChange("whatsapp", v)}
              data-testid="switch-consent-whatsapp"
            />
          </div>

          {/* Terms */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Show terms &amp; privacy</Label>
              <Switch
                checked={values.showTerms}
                onCheckedChange={(v) => onChange("showTerms", v)}
                data-testid="switch-consent-show-terms"
              />
            </div>
            {values.showTerms && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Terms URL</Label>
                  <Input
                    value={values.termsUrl}
                    onChange={(e) => onChange("termsUrl", e.target.value)}
                    placeholder="/terms-and-conditions"
                    className="text-xs h-8"
                    data-testid="input-consent-terms-url"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Privacy URL</Label>
                  <Input
                    value={values.privacyUrl}
                    onChange={(e) => onChange("privacyUrl", e.target.value)}
                    placeholder="/privacy-policy"
                    className="text-xs h-8"
                    data-testid="input-consent-privacy-url"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
