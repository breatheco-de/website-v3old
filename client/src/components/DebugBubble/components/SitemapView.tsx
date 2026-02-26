import {
  IconArrowLeft,
  IconSearch,
  IconX,
  IconRefresh,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconDotsVertical,
  IconCopy,
  IconDownload,
  IconTrash,
  IconExternalLink,
} from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MenuView, SitemapUrl } from "../types";

export interface SitemapFolder {
  name: string;
  path: string;
  urls: SitemapUrl[];
  subfolders: SitemapFolder[];
}

interface SitemapViewProps {
  setMenuView: (v: MenuView) => void;
  sitemapUrls: SitemapUrl[];
  sitemapLoading: boolean;
  sitemapSearch: string;
  setSitemapSearch: (v: string) => void;
  showSitemapSearch: boolean;
  setShowSitemapSearch: (v: boolean) => void;
  filteredSitemapUrls: SitemapUrl[];
  folders: SitemapFolder[];
  rootUrls: SitemapUrl[];
  expandedFolders: Set<string>;
  toggleFolder: (name: string) => void;
  setCreateContentModalOpen: (v: boolean) => void;
  handleDuplicatePage: (url: SitemapUrl) => void;
  handleDeletePage: (url: SitemapUrl) => void;
  handleDownloadYml: (url: SitemapUrl) => void;
}

export function SitemapView({
  setMenuView,
  sitemapUrls,
  sitemapLoading,
  sitemapSearch,
  setSitemapSearch,
  showSitemapSearch,
  setShowSitemapSearch,
  filteredSitemapUrls,
  folders,
  rootUrls,
  expandedFolders,
  toggleFolder,
  setCreateContentModalOpen,
  handleDuplicatePage,
  handleDeletePage,
  handleDownloadYml,
}: SitemapViewProps) {
  return (
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
                              {path.slice(folder.path.length + 1)}
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
  );
}
