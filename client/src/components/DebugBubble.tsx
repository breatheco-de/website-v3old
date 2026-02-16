import { useState, useEffect, lazy, Suspense, useMemo, useCallback, useRef } from "react";
import { subscribeToContentUpdates } from "@/lib/contentEvents";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useInternalNav } from "@/hooks/useInternalNav";
import { useSession } from "@/contexts/SessionContext";
import { buildContentUrl, getFolderFromSlug, type ContentType } from "@shared/slugMappings";
import {
  IconBug,
  IconMap,
  IconMapPin,
  IconPencil,
  IconPencilOff,
  IconComponents,
  IconLanguage,
  IconRoute,
  IconSun,
  IconMoon,
  IconX,
  IconAlertTriangle,
  IconLayoutColumns,
  IconRocket,
  IconBrain,
  IconUsers,
  IconCertificate,
  IconQuestionMark,
  IconArrowRight,
  IconLayoutBottombar,
  IconArrowLeft,
  IconChevronRight,
  IconChevronDown,
  IconRefresh,
  IconCheck,
  IconSearch,
  IconExternalLink,
  IconMessage,
  IconBuildingSkyscraper,
  IconCreditCard,
  IconFolderCode,
  IconFolder,
  IconBook,
  IconSparkles,
  IconChartBar,
  IconTable,
  IconFlask,
  IconStethoscope,
  IconPlus,
  IconUsersGroup,
  IconBrandGithub,
  IconCloudDownload,
  IconDeviceMobile,
  IconDeviceDesktop,
  IconDatabase,
  IconCopy,
  IconArrowUp,
  IconArrowDown,
  IconFile,
  IconTrash,
  IconDeviceFloppy,
  IconMenu2,
  IconDotsVertical,
  IconDownload,
  IconPhoto,
  IconBrowserPlus,
} from "@tabler/icons-react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { useSyncOptional } from "@/contexts/SyncContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useDebugAuth, getDebugToken, getDebugUserName } from "@/hooks/useDebugAuth";
import { locations } from "@/lib/locations";
import { normalizeLocale } from "@shared/locale";
import { LocaleFlag } from "@/components/DebugBubble/components/LocaleFlag";
import { useQuery } from "@tanstack/react-query";

const componentIconMap: Record<string, typeof IconComponents> = {
  hero: IconRocket,
  two_column: IconLayoutColumns,
  two_column_accordion_card: IconLayoutColumns,
  comparison_table: IconTable,
  features_grid: IconLayoutColumns,
  features_quad: IconLayoutColumns,
  numbered_steps: IconArrowRight,
  ai_learning: IconBrain,
  mentorship: IconUsers,
  community_support: IconUsers,
  pricing: IconCreditCard,
  projects: IconFolderCode,
  project_showcase: IconChartBar,
  syllabus: IconBook,
  why_learn_ai: IconSparkles,
  certificate: IconCertificate,
  whos_hiring: IconBuildingSkyscraper,
  testimonials: IconMessage,
  testimonials_slide: IconMessage,
  testimonials_grid: IconMessage,
  faq: IconQuestionMark,
  cta_banner: IconArrowRight,
  footer: IconLayoutBottombar,
  award_badges: IconCertificate,
  awards_marquee: IconCertificate,
  horizontal_bars: IconChartBar,
  vertical_bars_cards: IconChartBar,
  graduates_stats: IconUsersGroup,
  image_row: IconPhoto,
  lead_form: IconFile,
  apply_form: IconFile,
  banner: IconRocket,
  article: IconBook,
  press_mentions: IconMessage,
  split_cards: IconLayoutColumns,
  course_selector: IconBook,
  sticky_cta: IconArrowRight,
  bento_cards: IconLayoutColumns,
  value_proof_panel: IconChartBar,
  partnership_carousel: IconBuildingSkyscraper,
  human_and_ai_duo: IconBrain,
  bullet_tabs_showcase: IconSparkles,
  geeks_vs_others_comparison: IconTable,
};

type MenuView = "main" | "components" | "sitemap" | "experiments" | "menus";

const STORAGE_KEY = "debug-bubble-menu-view";

interface SitemapUrl {
  loc: string;
  label: string;
}

interface RedirectItem {
  from: string;
  to: string;
  type: string;
}

interface ExperimentVariant {
  slug: string;
  version: number;
  allocation: number;
}

interface ExperimentConfig {
  slug: string;
  status: "planned" | "active" | "paused" | "winner" | "archived";
  description?: string;
  variants: ExperimentVariant[];
  targeting?: Record<string, unknown>;
  max_visitors?: number;
  stats?: Record<string, number>;
}

interface ExperimentsResponse {
  experiments: ExperimentConfig[];
  hasExperimentsFile: boolean;
  filePath: string;
}

interface GitHubSyncStatus {
  configured: boolean;
  syncEnabled: boolean;
  localCommit: string | null;
  remoteCommit: string | null;
  status: 'in-sync' | 'behind' | 'ahead' | 'diverged' | 'unknown' | 'not-configured' | 'invalid-credentials';
  behindBy?: number;
  aheadBy?: number;
  repoUrl?: string;
  branch?: string;
}

interface PendingChange {
  file: string;
  status: 'modified' | 'added' | 'deleted';
  source: 'local' | 'incoming' | 'conflict';
  contentType: string;
  slug: string;
  author?: string;
  date?: string;
  commitSha?: string;
}

interface ContentInfo {
  type: "programs" | "pages" | "landings" | "locations" | null;
  slug: string | null;
  label: string;
}

// De-slugify a string (e.g., "hero-messaging-test" -> "Hero Messaging Test")
function deslugify(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Detect content type and slug from URL path
function detectContentInfo(pathname: string): ContentInfo {
  const typeLabels: Record<string, string> = {
    programs: "Program",
    pages: "Page",
    landings: "Landing",
    locations: "Location",
  };

  // Private preview route: /private/preview/:contentType/:slug
  const previewMatch = pathname.match(/^\/private\/preview\/(programs|pages|landings|locations)\/([^/]+)\/?$/);
  if (previewMatch) {
    return { 
      type: previewMatch[1] as ContentInfo["type"], 
      slug: previewMatch[2], 
      label: typeLabels[previewMatch[1]] || "Content" 
    };
  }

  // Private experiment editor: /private/:contentType/:contentSlug/experiment/:experimentSlug
  const experimentMatch = pathname.match(/^\/private\/(programs|pages|landings|locations)\/([^/]+)\/experiment\/[^/]+\/?$/);
  if (experimentMatch) {
    return { 
      type: experimentMatch[1] as ContentInfo["type"], 
      slug: experimentMatch[2], 
      label: typeLabels[experimentMatch[1]] || "Content" 
    };
  }

  // Programs: /en/career-programs/:slug or /es/programas-de-carrera/:slug
  const programEnMatch = pathname.match(/^\/en\/career-programs\/([^/]+)\/?$/);
  if (programEnMatch) {
    return { type: "programs", slug: programEnMatch[1], label: "Program" };
  }
  const programEsMatch = pathname.match(/^\/es\/programas-de-carrera\/([^/]+)\/?$/);
  if (programEsMatch) {
    return { type: "programs", slug: programEsMatch[1], label: "Program" };
  }

  // Landings: /landing/:slug
  const landingMatch = pathname.match(/^\/landing\/([^/]+)\/?$/);
  if (landingMatch) {
    return { type: "landings", slug: landingMatch[1], label: "Landing" };
  }

  // Locations: /en/location/:slug or /es/ubicacion/:slug
  const locationEnMatch = pathname.match(/^\/en\/location\/([^/]+)\/?$/);
  if (locationEnMatch) {
    return { type: "locations", slug: locationEnMatch[1], label: "Location" };
  }
  const locationEsMatch = pathname.match(/^\/es\/ubicacion\/([^/]+)\/?$/);
  if (locationEsMatch) {
    return { type: "locations", slug: locationEsMatch[1], label: "Location" };
  }

  // Template pages: /en/:slug or /es/:slug (catch-all for pages)
  const pageEnMatch = pathname.match(/^\/en\/([^/]+)\/?$/);
  if (pageEnMatch && !["career-programs", "location"].includes(pageEnMatch[1])) {
    return { type: "pages", slug: pageEnMatch[1], label: "Page" };
  }
  const pageEsMatch = pathname.match(/^\/es\/([^/]+)\/?$/);
  if (pageEsMatch && !["programas-de-carrera", "ubicacion"].includes(pageEsMatch[1])) {
    return { type: "pages", slug: pageEsMatch[1], label: "Page" };
  }

  return { type: null, slug: null, label: "" };
}

// Get persisted menu view from sessionStorage
const getPersistedMenuView = (): MenuView => {
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "main" || stored === "components" || stored === "sitemap" || stored === "experiments" || stored === "menus") {
      return stored;
    }
  }
  return "main";
};

interface MenuFileItem {
  name: string;
  file: string;
}

interface MenuData {
  navbar?: {
    items?: Array<{
      label: string;
      href: string;
      component: string;
      dropdown?: unknown;
    }>;
  };
}

