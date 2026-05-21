/**
 * Unified Icon System (public runtime)
 *
 * Resolves icons for section YAML and shared UI:
 * 1. Custom icons (@/components/custom-icons) — checked first
 * 2. Lucide — per-icon dynamic import via lucide-react/dynamicIconImports (no import *)
 *
 * Usage:
 *   import { getIcon } from "@/lib/icons";
 *   const Icon = getIcon("Rigobot");       // custom
 *   const Icon = getIcon("brain");         // Lucide kebab slug
 *   const Icon = getIcon("IconRocket");    // legacy Tabler-prefixed YAML
 *
 * Full picker catalog (all Lucide slugs): @/lib/icons-picker — editor only.
 * Tech stack logos (Python, React, …): @/lib/tech-brand-icons — not getIcon().
 */
import { createElement, useEffect, useState, type ComponentType } from "react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { getCustomIcon } from "@/components/custom-icons";

/** PascalCase names backed by @/components/custom-icons (also in picker list). */
export const CUSTOM_ICON_NAMES = [
  "Rigobot",
  "RigobotIconTiny",
  "Briefcase",
  "ChecklistVerify",
  "CodeWindow",
  "Contract",
  "FolderCheck",
  "Graduation",
  "GrowthChart",
  "HandsGroup",
  "Handshake",
  "Interview",
  "JobSearch",
  "Matplotlib",
  "Mentor2",
  "Monitor",
  "Optimization",
  "PeopleGroup",
  "Rocket",
  "Security",
  "StairsWithFlag",
  "Target",
];

