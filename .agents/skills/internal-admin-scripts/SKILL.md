# Internal Admin Scripts

Standards and conventions for admin scripts in `scripts/admin/`. Load this skill whenever creating or modifying an admin script.

## Location & Naming

All admin scripts live in `scripts/admin/<kebab-case-name>.ts`.

## Dual-Mode Pattern

Every script exports a **named async function** with typed options and a typed result, AND supports **direct CLI execution** via a bottom guard block.

Use the ESM-safe guard — never use `require.main`:

```ts
import { fileURLToPath } from "url";

export async function myScript(options: MyOptions): Promise<MyResult> {
  // ... core logic
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  // CLI argument parsing and execution here
}
```

The exported function is the primary API surface. The CLI block at the bottom is a thin wrapper that parses arguments and calls the exported function.

## Initialization

- **CLI mode**: Must call `media.initFromEnv()` before any media/registry operations.
- **Module mode**: Does NOT call `initFromEnv()` — the caller (e.g., an API route or another script) is responsible for initialization.

```ts
import { media } from "../../server/media";

// In the CLI guard:
if (process.argv[1] === __filename) {
  media.initFromEnv();
  myScript({ ... }).then(result => { ... });
}
```

## Dry-Run Support

All scripts that mutate data must accept a `dryRun?: boolean` option. In dry-run mode the function returns results describing what *would* happen without making any changes.

```ts
export interface MyOptions {
  dryRun?: boolean;
  // ... other options
}
```

## Result Shape

Return a structured result object:

```ts
{
  message: string;
  results: Array<{
    id: string;
    src?: string;
    status: string;     // e.g. "removed", "would-remove", "migrated", "skipped", "error"
    reason?: string;    // present when status is "skipped" or "error"
  }>;
  // count fields as appropriate, e.g.:
  removedCount: number;
  skippedCount: number;
}
```

Never throw for per-item failures — capture them as `status: "error"` with `reason` in the results array.

Scripts may extend the base result item with script-specific fields beyond `id`, `src?`, `status`, and `reason?`. For example, migration scripts use `oldSrc` and `newSrc` instead of a single `src`.

## Error Handling Tiers

### Pre-flight errors
Registry unreadable, missing config, bad arguments — throw or return early with a clear `message` before processing begins.

```ts
const registry = mediaGallery.getRegistry();
if (!registry) {
  return { message: "Failed to load registry", removedCount: 0, skippedCount: 0, results: [] };
}
```

### Per-item errors
File delete failure, single-item migration error — catch, record as `status: "error"` with `reason`, and continue processing the remaining items.

```ts
try {
  await mediaGallery.unregister(id);
  results.push({ id, src, status: "removed" });
} catch (err: any) {
  results.push({ id, src, status: "error", reason: err.message || "unknown" });
  errorCount++;
}
```

### Fatal mid-loop errors
Catch at the loop level, record remaining items as errored, return partial results with a clear `message`.

## CLI Output Format

Print per-item lines with `[OK]`, `[SKIP]`, or `[ERR]` prefixes, then a summary line.

```
  [OK]  some-image: /path/to/image.png — removed
  [SKIP] other-image: /path/to/other.png — skipped: in use
  [ERR] broken-image: /path/to/broken.png — error: file not found

Done. 5 removed, 2 skipped, 1 failed (8 total)
```

Exit with code 1 on fatal errors (via `.catch()` on the main promise).

## CLI Argument Conventions

- Positional args for required inputs
- `--dry-run` flag for dry-run mode
- `--<key>=<value>` for optional named parameters
- Print usage and exit 1 if required args are missing

```ts
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const positional = args.filter(a => !a.startsWith("--"));
  const flags = new Set(args.filter(a => a.startsWith("--")));
  const dryRun = flags.has("--dry-run");
  const prefix = args.find(a => a.startsWith("--prefix="))?.split("=")[1];

  if (!positional[0] || !positional[1]) {
    console.log("Usage: npx tsx scripts/admin/my-script.ts <arg1> <arg2> [--dry-run]");
    process.exit(1);
  }

  media.initFromEnv();
  myScript({ ... }).then(result => { ... }).catch(err => {
    console.error("Failed:", err);
    process.exit(1);
  });
}
```

## API Route Exposure

If a script needs to be callable from the UI, add a route in `server/routes.ts`:

```
POST /api/image-registry/scripts/<script-name>
```

The route validates the request body and returns the result as JSON. Use dynamic import to avoid loading the script at server startup:

```ts
app.post("/api/image-registry/scripts/remove-unused", async (req, res) => {
  try {
    const { dryRun } = req.body as { dryRun?: boolean };
    const { removeUnusedImages } = await import("../scripts/admin/remove-unused-images");
    const result = await removeUnusedImages({ dryRun: dryRun ?? false });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Remove unused images failed" });
  }
});
```

## Streaming / Progress Pattern

For long-running operations on large datasets, the exported function should accept an optional `onProgress` callback:

```ts
export interface ProgressEvent {
  total: number;
  processed: number;
  batch: Array<{ id: string; src?: string; status: string; reason?: string }>;
  done?: boolean;
  summary?: { message: string; [key: string]: unknown };
  fatalError?: boolean;
  message?: string;
}

export async function myLongScript(
  options: MyOptions & { onProgress?: (event: ProgressEvent) => void }
): Promise<MyResult> {
  const items = getItemsToProcess();
  const BATCH_SIZE = 10;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = [];
    for (const item of batch) {
      // process item...
      batchResults.push({ id: item.id, status: "ok" });
    }
    options.onProgress?.({
      total: items.length,
      processed: i + batch.length,
      batch: batchResults,
    });
  }

  options.onProgress?.({
    total: items.length,
    processed: items.length,
    batch: [],
    done: true,
    summary: { message: "Complete" },
  });
}
```

Expose a separate `/stream` route variant using chunked transfer encoding (newline-delimited JSON):

```ts
app.post("/api/image-registry/scripts/my-script/stream", async (req, res) => {
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    await myLongScript({
      ...req.body,
      onProgress: (event) => {
        res.write(JSON.stringify(event) + "\n");
      },
    });
  } catch (error: any) {
    res.write(JSON.stringify({ fatalError: true, message: error.message }) + "\n");
  }

  res.end();
});
```

On fatal mid-stream error, write `{ fatalError: true, message, processed, total }` before closing the response.

## Reference Examples

- **`scripts/admin/remove-unused-images.ts`** — Dual-mode, dry-run support, API-exposed via `POST /api/image-registry/scripts/remove-unused`. Clean example of the full pattern.
- **`scripts/admin/migrate-to-cloud.ts`** — Dual-mode, dry-run support, positional args for `<from>` and `<to>` providers, `--prefix=<path>` optional parameter. Demonstrates CLI argument parsing with validation.
