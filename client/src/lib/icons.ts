/**
 * Unified Icon System
 * 
 * This utility provides a centralized way to render icons from:
 * 1. Custom icons (Rigobot, etc.) - checked first
 * 2. Lucide icons - fallback
 * 
 * Usage:
 *   import { getIcon, getAllIconNames } from "@/lib/icons";
import { Briefcase } from "lucide-react";
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

// Curated list of Lucide icon names for the picker
export const TABLER_ICON_NAMES = [
  // General UI icons
  "Rocket", "Users", "Briefcase", "Shield", "Check",
  "X", "Plus", "Minus", "Star", "Heart",
  "Home", "Settings", "Search", "Mail", "Phone",
  "Calendar", "Clock", "Map", "MapPin", "Globe",
  "Send", "Download", "Upload", "Share2",
  "Link", "ExternalLink", "Eye", "EyeOff", "Lock",
  "LockOpen", "Key", "User", "UserPlus", "UserCheck",
  "CreditCard", "Wallet", "Banknote", "Coins", "DollarSign",
  "Euro", "Receipt", "Calculator",
  "BarChart2", "LineChart", "PieChart", "TrendingUp", "TrendingDown",
  "Target", "Trophy", "Medal", "Award",
  "Badge", "Flag", "Bookmark", "Tag", "Tags",
  "Folder", "File", "FileText", "Clipboard", "NotebookPen",
  "Pencil", "Trash2", "Archive", "RefreshCw",
  "RotateCw", "Repeat", "ArrowUp", "ArrowDown", "ArrowLeft",
  "ArrowRight", "ChevronUp", "ChevronDown", "ChevronLeft", "ChevronRight",
  "Menu", "MoreVertical", "MoreHorizontal", "Filter", "ArrowUpDown",
  "ZoomIn", "ZoomOut", "Maximize2", "Minimize2", "Maximize",
  "Code", "Terminal",
  "MessageSquare", "MessageCircle", "MessagesSquare", "Bell", "BellRing",
  "AlertCircle", "AlertTriangle", "Info", "HelpCircle",
  "Lightbulb", "Flame", "Zap",
  "Cloud", "CloudDownload", "CloudUpload", "Database", "Server",
  "Cpu", "Laptop", "Monitor", "Smartphone", "Tablet",
  "Headphones", "Mic", "Volume2", "VolumeX",
  "Wifi", "Sun", "Moon",
  "School", "Book", "BookOpen", "Notebook", "Backpack",
  "GraduationCap", "Bot", "Brain", "Activity",
  "Webhook", "Sparkles", "Wand2",
  // Brand-like icons from Lucide
  "Github", "Linkedin", "Twitter", "Youtube", "Facebook",
  "Instagram", "Figma", "GitBranch", "Package",
];

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
 * - "rocket" -> "Rocket" (Lucide PascalCase)
 * - "Rocket" -> "Rocket" (already correct for Lucide)
 * - "IconRocket" -> looks up in TABLER_TO_LUCIDE map -> "Rocket"
 * - "Rigobot" -> "Rigobot" (custom icon)
 */
function normalizeIconName(name: string): { normalized: string; isCustom: boolean } {
  if (!name) return { normalized: "", isCustom: false };
  
  // Check if it's a known custom icon first
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  if (CUSTOM_ICON_NAMES.includes(capitalizedName)) {
    return { normalized: capitalizedName, isCustom: true };
  }
  
  // Handle old Tabler-style "Icon" prefixed names
  if (name.startsWith("Icon")) {
    const lucideName = TABLER_TO_LUCIDE[name];
    if (lucideName) return { normalized: lucideName, isCustom: false };
    // Try stripping the "Icon" prefix directly
    return { normalized: name.slice(4), isCustom: false };
  }
  
  // Capitalize for Lucide (PascalCase)
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

/**
 * Get all Lucide icon names dynamically from the library.
 */
export function getAllTablerIconNames(): string[] {
  return Object.keys(LucideIcons).filter(
    (key) => typeof (LucideIcons as Record<string, unknown>)[key] === "function" && /^[A-Z]/.test(key)
  );
}

/**
 * Get all available icon names for the picker.
 * Returns custom icons first, then Lucide icons.
 */
export function getAllIconNames(): string[] {
  return [...CUSTOM_ICON_NAMES, ...getAllTablerIconNames()];
}

/**
 * Get display name for an icon
 */
export function getIconDisplayName(name: string): string {
  if (name.startsWith("Icon")) {
    return name.slice(4);
  }
  return name;
}

/**
 * Check if an icon name is a custom icon
 */
export function isCustomIcon(name: string): boolean {
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  return CUSTOM_ICON_NAMES.includes(capitalizedName);
}