function MenusView() {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [, navigate] = useLocation();
  
  const { data: menusData, isLoading } = useQuery<{ menus: MenuFileItem[] }>({
    queryKey: ["/api/menus"],
  });
  
  const { data: menuDetailData, isFetching: isMenuLoading } = useQuery<{ name: string; data: MenuData }>({
    queryKey: ["/api/menus", expandedMenu],
    enabled: !!expandedMenu,
  });

  const menus = menusData?.menus || [];
  const menuData = menuDetailData?.data;

  const toggleMenu = (name: string) => {
    setExpandedMenu(expandedMenu === name ? null : name);
  };

  const handleEditMenu = (e: React.MouseEvent, menuName: string) => {
    e.stopPropagation();
    navigate(`/private/menu-editor/${menuName}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (menus.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <IconMenu2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">No menus found</p>
        <p className="text-xs text-muted-foreground">
          Add <code className="bg-muted px-1 rounded">.yml</code> files to{" "}
          <code className="bg-muted px-1 rounded">marketing-content/menus/</code>
        </p>
      </div>
    );
  }

  return (
    <>
      {menus.map((menu) => (
        <div key={menu.name} className="mb-1">
          <div className="flex items-center">
            <button
              onClick={() => toggleMenu(menu.name)}
              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md text-sm hover-elevate cursor-pointer"
              data-testid={`button-menu-${menu.name}`}
            >
              {isMenuLoading && expandedMenu === menu.name ? (
                <IconRefresh className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
              ) : expandedMenu === menu.name ? (
                <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <IconChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <IconMenu2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">{menu.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{menu.file}</span>
            </button>
            <button
              onClick={(e) => handleEditMenu(e, menu.name)}
              className="p-2 rounded-md hover-elevate cursor-pointer"
              title="Edit menu"
              data-testid={`button-edit-menu-${menu.name}`}
            >
              <IconPencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {expandedMenu === menu.name && menuData && (
            <div className="ml-4 border-l pl-2 space-y-1 mt-1">
              {menuData?.navbar?.items?.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-muted-foreground hover-elevate cursor-pointer"
                  data-testid={`link-menu-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs opacity-60">{item.component}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// Edit Mode Toggle Component - uses optional hook to handle being outside provider
function EditModeToggle() {
  const editMode = useEditModeOptional();
  
  // If not within EditModeProvider, don't render
  if (!editMode) {
    return null;
  }
  
  const { isEditMode, toggleEditMode } = editMode;
  
  return (
    <button
      onClick={toggleEditMode}
      className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover-elevate"
      data-testid="button-toggle-edit-mode"
    >
      <div className="flex items-center gap-3">
        {isEditMode ? (
          <IconPencilOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <IconPencil className="h-4 w-4 text-muted-foreground" />
        )}
        <span>Edit Mode</span>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded ${isEditMode ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {isEditMode ? "ON" : "OFF"}
      </span>
    </button>
  );
}

interface MenuItemProps {
  icon: typeof IconComponents;
  label: string;
  onClick?: () => void;
  href?: string;
  testId: string;
  rightContent?: React.ReactNode;
  indicator?: "chevron" | "arrow" | "none";
  disabled?: boolean;
  className?: string;
}

function MenuItem({ icon: Icon, label, onClick, href, testId, rightContent, indicator = "none", disabled, className }: MenuItemProps) {
  const hasRightSide = rightContent || indicator !== "none";
  const baseClass = disabled
    ? "flex items-center justify-between w-full px-3 py-2 rounded-md text-sm text-muted-foreground cursor-default"
    : "flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover-elevate";
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;

  const content = (
    <>
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      {hasRightSide && (
        <div className="flex items-center gap-1.5">
          {rightContent}
          {indicator === "chevron" && <IconChevronRight className="h-4 w-4 text-muted-foreground" />}
          {indicator === "arrow" && <IconArrowRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      )}
    </>
  );

  if (disabled) {
    return <div className={combinedClass} data-testid={testId}>{content}</div>;
  }
  if (href) {
    return <a href={href} className={combinedClass} data-testid={testId}>{content}</a>;
  }
  if (onClick) {
    return <button onClick={onClick} className={combinedClass} data-testid={testId}>{content}</button>;
  }
  return <div className={combinedClass} data-testid={testId}>{content}</div>;
}

interface ExpandableMenuItemProps {
  icon: typeof IconComponents;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  testId: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function ExpandableMenuItem({ icon: Icon, label, expanded, onToggle, testId, actions, children }: ExpandableMenuItemProps) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 hover-elevate rounded-md -ml-1 pl-1 py-0.5"
          data-testid={testId}
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
          <IconChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        {actions}
      </div>
      {expanded && (
        <div className="ml-2 pl-1 space-y-0.5 rounded-md py-1" style={{ backgroundColor: "hsl(var(--muted-foreground) / 0.1)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function DebugBubble() {
  const handleLinkClick = useInternalNav();
  // Check if we should hide the debug bubble (via URL param or in preview-frame route)
  const shouldHide = typeof window !== "undefined" && (
    new URLSearchParams(window.location.search).get("hide_debug") === "true" ||
    window.location.pathname === "/preview-frame"
  );
  
  const { isValidated, hasToken, isLoading, isDebugMode, retryValidation, validateManualToken, clearToken, checkSession } = useDebugAuth();
  const { session } = useSession();
  const editMode = useEditModeOptional();
  const syncContext = useSyncOptional();
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const [pathname, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });
  const [cacheClearStatus, setCacheClearStatus] = useState<"idle" | "loading" | "success">("idle");
  const [sitemapUrls, setSitemapUrls] = useState<SitemapUrl[]>([]);
  const [sitemapSearch, setSitemapSearch] = useState("");
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [showSitemapSearch, setShowSitemapSearch] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");
  const [showComponentSearch, setShowComponentSearch] = useState(false);

  const { data: componentRegistryData } = useQuery<{ components: Array<{ type: string; name: string; description: string; latestVersion: string; versions: string[] }> }>({
    queryKey: ["/api/component-registry"],
    staleTime: 60000,
  });

  const filteredComponents = useMemo(() => {
    const components = componentRegistryData?.components?.filter(c => c.type !== "_common") || [];
    if (!componentSearch) return components;
    const q = componentSearch.toLowerCase();
    return components.filter(c =>
      c.type.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }, [componentRegistryData, componentSearch]);
  const [tokenInput, setTokenInput] = useState("");
  const [pendingAutoEditMode, setPendingAutoEditMode] = useState(false);
  const prevIsValidatedRef = useRef<boolean | null>(null);
  const [redirectsList, setRedirectsList] = useState<RedirectItem[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedLocationSlug, setSelectedLocationSlug] = useState<string>("");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  
  // Experiments state
  const [experimentsData, setExperimentsData] = useState<ExperimentsResponse | null>(null);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  
  // GitHub sync status state
  const [githubSyncStatus, setGithubSyncStatus] = useState<GitHubSyncStatus | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
  
  // Pending changes state
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [pendingChangesLoading, setPendingChangesLoading] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Pull conflict state
  const [pullConflictModalOpen, setPullConflictModalOpen] = useState(false);
  const [pullConflictFiles, setPullConflictFiles] = useState<string[]>([]);
  
  // Per-file sync state
  const [selectedFileForCommit, setSelectedFileForCommit] = useState<string | null>(null);
  const [fileCommitMessage, setFileCommitMessage] = useState("");
  const [fileCommitting, setFileCommitting] = useState<string | null>(null);
  const [filePulling, setFilePulling] = useState<string | null>(null);
  const [confirmPullFile, setConfirmPullFile] = useState<string | null>(null);
  
  // Advanced options state
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);
  const [isIgnoringAllChanges, setIsIgnoringAllChanges] = useState(false);
  
  // Create content modal state
  const [createContentModalOpen, setCreateContentModalOpen] = useState(false);
  const [createContentType, setCreateContentType] = useState<'location' | 'page' | 'program' | 'landing'>('page');
  const [createContentTitle, setCreateContentTitle] = useState("");
  const [createContentSlugEn, setCreateContentSlugEn] = useState("");
  const [createContentSlugEs, setCreateContentSlugEs] = useState("");
  const [createContentSlugEnStatus, setCreateContentSlugEnStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [createContentSlugEsStatus, setCreateContentSlugEsStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [slugEnConflictReason, setSlugEnConflictReason] = useState<string | null>(null);
  const [slugEsConflictReason, setSlugEsConflictReason] = useState<string | null>(null);
  const [editingSlugEn, setEditingSlugEn] = useState(false);
  const [editingSlugEs, setEditingSlugEs] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [createLandingLocale, setCreateLandingLocale] = useState<'en' | 'es'>('en');
  
  // Duplicate page state
  const [duplicatingPage, setDuplicatingPage] = useState<{ loc: string; label: string; contentType: 'location' | 'page' | 'program' | 'landing' } | null>(null);
  
  // Delete page state
  const [deletePageModalOpen, setDeletePageModalOpen] = useState(false);
  const [deletingPage, setDeletingPage] = useState<{ slug: string; contentType: 'location' | 'page' | 'program' | 'landing' } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  
  // Session check state
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  
  // SEO modal state
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoData, setSeoData] = useState<{
    meta: Record<string, unknown>;
    faqSchema: Record<string, unknown> | null;
    schemaOrg: Record<string, unknown>[];
    title: string;
  } | null>(null);
  const [seoMeta, setSeoMeta] = useState<{
    page_title: string;
    description: string;
    canonical_url: string;
  }>({ page_title: "", description: "", canonical_url: "" });
  const [seoSaving, setSeoSaving] = useState(false);
  const [seoFaqExpanded, setSeoFaqExpanded] = useState(true);
  const [seoSchemaExpanded, setSeoSchemaExpanded] = useState(false);
  const [seoSchemaInclude, setSeoSchemaInclude] = useState<string[]>([]);
  const [seoSchemaOverrides, setSeoSchemaOverrides] = useState<Record<string, string>>({});
  const [seoSchemaOverridesErrors, setSeoSchemaOverridesErrors] = useState<Record<string, string>>({});
  const [availableSchemaKeys, setAvailableSchemaKeys] = useState<string[]>([]);
  const [seoSchemaIncludeExpanded, setSeoSchemaIncludeExpanded] = useState(false);
  const [seoSchemaOverridesExpanded, setSeoSchemaOverridesExpanded] = useState(false);
  const [seoLocations, setSeoLocations] = useState<string[]>([]);
  const [seoAvailableLocations, setSeoAvailableLocations] = useState<Array<{ slug: string; name: string; city: string; country: string }>>([]);
  const [seoLocationsExpanded, setSeoLocationsExpanded] = useState(true);
  const [seoLocationSearch, setSeoLocationSearch] = useState("");
  
  // Slug rename state
  const [slugEditorExpanded, setSlugEditorExpanded] = useState(false);
  const [newSlugValue, setNewSlugValue] = useState("");
  const [slugCheckStatus, setSlugCheckStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugCheckReason, setSlugCheckReason] = useState<string | null>(null);
  const [slugRenaming, setSlugRenaming] = useState(false);
  const [slugRedirectPrompt, setSlugRedirectPrompt] = useState(false);
  const [slugOldUrls, setSlugOldUrls] = useState<Record<string, string>>({});
  const [slugNewUrls, setSlugNewUrls] = useState<Record<string, string>>({});
  
  // Breathecode host state
  const [breathecodeHost, setBreathecodeHost] = useState<{ host: string; isDefault: boolean } | null>(null);
  
  // Page diagnostics state
  const [pageErrorsModalOpen, setPageErrorsModalOpen] = useState(false);
  const [pageDiagnostics, setPageDiagnostics] = useState<{
    url: string;
    contentType: string;
    slug: string;
    locale: string;
    filePath: string;
    title: string;
    schemaValidation: { valid: boolean; errors: Array<{ path: string; code: string; message: string; expected?: string; received?: string }> };
    issues: Array<{ type: "error" | "warning" | "info"; code: string; message: string; category?: string; details?: { path?: string; expected?: string; received?: string } }>;
    score: { total: number; seo: number; schema: number; content: number };
  } | null>(null);
  const [pageDiagnosticsLoading, setPageDiagnosticsLoading] = useState(false);

  // Detect current content info from URL
  const contentInfo = useMemo(() => detectContentInfo(pathname), [pathname]);

  // Check if location is currently overridden via query string
  const currentLocationOverride = typeof window !== "undefined" 
    ? new URLSearchParams(window.location.search).get("location") 
    : null;

  // State for expanded folders in sitemap view
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Initialize menu view from sessionStorage (persisted across refreshes)
  const [menuView, setMenuViewState] = useState<MenuView>(getPersistedMenuView);
  const [sitemapExpanded, setSitemapExpanded] = useState(false);
  const [componentsExpanded, setComponentsExpanded] = useState(false);

  // Wrapper to persist menu view changes to sessionStorage
  const setMenuView = (view: MenuView) => {
    setMenuViewState(view);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, view);
    }
  };

  // Auto-open experiments menu when URL contains "experiment"
  useEffect(() => {
    if (pathname.includes("experiment") && contentInfo.type && contentInfo.slug) {
      setMenuViewState("experiments");
    }
  }, [pathname, contentInfo.type, contentInfo.slug]);

  // Auto-fetch page diagnostics when debug mode is active (on every page)
  useEffect(() => {
    if (!isDebugMode || pathname.startsWith('/private/')) {
      setPageDiagnostics(null);
      return;
    }
    setPageDiagnosticsLoading(true);
    setPageDiagnostics(null);
    fetch(`/api/diagnostics/page?url=${encodeURIComponent(pathname)}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) setPageDiagnostics(data);
      })
      .catch(() => {})
      .finally(() => setPageDiagnosticsLoading(false));
  }, [pathname, isDebugMode]);

  const pageErrorCount = useMemo(() => {
    if (!pageDiagnostics) return 0;
    return pageDiagnostics.issues?.filter(i => i.type === "error").length || 0;
  }, [pageDiagnostics]);

  const pageWarningCount = useMemo(() => {
    if (!pageDiagnostics) return 0;
    return pageDiagnostics.issues?.filter(i => i.type === "warning").length || 0;
  }, [pageDiagnostics]);

  // Auto-enable edit mode after successful token validation
  useEffect(() => {
    // Detect when isValidated changes from false/null to true
    const wasValidated = prevIsValidatedRef.current;
    prevIsValidatedRef.current = isValidated;
    
    if (pendingAutoEditMode && isValidated === true && wasValidated !== true && !isLoading) {
      setPendingAutoEditMode(false);
      setTokenInput("");
      
      // Enable edit mode and navigate to preview
      if (editMode && !editMode.isEditMode) {
        editMode.toggleEditMode();
        
        // Navigate to preview route if on a content page
        if (contentInfo.type && contentInfo.slug && !pathname.startsWith('/private/preview/')) {
          const pathSegments = pathname.split('/').filter(Boolean);
          const urlLocale = pathSegments[0];
          const normalizedLocale = normalizeLocale(urlLocale || i18n.language);
          const previewUrl = `/private/preview/${contentInfo.type}/${contentInfo.slug}?locale=${normalizedLocale}`;
          navigate(previewUrl);
        }
      }
    }
  }, [isValidated, isLoading, pendingAutoEditMode, editMode, contentInfo, pathname, i18n.language, navigate]);

  // Fetch sitemap URLs when entering sitemap view
  useEffect(() => {
    if (menuView === "sitemap" && sitemapUrls.length === 0) {
      setSitemapLoading(true);
      fetch("/api/debug/sitemap-urls")
        .then((res) => res.json())
        .then((data) => {
          setSitemapUrls(data);
          setSitemapLoading(false);
        })
        .catch(() => setSitemapLoading(false));
    }
  }, [menuView]);

  // Fetch redirects count on mount
  useEffect(() => {
    if (redirectsList.length === 0) {
      fetch("/api/debug/redirects")
        .then((res) => res.json())
        .then((data) => {
          setRedirectsList(data.redirects || []);
        })
        .catch(() => {});
    }
  }, []);

  // Fetch Breathecode host on mount
  useEffect(() => {
    fetch("/api/debug/breathecode-host")
      .then((res) => res.json())
      .then((data) => {
        setBreathecodeHost(data);
      })
      .catch(() => {});
  }, []);

  // Listen for open-sync-modal event from SyncConflictBanner
  useEffect(() => {
    const handleOpenSyncModal = () => {
      setCommitModalOpen(true);
      // Fetch pending changes when modal opens from banner
      setPendingChangesLoading(true);
      fetch(`/api/github/pending-changes?_t=${Date.now()}`)
        .then((res) => res.json())
        .then((data: { changes: PendingChange[]; count: number }) => {
          setPendingChanges(data.changes || []);
          setPendingChangesLoading(false);
        })
        .catch(() => {
          setPendingChanges([]);
          setPendingChangesLoading(false);
        });
    };
    window.addEventListener("open-sync-modal", handleOpenSyncModal);
    return () => {
      window.removeEventListener("open-sync-modal", handleOpenSyncModal);
    };
  }, []);

  // Fetch experiments when entering experiments view
  useEffect(() => {
    if (menuView === "experiments" && contentInfo.type && contentInfo.slug) {
      setExperimentsLoading(true);
      fetch(`/api/experiments/${contentInfo.type}/${contentInfo.slug}`)
        .then((res) => res.json())
        .then((data: ExperimentsResponse) => {
          setExperimentsData(data);
          setExperimentsLoading(false);
        })
        .catch(() => {
          setExperimentsLoading(false);
          setExperimentsData(null);
        });
    }
  }, [menuView, contentInfo.type, contentInfo.slug]);

  // Reset experiments data and menu view when leaving a content page
  useEffect(() => {
    if (!contentInfo.type) {
      setExperimentsData(null);
      // Reset menu view to main if currently on experiments view
      if (menuView === "experiments") {
        setMenuView("main");
      }
    }
  }, [contentInfo.type, menuView]);

  // Fetch GitHub sync status on mount and when popover opens
  useEffect(() => {
    if (open && menuView === "main" && !githubSyncStatus && !syncStatusLoading) {
      setSyncStatusLoading(true);
      fetch("/api/github/sync-status")
        .then((res) => res.json())
        .then((data: GitHubSyncStatus) => {
          setGithubSyncStatus(data);
          setSyncStatusLoading(false);
        })
        .catch(() => {
          setSyncStatusLoading(false);
        });
    }
  }, [open, menuView]);

  // Function to refresh sync status
  const refreshSyncStatus = () => {
    setSyncStatusLoading(true);
    setGithubSyncStatus(null);
    fetch("/api/github/sync-status")
      .then((res) => res.json())
      .then((data: GitHubSyncStatus) => {
        setGithubSyncStatus(data);
        setSyncStatusLoading(false);
      })
      .catch(() => {
        setSyncStatusLoading(false);
      });
  };

  // Function to execute the actual sync (called after conflict check)
  const executeSyncFromRemote = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        // Refresh sync status and pending changes before reload
        await refreshSyncStatus();
        if (syncContext) {
          syncContext.refreshSyncStatus();
        }
        window.location.reload();
      } else {
        setIsSyncing(false);
      }
    } catch {
      setIsSyncing(false);
    }
  };

  // Function to sync from remote (pull latest changes) - checks for conflicts first
  const handleSyncFromRemote = async () => {
    setIsSyncing(true);
    try {
      // Check for conflicts first
      const conflictRes = await fetch("/api/github/pull-conflicts");
      if (conflictRes.ok) {
        const conflictData = await conflictRes.json();
        if (conflictData.hasConflicts && conflictData.conflictingFiles.length > 0) {
          // Show conflict modal instead of pulling
          setPullConflictFiles(conflictData.conflictingFiles);
          setPullConflictModalOpen(true);
          setIsSyncing(false);
          return;
        }
      }
      // No conflicts, proceed with sync
      await executeSyncFromRemote();
    } catch {
      setIsSyncing(false);
    }
  };

  // Fetch pending changes when GitHub sync is enabled
  const fetchPendingChanges = () => {
    setPendingChangesLoading(true);
    fetch(`/api/github/pending-changes?_t=${Date.now()}`)
      .then((res) => res.json())
      .then((data: { changes: PendingChange[]; count: number }) => {
        setPendingChanges(data.changes || []);
        setPendingChangesLoading(false);
      })
      .catch(() => {
        setPendingChanges([]);
        setPendingChangesLoading(false);
      });
  };

  // Handle session check (validates without clearing cache first)
  const fetchSeoPreview = useCallback(async () => {
    if (!contentInfo.type || !contentInfo.slug) return;
    setSeoLoading(true);
    setSeoData(null);
    try {
      const pathSegments = pathname.split('/').filter(Boolean);
      const urlLocale = pathSegments[0];
      const locale = normalizeLocale(urlLocale || i18n.language);
      const contentTypeMap: Record<string, string> = {
        programs: "programs",
        pages: "pages",
        landings: "landings",
        locations: "locations",
      };
      const apiContentType = contentTypeMap[contentInfo.type] || contentInfo.type;
      const res = await fetch(`/api/seo-preview/${apiContentType}/${contentInfo.slug}?locale=${locale}`);
      if (!res.ok) throw new Error("Failed to fetch SEO data");
      const [data, schemaKeysRes] = await Promise.all([
        res.json(),
        fetch("/api/schema").then(r => r.ok ? r.json() : { available: [] }),
      ]);
      setSeoData(data);
      setSeoMeta({
        page_title: (data.meta?.page_title as string) || "",
        description: (data.meta?.description as string) || "",
        canonical_url: (data.meta?.canonical_url as string) || "",
      });
      setAvailableSchemaKeys(schemaKeysRes.available || []);
      setSeoSchemaInclude(data.schemaInclude || []);
      const overridesObj: Record<string, string> = {};
      if (data.schemaOverrides) {
        for (const [key, val] of Object.entries(data.schemaOverrides)) {
          overridesObj[key] = JSON.stringify(val, null, 2);
        }
      }
      setSeoSchemaOverrides(overridesObj);
      setSeoSchemaOverridesErrors({});
      setSeoLocations((data.locations as string[]) || []);
      setSeoAvailableLocations((data.availableLocations as Array<{ slug: string; name: string; city: string; country: string }>) || []);
      setSeoLocationSearch("");
    } catch (error) {
      console.error("Error fetching SEO preview:", error);
      toast({
        title: "Failed to load SEO data",
        description: "Could not fetch page SEO information.",
        variant: "destructive",
      });
    } finally {
      setSeoLoading(false);
    }
  }, [contentInfo.type, contentInfo.slug, pathname, i18n.language, toast]);

  useEffect(() => {
    if (!newSlugValue || !contentInfo.type || newSlugValue === contentInfo.slug) {
      setSlugCheckStatus("idle");
      setSlugCheckReason(null);
      return;
    }
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(newSlugValue)) {
      setSlugCheckStatus("taken");
      setSlugCheckReason("Use only lowercase letters, numbers, and hyphens");
      return;
    }
    setSlugCheckStatus("checking");
    const controller = new AbortController();
    const contentTypeMap: Record<string, string> = { programs: "program", pages: "page", locations: "location", landings: "landing" };
    const apiType = contentTypeMap[contentInfo.type] || contentInfo.type;
    const timer = setTimeout(() => {
      fetch(`/api/content/check-slug?type=${apiType}&slug=${newSlugValue}`, { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (data.available) {
            setSlugCheckStatus("available");
            setSlugCheckReason(null);
          } else {
            setSlugCheckStatus("taken");
            setSlugCheckReason(data.reason === "slug_taken" ? "This slug is already in use" : data.reason === "redirect_conflict" ? `Conflicts with redirect to ${data.redirectTo}` : data.reason || "Not available");
          }
        })
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [newSlugValue, contentInfo.type, contentInfo.slug]);

  const handleSlugRename = async (createRedirect: boolean) => {
    if (!contentInfo.type || !contentInfo.slug || !newSlugValue || slugCheckStatus !== "available") return;
    setSlugRenaming(true);
    setSlugRedirectPrompt(false);
    try {
      const contentTypeMap: Record<string, string> = { programs: "program", pages: "page", locations: "location", landings: "landing" };
      const apiType = contentTypeMap[contentInfo.type] || contentInfo.type;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getDebugToken();
      if (token) headers["X-Debug-Token"] = token;
      const res = await fetch("/api/content/rename-slug", {
        method: "POST",
        headers,
        body: JSON.stringify({
          contentType: apiType,
          currentSlug: contentInfo.slug,
          newSlug: newSlugValue,
          createRedirect,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to rename");
      }
      const result = await res.json();
      toast({
        title: "Slug renamed",
        description: `${result.oldSlug} → ${result.newSlug}${createRedirect ? " (redirect created)" : ""}`,
      });
      setSeoModalOpen(false);
      setSlugEditorExpanded(false);
      setNewSlugValue("");
      const pathSegments = pathname.split("/").filter(Boolean);
      const urlLocale = pathSegments[0];
      const newUrl = result.newUrls?.[urlLocale || "en"] || result.newUrls?.["en"];
      if (newUrl) {
        window.location.href = newUrl;
      } else {
        window.location.reload();
      }
    } catch (error) {
      toast({
        title: "Failed to rename slug",
        description: error instanceof Error ? error.message : "Could not rename content slug.",
        variant: "destructive",
      });
    } finally {
      setSlugRenaming(false);
    }
  };

  const handleSlugRenameClick = () => {
    if (!contentInfo.type || !contentInfo.slug || slugCheckStatus !== "available") return;
    const contentTypeMap: Record<string, string> = { programs: "program", pages: "page", locations: "location", landings: "landing" };
    const apiType = contentTypeMap[contentInfo.type] || contentInfo.type;
    const oldUrls = contentIndex_buildUrls(apiType, contentInfo.slug);
    const newUrls = contentIndex_buildUrls(apiType, newSlugValue);
    setSlugOldUrls(oldUrls);
    setSlugNewUrls(newUrls);
    setSlugRedirectPrompt(true);
  };

  const contentIndex_buildUrls = (apiType: string, slug: string): Record<string, string> => {
    if (apiType === "landing") {
      return { default: `/landing/${slug}` };
    }
    const ct = apiType as ContentType;
    return {
      en: buildContentUrl(ct, slug, "en"),
      es: buildContentUrl(ct, slug, "es"),
    };
  };

  const handleSeoSave = async () => {
    if (!contentInfo.type || !contentInfo.slug) return;
    setSeoSaving(true);
    try {
      const pathSegments = pathname.split('/').filter(Boolean);
      const urlLocale = pathSegments[0];
      const locale = normalizeLocale(urlLocale || i18n.language);
      const contentTypeMap: Record<string, string> = {
        programs: "program",
        pages: "page",
        landings: "landing",
        locations: "location",
      };
      const apiContentType = contentTypeMap[contentInfo.type] || contentInfo.type;
      
      const existingMeta = { ...(seoData?.meta || {}) };
      const editableKeys = ["page_title", "description", "canonical_url"] as const;
      for (const key of editableKeys) {
        if (seoMeta[key]) {
          existingMeta[key] = seoMeta[key];
        } else {
          delete existingMeta[key];
        }
      }
      
      const hasOverrideErrors = Object.keys(seoSchemaOverridesErrors).length > 0;
      if (hasOverrideErrors) {
        toast({
          title: "Invalid JSON in schema overrides",
          description: "Please fix the JSON errors before saving.",
          variant: "destructive",
        });
        setSeoSaving(false);
        return;
      }

      const parsedOverrides: Record<string, Record<string, unknown>> = {};
      for (const [key, val] of Object.entries(seoSchemaOverrides)) {
        if (val.trim() && seoSchemaInclude.includes(key)) {
          try {
            parsedOverrides[key] = JSON.parse(val);
          } catch {
            // skip invalid
          }
        }
      }

      const schemaValue: Record<string, unknown> = {};
      if (seoSchemaInclude.length > 0) {
        schemaValue.include = seoSchemaInclude;
      }
      if (Object.keys(parsedOverrides).length > 0) {
        schemaValue.overrides = parsedOverrides;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getDebugToken();
      if (token) headers["X-Debug-Token"] = token;
      const author = getDebugUserName();

      const operations: Array<{ action: string; path: string; value: unknown }> = [
        { action: "update_field", path: "meta", value: existingMeta },
        { action: "update_field", path: "schema", value: Object.keys(schemaValue).length > 0 ? schemaValue : null },
      ];

      const res = await fetch("/api/content/edit", {
        method: "POST",
        headers,
        body: JSON.stringify({
          contentType: apiContentType,
          slug: contentInfo.slug,
          locale,
          author: author || undefined,
          operations,
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save");
      }

      if (contentInfo.type === "landings" && seoAvailableLocations.length > 0) {
        const locRes = await fetch("/api/content/update-locations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            contentType: "landings",
            slug: contentInfo.slug,
            locations: seoLocations,
            author: author || undefined,
          }),
        });
        if (!locRes.ok) {
          const locErr = await locRes.json().catch(() => ({}));
          throw new Error(locErr.error || "Failed to save locations");
        }
      }
      
      toast({
        title: "SEO updated",
        description: "Meta tags have been saved successfully.",
      });
      setSeoModalOpen(false);
    } catch (error) {
      console.error("Error saving SEO:", error);
      toast({
        title: "Failed to save SEO",
        description: error instanceof Error ? error.message : "Could not save meta changes.",
        variant: "destructive",
      });
    } finally {
      setSeoSaving(false);
    }
  };

  const handleCheckSession = async () => {
    setIsCheckingSession(true);
    try {
      const result = await checkSession();
      if (result.valid) {
        toast({
          title: "Session valid",
          description: "Your authentication is still active.",
        });
      } else if (result.networkError) {
        // Network error - session not cleared, just inform user
        toast({
          title: "Network error",
          description: "Could not reach server to verify session. Try again later.",
          variant: "destructive",
        });
      } else if (result.expired) {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Session invalid",
          description: "Please log in again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Check failed",
        description: "Could not verify session.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingSession(false);
    }
  };

  // Fetch pending changes when sync status indicates sync is enabled
  useEffect(() => {
    if (githubSyncStatus?.syncEnabled) {
      fetchPendingChanges();
    }
  }, [githubSyncStatus?.syncEnabled]);

  // Listen for content updates to refresh pending changes immediately
  useEffect(() => {
    const unsubscribe = subscribeToContentUpdates(() => {
      // Refresh pending changes when any content is updated
      if (!githubSyncStatus) {
        // Fetch sync status first, which will trigger pending changes fetch
        fetch("/api/github/sync-status")
          .then((res) => res.json())
          .then((data: GitHubSyncStatus) => {
            setGithubSyncStatus(data);
            if (data.syncEnabled) {
              fetchPendingChanges();
            }
          })
          .catch(() => {});
      } else if (githubSyncStatus.syncEnabled) {
        fetchPendingChanges();
      }
    });

    return unsubscribe;
  }, [githubSyncStatus]);

  // Handle commit
  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    
    setIsCommitting(true);
    try {
      const forceCommit = syncContext?.forceCommitEnabled || false;
      const author = getDebugUserName();
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: commitMessage.trim(),
          force: forceCommit,
          author,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCommitModalOpen(false);
        setCommitMessage("");
        setPendingChanges([]);
        refreshSyncStatus();
        if (syncContext) {
          syncContext.refreshSyncStatus();
          syncContext.syncWithRemote();
        }
      } else {
        alert(data.error || "Failed to commit changes");
      }
    } catch (error) {
      alert("Failed to commit changes");
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle per-file commit
  const handleFileCommit = async (filePath: string) => {
    if (!fileCommitMessage.trim()) return;
    
    setFileCommitting(filePath);
    try {
      const author = getDebugUserName();
      const res = await fetch("/api/github/commit-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          filePath,
          message: fileCommitMessage.trim(),
          author,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Remove committed file from pending changes
        const remainingChanges = pendingChanges.filter(c => c.file !== filePath);
        setPendingChanges(remainingChanges);
        setSelectedFileForCommit(null);
        setFileCommitMessage("");
        
        // If all pending changes are resolved, sync with remote to update lastSyncedCommit
        if (remainingChanges.length === 0) {
          try {
            await fetch("/api/github/sync-with-remote", { method: "POST" });
          } catch {
            // Silently fail - sync status will still be refreshed
          }
        }
        
        refreshSyncStatus();
        if (syncContext) {
          syncContext.refreshSyncStatus();
        }
      } else {
        alert(data.error || "Failed to commit file");
      }
    } catch {
      alert("Failed to commit file");
    } finally {
      setFileCommitting(null);
    }
  };

  // Handle per-file pull
  const handleFilePull = async (filePath: string) => {
    setFilePulling(filePath);
    try {
      const res = await fetch("/api/github/pull-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Remove file from pending changes (now synced)
        const remainingChanges = pendingChanges.filter(c => c.file !== filePath);
        setPendingChanges(remainingChanges);
        setConfirmPullFile(null);
        
        // If all pending changes are resolved, sync with remote to update lastSyncedCommit
        if (remainingChanges.length === 0) {
          try {
            await fetch("/api/github/sync-with-remote", { method: "POST" });
          } catch {
            // Silently fail - sync status will still be refreshed
          }
        }
        
        refreshSyncStatus();
        if (syncContext) {
          syncContext.refreshSyncStatus();
        }
      } else {
        alert(data.error || "Failed to pull file");
      }
    } catch {
      alert("Failed to pull file");
    } finally {
      setFilePulling(null);
    }
  };

  // Handle ignore all local changes - reset to remote state
  const handleIgnoreAllChanges = async () => {
    const localChanges = pendingChanges.filter(c => c.source === 'local' || c.source === 'conflict');
    if (localChanges.length === 0) return;
    
    const confirmed = window.confirm(
      `This will erase all changes you have made to Marketing Content YAMLs (${localChanges.length} file${localChanges.length > 1 ? 's' : ''}). This cannot be undone. Continue?`
    );
    if (!confirmed) return;
    
    setIsIgnoringAllChanges(true);
    try {
      // Pull each file with local changes from remote
      for (const change of localChanges) {
        const res = await fetch("/api/github/pull-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: change.file }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to reset ${change.file}`);
        }
      }
      
      // Clear pending changes and refresh
      setPendingChanges(pendingChanges.filter(c => c.source !== 'local' && c.source !== 'conflict'));
      setAdvancedOptionsOpen(false);
      
      // Sync with remote to update status
      try {
        await fetch("/api/github/sync-with-remote", { method: "POST" });
      } catch {
        // Silently fail
      }
      
      refreshSyncStatus();
      if (syncContext) {
        syncContext.refreshSyncStatus();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to ignore local changes");
    } finally {
      setIsIgnoringAllChanges(false);
    }
  };

  // Handle popover open/close - reset search but preserve menu view
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSitemapSearch("");
      setShowSitemapSearch(false);
    }
  };

  // Filter sitemap URLs by search
  const filteredSitemapUrls = sitemapUrls.filter(
    (url) =>
      url.label.toLowerCase().includes(sitemapSearch.toLowerCase()) ||
      url.loc.toLowerCase().includes(sitemapSearch.toLowerCase())
  );

  // Group sitemap URLs into nested folders based on URL path structure
  interface SitemapFolder {
    name: string;
    path: string; // Full path to this folder level
    urls: SitemapUrl[]; // URLs that terminate at this folder level
    subfolders: SitemapFolder[];
  }

  const groupedSitemapUrls = (): { folders: SitemapFolder[]; rootUrls: SitemapUrl[] } => {
    const rootUrls: SitemapUrl[] = [];
    const folderMap = new Map<string, SitemapFolder>();

    filteredSitemapUrls.forEach((url) => {
      const path = new URL(url.loc).pathname;
      const segments = path.split('/').filter(Boolean);
      
      // Root level pages (e.g., "/", "/about")
      if (segments.length <= 1) {
        rootUrls.push(url);
        return;
      }

      // Build folder path from all segments except the last (the page)
      const folderSegments = segments.slice(0, -1);
      const folderPath = '/' + folderSegments.join('/');
      
      // Create or get the folder
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, {
          name: folderSegments.join('/'),
          path: folderPath,
          urls: [],
          subfolders: [],
        });
      }
      
      folderMap.get(folderPath)!.urls.push(url);
    });

    // Convert map to sorted array
    const folders = Array.from(folderMap.values()).sort((a, b) => 
      a.path.localeCompare(b.path)
    );

    return { folders, rootUrls };
  };

  const { folders, rootUrls } = groupedSitemapUrls();

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  // Only show bubble if debug mode is active
  // In dev: always active
  // In production: requires ?debug=true in URL
  if (!isDebugMode) {
    return null;
  }
  
  // Wait for loading to complete
  if (isLoading) {
    return null;
  }
  
  // Token states for different warning scenarios
  const noTokenDetected = !hasToken;
  const tokenWithoutCapabilities = hasToken && isValidated === false;

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", newTheme);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "es" : "en";
    i18n.changeLanguage(newLang);
  };

  const currentLang = i18n.language === "es" ? "ES" : "EN";

  // Detect content type from URL path
  const getContentTypeFromPath = (path: string): 'page' | 'program' | 'landing' | 'location' | null => {
    const parts = path.split('/').filter(Boolean);
    
    const hasLocale = parts[0] === 'en' || parts[0] === 'es' || parts[0] === 'us';
    const contentParts = hasLocale ? parts.slice(1) : parts;
    
    if (contentParts.length === 0) return null;
    
    // Check content type based on first path segment
    if (contentParts[0] === 'landing') return 'landing';
    if (contentParts[0] === 'bootcamp' || contentParts[0] === 'course') return 'program';
    if (contentParts[0] === 'coding-campus') return 'location';
    
    // If has locale prefix, it's a page
    if (hasLocale) return 'page';
    
    return null;
  };
  
  // Handle duplicate page action
  const handleDuplicatePage = (url: SitemapUrl) => {
    const path = new URL(url.loc).pathname;
    const contentType = getContentTypeFromPath(path);
    if (contentType) {
      setDuplicatingPage({ loc: url.loc, label: url.label, contentType });
      setCreateContentType(contentType);
      setCreateContentTitle("");
      setCreateContentSlugEn("");
      setCreateContentSlugEs("");
      setCreateContentSlugEnStatus('idle');
      setCreateContentSlugEsStatus('idle');
      setSlugEnConflictReason(null);
      setSlugEsConflictReason(null);
      setCreateContentModalOpen(true);
    } else {
      toast({ title: "No se puede duplicar", description: "Tipo de contenido no reconocido", variant: "destructive" });
    }
  };

  const handleDeletePage = (url: SitemapUrl) => {
    const urlPath = new URL(url.loc).pathname;
    const contentType = getContentTypeFromPath(urlPath);
    if (!contentType) {
      toast({ title: "No se puede eliminar", description: "Tipo de contenido no reconocido", variant: "destructive" });
      return;
    }
    const parts = urlPath.split('/').filter(Boolean);
    const hasLocale = parts[0] === 'en' || parts[0] === 'es' || parts[0] === 'us';
    const locale = hasLocale ? parts[0] : 'en';
    const contentParts = hasLocale ? parts.slice(1) : parts;
    let slug = '';
    if (contentType === 'landing') {
      slug = contentParts.slice(1).join('-') || contentParts[contentParts.length - 1];
    } else if (contentType === 'program') {
      slug = contentParts[contentParts.length - 1];
    } else if (contentType === 'location') {
      slug = contentParts[contentParts.length - 1];
    } else {
      const rawSlug = contentParts.join('-') || contentParts[contentParts.length - 1];
      slug = getFolderFromSlug(rawSlug, locale === 'us' ? 'en' : locale);
    }
    if (!slug) {
      toast({ title: "No se puede eliminar", description: "No se pudo determinar el slug", variant: "destructive" });
      return;
    }
    setDeletingPage({ slug, contentType });
    setDeleteConfirmInput("");
    setDeletePageModalOpen(true);
  };

  const handleDownloadYml = async (url: SitemapUrl) => {
    const urlPath = new URL(url.loc).pathname;
    const parts = urlPath.split('/').filter(Boolean);
    const hasLocale = parts[0] === 'en' || parts[0] === 'es';
    const contentParts = hasLocale ? parts.slice(1) : parts;
    const slug = contentParts.length === 0 ? 'home' : contentParts[contentParts.length - 1];
    if (!slug) {
      toast({ title: "Cannot download", description: "Could not determine slug from URL", variant: "destructive" });
      return;
    }
    const token = getDebugToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Token ${token}`;

    try {
      const resolveRes = await fetch(`/api/content/resolve-folder?slug=${encodeURIComponent(slug)}`, { headers });
      if (!resolveRes.ok) {
        toast({ title: "No YAML found", description: `This page has no YAML content files (code-only route)` });
        return;
      }
      const resolveData = await resolveRes.json();

      const entries: { folder: string; files: string[]; title?: string; contentType: string }[] = resolveData.multiple
        ? resolveData.matches
        : [resolveData];

      let downloadedCount = 0;
      for (const entry of entries) {
        for (const filename of entry.files) {
          try {
            const res = await fetch(`/api/content/file?path=${encodeURIComponent(`${entry.folder}/${filename}`)}`, { headers });
            if (!res.ok) continue;
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/yaml' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = entries.length > 1 ? `${entry.contentType}-${slug}-${filename}` : `${slug}-${filename}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            downloadedCount++;
          } catch {}
        }
      }
      if (downloadedCount > 0) {
        toast({ title: "Download complete", description: `Downloaded ${downloadedCount} YAML file(s) for "${slug}"` });
      } else {
        toast({ title: "No files found", description: `No YAML files could be downloaded for "${slug}"`, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Download failed", description: "An error occurred while downloading", variant: "destructive" });
    }
  };

  const confirmDeletePage = async () => {
    if (!deletingPage || deleteConfirmInput !== deletingPage.slug) return;
    setIsDeletingPage(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Token ${token}`;
      const response = await fetch("/api/content/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ type: deletingPage.contentType, slug: deletingPage.slug, confirmSlug: deleteConfirmInput }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Página eliminada", description: data.message });
        setDeletePageModalOpen(false);
        setDeletingPage(null);
        setDeleteConfirmInput("");
        const sitemapRes = await fetch("/api/debug/sitemap-urls");
        if (sitemapRes.ok) {
          const sitemapData = await sitemapRes.json();
          setSitemapUrls(sitemapData);
        }
      } else {
        toast({ title: "Error", description: data.error || "Error al eliminar", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    } finally {
      setIsDeletingPage(false);
    }
  };

  const clearSitemapCache = async () => {
    setCacheClearStatus("loading");
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Token ${token}`;
      }

      const response = await fetch("/api/debug/clear-sitemap-cache", {
        method: "POST",
        headers,
      });

      if (response.ok) {
        setCacheClearStatus("success");
        setTimeout(() => setCacheClearStatus("idle"), 2000);
        const freshRes = await fetch("/api/debug/sitemap-urls");
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setSitemapUrls(freshData);
        }
      } else {
        console.error("Failed to clear sitemap cache");
        setCacheClearStatus("idle");
      }
    } catch (error) {
      console.error("Error clearing sitemap cache:", error);
      setCacheClearStatus("idle");
    }
  };

  const handleLocationOverride = () => {
    if (!selectedLocationSlug) return;
    const url = new URL(window.location.href);
    url.searchParams.set("location", selectedLocationSlug);
    window.location.href = url.toString();
  };

  const handleClearLocationOverride = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("location");
    window.location.href = url.toString();
  };

  // Group locations by region for display
  const locationsByRegion = locations.reduce((acc, loc) => {
    if (!acc[loc.region]) acc[loc.region] = [];
    acc[loc.region].push(loc);
    return acc;
  }, {} as Record<string, typeof locations>);

  const regionLabels: Record<string, string> = {
    "usa-canada": "USA & Canada",
    "latam": "Latin America",
    "europe": "Europe",
  };

  // Don't render if hide_debug param is set (for embedded previews)
  if (shouldHide) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50" data-testid="debug-bubble">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Button
              size="icon"
              variant="default"
              className="h-12 w-12 rounded-full shadow-lg"
              data-testid="button-debug-toggle"
            >
              {open ? <IconX className="h-5 w-5" /> : <IconBug className="h-5 w-5" />}
            </Button>
            {/* Show "Commit" indicator when there are local changes that need uploading - only when logged in */}
            {githubSyncStatus?.syncEnabled && pendingChanges.some(c => c.source === 'local' || c.source === 'conflict') && !noTokenDetected && !tokenWithoutCapabilities && (
              <button
                onClick={() => {
                  setCommitModalOpen(true);
                  fetchPendingChanges(); // Refresh pending changes when opening modal
                }}
                className="absolute -top-1 left-full ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium animate-pulse cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: '#fbbf24',
                  color: '#000',
                  boxShadow: '0 0 12px 2px rgba(251, 191, 36, 0.6), 0 0 20px 4px rgba(251, 191, 36, 0.3)',
                }}
                data-testid="indicator-pending-changes"
                title={`${pendingChanges.length} pending change${pendingChanges.length > 1 ? 's' : ''} - click to commit`}
              >
                <IconArrowUp className="h-3 w-3" />
                <span>Commit</span>
              </button>
            )}
            {/* Show "Page errors" indicator when diagnostics found issues */}
            {(pageErrorCount > 0 || pageWarningCount > 0) && (
              <button
                onClick={() => setPageErrorsModalOpen(true)}
                className="absolute left-full ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  top: githubSyncStatus?.syncEnabled && pendingChanges.some(c => c.source === 'local' || c.source === 'conflict') && !noTokenDetected && !tokenWithoutCapabilities ? '1.5rem' : '-0.25rem',
                  backgroundColor: pageErrorCount > 0 ? '#ef4444' : '#f59e0b',
                  color: '#fff',
                  boxShadow: pageErrorCount > 0
                    ? '0 0 12px 2px rgba(239, 68, 68, 0.6), 0 0 20px 4px rgba(239, 68, 68, 0.3)'
                    : '0 0 12px 2px rgba(245, 158, 11, 0.6), 0 0 20px 4px rgba(245, 158, 11, 0.3)',
                }}
                data-testid="indicator-page-errors"
                title={`${pageErrorCount} error${pageErrorCount !== 1 ? 's' : ''}, ${pageWarningCount} warning${pageWarningCount !== 1 ? 's' : ''} - click to view`}
              >
                <IconAlertTriangle className="h-3 w-3" />
                <span>Page errors</span>
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="start" 
          className="w-80 p-0"
          sideOffset={8}
        >
          {/* No token detected - show only warning */}
          {noTokenDetected ? (
            <div className="p-4 pl-[8px] pr-[8px]">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900 flex-shrink-0">
                  <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">No token detected</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Enter your token below or add <code className="bg-muted px-1 rounded">?token=xxx</code> to URL, or{" "}
                    <a 
                      href={`https://breathecode.herokuapp.com/v1/auth/view/login?url=${encodeURIComponent(window.location.href)}`}
                      className="text-primary underline hover:no-underline"
                      data-testid="link-login"
                    >
                      click here to login
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter token..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tokenInput.trim()) {
                          setPendingAutoEditMode(true);
                          validateManualToken(tokenInput.trim());
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      data-testid="input-token"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        setPendingAutoEditMode(true);
                        validateManualToken(tokenInput.trim());
                      }}
                      disabled={!tokenInput.trim() || isLoading}
                      data-testid="button-validate-token"
                    >
                      {isLoading ? (
                        <IconRefresh className="h-4 w-4 animate-spin" />
                      ) : (
                        "Validate"
                      )}
                    </Button>
                  </div>
                  {breathecodeHost && !breathecodeHost.isDefault && (
                    <div className="flex items-start gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                      <IconAlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div>The host is pointing to</div>
                        <div className="font-mono break-all">{breathecodeHost.host}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : tokenWithoutCapabilities ? (
            /* Token exists but not validated - show warning with retry */
            (<div className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                  <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Limited access</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Token detected but no webmaster capabilities have been detected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={retryValidation}
                      disabled={isLoading}
                      className="flex-1"
                      data-testid="button-retry-validation"
                    >
                      {isLoading ? (
                        <IconRefresh className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <IconRefresh className="h-4 w-4 mr-1" />
                          Retry
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearToken}
                      disabled={isLoading}
                      data-testid="button-clear-token"
                    >
                      <IconX className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            </div>)
          ) : (
            <>
              {/* Warning banner for invalid GitHub credentials */}
              {githubSyncStatus?.syncEnabled && githubSyncStatus.status === 'invalid-credentials' && (
                <div className="p-3 bg-red-100 dark:bg-red-900/50 border-b border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-red-800 dark:text-red-200">
                        Invalid GitHub Credentials for Sync
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                        Check GITHUB_TOKEN and GITHUB_REPO_URL settings
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning banner when sync is disabled */}
              {githubSyncStatus && !githubSyncStatus.syncEnabled && githubSyncStatus.configured && (
                <div className="p-3 bg-muted/50 border-b border-border">
                  <div className="flex items-start gap-2">
                    <IconBrandGithub className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">
                        GitHub Sync is Disabled
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Set GITHUB_SYNC_ENABLED=true to enable
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning banner when behind or diverged from GitHub */}
              {githubSyncStatus && (githubSyncStatus.status === 'behind' || githubSyncStatus.status === 'diverged') && (
                <div className="p-3 bg-amber-100 dark:bg-amber-900/50 border-b border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        {githubSyncStatus.status === 'behind' 
                          ? 'Pull latest changes before publishing'
                          : 'Local and remote have diverged'}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        Production content edits may be overwritten
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Persistent Dev Tools header - visible in all menu views */}
              <div className="p-3 border-b pl-[8px] pr-[8px] pt-[3px] pb-[3px]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Dev Tools</h3>
                  <div className="flex items-center gap-2">
                    {/* SEO button - visible only on content pages */}
                    {contentInfo.type && contentInfo.slug && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setSeoModalOpen(true);
                          fetchSeoPreview();
                        }}
                        className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground transition-colors hover-elevate"
                        data-testid="button-edit-seo"
                        title="Edit page SEO & meta tags"
                      >
                        META
                      </button>
                    )}
                    {/* Read/Edit toggle */}
                    {editMode && (
                      <div 
                        className="flex items-center bg-muted rounded-full p-0.5"
                        data-testid="toggle-edit-mode"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!editMode.isEditMode) {
                              editMode.toggleEditMode();
                              // Navigate to preview route if on a content page
                              if (contentInfo.type && contentInfo.slug && !pathname.startsWith('/private/preview/')) {
                                // Extract locale from URL path (e.g., /en/career-programs/... → en)
                                // This is more reliable than i18n.language which can return browser locale like en-US
                                const pathSegments = pathname.split('/').filter(Boolean);
                                const urlLocale = pathSegments[0];
                                const normalizedLocale = normalizeLocale(urlLocale || i18n.language);
                                const previewUrl = `/private/preview/${contentInfo.type}/${contentInfo.slug}?locale=${normalizedLocale}`;
                                navigate(previewUrl);
                              }
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            editMode.isEditMode 
                              ? "bg-primary text-primary-foreground" 
                              : "text-muted-foreground"
                          }`}
                          data-testid="button-edit-mode"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (editMode.isEditMode) editMode.toggleEditMode();
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            !editMode.isEditMode 
                              ? "bg-foreground text-background shadow-sm" 
                              : "text-muted-foreground"
                          }`}
                          data-testid="button-read-mode"
                        >
                          Read
                        </button>
                      </div>
                    )}
                    {/* Preview breakpoint toggle - only visible in edit mode */}
                    {editMode && editMode.isEditMode && (
                      <div 
                        className="flex items-center bg-muted rounded-full p-0.5"
                        data-testid="toggle-preview-breakpoint"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            editMode.setPreviewBreakpoint('desktop');
                          }}
                          className={`p-1.5 rounded-full transition-colors ${
                            editMode.previewBreakpoint === 'desktop' 
                              ? "bg-foreground text-background shadow-sm" 
                              : "text-muted-foreground"
                          }`}
                          data-testid="button-preview-desktop"
                          title="Preview desktop view"
                        >
                          <IconDeviceDesktop className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            editMode.setPreviewBreakpoint('mobile');
                          }}
                          className={`p-1.5 rounded-full transition-colors ${
                            editMode.previewBreakpoint === 'mobile' 
                              ? "bg-foreground text-background shadow-sm" 
                              : "text-muted-foreground"
                          }`}
                          data-testid="button-preview-mobile"
                          title="Preview mobile view"
                        >
                          <IconDeviceMobile className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Menu content based on current view */}
              {menuView === "main" ? (
              <>
              <div className="p-2 space-y-1">
                <ExpandableMenuItem
                  icon={IconMap}
                  label="Sitemap"
                  expanded={sitemapExpanded}
                  onToggle={() => {
                    setSitemapExpanded(!sitemapExpanded);
                    if (!sitemapExpanded) setComponentsExpanded(false);
                  }}
                  testId="button-sitemap-toggle"
                  actions={
                    <button
                      onClick={clearSitemapCache}
                      disabled={cacheClearStatus === "loading"}
                      className="p-1 rounded hover-elevate disabled:opacity-50"
                      data-testid="button-clear-sitemap-cache"
                      title="Clear sitemap cache"
                    >
                      {cacheClearStatus === "loading" ? (
                        <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                      ) : cacheClearStatus === "success" ? (
                        <IconCheck className="h-3.5 w-3.5 text-chart-3" />
                      ) : (
                        <IconRefresh className="h-3.5 w-3.5" />
                      )}
                    </button>
                  }
                >
                  <MenuItem
                    icon={IconMap}
                    label="All URLs"
                    onClick={() => setMenuView("sitemap")}
                    indicator="chevron"
                    testId="button-sitemap-all-urls"
                  />
                  <MenuItem
                    icon={IconRoute}
                    label="Redirects"
                    href="/private/redirects"
                    indicator="arrow"
                    testId="link-redirects-page"
                    rightContent={<span className="text-xs text-muted-foreground">{redirectsList.length || '...'}</span>}
                  />
                </ExpandableMenuItem>
                
                <ExpandableMenuItem
                  icon={IconComponents}
                  label="Components"
                  expanded={componentsExpanded}
                  onToggle={() => {
                    setComponentsExpanded(!componentsExpanded);
                    if (!componentsExpanded) setSitemapExpanded(false);
                  }}
                  testId="button-components-toggle"
                >
                  <MenuItem
                    icon={IconComponents}
                    label="Component Gallery"
                    onClick={() => setMenuView("components")}
                    indicator="chevron"
                    testId="button-gallery-registry"
                  />
                  <MenuItem
                    icon={IconMenu2}
                    label="Menus"
                    onClick={() => setMenuView("menus")}
                    indicator="chevron"
                    testId="button-menus-menu"
                  />
                  <MenuItem
                    icon={IconBrowserPlus}
                    label="Modals"
                    disabled
                    testId="placeholder-modals-menu"
                    rightContent={<span className="text-xs text-muted-foreground">Soon</span>}
                  />
                </ExpandableMenuItem>
                
                <MenuItem
                  icon={IconPhoto}
                  label="Media Gallery"
                  href="/private/media-gallery"
                  indicator="arrow"
                  testId="link-media-gallery"
                />

                <MenuItem
                  icon={IconStethoscope}
                  label="Diagnostics"
                  href="/private/diagnostics"
                  indicator="arrow"
                  testId="link-diagnostics"
                />
                
                {contentInfo.type && contentInfo.slug && (
                  <MenuItem
                    icon={IconFlask}
                    label="Experiments"
                    onClick={() => setMenuView("experiments")}
                    indicator="chevron"
                    testId="button-experiments-menu"
                    rightContent={<span className="text-xs text-muted-foreground">{contentInfo.label}</span>}
                  />
                )}
                
                {/* GitHub sync status */}
                <div className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm">
                  <div className="flex items-center gap-3">
                    <IconBrandGithub className="h-4 w-4 text-muted-foreground" />
                    <span>GitHub Sync</span>
                    {githubSyncStatus && !githubSyncStatus.syncEnabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {syncStatusLoading ? (
                      <IconRefresh className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : githubSyncStatus ? (
                      <>
                        {githubSyncStatus.status === 'in-sync' && (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <IconCheck className="h-3.5 w-3.5" />
                            In sync
                          </span>
                        )}
                        {githubSyncStatus.status === 'behind' && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <IconCloudDownload className="h-3.5 w-3.5" />
                            {githubSyncStatus.behindBy} behind
                          </span>
                        )}
                        {githubSyncStatus.status === 'ahead' && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            {githubSyncStatus.aheadBy} ahead
                          </span>
                        )}
                        {githubSyncStatus.status === 'diverged' && (
                          <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <IconAlertTriangle className="h-3.5 w-3.5" />
                            Diverged
                          </span>
                        )}
                        {githubSyncStatus.status === 'invalid-credentials' && (
                          <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                            <IconAlertTriangle className="h-3.5 w-3.5" />
                            Invalid Credentials
                          </span>
                        )}
                        {githubSyncStatus.status === 'not-configured' && (
                          <span className="text-xs text-muted-foreground">Not configured</span>
                        )}
                        {githubSyncStatus.status === 'unknown' && (
                          <span className="text-xs text-amber-600 dark:text-amber-400" title="Could not compare local and remote commits">
                            Check failed
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                    <button
                      onClick={refreshSyncStatus}
                      disabled={syncStatusLoading}
                      className="p-1 rounded hover-elevate disabled:opacity-50"
                      data-testid="button-refresh-sync-status"
                      title="Refresh sync status"
                    >
                      <IconRefresh className={`h-3.5 w-3.5 ${syncStatusLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {githubSyncStatus?.syncEnabled && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fetchPendingChanges();
                          setCommitModalOpen(true);
                        }}
                        className="p-1 rounded hover-elevate"
                        data-testid="button-open-sync-modal"
                        title="Manage file sync"
                      >
                        <IconCloudDownload className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t p-2 space-y-1">
                {/* Session Group */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <IconDatabase className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Session</span>
                      {!hasToken && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">(no auth)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCheckSession}
                        disabled={isCheckingSession}
                        className="p-1 rounded hover-elevate"
                        data-testid="button-session-refresh"
                        title="Check session validity"
                      >
                        <IconRefresh className={`h-3.5 w-3.5 text-muted-foreground ${isCheckingSession ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => setSessionModalOpen(true)}
                        className="p-1 rounded hover-elevate"
                        data-testid="button-session-view"
                        title="View session data"
                      >
                        <IconPencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="pl-2 space-y-0.5">
                    <button
                      onClick={() => {
                        setSelectedLocationSlug(session.location?.slug || "");
                        setLocationModalOpen(true);
                      }}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover-elevate"
                      data-testid="button-location-override"
                    >
                      <div className="flex items-center gap-3">
                        <IconMapPin className="h-4 w-4 text-muted-foreground" />
                        <span>Location</span>
                        {currentLocationOverride && (
                          <span className="text-xs text-muted-foreground">(override)</span>
                        )}
                      </div>
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-[100px] truncate">
                        {session.location?.name || 'Detecting...'}
                      </code>
                    </button>
                    
                    <button
                      onClick={toggleLanguage}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover-elevate"
                      data-testid="button-toggle-language"
                    >
                      <div className="flex items-center gap-3">
                        <IconLanguage className="h-4 w-4 text-muted-foreground" />
                        <span>Language</span>
                      </div>
                      <span className="text-xs font-medium bg-muted px-2 py-1 rounded">{currentLang}</span>
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover-elevate"
                  data-testid="button-toggle-theme"
                >
                  <div className="flex items-center gap-3">
                    {theme === "light" ? (
                      <IconSun className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconMoon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Theme</span>
                  </div>
                  <span className="text-xs font-medium bg-muted px-2 py-1 rounded capitalize">{theme}</span>
                </button>
              </div>
              </>
              ) : menuView === "components" ? (
              <>
              <div className="px-3 py-2 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setMenuView("main"); setComponentSearch(""); setShowComponentSearch(false); }}
                      className="p-1 rounded-md hover-elevate"
                      data-testid="button-back-to-main"
                    >
                      <IconArrowLeft className="h-4 w-4" />
                    </button>
                    {showComponentSearch ? (
                      <div className="relative flex-1">
                        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search components..."
                          value={componentSearch}
                          onChange={(e) => setComponentSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-component-search"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-semibold text-sm">Gallery Registry</h3>
                        <p className="text-xs text-muted-foreground">{filteredComponents.length} components</p>
                      </div>
                    )}
                  </div>
                  {showComponentSearch ? (
                    <button
                      onClick={() => { setShowComponentSearch(false); setComponentSearch(""); }}
                      className="p-1.5 rounded hover-elevate"
                      title="Cancel search"
                      data-testid="button-cancel-component-search"
                    >
                      <IconX className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowComponentSearch(true)}
                      className="p-1.5 rounded hover-elevate"
                      title="Search components"
                      data-testid="button-toggle-component-search"
                    >
                      <IconSearch className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {!componentRegistryData ? (
                    <div className="flex items-center justify-center py-8">
                      <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredComponents.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No components found
                    </div>
                  ) : (
                    filteredComponents.map((component) => {
                      const Icon = componentIconMap[component.type] || IconComponents;
                      return (
                        <a
                          key={component.type}
                          href={`/private/component-showcase/${component.type}`}
                          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate cursor-pointer"
                          data-testid={`link-component-${component.type}`}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{component.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{component.description}</div>
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </>
          ) : menuView === "experiments" ? (
            <>
              <div className="px-3 py-2 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setMenuView("main")}
                      className="p-1 rounded-md hover-elevate"
                      data-testid="button-back-to-main-experiments"
                    >
                      <IconArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <h3 className="font-semibold text-sm">Experiments</h3>
                      <p className="text-xs text-muted-foreground">
                        {contentInfo.label}: {contentInfo.slug}
                      </p>
                    </div>
                  </div>
                  <button
                    className="p-1.5 rounded hover-elevate"
                    title="Create new experiment"
                    data-testid="button-create-experiment"
                  >
                    <IconPlus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {experimentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !experimentsData?.hasExperimentsFile ? (
                    <div className="text-center py-8 px-4">
                      <IconFlask className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">No experiments file found</p>
                      <p className="text-xs text-muted-foreground">
                        Create <code className="bg-muted px-1 rounded">experiments.yml</code> in the content folder
                      </p>
                    </div>
                  ) : experimentsData.experiments.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <IconFlask className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No experiments defined</p>
                    </div>
                  ) : (
                    experimentsData.experiments.map((experiment) => {
                      const statusColors: Record<string, string> = {
                        planned: "bg-muted text-muted-foreground",
                        active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                        paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                        winner: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                        archived: "bg-muted text-muted-foreground opacity-60",
                      };
                      const totalExposures = Object.values(experiment.stats || {}).reduce((a, b) => a + b, 0);
                      
                      return (
                        <a
                          key={experiment.slug}
                          href={`/private/${contentInfo.type}/${contentInfo.slug}/experiment/${experiment.slug}`}
                          onClick={handleLinkClick}
                          className="flex flex-col w-full px-3 py-2.5 rounded-md text-sm hover-elevate cursor-pointer text-left"
                          data-testid={`button-experiment-${experiment.slug}`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="font-medium">{deslugify(experiment.slug)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[experiment.status]}`}>
                              {experiment.status}
                            </span>
                          </div>
                          {experiment.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                              {experiment.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{experiment.variants.length} variants</span>
                            {totalExposures > 0 && (
                              <span>{totalExposures} exposures</span>
                            )}
                            {experiment.max_visitors && (
                              <span>max {experiment.max_visitors}</span>
                            )}
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </>
          ) : menuView === "menus" ? (
            <>
              <div className="px-3 py-2 border-b">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMenuView("main")}
                    className="p-1 rounded-md hover-elevate"
                    data-testid="button-back-to-main-menus"
                  >
                    <IconArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h3 className="font-semibold text-sm">Menus</h3>
                    <p className="text-xs text-muted-foreground">Navigation menu configurations</p>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  <MenusView />
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <div className="px-3 py-2 border-b">
                <div className="flex items-center justify-between gap-2">
                  {showSitemapSearch ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative flex-1 min-w-0">
                        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search URLs..."
                          value={sitemapSearch}
                          onChange={(e) => setSitemapSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-sitemap-search"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => { setShowSitemapSearch(false); setSitemapSearch(""); }}
                        className="p-1.5 rounded hover-elevate flex-shrink-0"
                        title="Cancel search"
                        data-testid="button-cancel-sitemap-search"
                      >
                        <IconX className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setMenuView("main")}
                          className="p-1 rounded-md hover-elevate"
                          data-testid="button-back-to-main-sitemap"
                        >
                          <IconArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                          <h3 className="font-semibold text-sm">Sitemap URLs</h3>
                          <p className="text-xs text-muted-foreground">{sitemapUrls.length} URLs indexed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCreateContentModalOpen(true)}
                          className="p-1.5 rounded hover-elevate"
                          title="Create new content"
                          data-testid="button-create-content"
                        >
                          <IconPlus className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setShowSitemapSearch(true)}
                          className="p-1.5 rounded hover-elevate"
                          title="Search"
                          data-testid="button-toggle-sitemap-search"
                        >
                          <IconSearch className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <a
                          href="/sitemap.xml"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover-elevate"
                          title="Open sitemap.xml"
                          data-testid="link-sitemap-xml"
                        >
                          <IconExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-[240px]">
                <div className="p-2 space-y-1">
                  {sitemapLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredSitemapUrls.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No URLs found
                    </div>
                  ) : (
                    <>
                      {folders.map((folder) => (
                        <div key={folder.name} className="mb-1">
                          <button
                            onClick={() => toggleFolder(folder.name)}
                            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover-elevate cursor-pointer"
                            data-testid={`button-folder-${folder.name.toLowerCase()}`}
                          >
                            {expandedFolders.has(folder.name) ? (
                              <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <IconChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <IconFolder className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-medium">{folder.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {folder.urls.length}
                            </span>
                          </button>
                          {expandedFolders.has(folder.name) && (
                            <div className="ml-4 border-l pl-2 space-y-1 mt-1">
                              {folder.urls.map((url, urlIndex) => {
                                const path = new URL(url.loc).pathname;
                                return (
                                  <div
                                    key={`${folder.name}-${urlIndex}-${url.loc}`}
                                    className="group flex items-center gap-1 px-3 py-1 rounded-md hover-elevate"
                                  >
                                    <a
                                      href={path}
                                      className="flex-1 text-xs text-muted-foreground cursor-pointer truncate"
                                      data-testid={`link-sitemap-url-${url.label.toLowerCase().replace(/\s+/g, '-')}`}
                                    >
                                      {path}
                                    </a>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`button-url-menu-${url.label.toLowerCase().replace(/\s+/g, '-')}`}
                                        >
                                          <IconDotsVertical className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem onClick={() => handleDuplicatePage(url)} className="text-[13px]" data-testid={`menu-duplicate-${url.label.toLowerCase().replace(/\s+/g, '-')}`}>
                                          <IconCopy className="h-3.5 w-3.5 mr-2" />
                                          Duplicate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownloadYml(url)} className="text-[13px]" data-testid={`menu-download-${url.label.toLowerCase().replace(/\s+/g, '-')}`}>
                                          <IconDownload className="h-3.5 w-3.5 mr-2" />
                                          Download YAML
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeletePage(url)} className="text-[13px] text-destructive" data-testid={`menu-delete-${url.label.toLowerCase().replace(/\s+/g, '-')}`}>
                                          <IconTrash className="h-3.5 w-3.5 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                      {rootUrls.map((url, urlIndex) => {
                        const path = new URL(url.loc).pathname;
                        return (
                          <div
                            key={`root-${urlIndex}-${url.loc}`}
                            className="group flex items-center gap-1 px-3 py-1.5 rounded-md hover-elevate"
                          >
                            <a
                              href={path}
                              className="flex-1 text-xs text-muted-foreground cursor-pointer truncate"
                              data-testid={`link-sitemap-url-${url.label.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {path}
                            </a>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`button-url-menu-root-${url.label.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <IconDotsVertical className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleDuplicatePage(url)} className="text-[13px]" data-testid={`menu-duplicate-root-${url.label.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <IconCopy className="h-3.5 w-3.5 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadYml(url)} className="text-[13px]" data-testid={`menu-download-root-${url.label.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <IconDownload className="h-3.5 w-3.5 mr-2" />
                                  Download YAML
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeletePage(url)} className="text-[13px] text-destructive" data-testid={`menu-delete-root-${url.label.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <IconTrash className="h-3.5 w-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
            </>
          )}
        </PopoverContent>
      </Popover>
      <Dialog open={locationModalOpen} onOpenChange={setLocationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override Session Location</DialogTitle>
            <DialogDescription>
              You can override the auto-detected location by adding a <code className="text-xs bg-muted px-1 py-0.5 rounded">?location=slug</code> query parameter to any URL. This is useful for testing location-specific content.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select new Location</label>
              <Select value={selectedLocationSlug} onValueChange={setSelectedLocationSlug}>
                <SelectTrigger data-testid="select-location-override">
                  <SelectValue placeholder="Choose a location..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(locationsByRegion).map(([region, locs]) => (
                    <SelectGroup key={region}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground">
                        {regionLabels[region] || region}
                      </SelectLabel>
                      {locs.map((loc) => (
                        <SelectItem key={loc.slug} value={loc.slug}>
                          {loc.name}, {loc.country}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {currentLocationOverride && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Currently overriding:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{currentLocationOverride}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearLocationOverride}
                  className="h-6 px-2 text-xs"
                  data-testid="button-clear-location-override"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setLocationModalOpen(false)}
              data-testid="button-cancel-location-override"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLocationOverride}
              disabled={!selectedLocationSlug}
              data-testid="button-confirm-location-override"
            >
              Override Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={sessionModalOpen} onOpenChange={setSessionModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Data{getDebugUserName() ? ` - ${getDebugUserName()}` : ''}</DialogTitle>
            <DialogDescription>
              Current session values captured from browser, geolocation, and URL parameters.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {hasToken && getDebugToken() && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Authentication Token</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-2 py-1.5 rounded text-xs font-mono truncate" data-testid="text-session-token">
                    {getDebugToken()}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => {
                      const token = getDebugToken();
                      if (token) {
                        navigator.clipboard.writeText(token);
                        setTokenCopied(true);
                        setTimeout(() => setTokenCopied(false), 2000);
                      }
                    }}
                    data-testid="button-copy-token"
                  >
                    {tokenCopied ? (
                      <IconCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <IconCopy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => {
                      clearToken();
                      setSessionModalOpen(false);
                    }}
                    data-testid="button-clear-session-token"
                    title="Clear token"
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className={`space-y-3 ${hasToken && getDebugToken() ? 'border-t pt-3' : ''}`}>
              <h4 className="text-sm font-semibold text-foreground">Geolocation</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.country || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">City:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.city || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Region:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.region || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timezone:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.timezone || 'N/A'}</code>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Device</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.deviceCategory || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OS:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.osFamily || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Browser:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.browserFamily || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Viewport:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.viewportWidth}x{session.device?.viewportHeight}</code>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Pixel Ratio:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.devicePixelRatio || 'N/A'}</code>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">UTM Parameters</h4>
              <div className="space-y-1.5 text-sm">
                {(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_placement', 'utm_plan'] as const).map(key => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.utm?.[key] || '—'}</code>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Tracking</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PPC Tracking ID:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs max-w-[150px] truncate">{session.utm?.ppc_tracking_id || '—'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Referral:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.utm?.referral || session.utm?.ref || '—'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coupon:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.utm?.coupon || '—'}</code>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Experiment</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Experiment:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.experiment?.experiment_slug || '—'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variant:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.experiment?.variant_slug || '—'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.experiment?.variant_version ?? '—'}</code>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Session Info</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Language:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.language}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Browser Lang:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.browserLang || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location Campus:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.location?.slug || 'N/A'}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initialized:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.initialized ? 'Yes' : 'No'}</code>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSessionModalOpen(false)}
              data-testid="button-close-session-modal"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Sync Files Modal */}
      <Dialog open={commitModalOpen} onOpenChange={setCommitModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBrandGithub className="h-5 w-5" />
              Sync Files with GitHub
            </DialogTitle>
            <DialogDescription>
              Upload your local changes to remote or download incoming changes from remote.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Pending changes list */}
            <div className="space-y-2">
              {pendingChangesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : pendingChanges.length === 0 ? (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground">
                    All files are in sync. No local or remote changes detected.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[250px]">
                  <div className="space-y-1">
                    {pendingChanges.map((change, index) => (
                      <Card 
                        key={`${change.file}-${index}`}
                        className="p-2 space-y-1"
                      >
                        {/* Row 1: File path only */}
                        <div 
                          className="font-mono text-xs text-foreground truncate"
                          title={change.file}
                        >
                          {change.file.replace('marketing-content/', '')}
                        </div>
                        
                        {/* Row 2: Badge | Author | Date | Commit hash | Actions */}
                        {selectedFileForCommit === change.file ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={fileCommitMessage}
                              onChange={(e) => setFileCommitMessage(e.target.value)}
                              placeholder="Commit message..."
                              className="w-full px-2 py-1.5 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              data-testid={`input-file-commit-message-${index}`}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && fileCommitMessage.trim()) {
                                  handleFileCommit(change.file);
                                } else if (e.key === 'Escape') {
                                  setSelectedFileForCommit(null);
                                  setFileCommitMessage("");
                                }
                              }}
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-7 text-xs flex-1"
                                onClick={() => handleFileCommit(change.file)}
                                disabled={!fileCommitMessage.trim() || fileCommitting === change.file}
                                data-testid={`button-confirm-file-commit-${index}`}
                              >
                                {fileCommitting === change.file ? (
                                  <IconRefresh className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <IconArrowUp className="h-3 w-3 mr-1" />
                                    Commit
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setSelectedFileForCommit(null);
                                  setFileCommitMessage("");
                                }}
                                data-testid={`button-cancel-file-commit-${index}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Badge */}
                            <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                              change.source === 'conflict'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                : change.source === 'incoming'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            }`}>
                              {change.source === 'conflict' ? 'Conflict' : change.source === 'incoming' ? 'Incoming update' : 'Local update'}
                            </span>
                            
                            {/* Author */}
                            <span className="text-xs text-muted-foreground">
                              {change.author || (change.source === 'local' ? 'Legacy yourself' : '')}
                            </span>
                            
                            {/* Date */}
                            {change.date && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(change.date).toLocaleDateString()}
                              </span>
                            )}
                            
                            {/* Commit hash (clickable) */}
                            {change.commitSha && githubSyncStatus?.repoUrl && (
                              <a
                                href={`${githubSyncStatus.repoUrl.replace(/\.git$/, '')}/commit/${change.commitSha}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline"
                                title={`View commit ${change.commitSha}`}
                                data-testid={`link-commit-${index}`}
                              >
                                {change.commitSha.substring(0, 7)}
                              </a>
                            )}
                            
                            {/* Spacer to push buttons to the right */}
                            <div className="flex-1" />
                            
                            {/* Action buttons */}
                            <div className="flex items-center gap-1">
                              {/* Backup download button - always visible */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={async () => {
                                      try {
                                        const token = getDebugToken();
                                        const headers: Record<string, string> = {};
                                        if (token) {
                                          headers["Authorization"] = `Token ${token}`;
                                        }
                                        const response = await fetch(`/api/content/file?path=${encodeURIComponent(change.file)}`, { headers });
                                        if (!response.ok) throw new Error('Failed to fetch file');
                                        const content = await response.text();
                                        const blob = new Blob([content], { type: 'application/x-yaml' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        const pathParts = change.file.replace('marketing-content/', '').split('/');
                                        const fileName = pathParts.length >= 2 
                                          ? `${pathParts[pathParts.length - 2]}.${pathParts[pathParts.length - 1]}`
                                          : pathParts.pop() || 'backup.yml';
                                        a.download = fileName;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                        toast({
                                          title: "Backup downloaded",
                                          description: `Downloaded ${change.file.split('/').pop()}`,
                                        });
                                      } catch (error) {
                                        console.error('Failed to download backup:', error);
                                        toast({
                                          title: "Download failed",
                                          description: "Could not download the backup file",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    data-testid={`button-backup-file-${index}`}
                                  >
                                    <IconDeviceFloppy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Download a backup of my page</p>
                                </TooltipContent>
                              </Tooltip>
                              {/* Show Upload button for local changes and conflicts */}
                              {(change.source === 'local' || change.source === 'conflict') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        setSelectedFileForCommit(change.file);
                                        setFileCommitMessage("");
                                      }}
                                      data-testid={`button-commit-file-${index}`}
                                    >
                                      <IconArrowUp className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p>Upload my version to remote</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {/* Show Download button for incoming changes and conflicts */}
                              {(change.source === 'incoming' || change.source === 'conflict') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        if (change.source === 'conflict') {
                                          setConfirmPullFile(change.file);
                                        } else {
                                          handleFilePull(change.file);
                                        }
                                      }}
                                      disabled={filePulling === change.file}
                                      data-testid={`button-pull-file-${index}`}
                                    >
                                      {filePulling === change.file ? (
                                        <IconRefresh className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <IconArrowDown className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p>Download and Override mine</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            
            {/* Advanced Options - always visible */}
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setAdvancedOptionsOpen(!advancedOptionsOpen)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-advanced-options"
              >
                {advancedOptionsOpen ? (
                  <IconChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <IconChevronRight className="h-3.5 w-3.5" />
                )}
                Advanced options
              </button>
              
              {advancedOptionsOpen && (
                <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Discard all your local changes and reset to the remote version.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleIgnoreAllChanges}
                    disabled={isIgnoringAllChanges || !pendingChanges.some(c => c.source === 'local' || c.source === 'conflict')}
                    data-testid="button-ignore-all-changes"
                  >
                    {isIgnoringAllChanges ? (
                      <>
                        <IconRefresh className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <IconTrash className="h-3.5 w-3.5 mr-1.5" />
                        Ignore all my local changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommitModalOpen(false);
                setSelectedFileForCommit(null);
                setFileCommitMessage("");
                setAdvancedOptionsOpen(false);
              }}
              data-testid="button-close-commit-modal"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Pull Conflict Modal */}
      <Dialog open={pullConflictModalOpen} onOpenChange={setPullConflictModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle>Conflicting Files Detected</DialogTitle>
                <DialogDescription>
                  The following files have been modified both locally and on remote.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-4">
            <ScrollArea className="max-h-[200px] border rounded-md">
              <div className="p-2 space-y-1">
                {pullConflictFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span 
                      className="font-mono text-xs truncate" 
                      title={file}
                    >
                      {file.replace('marketing-content/', '')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <p className="text-xs text-muted-foreground mt-3">
              Pulling will overwrite your local changes to these files.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPullConflictModalOpen(false)}
              data-testid="button-cancel-pull"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPullConflictModalOpen(false);
                setCommitModalOpen(true);
              }}
              data-testid="button-commit-first"
            >
              <IconArrowUp className="h-4 w-4 mr-2" />
              Commit First
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setPullConflictModalOpen(false);
                executeSyncFromRemote();
              }}
              data-testid="button-pull-anyway"
            >
              <IconCloudDownload className="h-4 w-4 mr-2" />
              Pull Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Per-file Download Confirmation Modal */}
      <Dialog open={confirmPullFile !== null} onOpenChange={(open) => !open && setConfirmPullFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <IconCloudDownload className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle>Download and Override Local File?</DialogTitle>
                <DialogDescription>
                  This will replace your local version with the remote version.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span 
                className="font-mono text-sm truncate" 
                title={confirmPullFile || ''}
              >
                {confirmPullFile?.replace('marketing-content/', '')}
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground mt-3">
              Your local version will be replaced with the remote version. This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmPullFile(null)}
              disabled={filePulling === confirmPullFile}
              data-testid="button-cancel-pull-file"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmPullFile) {
                  handleFilePull(confirmPullFile);
                }
              }}
              disabled={filePulling === confirmPullFile}
              data-testid="button-confirm-pull-file"
            >
              {filePulling === confirmPullFile ? (
                <>
                  <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <IconCloudDownload className="h-4 w-4 mr-2" />
                  Download and Override mine
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Page Confirmation Modal */}
      <Dialog open={deletePageModalOpen} onOpenChange={(open) => {
        setDeletePageModalOpen(open);
        if (!open) {
          setDeleteConfirmInput("");
          setDeletingPage(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar página</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-2">
              Esta acción es irreversible y permanente. Si estás seguro de eliminar <span className="font-bold text-foreground">{deletingPage?.slug}</span> entonces escribe el nombre de la página acá abajo y dale click a confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm text-muted-foreground">
              Escribe <span className="font-mono font-bold text-foreground">{deletingPage?.slug}</span> para completar esta acción:
            </label>
            <input
              value={deleteConfirmInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmInput(e.target.value)}
              placeholder={deletingPage?.slug || ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="input-delete-confirm-slug"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeletePageModalOpen(false);
                setDeleteConfirmInput("");
                setDeletingPage(null);
              }}
              data-testid="button-delete-cancel"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmInput !== deletingPage?.slug || isDeletingPage}
              onClick={confirmDeletePage}
              data-testid="button-delete-confirm"
            >
              {isDeletingPage ? "Eliminando..." : "Confirmar eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Create Content Modal */}
      <Dialog open={createContentModalOpen} onOpenChange={(open) => {
        setCreateContentModalOpen(open);
        if (!open) {
          setCreateContentTitle("");
          setCreateContentSlugEn("");
          setCreateContentSlugEs("");
          setCreateContentSlugEnStatus('idle');
          setCreateContentSlugEsStatus('idle');
          setSlugEnConflictReason(null);
          setSlugEsConflictReason(null);
          setEditingSlugEn(false);
          setEditingSlugEs(false);
          setCreateContentType('page');
          setDuplicatingPage(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {duplicatingPage ? (
                <>
                  <IconCopy className="h-5 w-5" />
                  Duplicando página
                </>
              ) : (
                <>
                  <IconPlus className="h-5 w-5" />
                  Create New Content
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {duplicatingPage ? (
                <>Estás duplicando: <strong>{duplicatingPage.label}</strong></>
              ) : (
                <>Create a new page, location, program, or landing with starter YAML files.</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <div className="flex items-center gap-2">
                <Select 
                  value={createContentType} 
                  disabled={!!duplicatingPage}
                  onValueChange={(v) => {
                    setCreateContentType(v as 'location' | 'page' | 'program' | 'landing');
                    // Re-validate slugs with new type (skip for landing - uses different validation)
                    if (v !== 'landing') {
                      if (createContentSlugEn) {
                        setCreateContentSlugEnStatus('checking');
                        fetch(`/api/content/check-slug?type=${v}&slug=${createContentSlugEn}&locale=en`)
                          .then(res => res.json())
                          .then(data => {
                            setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                            setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                          })
                          .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                      }
                      if (createContentSlugEs) {
                        setCreateContentSlugEsStatus('checking');
                        fetch(`/api/content/check-slug?type=${v}&slug=${createContentSlugEs}&locale=es`)
                          .then(res => res.json())
                          .then(data => {
                            setCreateContentSlugEsStatus(data.available ? 'available' : 'taken');
                            setSlugEsConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                          })
                          .catch(() => { setCreateContentSlugEsStatus('idle'); setSlugEsConflictReason(null); });
                      }
                    } else {
                      // For landings, validate single slug
                      if (createContentSlugEn) {
                        setCreateContentSlugEnStatus('checking');
                        fetch(`/api/content/check-slug?type=landing&slug=${createContentSlugEn}`)
                          .then(res => res.json())
                          .then(data => {
                            setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                            setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                          })
                          .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                      }
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-content-type" className={createContentType === 'landing' ? 'flex-1' : 'w-full'}>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Page</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="landing">Landing</SelectItem>
                  </SelectContent>
                </Select>
                
                {createContentType === 'landing' && (
                  <Select value={createLandingLocale} onValueChange={(v) => setCreateLandingLocale(v as 'en' | 'es')}>
                    <SelectTrigger className="w-36" data-testid="select-landing-locale">
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          <LocaleFlag locale={createLandingLocale} />
                          <span>{createLandingLocale === 'en' ? 'English' : 'Spanish'}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        <span className="flex items-center gap-2">
                          <LocaleFlag locale="en" />
                          <span>English</span>
                        </span>
                      </SelectItem>
                      <SelectItem value="es">
                        <span className="flex items-center gap-2">
                          <LocaleFlag locale="es" />
                          <span>Spanish</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                value={createContentTitle}
                onChange={(e) => {
                  const title = e.target.value;
                  setCreateContentTitle(title);
                  const slug = title
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');
                  setCreateContentSlugEn(slug);
                  setCreateContentSlugEs(slug);
                  if (slug) {
                    if (createContentType === 'landing') {
                      // Landings: single slug validation
                      setCreateContentSlugEnStatus('checking');
                      fetch(`/api/content/check-slug?type=landing&slug=${slug}`)
                        .then(res => res.json())
                        .then(data => {
                          setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                          setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                        })
                        .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                    } else {
                      // Other types: validate both EN/ES slugs
                      setCreateContentSlugEnStatus('checking');
                      setCreateContentSlugEsStatus('checking');
                      fetch(`/api/content/check-slug?type=${createContentType}&slug=${slug}&locale=en`)
                        .then(res => res.json())
                        .then(data => {
                          setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                          setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                        })
                        .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                      fetch(`/api/content/check-slug?type=${createContentType}&slug=${slug}&locale=es`)
                        .then(res => res.json())
                        .then(data => {
                          setCreateContentSlugEsStatus(data.available ? 'available' : 'taken');
                          setSlugEsConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                        })
                        .catch(() => { setCreateContentSlugEsStatus('idle'); setSlugEsConflictReason(null); });
                    }
                  } else {
                    setCreateContentSlugEnStatus('idle');
                    setCreateContentSlugEsStatus('idle');
                    setSlugEnConflictReason(null);
                    setSlugEsConflictReason(null);
                  }
                }}
                placeholder="e.g., Career Development Guide"
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="input-content-title"
              />
            </div>
            
            {createContentSlugEn && createContentType === 'landing' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                {/* Single slug for landings */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Sitemap URL:</p>
                  <div className="flex items-center gap-2">
                    {editingSlugEn ? (
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">/landing/</span>
                        <input
                          type="text"
                          value={createContentSlugEn}
                          onChange={(e) => {
                            const slug = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, '-')
                              .replace(/[^a-z0-9-]/g, '')
                              .replace(/-+/g, '-');
                            setCreateContentSlugEn(slug);
                            if (slug) {
                              setCreateContentSlugEnStatus('checking');
                              fetch(`/api/content/check-slug?type=landing&slug=${slug}`)
                                .then(res => res.json())
                                .then(data => {
                                  setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                                  setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                                })
                                .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                            } else {
                              setCreateContentSlugEnStatus('idle');
                              setSlugEnConflictReason(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-slug-landing"
                          autoFocus
                          onBlur={() => setEditingSlugEn(false)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingSlugEn(false)}
                        />
                      </div>
                    ) : (
                      <code 
                        className="flex-1 text-xs bg-background px-2 py-1 rounded cursor-pointer hover-elevate"
                        onClick={() => setEditingSlugEn(true)}
                        data-testid="url-preview-landing"
                      >
                        /landing/{createContentSlugEn}
                      </code>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingSlugEn(!editingSlugEn)}
                      className="p-1 rounded hover-elevate"
                      title="Edit slug"
                      data-testid="button-edit-slug-landing"
                    >
                      <IconPencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <div className="w-4">
                      {createContentSlugEnStatus === 'checking' && (
                        <IconRefresh className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {createContentSlugEnStatus === 'available' && (
                        <IconCheck className="h-4 w-4 text-green-600" />
                      )}
                      {createContentSlugEnStatus === 'taken' && (
                        <IconX className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  {createContentSlugEnStatus === 'taken' && (
                    <p className="text-xs text-red-600 pl-1">{slugEnConflictReason || 'This slug is already taken'}</p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Files that will be created:</p>
                  <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
                    <div>marketing-content/landings/{createContentSlugEn}/</div>
                    <div className="pl-4">├── _common.yml</div>
                    <div className="pl-4">└── promoted.yml</div>
                  </div>
                </div>
              </div>
            )}
            
            {createContentSlugEn && createContentType !== 'landing' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">URLs that will be created:</p>
                  
                  {/* English URL Row */}
                  <div className="flex items-center gap-2">
                    {editingSlugEn ? (
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {buildContentUrl(createContentType as ContentType, '', 'en').slice(0, -1)}
                        </span>
                        <input
                          type="text"
                          value={createContentSlugEn}
                          onChange={(e) => {
                            const slug = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, '-')
                              .replace(/[^a-z0-9-]/g, '')
                              .replace(/-+/g, '-');
                            setCreateContentSlugEn(slug);
                            if (slug) {
                              setCreateContentSlugEnStatus('checking');
                              fetch(`/api/content/check-slug?type=${createContentType}&slug=${slug}&locale=en`)
                                .then(res => res.json())
                                .then(data => {
                                  setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                                  setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                                })
                                .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                            } else {
                              setCreateContentSlugEnStatus('idle');
                              setSlugEnConflictReason(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-slug-en"
                          autoFocus
                          onBlur={() => setEditingSlugEn(false)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingSlugEn(false)}
                        />
                      </div>
                    ) : (
                      <code 
                        className="flex-1 text-xs bg-background px-2 py-1 rounded cursor-pointer hover-elevate"
                        onClick={() => setEditingSlugEn(true)}
                        data-testid="url-preview-en"
                      >
                        {buildContentUrl(createContentType as ContentType, createContentSlugEn, 'en')}
                      </code>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingSlugEn(!editingSlugEn)}
                      className="p-1 rounded hover-elevate"
                      title="Edit English slug"
                      data-testid="button-edit-slug-en"
                    >
                      <IconPencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <div className="w-4">
                      {createContentSlugEnStatus === 'checking' && (
                        <IconRefresh className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {createContentSlugEnStatus === 'available' && (
                        <IconCheck className="h-4 w-4 text-green-600" />
                      )}
                      {createContentSlugEnStatus === 'taken' && (
                        <IconX className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  {createContentSlugEnStatus === 'taken' && (
                    <p className="text-xs text-red-600 pl-1">{slugEnConflictReason || 'English slug is taken'}</p>
                  )}
                  
                  {/* Spanish URL Row */}
                  <div className="flex items-center gap-2">
                    {editingSlugEs ? (
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {buildContentUrl(createContentType as ContentType, '', 'es').slice(0, -1)}
                        </span>
                        <input
                          type="text"
                          value={createContentSlugEs}
                          onChange={(e) => {
                            const slug = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, '-')
                              .replace(/[^a-z0-9-]/g, '')
                              .replace(/-+/g, '-');
                            setCreateContentSlugEs(slug);
                            if (slug) {
                              setCreateContentSlugEsStatus('checking');
                              fetch(`/api/content/check-slug?type=${createContentType}&slug=${slug}&locale=es`)
                                .then(res => res.json())
                                .then(data => {
                                  setCreateContentSlugEsStatus(data.available ? 'available' : 'taken');
                                  setSlugEsConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                                })
                                .catch(() => { setCreateContentSlugEsStatus('idle'); setSlugEsConflictReason(null); });
                            } else {
                              setCreateContentSlugEsStatus('idle');
                              setSlugEsConflictReason(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-slug-es"
                          autoFocus
                          onBlur={() => setEditingSlugEs(false)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingSlugEs(false)}
                        />
                      </div>
                    ) : (
                      <code 
                        className="flex-1 text-xs bg-background px-2 py-1 rounded cursor-pointer hover-elevate"
                        onClick={() => setEditingSlugEs(true)}
                        data-testid="url-preview-es"
                      >
                        {buildContentUrl(createContentType as ContentType, createContentSlugEs, 'es')}
                      </code>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingSlugEs(!editingSlugEs)}
                      className="p-1 rounded hover-elevate"
                      title="Edit Spanish slug"
                      data-testid="button-edit-slug-es"
                    >
                      <IconPencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <div className="w-4">
                      {createContentSlugEsStatus === 'checking' && (
                        <IconRefresh className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {createContentSlugEsStatus === 'available' && (
                        <IconCheck className="h-4 w-4 text-green-600" />
                      )}
                      {createContentSlugEsStatus === 'taken' && (
                        <IconX className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  {createContentSlugEsStatus === 'taken' && (
                    <p className="text-xs text-red-600 pl-1">{slugEsConflictReason || 'Spanish slug is taken'}</p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Files that will be created:</p>
                  <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
                    <div>marketing-content/{createContentType === 'location' ? 'locations' : createContentType === 'program' ? 'programs' : 'pages'}/{createContentSlugEn}/</div>
                    <div className="pl-4">├── _common.yml</div>
                    <div className="pl-4">├── en.yml</div>
                    <div className="pl-4">└── es.yml</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCreateContentModalOpen(false)}
              data-testid="button-cancel-create-content"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Validation differs for landings vs other types
                if (createContentType === 'landing') {
                  if (!createContentSlugEn || createContentSlugEnStatus !== 'available') return;
                } else {
                  if (!createContentSlugEn || !createContentSlugEs || 
                      createContentSlugEnStatus !== 'available' || 
                      createContentSlugEsStatus !== 'available') return;
                }
                
                setIsCreatingContent(true);
                try {
                  const token = getDebugToken();
                  
                  // Different endpoint for landings
                  if (createContentType === 'landing') {
                    const response = await fetch('/api/content/create-landing', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Token ${token}` } : {}),
                      },
                      body: JSON.stringify({
                        slug: createContentSlugEn,
                        locale: createLandingLocale,
                        title: createContentTitle || createContentSlugEn,
                        ...(duplicatingPage ? { sourceUrl: duplicatingPage.loc } : {}),
                      }),
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                      const newUrl = `/landing/${createContentSlugEn}`;
                      toast({
                        title: "Landing created",
                        description: `Created new landing at ${newUrl}`,
                      });
                      setCreateContentModalOpen(false);
                      setCreateContentTitle("");
                      setCreateContentSlugEn("");
                      setCreateContentSlugEs("");
                      setCreateContentSlugEnStatus('idle');
                      setCreateContentSlugEsStatus('idle');
                      setSlugEnConflictReason(null);
                      setSlugEsConflictReason(null);
                      setCreateLandingLocale('en');
                      
                      // Refresh sitemap
                      setSitemapLoading(true);
                      const sitemapRes = await fetch('/api/debug/sitemap-urls');
                      if (sitemapRes.ok) {
                        const urls = await sitemapRes.json();
                        setSitemapUrls(urls);
                      }
                      setSitemapLoading(false);
                      
                      // Navigate to the new landing
                      window.location.href = newUrl;
                    } else {
                      toast({
                        title: "Failed to create landing",
                        description: data.error || "An error occurred",
                        variant: "destructive",
                      });
                    }
                  } else {
                    const response = await fetch('/api/content/create', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Token ${token}` } : {}),
                      },
                      body: JSON.stringify({
                        type: createContentType,
                        slugEn: createContentSlugEn,
                        slugEs: createContentSlugEs,
                        title: createContentTitle || createContentSlugEn,
                        ...(duplicatingPage ? { sourceUrl: duplicatingPage.loc } : {}),
                      }),
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                      const newUrl = buildContentUrl(createContentType as ContentType, createContentSlugEn, 'en');
                      toast({
                        title: duplicatingPage ? "Página duplicada" : "Content created",
                        description: duplicatingPage 
                          ? `Creada copia en ${newUrl}` 
                          : `Created new ${createContentType} at ${newUrl}`,
                      });
                      setCreateContentModalOpen(false);
                      setCreateContentTitle("");
                      setCreateContentSlugEn("");
                      setCreateContentSlugEs("");
                      setCreateContentSlugEnStatus('idle');
                      setCreateContentSlugEsStatus('idle');
                      setSlugEnConflictReason(null);
                      setSlugEsConflictReason(null);
                      setDuplicatingPage(null);
                      
                      // Refresh sitemap
                      setSitemapLoading(true);
                      const sitemapRes = await fetch('/api/debug/sitemap-urls');
                      if (sitemapRes.ok) {
                        const urls = await sitemapRes.json();
                        setSitemapUrls(urls);
                      }
                      setSitemapLoading(false);
                      
                      // Navigate to the new page
                      window.location.href = newUrl;
                    } else {
                      toast({
                        title: "Failed to create content",
                        description: data.error || "An error occurred",
                        variant: "destructive",
                      });
                    }
                  }
                } catch (error) {
                  console.error('Error creating content:', error);
                  toast({
                    title: "Failed to create content",
                    description: "Network error occurred",
                    variant: "destructive",
                  });
                } finally {
                  setIsCreatingContent(false);
                }
              }}
              disabled={
                isCreatingContent || !createContentSlugEn || createContentSlugEnStatus !== 'available' ||
                (createContentType !== 'landing' && (!createContentSlugEs || createContentSlugEsStatus !== 'available'))
              }
              data-testid="button-confirm-create-content"
            >
              {isCreatingContent ? (
                <>
                  <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                  {duplicatingPage ? "Duplicando..." : "Creating..."}
                </>
              ) : duplicatingPage ? (
                <>
                  <IconCopy className="h-4 w-4 mr-2" />
                  Duplicar {createContentType.charAt(0).toUpperCase() + createContentType.slice(1)}
                </>
              ) : (
                <>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Create {createContentType.charAt(0).toUpperCase() + createContentType.slice(1)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Page Errors Modal */}
      <Dialog open={pageErrorsModalOpen} onOpenChange={setPageErrorsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Page Diagnostics
            </DialogTitle>
            <DialogDescription>
              {pageDiagnostics ? `Issues found on ${pageDiagnostics.url}` : 'Loading diagnostics...'}
            </DialogDescription>
          </DialogHeader>
          {pageDiagnostics && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <span>Content Type:</span>
                  <span className="font-mono text-foreground" data-testid="text-modal-content-type">{pageDiagnostics.contentType}</span>
                  <span>Slug:</span>
                  <span className="font-mono text-foreground" data-testid="text-modal-slug">{pageDiagnostics.slug}</span>
                  <span>Locale:</span>
                  <span className="font-mono text-foreground" data-testid="text-modal-locale">{pageDiagnostics.locale}</span>
                  <span>Schema Valid:</span>
                  <span className={`font-mono ${pageDiagnostics.schemaValidation?.valid ? "text-green-600 dark:text-green-400" : "text-destructive"}`} data-testid="text-modal-schema-valid">
                    {pageDiagnostics.schemaValidation?.valid ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {(() => {
                const errors = pageDiagnostics.issues?.filter(i => i.type === "error") || [];
                const warnings = pageDiagnostics.issues?.filter(i => i.type === "warning") || [];
                const infos = pageDiagnostics.issues?.filter(i => i.type === "info") || [];
                return (
                  <>
                    {errors.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-destructive">Errors</h3>
                        {errors.map((issue, i) => (
                          <div key={i} className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm" data-testid={`modal-error-${i}`}>
                            <div className="font-mono font-medium text-destructive text-xs">{issue.code}</div>
                            <div className="mt-1 text-foreground">{issue.message}</div>
                            {issue.details?.expected && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Expected: <span className="font-mono">{issue.details.expected}</span>
                                {issue.details.received && (
                                  <> | Received: <span className="font-mono">{issue.details.received}</span></>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400">Warnings</h3>
                        {warnings.map((issue, i) => (
                          <div key={i} className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm" data-testid={`modal-warning-${i}`}>
                            <div className="font-mono font-medium text-amber-700 dark:text-amber-300 text-xs">{issue.code}</div>
                            <div className="mt-1 text-foreground">{issue.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {infos.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Info</h3>
                        {infos.map((issue, i) => (
                          <div key={i} className="p-3 rounded-md bg-muted/50 border border-border text-sm" data-testid={`modal-info-${i}`}>
                            <div className="font-mono font-medium text-muted-foreground text-xs">{issue.code}</div>
                            <div className="mt-1 text-foreground">{issue.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {errors.length === 0 && warnings.length === 0 && infos.length === 0 && (
                      <div className="p-3 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground" data-testid="modal-no-issues">
                        No issues found. The content loads and validates correctly.
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
                <div className="text-muted-foreground mb-1">Health Score</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span data-testid="text-modal-score-total">Total: <strong>{pageDiagnostics.score?.total}%</strong></span>
                  <span data-testid="text-modal-score-seo">SEO: {pageDiagnostics.score?.seo}%</span>
                  <span data-testid="text-modal-score-schema">Schema: {pageDiagnostics.score?.schema}%</span>
                  <span data-testid="text-modal-score-content">Content: {pageDiagnostics.score?.content}%</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageErrorsModalOpen(false)} data-testid="button-close-page-errors">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* SEO Editor Modal */}
      <Dialog open={seoModalOpen} onOpenChange={setSeoModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>SEO & Meta Tags</DialogTitle>
            <DialogDescription>
              {contentInfo.slug ? `${contentInfo.label}: ${contentInfo.slug}` : "Page SEO settings"}
            </DialogDescription>
          </DialogHeader>

          {seoLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <IconRefresh className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading SEO data...</p>
            </div>
          ) : seoData ? (
            <div className="space-y-6 py-2">
              {/* FAQ Schema - Read Only */}
              {seoData.faqSchema && (
                <div className="space-y-2">
                  <button
                    onClick={() => setSeoFaqExpanded(!seoFaqExpanded)}
                    className="flex items-center gap-2 w-full text-left"
                    data-testid="button-toggle-faq-schema"
                  >
                    {seoFaqExpanded ? (
                      <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h4 className="text-sm font-semibold">FAQ Schema</h4>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      Auto-generated
                    </span>
                  </button>
                  {seoFaqExpanded && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        This FAQ structured data is generated automatically from FAQ sections on this page. Google uses it to show rich results in search.
                      </p>
                      <pre className="bg-muted p-3 rounded-md text-xs font-mono max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all" data-testid="text-faq-schema-preview">
                        {JSON.stringify(seoData.faqSchema, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Schema Includes - Editable */}
              <div className="space-y-2">
                <button
                  onClick={() => setSeoSchemaIncludeExpanded(!seoSchemaIncludeExpanded)}
                  className="flex items-center gap-2 w-full text-left"
                  data-testid="button-toggle-schema-includes"
                >
                  {seoSchemaIncludeExpanded ? (
                    <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h4 className="text-sm font-semibold">Schema Includes</h4>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    {seoSchemaInclude.length} selected
                  </span>
                </button>
                {seoSchemaIncludeExpanded && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Select which Schema.org schemas to include on this page. These are defined in schema-org.yml.
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto">
                      {availableSchemaKeys.map((key) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate cursor-pointer text-sm"
                          data-testid={`checkbox-schema-${key}`}
                        >
                          <input
                            type="checkbox"
                            checked={seoSchemaInclude.includes(key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSeoSchemaInclude(prev => [...prev, key]);
                              } else {
                                setSeoSchemaInclude(prev => prev.filter(k => k !== key));
                                setSeoSchemaOverrides(prev => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                                setSeoSchemaOverridesErrors(prev => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="font-mono text-xs">{key}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Schema Overrides - JSON Editor */}
              {seoSchemaInclude.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setSeoSchemaOverridesExpanded(!seoSchemaOverridesExpanded)}
                    className="flex items-center gap-2 w-full text-left"
                    data-testid="button-toggle-schema-overrides"
                  >
                    {seoSchemaOverridesExpanded ? (
                      <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h4 className="text-sm font-semibold">Schema Overrides</h4>
                    {Object.keys(seoSchemaOverrides).length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {Object.keys(seoSchemaOverrides).length} override{Object.keys(seoSchemaOverrides).length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                  {seoSchemaOverridesExpanded && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Add JSON overrides to customize properties of included schemas. Leave empty for no overrides.
                      </p>
                      {seoSchemaInclude.map((key) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-xs font-medium font-mono text-foreground">
                            {key}
                          </label>
                          <textarea
                            value={seoSchemaOverrides[key] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSeoSchemaOverrides(prev => ({ ...prev, [key]: val }));
                              if (val.trim()) {
                                try {
                                  JSON.parse(val);
                                  setSeoSchemaOverridesErrors(prev => {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                  });
                                } catch {
                                  setSeoSchemaOverridesErrors(prev => ({ ...prev, [key]: "Invalid JSON" }));
                                }
                              } else {
                                setSeoSchemaOverridesErrors(prev => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                              }
                            }}
                            placeholder={`{\n  "name": "Custom Name",\n  "description": "Custom description"\n}`}
                            rows={4}
                            className={`w-full px-3 py-2 text-xs font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-y ${seoSchemaOverridesErrors[key] ? "border-destructive" : ""}`}
                            data-testid={`input-schema-override-${key}`}
                          />
                          {seoSchemaOverridesErrors[key] && (
                            <p className="text-xs text-destructive">{seoSchemaOverridesErrors[key]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Schema.org Preview - Read Only */}
              {seoData.schemaOrg && seoData.schemaOrg.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setSeoSchemaExpanded(!seoSchemaExpanded)}
                    className="flex items-center gap-2 w-full text-left"
                    data-testid="button-toggle-schema-org"
                  >
                    {seoSchemaExpanded ? (
                      <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h4 className="text-sm font-semibold">Schema.org Preview</h4>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      Current output
                    </span>
                  </button>
                  {seoSchemaExpanded && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        This is the current Schema.org output injected via SSR. Save changes above to update it.
                      </p>
                      <pre className="bg-muted p-3 rounded-md text-xs font-mono max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all" data-testid="text-schema-org-preview">
                        {JSON.stringify(seoData.schemaOrg, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Slug Editor */}
              {contentInfo.type && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setSlugEditorExpanded(!slugEditorExpanded);
                      if (!slugEditorExpanded) {
                        setNewSlugValue(contentInfo.slug || "");
                        setSlugCheckStatus("idle");
                        setSlugCheckReason(null);
                        setSlugRedirectPrompt(false);
                      }
                    }}
                    className="flex items-center gap-2 w-full text-left"
                    data-testid="button-toggle-slug-editor"
                  >
                    {slugEditorExpanded ? (
                      <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h4 className="text-sm font-semibold">Page Slug</h4>
                    <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {contentInfo.slug}
                    </code>
                  </button>
                  {slugEditorExpanded && (
                    <div className="space-y-3 pl-6">
                      <p className="text-xs text-muted-foreground">
                        Change the slug (URL identifier) for this content. This will rename the content folder and update all URLs.
                      </p>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground" htmlFor="slug-editor-input">
                          New Slug
                        </label>
                        <input
                          id="slug-editor-input"
                          type="text"
                          value={newSlugValue}
                          onChange={(e) => setNewSlugValue(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                          placeholder="e.g. my-new-page-slug"
                          className={`w-full px-3 py-2 text-sm font-mono rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring ${slugCheckStatus === "taken" ? "border-destructive" : slugCheckStatus === "available" ? "border-green-500" : ""}`}
                          data-testid="input-slug-editor"
                          disabled={slugRenaming}
                        />
                        {slugCheckStatus === "checking" && (
                          <p className="text-xs text-muted-foreground">Checking availability...</p>
                        )}
                        {slugCheckStatus === "available" && (
                          <p className="text-xs text-green-600">Slug is available</p>
                        )}
                        {slugCheckStatus === "taken" && slugCheckReason && (
                          <p className="text-xs text-destructive">{slugCheckReason}</p>
                        )}
                        {newSlugValue === contentInfo.slug && newSlugValue && (
                          <p className="text-xs text-muted-foreground">Same as current slug</p>
                        )}
                      </div>

                      {!slugRedirectPrompt ? (
                        <Button
                          size="sm"
                          onClick={handleSlugRenameClick}
                          disabled={slugCheckStatus !== "available" || slugRenaming || !newSlugValue || newSlugValue === contentInfo.slug}
                          data-testid="button-rename-slug"
                        >
                          {slugRenaming ? "Renaming..." : "Change Slug"}
                        </Button>
                      ) : (
                        <div className="space-y-3 rounded-md border p-3">
                          <p className="text-sm font-medium">Create a redirect?</p>
                          <p className="text-xs text-muted-foreground">
                            Do you want to create a redirect from the old URLs to the new ones? This ensures existing links and bookmarks still work.
                          </p>
                          <div className="space-y-1.5">
                            {Object.entries(slugOldUrls).map(([locale, oldUrl]) => (
                              <div key={locale} className="flex items-center gap-2 text-xs font-mono">
                                <code className="bg-muted px-1.5 py-0.5 rounded truncate">{oldUrl}</code>
                                <IconArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <code className="bg-muted px-1.5 py-0.5 rounded truncate">{slugNewUrls[locale]}</code>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSlugRename(true)}
                              disabled={slugRenaming}
                              data-testid="button-rename-with-redirect"
                            >
                              {slugRenaming ? "Renaming..." : "Yes, create redirect"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSlugRename(false)}
                              disabled={slugRenaming}
                              data-testid="button-rename-without-redirect"
                            >
                              No, just rename
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSlugRedirectPrompt(false)}
                              disabled={slugRenaming}
                              data-testid="button-cancel-rename"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Editable Meta Fields */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Meta Tags</h4>
                <p className="text-xs text-muted-foreground">
                  Edit these fields to improve how the page appears in search results and social media.
                </p>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor="seo-page-title">
                      Page Title
                    </label>
                    <input
                      id="seo-page-title"
                      type="text"
                      value={seoMeta.page_title}
                      onChange={(e) => setSeoMeta(prev => ({ ...prev, page_title: e.target.value }))}
                      placeholder="e.g. Full Stack Developer Program | 4Geeks"
                      className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      data-testid="input-seo-page-title"
                    />
                    <p className="text-xs text-muted-foreground">
                      {seoMeta.page_title.length}/60 characters (recommended)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor="seo-description">
                      Description
                    </label>
                    <textarea
                      id="seo-description"
                      value={seoMeta.description}
                      onChange={(e) => setSeoMeta(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="e.g. Learn full stack development with unlimited mentorship..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      data-testid="input-seo-description"
                    />
                    <p className="text-xs text-muted-foreground">
                      {seoMeta.description.length}/160 characters (recommended)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor="seo-canonical-url">
                      Canonical URL
                    </label>
                    <input
                      id="seo-canonical-url"
                      type="text"
                      value={seoMeta.canonical_url}
                      onChange={(e) => setSeoMeta(prev => ({ ...prev, canonical_url: e.target.value }))}
                      placeholder="e.g. https://4geeks.com/en/career-programs/full-stack"
                      className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      data-testid="input-seo-canonical-url"
                    />
                  </div>
                </div>
              </div>

              {contentInfo.type === "landings" && seoAvailableLocations.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setSeoLocationsExpanded(!seoLocationsExpanded)}
                    className="flex items-center gap-2 w-full text-left"
                    data-testid="button-toggle-locations"
                  >
                    {seoLocationsExpanded ? (
                      <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <IconMapPin className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Locations</h4>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {seoLocations.length === 0 ? "All (session-based)" : `${seoLocations.length} selected`}
                    </span>
                  </button>
                  {seoLocationsExpanded && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Choose which campus locations appear on this landing page. If none are selected, the visitor's nearest location is used automatically.
                      </p>

                      {seoLocations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {seoLocations.map((locSlug) => {
                            const locInfo = seoAvailableLocations.find(l => l.slug === locSlug);
                            return (
                              <span
                                key={locSlug}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
                                data-testid={`chip-location-${locSlug}`}
                              >
                                <span className="truncate max-w-[180px]">
                                  {locInfo ? `${locInfo.city}, ${locInfo.country}` : locSlug}
                                </span>
                                <button
                                  onClick={() => setSeoLocations(prev => prev.filter(s => s !== locSlug))}
                                  className="ml-0.5 rounded-sm hover-elevate"
                                  data-testid={`button-remove-location-${locSlug}`}
                                >
                                  <IconX className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </span>
                            );
                          })}
                          <button
                            onClick={() => setSeoLocations([])}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            data-testid="button-clear-all-locations"
                          >
                            Clear all
                          </button>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={seoLocationSearch}
                          onChange={(e) => setSeoLocationSearch(e.target.value)}
                          placeholder="Search locations..."
                          className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-location-search"
                        />
                        <div className="max-h-[160px] overflow-y-auto rounded-md border">
                          {seoAvailableLocations
                            .filter(loc => {
                              if (seoLocations.includes(loc.slug)) return false;
                              if (!seoLocationSearch) return true;
                              const q = seoLocationSearch.toLowerCase();
                              return loc.name.toLowerCase().includes(q)
                                || loc.city.toLowerCase().includes(q)
                                || loc.country.toLowerCase().includes(q)
                                || loc.slug.toLowerCase().includes(q);
                            })
                            .map(loc => (
                              <button
                                key={loc.slug}
                                onClick={() => setSeoLocations(prev => [...prev, loc.slug])}
                                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover-elevate"
                                data-testid={`button-add-location-${loc.slug}`}
                              >
                                <IconMapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span>{loc.city}, {loc.country}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{loc.slug}</span>
                              </button>
                            ))
                          }
                          {seoAvailableLocations.filter(loc => {
                            if (seoLocations.includes(loc.slug)) return false;
                            if (!seoLocationSearch) return true;
                            const q = seoLocationSearch.toLowerCase();
                            return loc.name.toLowerCase().includes(q)
                              || loc.city.toLowerCase().includes(q)
                              || loc.country.toLowerCase().includes(q)
                              || loc.slug.toLowerCase().includes(q);
                          }).length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              {seoLocationSearch ? "No matching locations" : "All locations already added"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <IconAlertTriangle className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Could not load SEO data for this page.</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSeoModalOpen(false)}
              data-testid="button-cancel-seo"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSeoSave}
              disabled={seoSaving || seoLoading || !seoData}
              data-testid="button-save-seo"
            >
              {seoSaving ? (
                <>
                  <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