// Legacy Tabler-style names (Icon-prefixed) in YAML → Lucide export names.
const TABLER_TO_LUCIDE: Record<string, string> = {
  "IconRocket": "Rocket",
  "IconUsers": "Users",
  "Briefcase": "Briefcase",
  "IconShield": "Shield",
  "IconMinus": "Minus",
  "IconHeart": "Heart",
  "IconHome": "Home",
  "IconMap": "Map",
  "IconGlobe": "Globe",
  "IconDownload": "Download",
  "IconShare": "Share2",
  "IconLock": "Lock",
  "IconLockOpen": "LockOpen",
  "IconKey": "Key",
  "IconUserPlus": "UserPlus",
  "IconUserCheck": "UserCheck",
  "IconCreditCard": "CreditCard",
  "IconWallet": "Wallet",
  "IconCash": "Banknote",
  "IconCoin": "Coins",
  "IconCurrency": "DollarSign",
  "IconCurrencyDollar": "DollarSign",
  "IconCurrencyEuro": "Euro",
  "IconReceipt": "Receipt",
  "IconCalculator": "Calculator",
  "IconChart": "BarChart2",
  "IconChartBar": "BarChart2",
  "IconChartLine": "LineChart",
  "IconChartPie": "PieChart",
  "IconTrendingDown": "TrendingDown",
  "IconTarget": "Target",
  "IconAward": "Trophy",
  "IconTrophy": "Trophy",
  "IconMedal": "Medal",
  "IconCertificate": "Award",
  "IconBadge": "Badge",
  "IconBookmark": "Bookmark",
  "IconTags": "Tags",
  "IconFileText": "FileText",
  "IconClipboard": "Clipboard",
  "IconNotes": "NotebookPen",
  "IconArchive": "Archive",
  "IconRotate": "RotateCw",
  "IconRepeat": "Repeat",
  "IconMenu": "Menu",
  "IconSort": "ArrowUpDown",
  "IconZoomIn": "ZoomIn",
  "IconZoomOut": "ZoomOut",
  "IconMaximize": "Maximize2",
  "IconMinimize": "Minimize2",
  "IconFullscreen": "Maximize",
  "IconMessage": "MessageSquare",
  "IconMessages": "MessagesSquare",
  "IconBell": "Bell",
  "IconBellRinging": "BellRing",
  "IconHelp": "HelpCircle",
  "IconBulb": "Lightbulb",
  "IconLightbulb": "Lightbulb",
  "IconFlame": "Flame",
  "IconBolt": "Zap",
  "IconZap": "Zap",
  "IconServer": "Server",
  "IconDevices": "Laptop",
  "IconDeviceTablet": "Tablet",
  "IconHeadphones": "Headphones",
  "IconHeadset": "Headset",
  "IconMicrophone": "Mic",
  "IconVolume": "Volume2",
  "IconVolumeOff": "VolumeX",
  "IconWifi": "Wifi",
  "IconSun": "Sun",
  "IconMoon": "Moon",
  "IconSchool": "School",
  "IconNotebook": "Notebook",
  "IconBackpack": "Backpack",
  "IconGraduationCap": "GraduationCap",
  "IconRobot": "Bot",
  "IconActivity": "Activity",
  "IconPulse": "Activity",
  "IconApi": "Webhook",
  "IconBrandPython": "Code",
  "IconBrandJavascript": "Code",
  "IconBrandTypescript": "Code",
  "IconBrandHtml5": "Code",
  "IconBrandCss3": "Code",
  "IconBrandReact": "Code",
  "IconBrandNextjs": "Code",
  "IconBrandNodejs": "Server",
  "IconBrandNpm": "Package",
  "IconBrandBun": "Package",
  "IconBrandTailwind": "Palette",
  "IconBrandBootstrap": "Code",
  "IconBrandSass": "Code",
  "IconBrandVue": "Code",
  "IconBrandAngular": "Code",
  "IconBrandSvelte": "Code",
  "IconBrandDeno": "Server",
  "IconBrandRust": "Code",
  "IconBrandGolang": "Code",
  "IconBrandSwift": "Code",
  "IconBrandKotlin": "Code",
  "IconBrandPhp": "Code",
  "IconBrandLaravel": "Code",
  "IconBrandDjango": "Code",
  "IconBrandFlask": "Code",
  "IconBrandOpenai": "Sparkles",
  "IconBrandAws": "Cloud",
  "IconBrandAzure": "Cloud",
  "IconBrandGoogleCloud": "Cloud",
  "IconBrandFirebase": "Flame",
  "IconBrandVercel": "Globe",
  "IconBrandCloudflare": "Shield",
  "IconBrandDigitalocean": "Cloud",
  "IconBrandMongodb": "Database",
  "IconBrandMysql": "Database",
  "IconBrandSupabase": "Database",
  "IconBrandPrisma": "Database",
  "IconBrandGitlab": "GitBranch",
  "IconBrandBitbucket": "GitBranch",
  "IconBrandGit": "Git",
  "IconBrandDocker": "Container",
  "IconBrandKubernetes": "Cloud",
  "IconBrandTerraform": "Layers",
  "IconBrandVscode": "Code",
  "IconBrandFigma": "Figma",
  "IconBrandSketch": "PenTool",
  "IconBrandNotion": "FileText",
  "IconBrandTwitter": "Twitter",
  "IconBrandX": "X",
  "IconBrandFacebook": "Facebook",
  "IconBrandInstagram": "Instagram",
  "IconBrandYoutube": "Youtube",
  "IconBrandTiktok": "Video",
  "IconBrandDiscord": "MessageCircle",
  "IconBrandSlack": "MessageSquare",
  "IconBrandZoom": "Video",
  "IconBrandTelegram": "Send",
  "IconBrandWhatsapp": "MessageCircle",
  "IconBrandSpotify": "Music",
  "IconBrandReddit": "MessageSquare",
  "IconBrandGoogle": "Globe",
  "IconBrandApple": "Apple",
  "IconBrandMicrosoft": "Monitor",
  "IconBrandMeta": "Globe",
  "IconBrandAmazon": "ShoppingCart",
  "IconBrandNetflix": "Tv",
  "IconBrandPaypal": "CreditCard",
  "IconBrandStripe": "CreditCard",
  "IconBrandShopify": "ShoppingBag",
  "IconBrandWordpress": "Globe",
  "IconBrandMedium": "FileText",
};

/** Small allowlist of Lucide slugs (kebab-case) for CMS validation / docs — not the full picker list. */
export const CURATED_LUCIDE_ICONS = [
  "circle-dollar-sign",
  "briefcase-business",
  "bot",
  "brain",
  "book-open",
  "check",
  "code-xml",
  "dumbbell",
  "globe",
  "mail",
  "lock-open",
  "lock",
  "trending-up",
  "user",
  "share",
  "puzzle",
  "link",
  "key-round",
  "clock",
  "chart-no-axes-combined",
  "notebook-pen",
] as const;

/** @deprecated Use CURATED_LUCIDE_ICONS */
export const TABLER_ICON_NAMES = CURATED_LUCIDE_ICONS;

