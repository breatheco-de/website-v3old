import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconCopy,
  IconPlus,
  IconPencil,
  IconRefresh,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconChevronDown,
  IconTrash,
  IconArrowBackUp,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildContentUrlFromPattern } from "@/lib/locale";
import { useContentTypes, useContentTypesRaw } from "@/hooks/useContentTypes";
import { getDebugToken } from "@/hooks/useDebugAuth";
import type { ContentTypeValue, SlugCheckStatus, SitemapUrl } from "../types";

export interface CreateContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicatingPage: { loc: string; label: string; contentType: string } | null;
  createContentType: ContentTypeValue;
  setCreateContentType: (v: ContentTypeValue) => void;
  createContentTitle: string;
  setCreateContentTitle: (v: string) => void;
  createContentSlugEn: string;
  setCreateContentSlugEn: (v: string) => void;
  createContentSlugEs: string;
  setCreateContentSlugEs: (v: string) => void;
  createContentSlugEnStatus: SlugCheckStatus;
  setCreateContentSlugEnStatus: (v: SlugCheckStatus) => void;
  createContentSlugEsStatus: SlugCheckStatus;
  setCreateContentSlugEsStatus: (v: SlugCheckStatus) => void;
  slugEnConflictReason: string | null;
  setSlugEnConflictReason: (v: string | null) => void;
  slugEsConflictReason: string | null;
  setSlugEsConflictReason: (v: string | null) => void;
  editingSlugEn: boolean;
  setEditingSlugEn: (v: boolean) => void;
  editingSlugEs: boolean;
  setEditingSlugEs: (v: boolean) => void;
  isCreatingContent: boolean;
  setIsCreatingContent: (v: boolean) => void;
  setSitemapUrls: (v: SitemapUrl[]) => void;
  setSitemapLoading: (v: boolean) => void;
  setDuplicatingPage: (v: any) => void;
  toast: any;
}

interface LocaleSetting {
  code: string;
  label: string;
}

interface LocaleSettingsResponse {
  default_locale: string;
  supported_locales: LocaleSetting[];
}

