import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const SETTINGS_PATH = path.join(process.cwd(), "marketing-content", "settings.yml");

interface LocaleEntry {
  code: string;
  label: string;
}

interface I18nSettings {
  default_locale: string;
  supported_locales: LocaleEntry[];
}

interface HomePageSettings {
  type: string;
  slug: string;
}

export interface TagManagerSettings {
  sgtm_enabled: boolean;
  sgtm_server_url: string;
  sgtm_proxy_path: string;
}

export interface OptimizationSettings {
  tagmanager: TagManagerSettings;
}

export interface ConversionEventEntry {
  name: string;
  description?: string;
}

export interface TrackingSettings {
  conversion_events: ConversionEventEntry[];
}

interface SiteSettings {
  i18n: I18nSettings;
  home_page: HomePageSettings;
  optimization: OptimizationSettings;
  tracking: TrackingSettings;
}

let cached: SiteSettings | null = null;

function loadSettings(): SiteSettings {
  if (cached) return cached;

  const defaults: SiteSettings = {
    i18n: {
      default_locale: "en",
      supported_locales: [
        { code: "en", label: "English" },
        { code: "es", label: "Spanish" },
      ],
    },
    home_page: {
      type: "page",
      slug: "home",
    },
    optimization: {
      tagmanager: {
        sgtm_enabled: false,
        sgtm_server_url: "",
        sgtm_proxy_path: "/sgtm/",
      },
    },
    tracking: {
      conversion_events: [],
    },
  };

  if (!fs.existsSync(SETTINGS_PATH)) {
    console.warn("[Settings] settings.yml not found, using defaults");
    cached = defaults;
    return cached;
  }

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = yaml.load(raw) as Record<string, unknown> | null;
    if (!parsed) {
      cached = defaults;
      return cached;
    }

    const i18nRaw = parsed.i18n as Record<string, unknown> | undefined;
    const i18n: I18nSettings = {
      default_locale: (i18nRaw?.default_locale as string) || defaults.i18n.default_locale,
      supported_locales: Array.isArray(i18nRaw?.supported_locales)
        ? (i18nRaw.supported_locales as LocaleEntry[]).filter(
            (e) => typeof e.code === "string" && typeof e.label === "string"
          )
        : defaults.i18n.supported_locales,
    };

    const homePageRaw = parsed.home_page as Record<string, unknown> | undefined;
    const home_page: HomePageSettings = {
      type: (homePageRaw?.type as string) || defaults.home_page.type,
      slug: (homePageRaw?.slug as string) || defaults.home_page.slug,
    };

    const optRaw = parsed.optimization as Record<string, unknown> | undefined;
    const tmRaw = optRaw?.tagmanager as Record<string, unknown> | undefined;
    const defTm = defaults.optimization.tagmanager;
    const optimization: OptimizationSettings = {
      tagmanager: {
        sgtm_enabled: typeof tmRaw?.sgtm_enabled === "boolean" ? tmRaw.sgtm_enabled : defTm.sgtm_enabled,
        sgtm_server_url: (tmRaw?.sgtm_server_url as string) || defTm.sgtm_server_url,
        sgtm_proxy_path: (tmRaw?.sgtm_proxy_path as string) || defTm.sgtm_proxy_path,
      },
    };

    const trackingRaw = parsed.tracking as Record<string, unknown> | undefined;
    const conversionEventsRaw = trackingRaw?.conversion_events;
    const tracking: TrackingSettings = {
      conversion_events: Array.isArray(conversionEventsRaw)
        ? (conversionEventsRaw as Array<Record<string, unknown>>)
            .filter((e) => e && typeof e.name === "string")
            .map((e) => ({
              name: e.name as string,
              description: typeof e.description === "string" ? e.description : undefined,
            }))
        : defaults.tracking.conversion_events,
    };

    cached = { ...defaults, i18n, home_page, optimization, tracking };
    console.log(
      `[Settings] Loaded: ${i18n.supported_locales.length} locale(s), default="${i18n.default_locale}", home_page="${home_page.slug}", conversion_events=${tracking.conversion_events.length}`
    );
    return cached;
  } catch (err) {
    console.error("[Settings] Failed to parse settings.yml, using defaults:", err);
    cached = defaults;
    return cached;
  }
}

export function getSettings(): SiteSettings {
  return loadSettings();
}

export function getSupportedLocales(): string[] {
  return loadSettings().i18n.supported_locales.map((l) => l.code);
}

export function getDefaultLocale(): string {
  return loadSettings().i18n.default_locale;
}

export function getLocaleLabel(code: string): string | undefined {
  const entry = loadSettings().i18n.supported_locales.find((l) => l.code === code);
  return entry?.label;
}

export function getLocaleEntries(): LocaleEntry[] {
  return loadSettings().i18n.supported_locales;
}

export function getHomePage(): HomePageSettings {
  return loadSettings().home_page;
}