/** Lucide slug → React export (e.g. circle-dollar-sign → CircleDollarSign). */
export function kebabToPascal(kebab: string): string {
  return kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/** React export → lucide.dev slug (e.g. CircleDollarSign → circle-dollar-sign). Used by dynamicIconImports keys. */
export function pascalToKebab(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export type IconComponent = ComponentType<{
  className?: string;
  size?: number | string;
  width?: string;
  height?: string;
  color?: string;
  style?: React.CSSProperties;
}>;

const lucideComponentCache = new Map<string, IconComponent>();
const lucideWrapperCache = new Map<string, IconComponent>();

type DynamicIconLoader = () => Promise<{ default: IconComponent }>;

const dynamicImports = dynamicIconImports as Record<string, DynamicIconLoader>;

/**
 * Normalize YAML/picker icon strings for loading.
 * - "circle-dollar-sign" → CircleDollarSign (Lucide)
 * - "Rocket" / "rocket" → Rocket (Lucide or custom if listed)
 * - "IconRocket" → TABLER_TO_LUCIDE lookup, else strip "Icon" prefix
 * - "Rigobot" → custom (isCustom: true)
 */
export function normalizeIconNameForLoad(
  name: string,
): { normalized: string; isCustom: boolean } {
  if (!name) return { normalized: "", isCustom: false };

  const trimmed = name.trim();
  const capitalizedName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  if (CUSTOM_ICON_NAMES.includes(capitalizedName)) {
    return { normalized: capitalizedName, isCustom: true };
  }

  if (trimmed.startsWith("Icon")) {
    const lucideName = TABLER_TO_LUCIDE[trimmed];
    if (lucideName) return { normalized: lucideName, isCustom: false };
    return { normalized: trimmed.slice(4), isCustom: false };
  }

  if (trimmed.includes("-")) {
    return { normalized: kebabToPascal(trimmed), isCustom: false };
  }

  return { normalized: capitalizedName, isCustom: false };
}

/** Load one Lucide icon by PascalCase export name; results are cached. */
export async function loadLucideIcon(pascalName: string): Promise<IconComponent | null> {
  if (!pascalName) return null;

  const cached = lucideComponentCache.get(pascalName);
  if (cached) return cached;

  const slug = pascalToKebab(pascalName);
  const loader = dynamicImports[slug];
  if (!loader) return null;

  const mod = await loader();
  if (!mod.default) return null;

  lucideComponentCache.set(pascalName, mod.default);
  return mod.default;
}

/** Placeholder component that async-loads Lucide when not yet in cache. */
function createLucideIconWrapper(pascalName: string): IconComponent {
  const Wrapped: IconComponent = (props) => {
    const [Icon, setIcon] = useState<IconComponent | null>(
      () => lucideComponentCache.get(pascalName) ?? null,
    );

    useEffect(() => {
      if (Icon) return;
      let cancelled = false;
      void loadLucideIcon(pascalName).then((loaded) => {
        if (!cancelled && loaded) setIcon(() => loaded);
      });
      return () => {
        cancelled = true;
      };
    }, [Icon, pascalName]);

    if (!Icon) return null;
    return createElement(Icon, props);
  };
  Wrapped.displayName = `LucideIcon(${pascalName})`;
  return Wrapped;
}

function getLucideIconComponent(pascalName: string): IconComponent | null {
  const cached = lucideComponentCache.get(pascalName);
  if (cached) return cached;

  let wrapper = lucideWrapperCache.get(pascalName);
  if (!wrapper) {
    wrapper = createLucideIconWrapper(pascalName);
    lucideWrapperCache.set(pascalName, wrapper);
  }
  return wrapper;
}

/**
 * Get an icon component by name. Custom icons first, then Lucide (cached or wrapper).
 *
 * @param name Icon name from YAML (e.g. Rigobot, brain, Rocket, IconRocket)
 */
export function getIcon(name: string): IconComponent | null {
  if (!name) return null;

  const { normalized, isCustom } = normalizeIconNameForLoad(name);

  if (isCustom) {
    const customIcon = getCustomIcon(normalized);
    if (customIcon) return customIcon as IconComponent;
  }

  const lucideIcon = getLucideIconComponent(normalized);
  if (lucideIcon) return lucideIcon;

  const fallbackCustom = getCustomIcon(name);
  if (fallbackCustom) return fallbackCustom as IconComponent;

  return null;
}

/** Whether the name refers to a curated custom icon (PascalCase registry). */
export function isCustomIcon(name: string): boolean {
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  return CUSTOM_ICON_NAMES.includes(capitalizedName);
}

/** True when the name is a curated Lucide slug (kebab-case), not a custom icon. */
export function isCuratedLucideIcon(name: string): boolean {
  return (CURATED_LUCIDE_ICONS as readonly string[]).includes(name);
}
