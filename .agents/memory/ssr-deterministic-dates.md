---
name: SSR-deterministic dates and query-param navigation
description: How to avoid hydration mismatches from date formatting, and how internal nav handles `?` URLs without re-render
---

**Rule 1:** Never format dates with `toLocaleDateString(undefined, ...)` in components that render on the server. The server's Node locale (English/UTC) differs from the visitor's browser locale/timezone, producing different SSR vs client text → hydration mismatch → section flashes/disappears on load.
**How to apply:** Use the page locale from `useSectionContext()` plus `timeZone: "UTC"`, and do "today" / date-filtering math on UTC date-only ISO strings (`new Date().toISOString().slice(0,10)`, lexicographic compare) so server and client output is identical.

**Rule 2:** `useInternalNav().navigate(url)` with a `?`-only URL (querystring) uses `history.replaceState` directly — it does NOT go through wouter and causes no React re-render. Full paths use `setLocation` and do re-render. So updating query params (e.g. before a CTA resolves its `{qs:}` tokens) is safe and render-free.
**Why:** Diagnosed while fixing the enrollment selector load flash — the on-mount `nav.navigate` was suspected of causing re-renders but wasn't; the real culprit was locale-dependent date formatting.

**Gotcha:** When applying query params on CTA click, gate on plain left-click (`!metaKey && !ctrlKey && !shiftKey && !altKey`) so Cmd/Ctrl-click (new tab) doesn't mutate the current tab's URL.
