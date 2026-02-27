import { useState, useEffect, lazy, Suspense, useMemo, useCallback, useRef } from "react";
import { subscribeToContentUpdates } from "@/lib/contentEvents";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useInternalNav } from "@/hooks/useInternalNav";
import { useSession } from "@/contexts/SessionContext";
import { buildContentUrl, getFolderFromSlug, type ContentType } from "@shared/slugMappings";
import { useContentTypes, getFolderFromType } from "@/hooks/useContentTypes";
import {
  IconBug,
  IconMap,
  IconMapPin,
  IconPencil,
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
  IconRefresh,
  IconCheck,
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
  IconUsersGroup,
  IconBrandGithub,
  IconCloudDownload,
  IconDeviceMobile,
  IconDeviceDesktop,
  IconDatabase,
  IconArrowUp,
  IconFile,
  IconMenu2,
  IconPhoto,
} from "@tabler/icons-react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { useSyncOptional } from "@/contexts/SyncContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useDebugAuth, getDebugToken, getDebugUserName, resolveAuthorName } from "@/hooks/useDebugAuth";
import { locations } from "@/lib/locations";
import { normalizeLocale } from "@shared/locale";
import { LocaleFlag } from "./components/LocaleFlag";
import { SyncStatusPopover } from "./components/SyncStatusPopover";
import { useQuery } from "@tanstack/react-query";
import {
  STORAGE_KEY,
  type MenuView,
  type SitemapUrl,
  type RedirectItem,
  type ExperimentVariant,
  type ExperimentConfig,
  type ExperimentsResponse,
  type GitHubSyncStatus,
  type PendingChange,
  type ContentInfo,
  type MenuFileItem,
  type MenuData,
  type MenuItemProps,
  type ExpandableMenuItemProps,
} from "./types";
import { deslugify, detectContentInfo, getPersistedMenuView } from "./utils/debugHelpers";
import { MenusView } from "./components/MenusView";
import { ComponentsView } from "./components/ComponentsView";
import { ExperimentsView } from "./components/ExperimentsView";
import { DatabasesView } from "./components/DatabasesView";
import { SitemapView } from "./components/SitemapView";
import { LocationOverrideModal } from "./components/LocationOverrideModal";
import { SessionModal } from "./components/SessionModal";
import { SyncModal } from "./components/SyncModal";
import { PullConflictModal } from "./components/PullConflictModal";
import { ConfirmPullFileModal } from "./components/ConfirmPullFileModal";
import { DeletePageModal } from "./components/DeletePageModal";
import { CreateContentModal } from "./components/CreateContentModal";
import { PageErrorsModal } from "./components/PageErrorsModal";
import { SeoModal } from "./components/SeoModal";
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
  const contentTypesMap = useContentTypes();
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
  const [pendingAutoEditMode, setPendingAutoEditMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('token');
  });
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

  const [autoCommitStatus, setAutoCommitStatus] = useState<{
    enabled: boolean;
    pendingFiles: number;
    pendingFilesList: string[];
    pendingFilesDetails: Array<{ filePath: string; author: string; timestamp: number }>;
    lastCommitAt: string | null;
    lastCommitSha: string | null;
    lastError: string | null;
    conflictedFiles: string[];
    commitIntervalSeconds: number;
    nextSyncAt: number | null;
    isCommitting: boolean;
    githubConfigured: boolean;
  } | null>(null);
  const [autoCommitCountdown, setAutoCommitCountdown] = useState<number | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [manualActionsOpen, setManualActionsOpen] = useState(false);
  const [isPushingAllLocal, setIsPushingAllLocal] = useState(false);
  const [pushAllLocalError, setPushAllLocalError] = useState<string | null>(null);
  
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
  const [slugOldUrl, setSlugOldUrl] = useState("");
  const [slugNewUrl, setSlugNewUrl] = useState("");
  
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

  useEffect(() => {
    setSlugEditorExpanded(false);
    setNewSlugValue("");
    setSlugCheckStatus("idle");
    setSlugCheckReason(null);
    setSlugRenaming(false);
    setSlugRedirectPrompt(false);
    setSlugOldUrl("");
    setSlugNewUrl("");
  }, [contentInfo.slug]);

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

  // Auto-fetch page diagnostics when debug mode is active (on every page, including preview routes)
  useEffect(() => {
    if (!isDebugMode) {
      setPageDiagnostics(null);
      return;
    }

    let diagnosticsUrl: string | null = null;

    if (pathname.startsWith('/private/preview/') && contentInfo.type && contentInfo.slug) {
      const searchParams = new URLSearchParams(window.location.search);
      const locale = normalizeLocale(searchParams.get('locale') || 'en');
      const urlMap: Record<string, Record<string, string>> = {
        programs: { en: `/en/career-programs/${contentInfo.slug}`, es: `/es/programas-de-carrera/${contentInfo.slug}` },
        pages: { en: `/en/${contentInfo.slug}`, es: `/es/${contentInfo.slug}` },
        locations: { en: `/en/location/${contentInfo.slug}`, es: `/es/ubicacion/${contentInfo.slug}` },
        landings: { en: `/landing/${contentInfo.slug}`, es: `/landing/${contentInfo.slug}` },
      };
      diagnosticsUrl = urlMap[contentInfo.type]?.[locale] || urlMap[contentInfo.type]?.en || null;
    } else if (!pathname.startsWith('/private/')) {
      diagnosticsUrl = pathname;
    }

    if (!diagnosticsUrl) {
      setPageDiagnostics(null);
      return;
    }

    setPageDiagnosticsLoading(true);
    setPageDiagnostics(null);
    fetch(`/api/diagnostics/page?url=${encodeURIComponent(diagnosticsUrl)}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) setPageDiagnostics(data);
      })
      .catch(() => {})
      .finally(() => setPageDiagnosticsLoading(false));
  }, [pathname, isDebugMode, contentInfo.type, contentInfo.slug]);

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

  useEffect(() => {
    if (!commitModalOpen) {
      setAutoCommitStatus(null);
      setAutoCommitCountdown(null);
      return;
    }
    
    const fetchStatus = () => {
      fetch('/api/github/auto-commit/status')
        .then(r => r.json())
        .then(data => setAutoCommitStatus(data))
        .catch(() => {});
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [commitModalOpen]);

  useEffect(() => {
    if (!commitModalOpen || !autoCommitStatus?.nextSyncAt) {
      setAutoCommitCountdown(null);
      return;
    }
    
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((autoCommitStatus.nextSyncAt! - Date.now()) / 1000));
      setAutoCommitCountdown(remaining);
      if (remaining <= 0) {
        fetch('/api/github/auto-commit/status')
          .then(r => r.json())
          .then(data => setAutoCommitStatus(data))
          .catch(() => {});
        if (manualActionsOpen) {
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
        }
      }
    };
    
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [commitModalOpen, autoCommitStatus?.nextSyncAt, manualActionsOpen]);

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

  const handlePushAllLocal = async (commitMessage: string, files: string[]) => {
    setIsPushingAllLocal(true);
    setPushAllLocalError(null);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Token ${token}`;
      const res = await fetch('/api/github/commit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: commitMessage, files }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPendingChanges();
        refreshSyncStatus();
        setPushAllLocalError(null);
      } else {
        setPushAllLocalError(data.error || 'Failed to push changes');
      }
    } catch (e) {
      setPushAllLocalError(e instanceof Error ? e.message : 'Failed to push changes');
    } finally {
      setIsPushingAllLocal(false);
    }
  };

  const handleFlush = async () => {
    setIsFlushing(true);
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Token ${token}`;
      await fetch('/api/github/auto-commit/flush', { method: 'POST', headers });
      const res = await fetch('/api/github/auto-commit/status');
      const data = await res.json();
      setAutoCommitStatus(data);
      fetchPendingChanges();
    } catch (e) {
      console.error('Flush failed:', e);
    } finally {
      setIsFlushing(false);
    }
  };

  const handleClearConflict = async (filePath: string) => {
    try {
      const token = getDebugToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Token ${token}`;
      await fetch('/api/github/auto-commit/clear-conflict', {
        method: 'POST',
        headers,
        body: JSON.stringify({ filePath }),
      });
      const res = await fetch('/api/github/auto-commit/status');
      const data = await res.json();
      setAutoCommitStatus(data);
    } catch (e) {
      console.error('Clear conflict failed:', e);
    }
  };

  // Handle session check (validates without clearing cache first)
  const fetchSeoPreview = useCallback(async () => {
    if (!contentInfo.type || !contentInfo.slug) return;
    setSeoLoading(true);
    setSeoData(null);
    try {
      const urlLocale = getEffectiveLocale();
      const locale = normalizeLocale(urlLocale || i18n.language);
      const apiContentType = contentTypesMap ? getFolderFromType(contentTypesMap, contentInfo.type) : contentInfo.type;
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

  const getEffectiveLocale = (): string => {
    if (pathname.startsWith("/private/preview/")) {
      const qLocale = new URLSearchParams(window.location.search).get("locale");
      if (qLocale) return qLocale;
    }
    const seg = pathname.split("/").filter(Boolean)[0];
    return seg || "en";
  };

  const currentLocaleSlug = (seoData?.slug as string) || contentInfo.slug || "";

  useEffect(() => {
    if (!newSlugValue || !contentInfo.type || newSlugValue === currentLocaleSlug) {
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
    setSlugCheckStatus("available");
    setSlugCheckReason(null);
  }, [newSlugValue, contentInfo.type, currentLocaleSlug]);

  const handleSlugRename = async (createRedirect: boolean) => {
    if (!contentInfo.type || !contentInfo.slug || !newSlugValue || slugCheckStatus !== "available") return;
    setSlugRenaming(true);
    setSlugRedirectPrompt(false);
    try {
      const apiType = contentInfo.type;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getDebugToken();
      if (token) headers["X-Debug-Token"] = token;
      const urlLocale = getEffectiveLocale();
      const res = await fetch("/api/content/rename-slug", {
        method: "POST",
        headers,
        body: JSON.stringify({
          contentType: apiType,
          folderSlug: contentInfo.slug,
          locale: urlLocale,
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
      const isPreview = pathname.startsWith("/private/preview/");
      if (isPreview) {
        const search = window.location.search;
        window.location.href = `/private/preview/${contentInfo.type}/${contentInfo.slug}${search}`;
      } else if (result.newUrl) {
        window.location.href = result.newUrl;
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
    const apiType = contentInfo.type;
    const urlLocale = getEffectiveLocale() as "en" | "es";
    if (apiType === "landing") {
      setSlugOldUrl(`/landing/${currentLocaleSlug}`);
      setSlugNewUrl(`/landing/${newSlugValue}`);
    } else {
      const ct = apiType as ContentType;
      setSlugOldUrl(buildContentUrl(ct, currentLocaleSlug, urlLocale));
      setSlugNewUrl(buildContentUrl(ct, newSlugValue, urlLocale));
    }
    setSlugRedirectPrompt(true);
  };

  const handleSeoSave = async () => {
    if (!contentInfo.type || !contentInfo.slug) return;
    setSeoSaving(true);
    try {
      const urlLocale = getEffectiveLocale();
      const locale = normalizeLocale(urlLocale || i18n.language);
      const apiContentType = contentInfo.type;
      
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
      const author = await resolveAuthorName();

      const operations: Array<{ action: string; path: string; value: unknown }> = [
        { action: "update_field", path: "meta", value: existingMeta },
        { action: "update_field", path: "schema", value: Object.keys(schemaValue).length > 0 ? schemaValue : null },
      ];

      const res = await fetch("/api/content/edit-common", {
        method: "POST",
        headers,
        body: JSON.stringify({
          contentType: apiContentType,
          slug: contentInfo.slug,
          author: author || undefined,
          operations,
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save");
      }

      if (contentInfo.type === "landing" && seoAvailableLocations.length > 0) {
        const locRes = await fetch("/api/content/update-locations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            contentType: "landing",
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
      const author = await resolveAuthorName();
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
      const author = await resolveAuthorName();
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
    
    // Check content type based on first path segment (must match content-types.yml URL patterns)
    if (contentParts[0] === 'landing') return 'landing';
    if (contentParts[0] === 'career-programs' || contentParts[0] === 'programas-de-carrera' || contentParts[0] === 'bootcamp' || contentParts[0] === 'course') return 'program';
    if (contentParts[0] === 'location' || contentParts[0] === 'ubicacion' || contentParts[0] === 'coding-campus') return 'location';
    
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
      toast({ title: "Cannot duplicate", description: "Unrecognized content type", variant: "destructive" });
    }
  };

  const handleDeletePage = (url: SitemapUrl) => {
    const urlPath = new URL(url.loc).pathname;
    const contentType = getContentTypeFromPath(urlPath);
    if (!contentType) {
      toast({ title: "Cannot delete", description: "Unrecognized content type", variant: "destructive" });
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
      toast({ title: "Cannot delete", description: "Could not determine slug", variant: "destructive" });
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
        toast({ title: "Page deleted", description: data.message });
        setDeletePageModalOpen(false);
        setDeletingPage(null);
        setDeleteConfirmInput("");
        const sitemapRes = await fetch("/api/debug/sitemap-urls");
        if (sitemapRes.ok) {
          const sitemapData = await sitemapRes.json();
          setSitemapUrls(sitemapData);
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to delete", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Connection error", variant: "destructive" });
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
                className="absolute left-full ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap"
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
          className="debug-bubble-popover w-96 p-0 sm:w-96 sm:max-h-[85vh] max-h-[100dvh] flex flex-col"
          sideOffset={8}
        >
          <div className="sm:hidden flex items-center justify-between p-2 border-b border-border flex-shrink-0">
            <span className="text-sm font-semibold px-1">Debug Tools</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="button-debug-close-mobile"
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
                  <MenuItem
                    icon={IconBook}
                    label="Blog"
                    href="/private/blog"
                    indicator="arrow"
                    testId="link-blog-manage"
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
                </ExpandableMenuItem>
                
                <MenuItem
                  icon={IconPhoto}
                  label="Media Gallery"
                  href="/private/media-gallery"
                  indicator="arrow"
                  testId="link-media-gallery"
                />

                <MenuItem
                  icon={IconDatabase}
                  label="Databases"
                  onClick={() => setMenuView("databases")}
                  indicator="arrow"
                  testId="button-databases-menu"
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
                    <SyncStatusPopover>
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
                    </SyncStatusPopover>
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
              <ComponentsView
                componentSearch={componentSearch}
                setComponentSearch={setComponentSearch}
                showComponentSearch={showComponentSearch}
                setShowComponentSearch={setShowComponentSearch}
                setMenuView={setMenuView}
                filteredComponents={filteredComponents}
                componentRegistryData={componentRegistryData}
                componentIconMap={componentIconMap}
              />
          ) : menuView === "experiments" ? (
              <ExperimentsView
                setMenuView={setMenuView}
                contentInfo={contentInfo}
                experimentsLoading={experimentsLoading}
                experimentsData={experimentsData}
                handleLinkClick={handleLinkClick}
              />
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
          ) : menuView === "databases" ? (
              <DatabasesView setMenuView={setMenuView} />
          ) : (
              <SitemapView
                setMenuView={setMenuView}
                sitemapUrls={sitemapUrls}
                sitemapLoading={sitemapLoading}
                sitemapSearch={sitemapSearch}
                setSitemapSearch={setSitemapSearch}
                showSitemapSearch={showSitemapSearch}
                setShowSitemapSearch={setShowSitemapSearch}
                filteredSitemapUrls={filteredSitemapUrls}
                folders={folders}
                rootUrls={rootUrls}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                setCreateContentModalOpen={setCreateContentModalOpen}
                handleDuplicatePage={handleDuplicatePage}
                handleDeletePage={handleDeletePage}
                handleDownloadYml={handleDownloadYml}
              />
          )}
            </>
          )}
          </div>
        </PopoverContent>
      </Popover>
      <LocationOverrideModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        selectedLocationSlug={selectedLocationSlug}
        setSelectedLocationSlug={setSelectedLocationSlug}
        currentLocationOverride={currentLocationOverride}
        handleLocationOverride={handleLocationOverride}
        handleClearLocationOverride={handleClearLocationOverride}
        locationsByRegion={locationsByRegion}
        regionLabels={regionLabels}
      />
      <SessionModal
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        session={session}
        hasToken={hasToken}
        getDebugToken={getDebugToken}
        getDebugUserName={getDebugUserName}
        clearToken={clearToken}
      />
      <SyncModal
        open={commitModalOpen}
        onOpenChange={setCommitModalOpen}
        autoCommitStatus={autoCommitStatus}
        autoCommitCountdown={autoCommitCountdown}
        isFlushing={isFlushing}
        handleFlush={handleFlush}
        handleClearConflict={handleClearConflict}
        pendingChanges={pendingChanges}
        pendingChangesLoading={pendingChangesLoading}
        selectedFileForCommit={selectedFileForCommit}
        setSelectedFileForCommit={setSelectedFileForCommit}
        fileCommitMessage={fileCommitMessage}
        setFileCommitMessage={setFileCommitMessage}
        fileCommitting={fileCommitting}
        handleFileCommit={handleFileCommit}
        filePulling={filePulling}
        handleFilePull={handleFilePull}
        setConfirmPullFile={setConfirmPullFile}
        githubSyncStatus={githubSyncStatus}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        isCommitting={isCommitting}
        handleCommit={handleCommit}
        handleSyncFromRemote={handleSyncFromRemote}
        isSyncing={isSyncing}
        handleIgnoreAllChanges={handleIgnoreAllChanges}
        isIgnoringAllChanges={isIgnoringAllChanges}
        fetchPendingChanges={fetchPendingChanges}
        handlePushAllLocal={handlePushAllLocal}
        isPushingAllLocal={isPushingAllLocal}
        pushAllLocalError={pushAllLocalError}
        setPushAllLocalError={setPushAllLocalError}
        manualActionsOpen={manualActionsOpen}
        setManualActionsOpen={setManualActionsOpen}
        advancedOptionsOpen={advancedOptionsOpen}
        setAdvancedOptionsOpen={setAdvancedOptionsOpen}
        getDebugToken={getDebugToken}
        toast={toast}
      />
      <PullConflictModal
        open={pullConflictModalOpen}
        onOpenChange={setPullConflictModalOpen}
        pullConflictFiles={pullConflictFiles}
        onCommitFirst={() => {
          setPullConflictModalOpen(false);
          fetchPendingChanges();
          setCommitModalOpen(true);
        }}
        onPullAnyway={() => {
          setPullConflictModalOpen(false);
          executeSyncFromRemote();
        }}
      />
      <ConfirmPullFileModal
        confirmPullFile={confirmPullFile}
        onOpenChange={(open) => { if (!open) setConfirmPullFile(null); }}
        onConfirm={() => { if (confirmPullFile) handleFilePull(confirmPullFile); }}
        filePulling={filePulling}
      />
      <DeletePageModal
        open={deletePageModalOpen}
        onOpenChange={setDeletePageModalOpen}
        deletingPage={deletingPage}
        deleteConfirmInput={deleteConfirmInput}
        setDeleteConfirmInput={setDeleteConfirmInput}
        isDeletingPage={isDeletingPage}
        onConfirm={confirmDeletePage}
      />
      <CreateContentModal
        open={createContentModalOpen}
        onOpenChange={setCreateContentModalOpen}
        duplicatingPage={duplicatingPage}
        createContentType={createContentType}
        setCreateContentType={setCreateContentType}
        createContentTitle={createContentTitle}
        setCreateContentTitle={setCreateContentTitle}
        createContentSlugEn={createContentSlugEn}
        setCreateContentSlugEn={setCreateContentSlugEn}
        createContentSlugEs={createContentSlugEs}
        setCreateContentSlugEs={setCreateContentSlugEs}
        createContentSlugEnStatus={createContentSlugEnStatus}
        setCreateContentSlugEnStatus={setCreateContentSlugEnStatus}
        createContentSlugEsStatus={createContentSlugEsStatus}
        setCreateContentSlugEsStatus={setCreateContentSlugEsStatus}
        slugEnConflictReason={slugEnConflictReason}
        setSlugEnConflictReason={setSlugEnConflictReason}
        slugEsConflictReason={slugEsConflictReason}
        setSlugEsConflictReason={setSlugEsConflictReason}
        editingSlugEn={editingSlugEn}
        setEditingSlugEn={setEditingSlugEn}
        editingSlugEs={editingSlugEs}
        setEditingSlugEs={setEditingSlugEs}
        isCreatingContent={isCreatingContent}
        setIsCreatingContent={setIsCreatingContent}
        createLandingLocale={createLandingLocale}
        setCreateLandingLocale={setCreateLandingLocale}
        setSitemapUrls={setSitemapUrls}
        setSitemapLoading={setSitemapLoading}
        setDuplicatingPage={setDuplicatingPage}
        toast={toast}
      />
      <PageErrorsModal
        open={pageErrorsModalOpen}
        onOpenChange={setPageErrorsModalOpen}
        pageDiagnostics={pageDiagnostics}
      />
      <SeoModal
        open={seoModalOpen}
        onOpenChange={setSeoModalOpen}
        contentInfo={contentInfo}
        seoLoading={seoLoading}
        seoData={seoData}
        seoMeta={seoMeta}
        setSeoMeta={setSeoMeta}
        seoFaqExpanded={seoFaqExpanded}
        setSeoFaqExpanded={setSeoFaqExpanded}
        seoSchemaExpanded={seoSchemaExpanded}
        setSeoSchemaExpanded={setSeoSchemaExpanded}
        seoSchemaIncludeExpanded={seoSchemaIncludeExpanded}
        setSeoSchemaIncludeExpanded={setSeoSchemaIncludeExpanded}
        seoSchemaOverridesExpanded={seoSchemaOverridesExpanded}
        setSeoSchemaOverridesExpanded={setSeoSchemaOverridesExpanded}
        seoSchemaInclude={seoSchemaInclude}
        setSeoSchemaInclude={setSeoSchemaInclude}
        seoSchemaOverrides={seoSchemaOverrides}
        setSeoSchemaOverrides={setSeoSchemaOverrides}
        seoSchemaOverridesErrors={seoSchemaOverridesErrors}
        setSeoSchemaOverridesErrors={setSeoSchemaOverridesErrors}
        availableSchemaKeys={availableSchemaKeys}
        seoLocations={seoLocations}
        setSeoLocations={setSeoLocations}
        seoAvailableLocations={seoAvailableLocations}
        seoLocationSearch={seoLocationSearch}
        setSeoLocationSearch={setSeoLocationSearch}
        seoSaving={seoSaving}
        handleSeoSave={handleSeoSave}
        slugEditorExpanded={slugEditorExpanded}
        setSlugEditorExpanded={setSlugEditorExpanded}
        newSlugValue={newSlugValue}
        setNewSlugValue={setNewSlugValue}
        slugCheckStatus={slugCheckStatus}
        slugRenaming={slugRenaming}
        slugRedirectPrompt={slugRedirectPrompt}
        slugOldUrl={slugOldUrl}
        slugNewUrl={slugNewUrl}
        handleSlugRenameClick={handleSlugRenameClick}
        handleSlugRename={handleSlugRename}
        currentLocaleSlug={currentLocaleSlug}
        setSlugCheckStatus={setSlugCheckStatus}
        setSlugCheckReason={setSlugCheckReason}
        slugCheckReason={slugCheckReason}
        setSlugRedirectPrompt={setSlugRedirectPrompt}
      />
    </div>
  );
}