function humanizeField(field: string): string {
  const map: Record<string, string> = {
    bc_slug: "Breathecode Slug",
    job_role: "Job Role",
    country: "Country",
    country_code: "Country Code",
    city: "City",
    region: "Region",
    timezone: "Timezone",
  };
  return map[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CreateContentModal({
  open,
  onOpenChange,
  duplicatingPage,
  createContentType,
  setCreateContentType,
  createContentTitle,
  setCreateContentTitle,
  createContentSlugEn,
  setCreateContentSlugEn,
  createContentSlugEs,
  setCreateContentSlugEs,
  createContentSlugEnStatus,
  setCreateContentSlugEnStatus,
  createContentSlugEsStatus,
  setCreateContentSlugEsStatus,
  slugEnConflictReason,
  setSlugEnConflictReason,
  slugEsConflictReason,
  setSlugEsConflictReason,
  editingSlugEn,
  setEditingSlugEn,
  editingSlugEs,
  setEditingSlugEs,
  isCreatingContent,
  setIsCreatingContent,
  setSitemapUrls,
  setSitemapLoading,
  setDuplicatingPage,
  toast,
}: CreateContentModalProps) {
  const [showFiles, setShowFiles] = useState(false);
  const [excludedLocales, setExcludedLocales] = useState<Set<string>>(new Set());
  const [showTypeChangeDetails, setShowTypeChangeDetails] = useState(false);
  const [uniqueFieldValues, setUniqueFieldValues] = useState<Record<string, string>>({});
  const contentTypesMap = useContentTypes();
  const { data: rawContentTypes } = useContentTypesRaw();

  const { data: localeSettings } = useQuery<LocaleSettingsResponse>({
    queryKey: ["/api/settings/locales"],
  });

  const supportedLocales: LocaleSetting[] = localeSettings?.supported_locales ?? [
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
  ];

  const loc0 = supportedLocales[0]?.code ?? "en";
  const loc1 = supportedLocales[1]?.code ?? "es";

  useEffect(() => {
    if (duplicatingPage) {
      let sourceLocale: string | null = null;
      for (const loc of supportedLocales) {
        if (duplicatingPage.loc.includes(`/${loc.code}/`)) {
          sourceLocale = loc.code;
          break;
        }
      }
      if (sourceLocale) {
        const others = supportedLocales.map((l) => l.code).filter((c) => c !== sourceLocale);
        setExcludedLocales(new Set(others));
      } else {
        setExcludedLocales(new Set());
      }
    } else {
      setExcludedLocales(new Set());
    }
  }, [duplicatingPage, localeSettings]);

  const isTypeChanged = !!(duplicatingPage && createContentType !== duplicatingPage.contentType);

  const creatableTypes = useMemo(() => {
    if (!rawContentTypes) return [];
    return rawContentTypes.filter((ct) => !ct.has_database);
  }, [rawContentTypes]);

  const selectedTypeData = useMemo(
    () => rawContentTypes?.find((ct) => ct.name === createContentType),
    [rawContentTypes, createContentType]
  );

  const extraUniqueFields = useMemo(() => {
    const unique = selectedTypeData?.unique_fields ?? ["slug"];
    return unique.filter((f) => f !== "slug" && f !== "title" && f !== "locale");
  }, [selectedTypeData]);

  const checkSlug = (type: string, slug: string, locale: string | null, onStatus: (s: SlugCheckStatus) => void, onReason: (r: string | null) => void) => {
    const url = locale
      ? `/api/content/check-slug?type=${type}&slug=${slug}&locale=${locale}`
      : `/api/content/check-slug?type=${type}&slug=${slug}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        onStatus(data.available ? "available" : "taken");
        onReason(
          data.available
            ? null
            : data.reason === "redirect_conflict"
            ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}`
            : null
        );
      })
      .catch(() => {
        onStatus("idle");
        onReason(null);
      });
  };

  const handleClose = (openVal: boolean) => {
    onOpenChange(openVal);
    if (!openVal) {
      setCreateContentTitle("");
      setCreateContentSlugEn("");
      setCreateContentSlugEs("");
      setCreateContentSlugEnStatus("idle");
      setCreateContentSlugEsStatus("idle");
      setSlugEnConflictReason(null);
      setSlugEsConflictReason(null);
      setEditingSlugEn(false);
      setEditingSlugEs(false);
      setCreateContentType("page");
      setDuplicatingPage(null);
      setExcludedLocales(new Set());
      setShowTypeChangeDetails(false);
      setUniqueFieldValues({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duplicatingPage ? (
              <>
                <IconCopy className="h-5 w-5" />
                Duplicate Page
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
              <>Duplicating: <strong>{duplicatingPage.label}</strong></>
            ) : (
              <>Create a new content entry with starter YAML files.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Content Type</label>
            <Select
              value={createContentType}
              onValueChange={(v) => {
                setCreateContentType(v);
                setExcludedLocales(new Set());
                if (createContentSlugEn) {
                  setCreateContentSlugEnStatus("checking");
                  checkSlug(v, createContentSlugEn, loc0, setCreateContentSlugEnStatus, setSlugEnConflictReason);
                }
                if (createContentSlugEs) {
                  setCreateContentSlugEsStatus("checking");
                  checkSlug(v, createContentSlugEs, loc1, setCreateContentSlugEsStatus, setSlugEsConflictReason);
                }
              }}
            >
              <SelectTrigger data-testid="select-content-type" className="w-full">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {creatableTypes.map((ct) => (
                  <SelectItem key={ct.name} value={ct.name}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isTypeChanged && (
            <div className="flex gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs" data-testid="warning-type-change">
              <IconAlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="text-amber-800 dark:text-amber-200">
                  This will change the content type from <strong>{duplicatingPage!.contentType}</strong> to <strong>{createContentType}</strong>.
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Some content-type-specific data will be automatically converted.
                </p>
                <button
                  type="button"
                  className="text-amber-700 dark:text-amber-300 underline hover:no-underline font-medium"
                  onClick={() => setShowTypeChangeDetails(true)}
                  data-testid="button-read-more-type-change"
                >
                  Read more
                </button>
              </div>
            </div>
          )}

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
                  .replace(/[^a-z0-9\s-]/g, "")
                  .replace(/\s+/g, "-")
                  .replace(/-+/g, "-")
                  .replace(/^-|-$/g, "");
                setCreateContentSlugEn(slug);
                setCreateContentSlugEs(slug);
                if (slug) {
                  setCreateContentSlugEnStatus("checking");
                  setCreateContentSlugEsStatus("checking");
                  checkSlug(createContentType, slug, loc0, setCreateContentSlugEnStatus, setSlugEnConflictReason);
                  if (!excludedLocales.has(loc1)) {
                    checkSlug(createContentType, slug, loc1, setCreateContentSlugEsStatus, setSlugEsConflictReason);
                  }
                } else {
                  setCreateContentSlugEnStatus("idle");
                  setCreateContentSlugEsStatus("idle");
                  setSlugEnConflictReason(null);
                  setSlugEsConflictReason(null);
                }
              }}
              placeholder="e.g., Career Development Guide"
              className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-content-title"
            />
          </div>

          {extraUniqueFields.map((field) => (
            <div key={field} className="space-y-2">
              <label className="text-sm font-medium">{humanizeField(field)}</label>
              <input
                type="text"
                value={uniqueFieldValues[field] ?? ""}
                onChange={(e) =>
                  setUniqueFieldValues((prev) => ({ ...prev, [field]: e.target.value }))
                }
                placeholder={`e.g., my-${field.replace(/_/g, "-")}`}
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid={`input-${field.replace(/_/g, "-")}`}
              />
            </div>
          ))}

          {duplicatingPage && (
            <div className="flex gap-2 p-3 rounded-md bg-muted/50 border text-xs text-muted-foreground">
              <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground mb-1">What will not be copied:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Redirects — each page must define its own</li>
                </ul>
              </div>
            </div>
          )}

          {createContentSlugEn && (() => {
            const loc0Excluded = excludedLocales.has(loc0);
            const loc1Excluded = excludedLocales.has(loc1);
            const activeCount = supportedLocales.length - excludedLocales.size;
            const isLastActive = activeCount <= 1;
            const toggleLocale = (locale: string) => {
              setExcludedLocales((prev) => {
                const next = new Set(prev);
                if (next.has(locale)) {
                  next.delete(locale);
                } else {
                  next.add(locale);
                }
                return next;
              });
            };
            const activeLocales = supportedLocales.map((l) => l.code).filter((l) => !excludedLocales.has(l));

            return (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">URLs that will be created:</p>

                  {/* First locale row */}
                  <div className={`flex items-center gap-2 transition-opacity ${loc0Excluded ? "opacity-40" : ""}`}>
                    {loc0Excluded ? (
                      <code className="flex-1 text-xs bg-background px-2 py-1 rounded line-through text-muted-foreground">
                        {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEn, loc0)}
                      </code>
                    ) : editingSlugEn ? (
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, "", loc0).slice(0, -1)}
                        </span>
                        <input
                          type="text"
                          value={createContentSlugEn}
                          onChange={(e) => {
                            const slug = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace(/[^a-z0-9-]/g, "")
                              .replace(/-+/g, "-");
                            setCreateContentSlugEn(slug);
                            if (slug) {
                              setCreateContentSlugEnStatus("checking");
                              checkSlug(createContentType, slug, loc0, setCreateContentSlugEnStatus, setSlugEnConflictReason);
                            } else {
                              setCreateContentSlugEnStatus("idle");
                              setSlugEnConflictReason(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-slug-en"
                          autoFocus
                          onBlur={() => setEditingSlugEn(false)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingSlugEn(false)}
                        />
                      </div>
                    ) : (
                      <code
                        className="flex-1 text-xs bg-background px-2 py-1 rounded cursor-pointer hover-elevate"
                        onClick={() => setEditingSlugEn(true)}
                        data-testid="url-preview-en"
                      >
                        {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEn, loc0)}
                      </code>
                    )}
                    {!loc0Excluded && (
                      <button
                        type="button"
                        onClick={() => setEditingSlugEn(!editingSlugEn)}
                        className="p-1 rounded hover-elevate"
                        title={`Edit ${supportedLocales[0]?.label ?? loc0} slug`}
                        data-testid="button-edit-slug-en"
                      >
                        <IconPencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLocale(loc0)}
                      disabled={!loc0Excluded && isLastActive}
                      className="p-1 rounded hover-elevate disabled:opacity-30 disabled:cursor-not-allowed"
                      title={loc0Excluded ? `Restore ${supportedLocales[0]?.label ?? loc0}` : `Skip ${supportedLocales[0]?.label ?? loc0}`}
                      data-testid="button-toggle-locale-en"
                    >
                      {loc0Excluded ? (
                        <IconArrowBackUp className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <IconTrash className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    {!loc0Excluded && (
                      <div className="w-4">
                        {createContentSlugEnStatus === "checking" && (
                          <IconRefresh className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {createContentSlugEnStatus === "available" && (
                          <IconCheck className="h-4 w-4 text-green-600" />
                        )}
                        {createContentSlugEnStatus === "taken" && (
                          <IconX className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {!loc0Excluded && createContentSlugEnStatus === "taken" && (
                    <p className="text-xs text-red-600 pl-1">{slugEnConflictReason || `${supportedLocales[0]?.label ?? loc0} slug is taken`}</p>
                  )}

                  {/* Second locale row */}
                  <div className={`flex items-center gap-2 transition-opacity ${loc1Excluded ? "opacity-40" : ""}`}>
                    {loc1Excluded ? (
                      <code className="flex-1 text-xs bg-background px-2 py-1 rounded line-through text-muted-foreground">
                        {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEs || createContentSlugEn, loc1)}
                      </code>
                    ) : editingSlugEs ? (
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, "", loc1).slice(0, -1)}
                        </span>
                        <input
                          type="text"
                          value={createContentSlugEs}
                          onChange={(e) => {
                            const slug = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace(/[^a-z0-9-]/g, "")
                              .replace(/-+/g, "-");
                            setCreateContentSlugEs(slug);
                            if (slug) {
                              setCreateContentSlugEsStatus("checking");
                              checkSlug(createContentType, slug, loc1, setCreateContentSlugEsStatus, setSlugEsConflictReason);
                            } else {
                              setCreateContentSlugEsStatus("idle");
                              setSlugEsConflictReason(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          data-testid="input-slug-es"
                          autoFocus
                          onBlur={() => setEditingSlugEs(false)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingSlugEs(false)}
                        />
                      </div>
                    ) : (
                      <code
                        className="flex-1 text-xs bg-background px-2 py-1 rounded cursor-pointer hover-elevate"
                        onClick={() => setEditingSlugEs(true)}
                        data-testid="url-preview-es"
                      >
                        {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEs, loc1)}
                      </code>
                    )}
                    {!loc1Excluded && (
                      <button
                        type="button"
                        onClick={() => setEditingSlugEs(!editingSlugEs)}
                        className="p-1 rounded hover-elevate"
                        title={`Edit ${supportedLocales[1]?.label ?? loc1} slug`}
                        data-testid="button-edit-slug-es"
                      >
                        <IconPencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLocale(loc1)}
                      disabled={!loc1Excluded && isLastActive}
                      className="p-1 rounded hover-elevate disabled:opacity-30 disabled:cursor-not-allowed"
                      title={loc1Excluded ? `Restore ${supportedLocales[1]?.label ?? loc1}` : `Skip ${supportedLocales[1]?.label ?? loc1}`}
                      data-testid="button-toggle-locale-es"
                    >
                      {loc1Excluded ? (
                        <IconArrowBackUp className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <IconTrash className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    {!loc1Excluded && (
                      <div className="w-4">
                        {createContentSlugEsStatus === "checking" && (
                          <IconRefresh className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {createContentSlugEsStatus === "available" && (
                          <IconCheck className="h-4 w-4 text-green-600" />
                        )}
                        {createContentSlugEsStatus === "taken" && (
                          <IconX className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {!loc1Excluded && createContentSlugEsStatus === "taken" && (
                    <p className="text-xs text-red-600 pl-1">{slugEsConflictReason || `${supportedLocales[1]?.label ?? loc1} slug is taken`}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowFiles((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover-elevate rounded"
                    data-testid="button-toggle-files"
                  >
                    <IconChevronDown className={`h-3 w-3 transition-transform ${showFiles ? "" : "-rotate-90"}`} />
                    Files that will be created
                  </button>
                  {showFiles && (
                    <div className="space-y-0.5 font-mono text-xs text-muted-foreground pl-4 pt-1">
                      <div>marketing-content/{contentTypesMap?.[createContentType]?.directory || createContentType}/{createContentSlugEn}/</div>
                      <div className="pl-4">├── _common.yml</div>
                      {activeLocales.map((loc, i) => (
                        <div key={loc} className="pl-4">
                          {i === activeLocales.length - 1 ? "└── " : "├── "}{loc}.yml
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-create-content"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const loc0Needed = !excludedLocales.has(loc0);
              const loc1Needed = !excludedLocales.has(loc1);
              if (loc0Needed && (!createContentSlugEn || createContentSlugEnStatus !== "available")) return;
              if (loc1Needed && (!createContentSlugEs || createContentSlugEsStatus !== "available")) return;
              if (!loc0Needed && !loc1Needed) return;
              if (extraUniqueFields.some((f) => !uniqueFieldValues[f])) return;

              setIsCreatingContent(true);
              try {
                const token = getDebugToken();
                const response = await fetch("/api/content/create", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Token ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    type: createContentType,
                    slugEn: excludedLocales.has(loc0) ? undefined : createContentSlugEn,
                    slugEs: excludedLocales.has(loc1) ? undefined : createContentSlugEs,
                    title: createContentTitle || createContentSlugEn,
                    ...(duplicatingPage ? { sourceUrl: duplicatingPage.loc } : {}),
                    ...(excludedLocales.size > 0 ? { skipLocales: Array.from(excludedLocales) } : {}),
                    ...(isTypeChanged ? { changeContentType: true } : {}),
                    ...(Object.keys(uniqueFieldValues).length > 0 ? { uniqueFieldValues } : {}),
                  }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                  const pattern = contentTypesMap?.[createContentType]?.url_pattern;
                  const activeSlug = excludedLocales.has(loc0) ? createContentSlugEs : createContentSlugEn;
                  const activeLocaleCode = excludedLocales.has(loc0) ? loc1 : loc0;
                  const newUrl = buildContentUrlFromPattern(pattern, activeSlug, activeLocaleCode);
                  toast({
                    title: duplicatingPage ? "Page duplicated" : "Content created",
                    description: duplicatingPage
                      ? `Created copy at ${newUrl}`
                      : `Created new ${createContentType} at ${newUrl}`,
                  });
                  onOpenChange(false);
                  setCreateContentTitle("");
                  setCreateContentSlugEn("");
                  setCreateContentSlugEs("");
                  setCreateContentSlugEnStatus("idle");
                  setCreateContentSlugEsStatus("idle");
                  setSlugEnConflictReason(null);
                  setSlugEsConflictReason(null);
                  setDuplicatingPage(null);
                  setUniqueFieldValues({});

                  setSitemapLoading(true);
                  const sitemapRes = await fetch("/api/debug/sitemap-urls");
                  if (sitemapRes.ok) {
                    const urls = await sitemapRes.json();
                    setSitemapUrls(urls);
                  }
                  setSitemapLoading(false);

                  window.location.href = newUrl;
                } else {
                  toast({
                    title: "Failed to create content",
                    description: data.error || "An error occurred",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                console.error("Error creating content:", error);
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
              isCreatingContent ||
              (() => {
                const loc0Needed = !excludedLocales.has(loc0);
                const loc1Needed = !excludedLocales.has(loc1);
                if (!loc0Needed && !loc1Needed) return true;
                if (loc0Needed && (!createContentSlugEn || createContentSlugEnStatus !== "available")) return true;
                if (loc1Needed && (!createContentSlugEs || createContentSlugEsStatus !== "available")) return true;
                if (extraUniqueFields.some((f) => !uniqueFieldValues[f])) return true;
                return false;
              })()
            }
            data-testid="button-confirm-create-content"
          >
            {isCreatingContent ? (
              <>
                <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                {duplicatingPage ? "Duplicating..." : "Creating..."}
              </>
            ) : duplicatingPage ? (
              <>
                <IconCopy className="h-4 w-4 mr-2" />
                Duplicate {createContentType.charAt(0).toUpperCase() + createContentType.slice(1)}
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

      <Dialog open={showTypeChangeDetails} onOpenChange={setShowTypeChangeDetails}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-type-change-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Content Type Conversion Details
            </DialogTitle>
            <DialogDescription>
              What happens when you change the content type during duplication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Template variables resolved</p>
              <p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{ single.* }}"}</code> template variables will be replaced with their actual or fallback values, hardcoded directly into the YAML content.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Source-specific properties removed</p>
              <p>
                Properties unique to the source content type (from its <code className="text-xs bg-muted px-1 py-0.5 rounded">field_mapping</code>) that don't exist in the target type will be removed from <code className="text-xs bg-muted px-1 py-0.5 rounded">_common.yml</code>.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Section bindings removed</p>
              <p>
                All section bindings will be removed. Each section starts unbound in the new entry.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Listing components preserved</p>
              <p>
                Listing components (<code className="text-xs bg-muted px-1 py-0.5 rounded">dynamic_entries</code>) and their <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{ single.* }}"}</code> template references will be preserved as-is.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Redirects not copied</p>
              <p>
                Redirects from the source entry will not be carried over to the duplicate.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">New URL pattern</p>
              <p>
                The entry will be created under the target content type's directory with the target's URL pattern.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTypeChangeDetails(false)} data-testid="button-close-type-change-details">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
