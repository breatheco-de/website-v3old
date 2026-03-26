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

interface SiteSettings {
  i18n: I18nSettings;
  home_page: HomePageSettings;
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

    cached = { ...defaults, i18n, home_page };
    console.log(
      `[Settings] Loaded: ${i18n.supported_locales.length} locale(s), default="${i18n.default_locale}", home_page="${home_page.slug}"`
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

  const normalized = locale.toLowerCase().split("-")[0].split("_")[0];
  const supported = getSupportedLocales();
  if (supported.includes(normalized)) return normalized;
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
    if (typeof entry.code !== "string" || !/^[a-z]{2,3}$/.test(entry.code)) {
      throw new Error(`Invalid locale code: "${entry.code}" — must be 2-3 lowercase letters`);
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
