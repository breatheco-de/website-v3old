import {
  IconBrandGithub,
  IconAlertTriangle,
  IconRefresh,
  IconArrowUp,
  IconArrowDown,
  IconChevronRight,
  IconChevronDown,
  IconX,
  IconDeviceFloppy,
  IconTrash,
  IconArrowBackUp,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AutoCommitStatus, PendingChange, GitHubSyncStatus } from "../types";

export interface SyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoCommitStatus: AutoCommitStatus | null;
  autoCommitCountdown: number | null;
  isFlushing: boolean;
  handleFlush: () => Promise<void>;
  handleClearConflict: (filePath: string) => Promise<void>;
  pendingChanges: PendingChange[];
  pendingChangesLoading: boolean;
  selectedFileForCommit: string | null;
  setSelectedFileForCommit: (v: string | null) => void;
  fileCommitMessage: string;
  setFileCommitMessage: (v: string) => void;
  fileCommitting: string | null;
  handleFileCommit: (filePath: string) => Promise<void>;
  filePulling: string | null;
  handleFilePull: (filePath: string) => Promise<void>;
  setConfirmPullFile: (v: string | null) => void;
  githubSyncStatus: GitHubSyncStatus | null;
  commitMessage: string;
  setCommitMessage: (v: string) => void;
  isCommitting: boolean;
  handleCommit: () => Promise<void>;
  handleSyncFromRemote: () => Promise<void>;
  isSyncing: boolean;
  handleIgnoreAllChanges: () => Promise<void>;
  isIgnoringAllChanges: boolean;
  fetchPendingChanges: () => void;
  manualActionsOpen: boolean;
  setManualActionsOpen: (v: boolean) => void;
  advancedOptionsOpen: boolean;
  setAdvancedOptionsOpen: (v: boolean) => void;
  getDebugToken: () => string | null;
  toast: any;
}