export function normalizeLocale(locale: string | undefined | null): string {
  const defaultLocale = getDefaultLocale();
  if (!locale) return defaultLocale;

  const lower = locale.toLowerCase().replace("_", "-");
  const supported = getSupportedLocales().map(c => c.toLowerCase());

  // Exact match first (handles both "es" and "es-mx" if explicitly in supported_locales)
  if (supported.includes(lower)) return lower;

  // If it's a regional locale (xx-xx), check if the base language is supported.
  // When the base is supported, preserve the full regional code so content loaders
  // can find es-mx.yml instead of falling back to es.yml.
  const dashIdx = lower.indexOf("-");
  if (dashIdx > 0) {
    const base = lower.slice(0, dashIdx);
    if (supported.includes(base)) return lower;
  }

  // Fall back to the base language alone
  const base = lower.split("-")[0];
  if (supported.includes(base)) return base;

  return defaultLocale;
}

export function updateLocaleSettings(input: {
  default_locale: string;
  supported_locales: LocaleEntry[];
}): void {
  const { default_locale, supported_locales } = input;

  if (!Array.isArray(supported_locales) || supported_locales.length === 0) {
    throw new Error("At least one supported locale is required");
  }

  for (const entry of supported_locales) {
    if (typeof entry.code !== "string" || !/^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(entry.code)) {
      throw new Error(`Invalid locale code: "${entry.code}" — must be 2-3 lowercase letters, optionally followed by a region tag (e.g. es-MX)`);
    }
    if (typeof entry.label !== "string" || !entry.label.trim()) {
      throw new Error(`Locale "${entry.code}" must have a non-empty label`);
    }
  }

  if (!supported_locales.some((l) => l.code === default_locale)) {
    throw new Error(`Default locale "${default_locale}" must be in the supported locales list`);
  }

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      existing = (yaml.load(raw) as Record<string, unknown>) || {};
    } catch {}
  }

  existing.i18n = {
    default_locale,
    supported_locales: supported_locales.map((l) => ({
      code: l.code,
      label: l.label.trim(),
    })),
  };

  const output = yaml.dump(existing, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(SETTINGS_PATH, output, "utf-8");
  resetSettings();
  console.log(
    `[Settings] Updated: ${supported_locales.length} locale(s), default="${default_locale}"`
  );
}

export function resetSettings(): void {
  cached = null;
}

export function getOptimizationSettings(): OptimizationSettings {
  return loadSettings().optimization;
}

export function getTrackingSettings(): TrackingSettings {
  return loadSettings().tracking;
}

export function updateTrackingSettings(input: { conversion_events: Array<{ name: string; description?: string }> }): void {
  if (!Array.isArray(input.conversion_events)) {
    throw new Error("conversion_events must be an array");
  }

  for (const entry of input.conversion_events) {
    if (typeof entry.name !== "string" || !entry.name.trim()) {
      throw new Error("Each conversion event must have a non-empty name");
    }
    if (!/^[a-z][a-z0-9_]*$/.test(entry.name.trim())) {
      throw new Error(`Invalid conversion event name: "${entry.name}" — use lowercase letters, digits, and underscores only`);
    }
  }

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      existing = (yaml.load(raw) as Record<string, unknown>) || {};
    } catch {}
  }

  existing.tracking = {
    conversion_events: input.conversion_events.map((e) => ({
      name: e.name.trim(),
      ...(e.description ? { description: e.description } : {}),
    })),
  };

  const output = yaml.dump(existing, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(SETTINGS_PATH, output, "utf-8");
  resetSettings();
  console.log(`[Settings] Updated tracking.conversion_events: ${input.conversion_events.length} event(s)`);
}

export function updateOptimizationSettings(input: { tagmanager: Partial<TagManagerSettings> }): void {
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      existing = (yaml.load(raw) as Record<string, unknown>) || {};
    } catch {}
  }

  const current = loadSettings().optimization.tagmanager;
  const tm = input.tagmanager ?? {};
  const updated: TagManagerSettings = {
    sgtm_enabled: typeof tm.sgtm_enabled === "boolean" ? tm.sgtm_enabled : current.sgtm_enabled,
    sgtm_server_url: typeof tm.sgtm_server_url === "string" ? tm.sgtm_server_url : current.sgtm_server_url,
    sgtm_proxy_path: typeof tm.sgtm_proxy_path === "string" ? tm.sgtm_proxy_path : current.sgtm_proxy_path,
  };

  // Validate proxy path — must start with /, be more than just /, and contain a meaningful segment
  const pPath = updated.sgtm_proxy_path;
  if (!pPath.startsWith("/")) {
    throw new Error("Proxy path must start with /");
  }
  // Reject bare root path which would claim all routes
  const normalizedForValidation = pPath.replace(/\/$/, "") || "/";
  if (normalizedForValidation === "/" || normalizedForValidation === "") {
    throw new Error("Proxy path must not be / — use a specific path like /sgtm/");
  }
  // Ensure no path traversal or unsafe characters
  if (/[?#\s]/.test(pPath)) {
    throw new Error("Proxy path must not contain ?, #, or whitespace");
  }

  existing.optimization = {
    tagmanager: {
      sgtm_enabled: updated.sgtm_enabled,
      sgtm_server_url: updated.sgtm_server_url,
      sgtm_proxy_path: updated.sgtm_proxy_path,
    },
  };

  const output = yaml.dump(existing, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(SETTINGS_PATH, output, "utf-8");
  resetSettings();
  console.log(`[Settings] Updated optimization.tagmanager: enabled=${updated.sgtm_enabled}, url="${updated.sgtm_server_url}", path="${updated.sgtm_proxy_path}"`);
}
