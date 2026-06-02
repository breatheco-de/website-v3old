import { useState, useEffect } from "react";
import {
  IconArrowLeft,
  IconBraces,
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconInfoCircle,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconPlugConnected,
  IconServer,
  IconSettingsCog,
  IconToggleLeft,
  IconToggleRight,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import JsonViewer from "@/components/editing/JsonViewer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiFetch, queryClient } from "@/lib/queryClient";
import { TRACKING_EVENTS, type TrackingSettingsResponse } from "@/lib/tracking";

interface TagManagerConfig {
  sgtm_enabled: boolean;
  sgtm_server_url: string;
  sgtm_proxy_path: string;
}

interface OptimizationConfig {
  tagmanager: TagManagerConfig;
}

function GTMSection() {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);

  const { data, isLoading } = useQuery<OptimizationConfig>({
    queryKey: ["/api/settings/optimization"],
  });

  const [enabled, setEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [proxyPath, setProxyPath] = useState("/sgtm/");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  type TestStatus = "idle" | "testing" | "success" | "error";
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testReason, setTestReason] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data?.tagmanager) {
      setEnabled(data.tagmanager.sgtm_enabled);
      setServerUrl(data.tagmanager.sgtm_server_url || "");
      setProxyPath(data.tagmanager.sgtm_proxy_path || "/sgtm/");
      setDirty(false);
    }
  }, [data]);

  function markDirty() {
    setDirty(true);
  }

  async function handleTestConnection() {
    if (!serverUrl.trim()) return;
    setTesting(true);
    setTestStatus("testing");
    setTestReason("");
    try {
      const res = await apiFetch("/api/settings/optimization/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: serverUrl.trim() }),
        credentials: "include",
      });
      const result = await res.json();
      if (result.reachable) {
        setTestStatus("success");
        setTestReason("");
      } else {
        setTestStatus("error");
        setTestReason(result.reason || "Server unreachable.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestReason(err.message || "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const computedTransportUrl = `${siteOrigin}${proxyPath}`;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/settings/optimization", {
        tagmanager: {
          sgtm_enabled: enabled,
          sgtm_server_url: serverUrl.trim(),
          sgtm_proxy_path: proxyPath.trim(),
        },
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/optimization"] });
      setDirty(false);
      toast({ title: "Optimization settings saved" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <div className="flex items-center gap-2">
            <IconSettingsCog className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Server-Side Tagging</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
            data-testid="button-save-optimization"
          >
            {saving ? (
              <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <IconDeviceFloppy className="h-4 w-4 mr-1.5" />
            )}
            Save
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">What is server-side tagging?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Server-side Google Tag Manager (sGTM) runs your analytics tags on the server instead of the browser. This improves data quality by bypassing ad blockers and browser privacy restrictions (ITP/ETP), reduces page load time, and gives you full control over the data sent to third parties.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When enabled, this server transparently forwards all requests matching the proxy path to your sGTM server (e.g. a Stape.io endpoint), making them appear as first-party requests from your own domain.
                </p>
              </div>

              <div className="pt-2 border-t space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Enable sGTM proxy</p>
                    <p className="text-xs text-muted-foreground">
                      When off, the proxy path returns 404 and has no performance impact.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEnabled((v) => !v); markDirty(); }}
                    className="shrink-0 text-muted-foreground"
                    data-testid="toggle-sgtm-enabled"
                    aria-label={enabled ? "Disable sGTM proxy" : "Enable sGTM proxy"}
                  >
                    {enabled ? (
                      <IconToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <IconToggleLeft className="h-8 w-8" />
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="sgtm-server-url">
                    sGTM Server URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="sgtm-server-url"
                      placeholder="https://xxx.stape.net"
                      value={serverUrl}
                      onChange={(e) => {
                        setServerUrl(e.target.value);
                        markDirty();
                        setTestStatus("idle");
                        setTestReason("");
                      }}
                      className="font-mono text-sm"
                      data-testid="input-sgtm-server-url"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={!serverUrl.trim() || testing}
                      data-testid="button-test-sgtm-connection"
                      className="shrink-0"
                    >
                      {testing ? (
                        <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <IconPlugConnected className="h-4 w-4 mr-1.5" />
                      )}
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The Stape.io or custom sGTM server endpoint (e.g. <code className="font-mono">https://xxx.stape.net</code>).
                  </p>
                  {testStatus === "success" && (
                    <div className="flex items-center gap-1.5 text-xs" data-testid="status-sgtm-connection-success">
                      <IconCircleCheck className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="text-green-700 dark:text-green-400">Server reachable — connection successful.</span>
                    </div>
                  )}
                  {testStatus === "error" && (
                    <div className="flex items-start gap-1.5 text-xs" data-testid="status-sgtm-connection-error">
                      <IconCircleX className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span className="text-destructive">{testReason}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="sgtm-proxy-path">
                    Proxy path
                  </label>
                  <Input
                    id="sgtm-proxy-path"
                    placeholder="/sgtm/"
                    value={proxyPath}
                    onChange={(e) => { setProxyPath(e.target.value); markDirty(); }}
                    className="font-mono text-sm"
                    data-testid="input-sgtm-proxy-path"
                  />
                  <p className="text-xs text-muted-foreground">
                    Local path to mount the proxy at. Must start with <code className="font-mono">/</code>. Default: <code className="font-mono">/sgtm/</code>.
                  </p>
                </div>

                {serverUrl && proxyPath && (
                  <div className="rounded-md border bg-muted px-3 py-2.5 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Computed transport URL</p>
                    <code className="text-xs font-mono break-all" data-testid="text-transport-url">
                      {computedTransportUrl}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Paste this URL as the transport URL in your GTM web container server transport settings.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between gap-2 pb-3 cursor-pointer"
          onClick={() => setShowInstructions((v) => !v)}
          data-testid="button-toggle-instructions"
        >
          <div className="flex items-center gap-2">
            <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">How to connect GTM</CardTitle>
          </div>
          {showInstructions ? (
            <IconChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <IconChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        {showInstructions && (
          <CardContent className="space-y-3 pt-0">
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>
                <span className="text-foreground font-medium">Create a server-side GTM container</span> in your Google Tag Manager account (Container type: <em>Server</em>).
              </li>
              <li>
                <span className="text-foreground font-medium">Provision an sGTM server</span> — use Stape.io, GCP, or any supported host. Copy the tagging server URL (e.g. <code className="font-mono text-xs">https://xxx.stape.net</code>).
              </li>
              <li>
                <span className="text-foreground font-medium">Configure the proxy above</span> — paste your sGTM server URL, choose a proxy path (default <code className="font-mono text-xs">/sgtm/</code>), enable the proxy, and save.
              </li>
              <li>
                <span className="text-foreground font-medium">Set the transport URL in GTM</span> — in your GTM <em>web</em> container, open the Google Tag / GA4 tag settings and set the <strong>Server container URL</strong> (transport URL) to:
                <div className="mt-1.5 rounded-md border bg-muted px-3 py-2">
                  <code className="text-xs font-mono break-all">{computedTransportUrl || `${siteOrigin}/sgtm/`}</code>
                </div>
              </li>
              <li>
                <span className="text-foreground font-medium">Publish both containers</span> — publish your server container first, then republish your web container. Tags will now fire through the first-party proxy.
              </li>
            </ol>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

const SAMPLE_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

interface TrackingEvent {
  name: string;
  trigger: string;
  payload: Record<string, unknown>;
}

interface EventGroup {
  title: string;
  description: string;
  events: TrackingEvent[];
}

const GENERAL_EVENT_PAYLOADS: Record<string, Record<string, unknown>> = {
  page_view: {
    event: "page_view",
    user_id: SAMPLE_USER_ID,
    pagePath: "/en/apply",
    pageTitle: "Apply Now – 4Geeks Academy",
  },
  experiment_exposure: {
    event: "experiment_exposure",
    user_id: SAMPLE_USER_ID,
    experiment_id: "hero-variant-test",
    variant: "B",
  },
  cta_click: {
    event: "cta_click",
    user_id: SAMPLE_USER_ID,
    label: "Apply Now",
    section: "hero",
    destination: "/en/apply",
  },
  video_play: {
    event: "video_play",
    user_id: SAMPLE_USER_ID,
    video_id: "dQw4w9WgXcQ",
    title: "Why 4Geeks Academy",
  },
  scroll_depth: {
    event: "scroll_depth",
    user_id: SAMPLE_USER_ID,
    depth: 50,
    page: "/en/apply",
  },
};

interface UsageEntry {
  file: string;
  content_type: string;
  slug: string;
  locale: string;
  section_id: string;
  section_type: string;
}

function EventsSection() {
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<TrackingEvent | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<string | null>(null);
  const [renameEvent, setRenameEvent] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [usageModalEvent, setUsageModalEvent] = useState<string | null>(null);
  const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState("");

  const { data: trackingSettings } = useQuery<TrackingSettingsResponse>({
    queryKey: ["/api/settings/tracking"],
  });
  const conversionEventEntries = trackingSettings?.conversion_events ?? [];

  const { data: conversionCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/form-state/conversion-counts"],
  });

  const { data: usageModalData, isFetching: usageModalFetching } = useQuery<{ name: string; usages: UsageEntry[] }>({
    queryKey: ["/api/settings/tracking/conversion-events", usageModalEvent, "usage"],
    queryFn: async () => {
      const res = await apiFetch(`/api/settings/tracking/conversion-events/${encodeURIComponent(usageModalEvent!)}/usage`);
      if (!res.ok) throw new Error("Failed to load usage");
      return res.json();
    },
    enabled: !!usageModalEvent,
  });

  const { data: usageData, isFetching: usageFetching } = useQuery<{ name: string; usages: UsageEntry[] }>({
    queryKey: ["/api/settings/tracking/conversion-events", deleteConfirmEvent, "usage"],
    queryFn: async () => {
      const res = await apiFetch(`/api/settings/tracking/conversion-events/${encodeURIComponent(deleteConfirmEvent!)}/usage`);
      if (!res.ok) throw new Error("Failed to load usage");
      return res.json();
    },
    enabled: !!deleteConfirmEvent,
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("DELETE", `/api/settings/tracking/conversion-events/${encodeURIComponent(name)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tracking"] });
      setDeleteConfirmEvent(null);
      toast({ title: "Event deleted", description: `"${name}" removed from conversion events.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete event", description: err.message, variant: "destructive" });
    },
  });

  const addEventMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const updated = [...conversionEventEntries, { name: name.trim(), description: description.trim() || "Form submission" }];
      const res = await apiRequest("PUT", "/api/settings/tracking", { conversion_events: updated });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tracking"] });
      setAddEventOpen(false);
      setNewEventName("");
      setNewEventDesc("");
      toast({ title: "Event added", description: `"${newEventName.trim()}" added to conversion events.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add event", description: err.message, variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const res = await apiRequest("PATCH", `/api/settings/tracking/conversion-events/${encodeURIComponent(oldName)}`, { newName });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to rename");
      }
      return res.json();
    },
    onSuccess: (_data, { oldName, newName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tracking"] });
      setRenameEvent(null);
      setRenameValue("");
      toast({ title: "Event renamed", description: `"${oldName}" renamed to "${newName}".` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to rename event", description: err.message, variant: "destructive" });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({
      name,
      entries,
      newName,
    }: {
      name: string;
      entries: Array<{ file: string; section_id: string }>;
      newName: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/settings/tracking/conversion-events/${encodeURIComponent(name)}/reassign`,
        { newName, entries }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to reassign");
      }
      return res.json();
    },
    onSuccess: (_data, { newName, entries }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tracking/conversion-events", usageModalEvent, "usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/form-state/conversion-counts"] });
      setCheckedRows(new Set());
      setReassignOpen(false);
      setReassignTarget("");
      toast({
        title: "Reassigned",
        description: `${entries.length} ${entries.length === 1 ? "entry" : "entries"} moved to "${newName}".`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Reassign failed", description: err.message, variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ name, mergeInto }: { name: string; mergeInto: string }) => {
      const res = await apiRequest("POST", `/api/settings/tracking/conversion-events/${encodeURIComponent(name)}/merge`, { mergeInto });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to merge");
      }
      return res.json();
    },
    onSuccess: (_data, { name, mergeInto }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/tracking"] });
      setDeleteConfirmEvent(null);
      setMergeTarget("");
      toast({ title: "Event merged", description: `"${name}" merged into "${mergeInto}" and removed.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to merge event", description: err.message, variant: "destructive" });
    },
  });

  const routeEvents: TrackingEvent[] = [
    {
      name: "website-route-change",
      trigger: "Client-side navigation (not first load)",
      payload: {
        event: "website-route-change",
        pagePath: "/en/apply",
        pageTitle: "Apply Now – 4Geeks Academy",
      },
    },
  ];

  const visitorContextEvents: TrackingEvent[] = [
    {
      name: "visitor context object",
      trigger: "Once on first load, after geo + user ID resolve",
      payload: {
        user_id: SAMPLE_USER_ID,
        visitor_location_city: "Miami",
        visitor_location_country: "United States",
        visitor_location_slug: "miami-usa",
        visitor_language: "en",
        visitor_latitude: 25.7701,
        visitor_longitude: -80.1928,
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "bootcamp-2024",
      },
    },
  ];

  const conversionEvents: TrackingEvent[] = conversionEventEntries.map((entry) => ({
    name: entry.name,
    trigger: entry.description ?? "Form submission",
    payload: {
      event: entry.name,
      user_id: SAMPLE_USER_ID,
      email_hash: "3f2a1b4c8d9e0f12",
      program: "ai-engineering",
      location: "miami-usa",
      formentry_id: 12345,
      attribution_id: "attr_abc123",
      referral_key: "ref_xyz789",
    },
  }));

  const generalEvents: TrackingEvent[] = TRACKING_EVENTS.map((name) => ({
    name,
    trigger: "Various interactions",
    payload: GENERAL_EVENT_PAYLOADS[name] ?? { event: name, user_id: SAMPLE_USER_ID },
  }));

  const groups: EventGroup[] = [
    {
      title: "Route Events",
      description: "Fired by usePageTracking on every client-side navigation.",
      events: routeEvents,
    },
    {
      title: "Visitor Context",
      description: "Pushed to dataLayer once per page load via setVisitorContext, after the background session worker resolves geo location and user ID.",
      events: visitorContextEvents,
    },
    {
      title: "Conversion Events",
      description: "Fired via trackConversion when a user completes a key action. Configured in settings.yml under tracking.conversion_events.",
      events: conversionEvents,
    },
    {
      title: "General Events",
      description: "Fired via track for page views, clicks, video plays, and other interactions. Defined in TRACKING_EVENTS.",
      events: generalEvents,
    },
  ];

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{group.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                </div>
                {group.title === "Conversion Events" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddEventOpen(true)}
                    data-testid="button-add-conversion-event"
                    className="shrink-0"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    Add event
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid={`table-events-${group.title.toLowerCase().replace(/\s+/g, "-")}`}>
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-2/5">Event / Push</th>
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Trigger</th>
                      <th className="py-2 text-xs font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.events.map((ev) => (
                      <tr key={ev.name} className="border-b last:border-0">
                        <td className="py-2 pr-4 align-middle">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {ev.name}
                            </Badge>
                            {group.title === "Conversion Events" && conversionCounts?.[ev.name] !== undefined && (
                              <Badge
                                variant="outline"
                                className="text-xs tabular-nums text-muted-foreground cursor-pointer"
                                data-testid={`badge-form-count-${ev.name}`}
                                onClick={() => setUsageModalEvent(ev.name)}
                              >
                                {conversionCounts[ev.name]} {conversionCounts[ev.name] === 1 ? "form" : "forms"}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4 align-middle text-muted-foreground text-xs">{ev.trigger}</td>
                        <td className="py-2 align-middle text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedEvent(ev)}
                                  data-testid={`button-show-payload-${ev.name}`}
                                >
                                  <IconBraces className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Show payload</TooltipContent>
                            </Tooltip>
                            {group.title === "Conversion Events" && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => { setRenameEvent(ev.name); setRenameValue(ev.name); }}
                                      data-testid={`button-rename-event-${ev.name}`}
                                    >
                                      <IconPencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Rename event</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => { setDeleteConfirmEvent(ev.name); setMergeTarget(""); }}
                                      data-testid={`button-delete-event-${ev.name}`}
                                    >
                                      <IconTrash className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete event</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!usageModalEvent} onOpenChange={(open) => { if (!open) { setUsageModalEvent(null); setCheckedRows(new Set()); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Forms using
              <code className="font-mono text-sm font-semibold bg-muted px-1.5 py-0.5 rounded">{usageModalEvent}</code>
            </DialogTitle>
            <DialogDescription>
              Check entries to reassign them to a different conversion event.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            {usageModalFetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : usageModalData && usageModalData.usages.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={checkedRows.size === usageModalData.usages.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCheckedRows(new Set(usageModalData.usages.map((_, i) => i)));
                        } else {
                          setCheckedRows(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all-usages"
                    />
                    {checkedRows.size > 0 ? `${checkedRows.size} selected` : "Select all"}
                  </label>
                  {checkedRows.size > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setReassignTarget(""); setReassignOpen(true); }}
                      data-testid="button-reassign-selected"
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                      Reassign
                    </Button>
                  )}
                </div>
                <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                  {usageModalData.usages.map((u, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 py-1.5 px-1 rounded-md cursor-pointer border ${
                        checkedRows.has(i) ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setCheckedRows((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      data-testid={`usage-row-${i}`}
                    >
                      <Checkbox
                        checked={checkedRows.has(i)}
                        onCheckedChange={() => {
                          setCheckedRows((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-usage-${i}`}
                      />
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{u.content_type}/{u.slug}</span>
                        <span className="text-muted-foreground text-xs">({u.locale})</span>
                        {u.section_type && (
                          <span className="text-muted-foreground text-xs">· {u.section_type}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No forms are currently using this event.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignOpen} onOpenChange={(open) => { if (!open) { setReassignOpen(false); setReassignTarget(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign {checkedRows.size} {checkedRows.size === 1 ? "entry" : "entries"}</DialogTitle>
            <DialogDescription>
              Move the selected {checkedRows.size === 1 ? "entry" : "entries"} from <code className="font-mono text-xs">{usageModalEvent}</code> to a different conversion event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="reassign-target-select">Target event</Label>
            <Select value={reassignTarget} onValueChange={setReassignTarget}>
              <SelectTrigger id="reassign-target-select" data-testid="select-reassign-target">
                <SelectValue placeholder="Select target event…" />
              </SelectTrigger>
              <SelectContent>
                {conversionEventEntries
                  .filter((e) => e.name !== usageModalEvent)
                  .map((e) => (
                    <SelectItem key={e.name} value={e.name}>
                      <span className="font-mono text-xs">{e.name}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignOpen(false); setReassignTarget(""); }} data-testid="button-cancel-reassign">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!usageModalEvent || !reassignTarget || !usageModalData) return;
                const selectedEntries = Array.from(checkedRows).map((i) => ({
                  file: usageModalData.usages[i].file,
                  section_id: usageModalData.usages[i].section_id,
                }));
                reassignMutation.mutate({ name: usageModalEvent, entries: selectedEntries, newName: reassignTarget });
              }}
              disabled={!reassignTarget || reassignMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {reassignMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPencil className="h-4 w-4" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              {selectedEvent?.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Every time <code className="font-mono text-xs">{selectedEvent?.name}</code> happens, the following payload gets sent to Google Tag Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md" data-testid="text-payload-json">
            <JsonViewer
              value={selectedEvent ? JSON.stringify(selectedEvent.payload, null, 2) : ""}
              className="[&_.cm-editor]:!max-w-full [&_.cm-scroller]:!overflow-x-auto"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmEvent}
        onOpenChange={(open) => { if (!open) setDeleteConfirmEvent(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete conversion event</DialogTitle>
            <DialogDescription>
              This will remove <code className="font-mono text-xs">{deleteConfirmEvent}</code> from <code className="font-mono text-xs">settings.yml</code>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {usageFetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Checking usage…
              </div>
            ) : usageData && usageData.usages.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">This event is referenced in the following pages:</p>
                <ul className="space-y-1">
                  {usageData.usages.map((u, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5 flex-wrap">
                      <span className="font-medium">{u.content_type}/{u.slug}</span>
                      <span className="text-muted-foreground">({u.locale})</span>
                      {u.section_type && (
                        <span className="text-muted-foreground text-xs">· {u.section_type}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="space-y-1.5 pt-1">
                  <p className="text-sm font-medium">Merge all references into another event before deleting:</p>
                  <Select value={mergeTarget} onValueChange={setMergeTarget}>
                    <SelectTrigger data-testid="select-merge-target">
                      <SelectValue placeholder="Select target event…" />
                    </SelectTrigger>
                    <SelectContent>
                      {conversionEventEntries
                        .filter((e) => e.name !== deleteConfirmEvent)
                        .map((e) => (
                          <SelectItem key={e.name} value={e.name}>
                            <span className="font-mono text-xs">{e.name}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pages are using this event — safe to delete.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteConfirmEvent(null); setMergeTarget(""); }}
              data-testid="button-cancel-delete-event"
            >
              Cancel
            </Button>
            {usageData && usageData.usages.length > 0 ? (
              <Button
                variant="destructive"
                onClick={() => deleteConfirmEvent && mergeMutation.mutate({ name: deleteConfirmEvent, mergeInto: mergeTarget })}
                disabled={!mergeTarget || mergeMutation.isPending}
                data-testid="button-confirm-merge-event"
              >
                {mergeMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                Merge &amp; delete
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => deleteConfirmEvent && deleteEventMutation.mutate(deleteConfirmEvent)}
                disabled={deleteEventMutation.isPending || usageFetching}
                data-testid="button-confirm-delete-event"
              >
                {deleteEventMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameEvent}
        onOpenChange={(open) => { if (!open) { setRenameEvent(null); setRenameValue(""); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename conversion event</DialogTitle>
            <DialogDescription>
              Enter a new name for <code className="font-mono text-xs">{renameEvent}</code>. All references in YAML content files will be updated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="rename-event-input">New event name</Label>
            <Input
              id="rename-event-input"
              placeholder="e.g. scholarship_application"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameEvent && renameValue.trim() && renameValue.trim() !== renameEvent) {
                  renameMutation.mutate({ oldName: renameEvent, newName: renameValue.trim() });
                }
              }}
              data-testid="input-rename-event"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Use snake_case. This becomes the GTM event name.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRenameEvent(null); setRenameValue(""); }}
              data-testid="button-cancel-rename-event"
            >
              Cancel
            </Button>
            <Button
              onClick={() => renameEvent && renameMutation.mutate({ oldName: renameEvent, newName: renameValue.trim() })}
              disabled={!renameValue.trim() || renameValue.trim() === renameEvent || renameMutation.isPending}
              data-testid="button-confirm-rename-event"
            >
              {renameMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPencil className="h-4 w-4" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addEventOpen} onOpenChange={(open) => { if (!open) { setAddEventOpen(false); setNewEventName(""); setNewEventDesc(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add conversion event</DialogTitle>
            <DialogDescription>
              The event name becomes the GTM trigger key. Description is shown in this table for reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-event-name">Event name</Label>
              <Input
                id="new-event-name"
                placeholder="e.g. scholarship_application"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newEventName.trim()) {
                    addEventMutation.mutate({ name: newEventName, description: newEventDesc });
                  }
                }}
                data-testid="input-new-event-name"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Use snake_case. This becomes the GTM event name.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-event-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="new-event-desc"
                placeholder="e.g. Scholarship form submitted"
                value={newEventDesc}
                onChange={(e) => setNewEventDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newEventName.trim()) {
                    addEventMutation.mutate({ name: newEventName, description: newEventDesc });
                  }
                }}
                data-testid="input-new-event-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddEventOpen(false); setNewEventName(""); setNewEventDesc(""); }}
              data-testid="button-cancel-add-event"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addEventMutation.mutate({ name: newEventName, description: newEventDesc })}
              disabled={!newEventName.trim() || addEventMutation.isPending}
              data-testid="button-confirm-add-event"
            >
              {addEventMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPlus className="h-4 w-4" />}
              Add event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TrackingPage() {
  const [location] = useLocation();
  const isSgtm = location === "/private/tracking/sgtm";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/private/diagnostics">
              <Button variant="ghost" size="icon" data-testid="button-back-tracking">
                <IconArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <IconChartBar className="h-6 w-6 text-muted-foreground" />
              <div>
                <h1 className="text-xl font-semibold" data-testid="text-tracking-title">Tracking</h1>
                <p className="text-sm text-muted-foreground">Analytics &amp; event configuration</p>
              </div>
            </div>
          </div>

          <div className="flex items-center rounded-md border overflow-hidden" data-testid="toggle-tracking-view">
            <Link href="/private/tracking">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  !isSgtm
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid="button-view-events"
              >
                <IconChartBar className="h-3.5 w-3.5" />
                Events
              </button>
            </Link>
            <div className="w-px h-6 bg-border" />
            <Link href="/private/tracking/sgtm">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  isSgtm
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid="button-view-sgtm"
              >
                <IconServer className="h-3.5 w-3.5" />
                sGTM
              </button>
            </Link>
          </div>
        </div>

        {isSgtm ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Server-Side Tag Manager</h2>
            <GTMSection />
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tracked Events</h2>
            <p className="text-sm text-muted-foreground">
              All events currently fired into <code className="font-mono text-xs">window.dataLayer</code>. This list is auto-generated from the source constants in <code className="font-mono text-xs">@/lib/tracking</code>.
            </p>
            <EventsSection />
          </div>
        )}
      </div>
    </div>
  );
}
