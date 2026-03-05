import { useState, useMemo } from "react";
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
import { LocaleFlag } from "./LocaleFlag";
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
  createLandingLocale: 'en' | 'es';
  setCreateLandingLocale: (v: 'en' | 'es') => void;
  setSitemapUrls: (v: SitemapUrl[]) => void;
  setSitemapLoading: (v: boolean) => void;
  setDuplicatingPage: (v: any) => void;
  toast: any;
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
  createLandingLocale,
  setCreateLandingLocale,
  setSitemapUrls,
  setSitemapLoading,
  setDuplicatingPage,
  toast,
}: CreateContentModalProps) {
  const [showFiles, setShowFiles] = useState(false);
  const [excludedLocales, setExcludedLocales] = useState<Set<string>>(new Set());
  const [showTypeChangeDetails, setShowTypeChangeDetails] = useState(false);
  const contentTypesMap = useContentTypes();
  const { data: rawContentTypes } = useContentTypesRaw();

  const isTypeChanged = !!(duplicatingPage && createContentType !== duplicatingPage.contentType);

  const creatableTypes = useMemo(() => {
    if (!rawContentTypes) return [];
    return rawContentTypes.filter(ct => !ct.has_database);
  }, [rawContentTypes]);

  return (
    <Dialog open={open} onOpenChange={(openVal) => {
      onOpenChange(openVal);
      if (!openVal) {
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
        setExcludedLocales(new Set());
        setShowTypeChangeDetails(false);
      }
    }}>
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
            <div className="flex items-center gap-2">
              <Select 
                value={createContentType} 
                onValueChange={(v) => {
                  setCreateContentType(v);
                  setExcludedLocales(new Set());
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
                  {creatableTypes.map(ct => (
                    <SelectItem key={ct.name} value={ct.name}>{ct.label}</SelectItem>
                  ))}
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
                  .replace(/[^a-z0-9\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
                setCreateContentSlugEn(slug);
                setCreateContentSlugEs(slug);
                if (slug) {
                  if (createContentType === 'landing') {
                    setCreateContentSlugEnStatus('checking');
                    fetch(`/api/content/check-slug?type=landing&slug=${slug}`)
                      .then(res => res.json())
                      .then(data => {
                        setCreateContentSlugEnStatus(data.available ? 'available' : 'taken');
                        setSlugEnConflictReason(data.available ? null : (data.reason === 'redirect_conflict' ? `Conflicts with redirect: ${data.conflictUrl} → ${data.redirectTo}` : null));
                      })
                      .catch(() => { setCreateContentSlugEnStatus('idle'); setSlugEnConflictReason(null); });
                  } else {
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

          {createContentSlugEn && createContentType === 'landing' && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
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
                <button
                  type="button"
                  onClick={() => setShowFiles(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover-elevate rounded"
                  data-testid="button-toggle-files"
                >
                  <IconChevronDown className={`h-3 w-3 transition-transform ${showFiles ? '' : '-rotate-90'}`} />
                  Files that will be created
                </button>
                {showFiles && (
                  <div className="space-y-0.5 font-mono text-xs text-muted-foreground pl-4 pt-1">
                    <div>marketing-content/landings/{createContentSlugEn}/</div>
                    <div className="pl-4">├── _common.yml</div>
                    <div className="pl-4">└── {createLandingLocale}.yml</div>
                  </div>
                )}
              </div>

            </div>
          )}
          
          {createContentSlugEn && createContentType !== 'landing' && (() => {
            const enExcluded = excludedLocales.has('en');
            const esExcluded = excludedLocales.has('es');
            const activeCount = 2 - excludedLocales.size;
            const isLastActive = activeCount <= 1;
            const toggleLocale = (locale: string) => {
              setExcludedLocales(prev => {
                const next = new Set(prev);
                if (next.has(locale)) {
                  next.delete(locale);
                } else {
                  next.add(locale);
                }
                return next;
              });
            };
            const activeLocales = ['en', 'es'].filter(l => !excludedLocales.has(l));

            return (
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">URLs that will be created:</p>
                
                <div className={`flex items-center gap-2 transition-opacity ${enExcluded ? 'opacity-40' : ''}`}>
                  {enExcluded ? (
                    <code className="flex-1 text-xs bg-background px-2 py-1 rounded line-through text-muted-foreground">
                      {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEn, 'en')}
                    </code>
                  ) : editingSlugEn ? (
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, '', 'en').slice(0, -1)}
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
                      {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEn, 'en')}
                    </code>
                  )}
                  {!enExcluded && (
                    <button
                      type="button"
                      onClick={() => setEditingSlugEn(!editingSlugEn)}
                      className="p-1 rounded hover-elevate"
                      title="Edit English slug"
                      data-testid="button-edit-slug-en"
                    >
                      <IconPencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleLocale('en')}
                    disabled={!enExcluded && isLastActive}
                    className="p-1 rounded hover-elevate disabled:opacity-30 disabled:cursor-not-allowed"
                    title={enExcluded ? "Restore English" : "Skip English"}
                    data-testid="button-toggle-locale-en"
                  >
                    {enExcluded ? (
                      <IconArrowBackUp className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <IconTrash className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                  {!enExcluded && (
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
                  )}
                </div>
                {!enExcluded && createContentSlugEnStatus === 'taken' && (
                  <p className="text-xs text-red-600 pl-1">{slugEnConflictReason || 'English slug is taken'}</p>
                )}
                
                <div className={`flex items-center gap-2 transition-opacity ${esExcluded ? 'opacity-40' : ''}`}>
                  {esExcluded ? (
                    <code className="flex-1 text-xs bg-background px-2 py-1 rounded line-through text-muted-foreground">
                      {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEs || createContentSlugEn, 'es')}
                    </code>
                  ) : editingSlugEs ? (
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, '', 'es').slice(0, -1)}
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
                      {buildContentUrlFromPattern(contentTypesMap?.[createContentType]?.url_pattern, createContentSlugEs, 'es')}
                    </code>
                  )}
                  {!esExcluded && (
                    <button
                      type="button"
                      onClick={() => setEditingSlugEs(!editingSlugEs)}
                      className="p-1 rounded hover-elevate"
                      title="Edit Spanish slug"
                      data-testid="button-edit-slug-es"
                    >
                      <IconPencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleLocale('es')}
                    disabled={!esExcluded && isLastActive}
                    className="p-1 rounded hover-elevate disabled:opacity-30 disabled:cursor-not-allowed"
                    title={esExcluded ? "Restore Spanish" : "Skip Spanish"}
                    data-testid="button-toggle-locale-es"
                  >
                    {esExcluded ? (
                      <IconArrowBackUp className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <IconTrash className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                  {!esExcluded && (
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
                  )}
                </div>
                {!esExcluded && createContentSlugEsStatus === 'taken' && (
                  <p className="text-xs text-red-600 pl-1">{slugEsConflictReason || 'Spanish slug is taken'}</p>
                )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setShowFiles(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover-elevate rounded"
                  data-testid="button-toggle-files"
                >
                  <IconChevronDown className={`h-3 w-3 transition-transform ${showFiles ? '' : '-rotate-90'}`} />
                  Files that will be created
                </button>
                {showFiles && (
                  <div className="space-y-0.5 font-mono text-xs text-muted-foreground pl-4 pt-1">
                    <div>marketing-content/{contentTypesMap?.[createContentType]?.directory || createContentType}/{createContentSlugEn}/</div>
                    <div className="pl-4">├── _common.yml</div>
                    {activeLocales.map((loc, i) => (
                      <div key={loc} className="pl-4">
                        {i === activeLocales.length - 1 ? '└── ' : '├── '}{loc}.yml
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
              if (createContentType === 'landing') {
                if (!createContentSlugEn || createContentSlugEnStatus !== 'available') return;
              } else {
                const enNeeded = !excludedLocales.has('en');
                const esNeeded = !excludedLocales.has('es');
                if (enNeeded && (!createContentSlugEn || createContentSlugEnStatus !== 'available')) return;
                if (esNeeded && (!createContentSlugEs || createContentSlugEsStatus !== 'available')) return;
                if (!enNeeded && !esNeeded) return;
              }
              
              setIsCreatingContent(true);
              try {
                const token = getDebugToken();
                
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
                    onOpenChange(false);
                    setCreateContentTitle("");
                    setCreateContentSlugEn("");
                    setCreateContentSlugEs("");
                    setCreateContentSlugEnStatus('idle');
                    setCreateContentSlugEsStatus('idle');
                    setSlugEnConflictReason(null);
                    setSlugEsConflictReason(null);
                    setCreateLandingLocale('en');
                    
                    setSitemapLoading(true);
                    const sitemapRes = await fetch('/api/debug/sitemap-urls');
                    if (sitemapRes.ok) {
                      const urls = await sitemapRes.json();
                      setSitemapUrls(urls);
                    }
                    setSitemapLoading(false);
                    
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
                      slugEn: excludedLocales.has('en') ? undefined : createContentSlugEn,
                      slugEs: excludedLocales.has('es') ? undefined : createContentSlugEs,
                      title: createContentTitle || createContentSlugEn,
                      ...(duplicatingPage ? { sourceUrl: duplicatingPage.loc } : {}),
                      ...(excludedLocales.size > 0 ? { skipLocales: Array.from(excludedLocales) } : {}),
                      ...(isTypeChanged ? { changeContentType: true } : {}),
                    }),
                  });
                  
                  const data = await response.json();
                  
                  if (response.ok && data.success) {
                    const pattern = contentTypesMap?.[createContentType]?.url_pattern;
                    const newUrl = buildContentUrlFromPattern(pattern, createContentSlugEn, 'en');
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
                    setCreateContentSlugEnStatus('idle');
                    setCreateContentSlugEsStatus('idle');
                    setSlugEnConflictReason(null);
                    setSlugEsConflictReason(null);
                    setDuplicatingPage(null);
                    
                    setSitemapLoading(true);
                    const sitemapRes = await fetch('/api/debug/sitemap-urls');
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
              isCreatingContent ||
              (createContentType === 'landing'
                ? (!createContentSlugEn || createContentSlugEnStatus !== 'available')
                : (
                  (!excludedLocales.has('en') && (!createContentSlugEn || createContentSlugEnStatus !== 'available')) ||
                  (!excludedLocales.has('es') && (!createContentSlugEs || createContentSlugEsStatus !== 'available')) ||
                  (excludedLocales.has('en') && excludedLocales.has('es'))
                )
              )
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
