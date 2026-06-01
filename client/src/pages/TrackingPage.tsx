import { useState, useEffect } from "react";
import {
  IconArrowLeft,
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconInfoCircle,
  IconLoader2,
  IconPlugConnected,
  IconServer,
  IconSettingsCog,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiFetch, queryClient } from "@/lib/queryClient";
import { CONVERSION_NAMES, TRACKING_EVENTS } from "@/lib/tracking";

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

interface EventGroup {
  title: string;
  description: string;
  events: { name: string; trigger: string; fields: string }[];
}

function EventsSection() {
  const routeEvents: EventGroup["events"] = [
    {
      name: "website-route-change",
      trigger: "Every client-side navigation",
      fields: "pagePath, pageTitle",
    },
  ];

  const visitorContextEvents: EventGroup["events"] = [
    {
      name: "visitor context object",
      trigger: "Session bootstrap",
      fields: "user_id, visitor_location_city, visitor_location_country, visitor_location_slug, UTM params",
    },
  ];

  const conversionEvents: EventGroup["events"] = CONVERSION_NAMES.map((name) => ({
    name,
    trigger: "Form submission",
    fields: "user_id, email_hash, program, location, formentry_id, attribution_id, referral_key",
  }));

  const generalEvents: EventGroup["events"] = TRACKING_EVENTS.map((name) => ({
    name,
    trigger: "Various interactions",
    fields: "user_id, event-specific payload",
  }));

  const groups: EventGroup[] = [
    {
      title: "Route Events",
      description: "Fired by usePageTracking on every client-side navigation.",
      events: routeEvents,
    },
    {
      title: "Visitor Context",
      description: "Pushed to dataLayer once during session bootstrap via setVisitorContext.",
      events: visitorContextEvents,
    },
    {
      title: "Conversion Events",
      description: "Fired via trackConversion when a user completes a key action. Validated against CONVERSION_NAMES.",
      events: conversionEvents,
    },
    {
      title: "General Events",
      description: "Fired via track for page views, clicks, video plays, and other interactions. Defined in TRACKING_EVENTS.",
      events: generalEvents,
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid={`table-events-${group.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-1/3">Event / Push</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-1/4">Trigger</th>
                    <th className="text-left py-2 text-xs font-medium text-muted-foreground">Key fields</th>
                  </tr>
                </thead>
                <tbody>
                  {group.events.map((ev) => (
                    <tr key={ev.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 align-top">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {ev.name}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 align-top text-muted-foreground text-xs">{ev.trigger}</td>
                      <td className="py-2 align-top text-muted-foreground text-xs font-mono">{ev.fields}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
