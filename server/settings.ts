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

interface SiteSettings {
  i18n: I18nSettings;
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

    cached = { ...defaults, i18n };
    console.log(
      `[Settings] Loaded: ${i18n.supported_locales.length} locale(s), default="${i18n.default_locale}"`
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

export function resetSettings(): void {
  cached = null;
}
