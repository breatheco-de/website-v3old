/**
 * Unified Icon System
 * 
 * This utility provides a centralized way to render icons from:
 * 1. Custom icons (Rigobot, etc.) - checked first
 * 2. Lucide icons - fallback
 * 
 * Usage:
 *   import { getIcon, getAllIconNames } from "@/lib/icons";
 *   const IconComponent = getIcon("Rigobot"); // Custom icon
 *   const IconComponent = getIcon("Rocket");  // Lucide icon
 */

import * as LucideIcons from "lucide-react";
import { getCustomIcon } from "@/components/custom-icons";

// Custom icon names available (from custom-icons/index.ts)
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

// Mapping from old Tabler-style names (Icon-prefixed) to Lucide names
// Used for backward compatibility when YAML data contains Tabler-style icon names
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

/** Curated Lucide slugs (kebab-case) shown in the icon picker. */
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

/** @deprecated Use CURATED_LUCIDE_ICONS — kept for any external imports. */
export const TABLER_ICON_NAMES = CURATED_LUCIDE_ICONS;

/** Convert lucide.dev slug to React export name (e.g. circle-dollar-sign → CircleDollarSign). */
export function kebabToPascal(kebab: string): string {
  return kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/** Convert React export name to lucide.dev slug (e.g. CircleDollarSign → circle-dollar-sign). */
export function pascalToKebab(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// Type for icon components
type IconComponent = React.ComponentType<{
  className?: string;
  size?: number | string;
  width?: string;
  height?: string;
  color?: string;
  style?: React.CSSProperties;
}>;

/**
 * Normalize icon name to handle various formats:
 * - "circle-dollar-sign" -> "CircleDollarSign" (Lucide kebab slug)
 * - "Rocket" / "rocket" -> "Rocket" (Lucide PascalCase)
 * - "IconRocket" -> looks up in TABLER_TO_LUCIDE map -> "Rocket"
 * - "Rigobot" -> "Rigobot" (custom icon)
 */
function normalizeIconName(name: string): { normalized: string; isCustom: boolean } {
  if (!name) return { normalized: "", isCustom: false };

  const trimmed = name.trim();

  // Check if it's a known custom icon first (PascalCase registry)
  const capitalizedName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (CUSTOM_ICON_NAMES.includes(capitalizedName)) {
    return { normalized: capitalizedName, isCustom: true };
  }

  // Handle old Tabler-style "Icon" prefixed names
  if (trimmed.startsWith("Icon")) {
    const lucideName = TABLER_TO_LUCIDE[trimmed];
    if (lucideName) return { normalized: lucideName, isCustom: false };
    return { normalized: trimmed.slice(4), isCustom: false };
  }

  // Kebab-case lucide slug (picker + menus)
  if (trimmed.includes("-")) {
    return { normalized: kebabToPascal(trimmed), isCustom: false };
  }

  // Simple PascalCase / lowercase (TrendingUp, bot, mail)
  return { normalized: capitalizedName, isCustom: false };
}

/**
 * Get an icon component by name.
 * Checks custom icons first, then falls back to Lucide.
 * 
 * @param name Icon name (e.g., "Rigobot", "rocket", "Rocket", "IconRocket")
 * @returns Icon component or null if not found
 */
export function getIcon(name: string): IconComponent | null {
  if (!name) return null;
  
  const { normalized, isCustom } = normalizeIconName(name);
  
  if (isCustom) {
    const customIcon = getCustomIcon(normalized);
    if (customIcon) return customIcon as IconComponent;
  }
  
  // Try Lucide icon
  const lucideIcon = (LucideIcons as unknown as Record<string, IconComponent>)[normalized];
  if (lucideIcon) return lucideIcon;
  
  // Last resort: try custom icon even for unknown names
  const fallbackCustom = getCustomIcon(name);
  if (fallbackCustom) return fallbackCustom as IconComponent;
  
  return null;
}

const LUCIDE_EXPORT_SKIP = new Set(["Icon", "icons", "createLucideIcon"]);

function isLucideIconExport(value: unknown): boolean {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value)
  );
}

let cachedLucideIconSlugs: string[] | null = null;

/**
 * All Lucide icon slugs for the picker (kebab-case), excluding alias exports (*Icon, Lucide*).
 */
export function getAllTablerIconNames(): string[] {
  if (cachedLucideIconSlugs) return cachedLucideIconSlugs;

  cachedLucideIconSlugs = Object.keys(LucideIcons)
    .filter((key) => {
      if (!/^[A-Z]/.test(key)) return false;
      if (key.endsWith("Icon")) return false;
      if (key.startsWith("Lucide")) return false;
      if (LUCIDE_EXPORT_SKIP.has(key)) return false;
      return isLucideIconExport((LucideIcons as Record<string, unknown>)[key]);
    })
    .map((key) => pascalToKebab(key))
    .sort();

  return cachedLucideIconSlugs;
}

/**
 * Get all available icon names for the picker.
 * Returns custom icons first (PascalCase), then all Lucide slugs (kebab-case).
 */
export function getAllIconNames(): string[] {
  return [...CUSTOM_ICON_NAMES, ...getAllTablerIconNames()];
}

/**
 * Get display name for an icon (human-readable slug or legacy Tabler label).
 */
export function getIconDisplayName(name: string): string {
  if (name.startsWith("Icon")) {
    return name.slice(4);
  }
  if (name.includes("-")) {
    return name;
  }
  return pascalToKebab(name);
}

/**
 * Whether a picker/search term matches an icon entry (kebab slug or Pascal custom).
 */
export function iconMatchesSearch(iconName: string, searchLower: string): boolean {
  if (!searchLower) return true;
  const slug = iconName.includes("-") ? iconName : pascalToKebab(iconName);
  const pascal = iconName.includes("-") ? kebabToPascal(iconName) : iconName;
  return (
    iconName.toLowerCase().includes(searchLower) ||
    slug.includes(searchLower) ||
    pascal.toLowerCase().includes(searchLower)
  );
}

/**
 * Check if an icon name is a custom icon
 */
export function isCustomIcon(name: string): boolean {
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  return CUSTOM_ICON_NAMES.includes(capitalizedName);
}

/**
 * True when the name refers to a curated Lucide slug (not a custom icon).
 */
export function isCuratedLucideIcon(name: string): boolean {
  return (CURATED_LUCIDE_ICONS as readonly string[]).includes(name);
}