export function SyncModal({
  open,
  onOpenChange,
  autoCommitStatus,
  autoCommitCountdown,
  isFlushing,
  handleFlush,
  handleClearConflict,
  pendingChanges,
  pendingChangesLoading,
  selectedFileForCommit,
  setSelectedFileForCommit,
  fileCommitMessage,
  setFileCommitMessage,
  fileCommitting,
  handleFileCommit,
  filePulling,
  handleFilePull,
  setConfirmPullFile,
  githubSyncStatus,
  handleIgnoreAllChanges,
  isIgnoringAllChanges,
  fetchPendingChanges,
  manualActionsOpen,
  setManualActionsOpen,
  advancedOptionsOpen,
  setAdvancedOptionsOpen,
  getDebugToken,
  toast,
}: SyncModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBrandGithub className="h-5 w-5" />
            GitHub Sync
          </DialogTitle>
          <DialogDescription>
            Auto-commit keeps your content changes synced to GitHub.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {autoCommitStatus && (!autoCommitStatus.githubConfigured || autoCommitStatus.lastError) && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                {!autoCommitStatus.githubConfigured ? (
                  <p className="text-red-700 dark:text-red-300">
                    GitHub is not configured. Set <code className="text-xs bg-red-100 dark:bg-red-900/50 px-1 rounded">GITHUB_TOKEN</code>, <code className="text-xs bg-red-100 dark:bg-red-900/50 px-1 rounded">GITHUB_REPO_URL</code>, and enable <code className="text-xs bg-red-100 dark:bg-red-900/50 px-1 rounded">GITHUB_SYNC_ENABLED=true</code> in environment variables.
                  </p>
                ) : (
                  <p className="text-red-700 dark:text-red-300">{autoCommitStatus.lastError}</p>
                )}
              </div>
            </div>
          )}

          <Card className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  autoCommitStatus?.enabled && autoCommitStatus.githubConfigured
                    ? autoCommitStatus.isCommitting ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
                    : 'bg-muted-foreground/30'
                }`} />
                <span className="text-sm font-medium">
                  {autoCommitStatus?.isCommitting ? 'Syncing...' : autoCommitStatus?.enabled ? 'Auto-sync active' : 'Auto-sync inactive'}
                </span>
              </div>
              {autoCommitStatus?.pendingFiles ? (
                <Badge variant="secondary">{autoCommitStatus.pendingFiles} queued</Badge>
              ) : null}
            </div>

            {autoCommitStatus?.enabled && autoCommitStatus.githubConfigured && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Next sync</span>
                <span className="font-mono font-medium">
                  {autoCommitStatus.isCommitting
                    ? 'now...'
                    : autoCommitCountdown !== null && autoCommitCountdown > 0
                    ? `in ${autoCommitCountdown}s`
                    : autoCommitStatus.pendingFiles > 0
                    ? 'momentarily...'
                    : 'when files change'}
                </span>
              </div>
            )}

            {autoCommitStatus?.lastCommitAt && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last sync</span>
                <div className="flex items-center gap-1.5">
                  <span>{new Date(autoCommitStatus.lastCommitAt).toLocaleTimeString()}</span>
                  {autoCommitStatus.lastCommitSha && githubSyncStatus?.repoUrl && (
                    <a
                      href={`${githubSyncStatus.repoUrl.replace(/\.git$/, '')}/commit/${autoCommitStatus.lastCommitSha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                      data-testid="link-last-auto-commit"
                    >
                      {autoCommitStatus.lastCommitSha.substring(0, 7)}
                    </a>
                  )}
                </div>
              </div>
            )}

            {autoCommitStatus?.enabled && autoCommitStatus.pendingFiles > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleFlush}
                disabled={isFlushing || autoCommitStatus.isCommitting}
                data-testid="button-flush-auto-commit"
              >
                {isFlushing ? (
                  <><IconRefresh className="h-3.5 w-3.5 mr-1.5 animate-spin" />Syncing...</>
                ) : (
                  <><IconArrowUp className="h-3.5 w-3.5 mr-1.5" />Sync Now</>
                )}
              </Button>
            )}
          </Card>

          {autoCommitStatus && (autoCommitStatus.pendingFilesDetails.length > 0 || autoCommitStatus.conflictedFiles.length > 0) && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {autoCommitStatus.conflictedFiles.length > 0 ? 'Queued & Conflicted Files' : 'Queued Files'}
              </span>
              <ScrollArea className="max-h-[180px]">
                <div className="space-y-1">
                  {autoCommitStatus.conflictedFiles.map((filePath, idx) => (
                    <Card key={`conflict-${idx}`} className="p-2 space-y-1">
                      <div className="font-mono text-xs text-foreground truncate" title={filePath}>
                        {filePath.replace('marketing-content/', '')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                          Conflict
                        </span>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => {
                                  setSelectedFileForCommit(filePath);
                                  setFileCommitMessage("");
                                }}
                                data-testid={`button-resolve-upload-${idx}`}
                              >
                                <IconArrowUp className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Upload my version</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => {
                                  setConfirmPullFile(filePath);
                                }}
                                data-testid={`button-resolve-download-${idx}`}
                              >
                                <IconArrowDown className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Download remote version</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleClearConflict(filePath)}
                                data-testid={`button-clear-conflict-${idx}`}
                              >
                                <IconX className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Dismiss conflict</p></TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {autoCommitStatus.pendingFilesDetails.map((file, idx) => (
                    <Card key={`pending-${idx}`} className="p-2 space-y-1">
                      <div className="font-mono text-xs text-foreground truncate" title={file.filePath}>
                        {file.filePath.replace('marketing-content/', '')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          Queued
                        </span>
                        <span className="text-xs text-muted-foreground">{file.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(file.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => {
                setManualActionsOpen(!manualActionsOpen);
                if (!manualActionsOpen) fetchPendingChanges();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-manual-actions"
            >
              {manualActionsOpen ? (
                <IconChevronDown className="h-3.5 w-3.5" />
              ) : (
                <IconChevronRight className="h-3.5 w-3.5" />
              )}
              Manual Actions
            </button>
            
            {manualActionsOpen && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  {pendingChangesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : pendingChanges.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No remote or local differences detected outside the auto-commit queue.
                    </p>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto">
                      <div className="space-y-1">
                        {pendingChanges.map((change, index) => (
                          <Card
                            key={`${change.file}-${index}`}
                            className="p-2 space-y-1"
                          >
                            <div
                              className="font-mono text-xs text-foreground truncate"
                              title={change.file}
                            >
                              {change.file.replace('marketing-content/', '')}
                            </div>
                            
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
                                      <><IconArrowUp className="h-3 w-3 mr-1" />Commit</>
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
                                <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                                  change.source === 'conflict'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                    : change.source === 'incoming'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                }`}>
                                  {change.source === 'conflict' ? 'Conflict' : change.source === 'incoming' ? 'Incoming' : 'Local'}
                                </span>
                                <span className="text-xs text-muted-foreground italic">
                                  {change.author || 'Unknown author'}
                                </span>
                                {change.date && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(change.date).toLocaleDateString()}
                                  </span>
                                )}
                                {change.commitSha && githubSyncStatus?.repoUrl && (
                                  <a
                                    href={`${githubSyncStatus.repoUrl.replace(/\.git$/, '')}/commit/${change.commitSha}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-mono text-primary hover:underline"
                                    data-testid={`link-commit-${index}`}
                                  >
                                    {change.commitSha.substring(0, 7)}
                                  </a>
                                )}
                                <div className="flex-1" />
                                <div className="flex items-center gap-1">
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
                                            if (token) headers["Authorization"] = `Token ${token}`;
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
                                    <TooltipContent side="top"><p>Download backup</p></TooltipContent>
                                  </Tooltip>
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
                                      <TooltipContent side="top"><p>Upload to remote</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  {(change.source === 'local') && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() => setConfirmPullFile(change.file)}
                                          disabled={filePulling === change.file}
                                          data-testid={`button-drop-file-${index}`}
                                        >
                                          {filePulling === change.file ? (
                                            <IconRefresh className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <IconArrowBackUp className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top"><p>Drop changes (revert to remote)</p></TooltipContent>
                                    </Tooltip>
                                  )}
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
                                      <TooltipContent side="top"><p>Download remote</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOptionsOpen(!advancedOptionsOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-advanced-actions"
            >
              {advancedOptionsOpen ? (
                <IconChevronDown className="h-3.5 w-3.5" />
              ) : (
                <IconChevronRight className="h-3.5 w-3.5" />
              )}
              Advanced Actions
            </button>

            {advancedOptionsOpen && (
              <div className="mt-3">
                <div className="p-3 bg-muted/50 rounded-md space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Discard all local changes and reset to the remote version.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleIgnoreAllChanges}
                    disabled={isIgnoringAllChanges || !pendingChanges.some(c => c.source === 'local' || c.source === 'conflict')}
                    data-testid="button-ignore-all-changes"
                  >
                    {isIgnoringAllChanges ? (
                      <><IconRefresh className="h-3.5 w-3.5 mr-1.5 animate-spin" />Resetting...</>
                    ) : (
                      <><IconTrash className="h-3.5 w-3.5 mr-1.5" />Ignore all local changes</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedFileForCommit(null);
              setFileCommitMessage("");
              setManualActionsOpen(false);
            }}
            data-testid="button-close-commit-modal"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
