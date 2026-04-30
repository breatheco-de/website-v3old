/**
 * Sync State Management
 * 
 * Tracks the synchronization state between local content files and GitHub.
 * Persists state to GCS bucket to survive deployments, with local file as cache.
 * Works without git CLI - uses file hashes and GitHub API for comparison.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { gcs } from './gcs';

const SYNC_STATE_PATH = path.join(process.cwd(), 'marketing-content', '.sync-state.json');
const MARKETING_CONTENT_DIR = path.join(process.cwd(), 'marketing-content');
const GCS_SYNC_STATE_KEY = 'sync/sync-state.json';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Load sync state from GCS bucket on startup using authenticated download.
 * In production: loads from bucket, falls back to local file.
 * In development: uses local file only (each dev environment has its own state).
 */
export async function loadSyncStateFromBucket(): Promise<SyncState> {
  if (!IS_PRODUCTION) {
    console.log('[SyncState] Development mode, using local file only');
    return loadSyncState();
  }

  if (!gcs.available) {
    console.log('[SyncState] GCS unavailable, loading from local file');
    return loadSyncState();
  }

  try {
    const exists = await gcs.exists(GCS_SYNC_STATE_KEY);
    if (!exists) {
      console.log('[SyncState] No sync state found in bucket, using local file');
      return loadSyncState();
    }

    const data = await gcs.download(GCS_SYNC_STATE_KEY);
    if (!data) {
      console.log('[SyncState] Empty download from bucket, using local file');
      return loadSyncState();
    }

    const state = JSON.parse(data.toString('utf-8')) as SyncStateWithConfig;
    console.log('[SyncState] Loaded sync state from GCS bucket (authenticated)');

    saveSyncStateLocal(state);
    return state;
  } catch (error) {
    console.error('[SyncState] Error loading from bucket:', error);
    return loadSyncState();
  }
}

/**
 * Save sync state to GCS bucket for persistence across deployments.
 * Only runs in production — development uses local file only.
 */
async function saveSyncStateToBucket(state: SyncStateWithConfig): Promise<void> {
  if (!IS_PRODUCTION || !gcs.available) return;

  try {
    const content = JSON.stringify(state, null, 2);
    await gcs.upload(GCS_SYNC_STATE_KEY, Buffer.from(content, 'utf-8'), 'application/json');
  } catch (error) {
    console.error('[SyncState] Error saving to bucket:', error);
  }
}

/**
 * Check if a file should be tracked by the sync system.
 * Tracks YAML and JSON files in marketing-content directory.
 * Excludes component-registry, dot-prefixed state files, and image directories.
 */
export function shouldTrackFile(filePath: string, allowedExceptions?: Set<string>): boolean {
  if (allowedExceptions instanceof Set && allowedExceptions.has(filePath)) return true;

  if (!filePath.startsWith('marketing-content/')) {
    return false;
  }
  
  if (filePath.includes('component-registry/')) {
    // Only allow YML files inside the examples/ subfolder
    // Pattern: component-registry/{type}/{version}/examples/{file}.yml
    if (/component-registry\/[^/]+\/[^/]+\/examples\/[^/]+\.ya?ml$/.test(filePath)) {
      return true;
    }
    return false;
  }

  const basename = path.basename(filePath);
  if (basename.startsWith('.') && basename.endsWith('-state.json')) {
    return false;
  }

  if (filePath.includes('/images/')) {
    return false;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.yml' && ext !== '.yaml' && ext !== '.json') {
    return false;
  }
  
  return true;
}

export interface FileSyncInfo {
  sha: string;
  lastModified: number;
  remoteSha?: string;
  pulledFromCommit?: string;
  author?: string;
  modifiedAt?: string;
}

export interface SyncConfig {
  commitIntervalSeconds: number;
}

export interface SyncState {
  lastSyncedCommit: string | null;
  lastSyncedAt: string | null;
  files: Record<string, FileSyncInfo>;
}

export interface WebhookInfo {
  webhookId: number;
  webhookSecret: string;
  webhookUrl: string;
  createdAt: string;
}

export interface SyncStateWithConfig extends SyncState {
  config?: SyncConfig;
  webhook?: WebhookInfo;
}

export interface PendingChange {
  file: string;
  status: 'modified' | 'added' | 'deleted';
  source: 'local' | 'incoming' | 'conflict';
  contentType: string;
  slug: string;
  localSha: string;
  remoteSha?: string;
  author?: string;
  date?: string;
  commitSha?: string;
}

const DEFAULT_CONFIG: SyncConfig = {
  commitIntervalSeconds: 5,
};

const DEFAULT_SYNC_STATE: SyncStateWithConfig = {
  config: DEFAULT_CONFIG,
  lastSyncedCommit: null,
  lastSyncedAt: null,
  files: {},
};

export function computeFileSha(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function computeGitBlobSha(content: string): string {
  const buf = Buffer.from(content, 'utf-8');
  const header = `blob ${buf.length}\0`;
  return crypto.createHash('sha1').update(header).update(buf).digest('hex');
}

export function getSyncConfig(): SyncConfig {
  const state = loadSyncState() as SyncStateWithConfig;
  return state.config || DEFAULT_CONFIG;
}

export function updateSyncConfig(config: Partial<SyncConfig>): void {
  const state = loadSyncState() as SyncStateWithConfig;
  state.config = { ...(state.config || DEFAULT_CONFIG), ...config };
  saveSyncState(state);
}

/**
 * Save sync state to local file only (no bucket upload).
 */
function saveSyncStateLocal(state: SyncStateWithConfig): void {
  try {
    const dir = path.dirname(SYNC_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving sync state locally:', error);
  }
}

export function loadSyncState(): SyncState {
  try {
    if (fs.existsSync(SYNC_STATE_PATH)) {
      const content = fs.readFileSync(SYNC_STATE_PATH, 'utf-8');
      const state = JSON.parse(content) as SyncStateWithConfig;
      
      const prunedFiles: Record<string, FileSyncInfo> = {};
      let pruned = false;
      for (const [filePath, info] of Object.entries(state.files)) {
        if (shouldTrackFile(filePath)) {
          prunedFiles[filePath] = info;
        } else {
          pruned = true;
        }
      }
      
      if (pruned) {
        state.files = prunedFiles;
        saveSyncStateLocal(state);
      }
      
      return state;
    }
  } catch (error) {
    console.error('Error loading sync state:', error);
  }
  return { ...DEFAULT_SYNC_STATE };
}

/**
 * Save sync state to local file AND to GCS bucket.
 */
export function saveSyncState(state: SyncState): void {
  const stateWithConfig = state as SyncStateWithConfig;
  if (!stateWithConfig.config) {
    stateWithConfig.config = DEFAULT_CONFIG;
  }
  saveSyncStateLocal(stateWithConfig);
  saveSyncStateToBucket(stateWithConfig).catch(err => {
    console.error('[SyncState] Background bucket save failed:', err);
  });
}

let autoCommitCallback: ((filePath: string, author?: string, allowedExceptions?: Set<string>) => void) | null = null;

/**
 * Register the auto-commit callback. Called once during server init.
 */
export function setAutoCommitCallback(cb: (filePath: string, author?: string, allowedExceptions?: Set<string>) => void): void {
  autoCommitCallback = cb;
}

const fileModifiedListeners: Array<(filePath: string) => void> = [];

/**
 * Register a listener that fires whenever any tracked file is marked as modified.
 * Used to invalidate caches that depend on file content.
 */
export function addFileModifiedListener(cb: (filePath: string) => void): void {
  fileModifiedListeners.push(cb);
}

/**
 * Mark a file as modified (dirty) after an edit.
 * Tracks YAML and JSON files in marketing-content directory.
 * Also queues the file for auto-commit if enabled.
 * @param filePath - The file path to mark as modified
 * @param author - Optional author name who made the modification
 */
export function markFileAsModified(filePath: string, author?: string, allowedExceptions?: Set<string>): void {
  const cwd = process.cwd();
  let relativePath: string;
  
  if (path.isAbsolute(filePath)) {
    relativePath = filePath.startsWith(cwd) 
      ? filePath.slice(cwd.length + 1)
      : filePath;
  } else if (filePath.startsWith('marketing-content/') || filePath.startsWith('client/')) {
    relativePath = filePath;
  } else {
    relativePath = `marketing-content/${filePath}`;
  }
  
  if (!shouldTrackFile(relativePath, allowedExceptions)) {
    return;
  }
  
  const state = loadSyncState();
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), relativePath);
  
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const sha = computeFileSha(content);
    const stats = fs.statSync(fullPath);
    
    state.files[relativePath] = {
      sha,
      lastModified: stats.mtimeMs,
      remoteSha: state.files[relativePath]?.remoteSha,
      author: author || state.files[relativePath]?.author,
      modifiedAt: new Date().toISOString(),
    };
    
    saveSyncState(state);

    if (autoCommitCallback) {
      autoCommitCallback(relativePath, author, allowedExceptions);
    }
    fileModifiedListeners.forEach(cb => cb(relativePath));
  } else if (state.files[relativePath]) {
    state.files[relativePath] = {
      ...state.files[relativePath],
      author: author || state.files[relativePath].author,
      modifiedAt: new Date().toISOString(),
    };
    
    saveSyncState(state);

    if (autoCommitCallback) {
      autoCommitCallback(relativePath, author, allowedExceptions);
    }
    fileModifiedListeners.forEach(cb => cb(relativePath));
  } else if (allowedExceptions instanceof Set && allowedExceptions.has(relativePath)) {
    if (autoCommitCallback) {
      autoCommitCallback(relativePath, author, allowedExceptions);
    }
    fileModifiedListeners.forEach(cb => cb(relativePath));
  }
}

function getAllContentFiles(): string[] {
  const files: string[] = [];
  
  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          walkDir(fullPath);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.yml' || ext === '.yaml' || ext === '.json') {
          const relativePath = path.relative(process.cwd(), fullPath);
          if (shouldTrackFile(relativePath)) {
            files.push(relativePath);
          }
        }
      }
    }
  }
  
  walkDir(MARKETING_CONTENT_DIR);
  return files;
}

function parseContentPath(filePath: string): { contentType: string; slug: string } {
  const withoutPrefix = filePath.replace('marketing-content/', '');
  const parts = withoutPrefix.split('/');
  if (parts.length >= 2) {
    return {
      contentType: parts[0],
      slug: parts[1],
    };
  }
  return {
    contentType: 'config',
    slug: path.basename(filePath, path.extname(filePath)),
  };
}

export function detectPendingChanges(): PendingChange[] {
  const state = loadSyncState();
  const changesMap = new Map<string, PendingChange>();
  const currentFiles = getAllContentFiles();
  const processedFiles = new Set<string>();
  
  for (const filePath of currentFiles) {
    if (!shouldTrackFile(filePath)) {
      continue;
    }
    
    processedFiles.add(filePath);
    const fullPath = path.join(process.cwd(), filePath);
    
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const currentSha = computeFileSha(content);
      const storedInfo = state.files[filePath];
      
      const { contentType, slug } = parseContentPath(filePath);
      
      if (!storedInfo || !storedInfo.remoteSha) {
        changesMap.set(filePath, {
          file: filePath,
          status: 'added',
          source: 'local',
          contentType,
          slug,
          localSha: currentSha,
          author: storedInfo?.author,
          date: storedInfo?.modifiedAt,
        });
      } else if (storedInfo.remoteSha !== currentSha) {
        changesMap.set(filePath, {
          file: filePath,
          status: 'modified',
          source: 'local',
          contentType,
          slug,
          localSha: currentSha,
          remoteSha: storedInfo.remoteSha,
          author: storedInfo.author,
          date: storedInfo.modifiedAt,
        });
      } else if (storedInfo.sha !== currentSha) {
        changesMap.set(filePath, {
          file: filePath,
          status: 'modified',
          source: 'local',
          contentType,
          slug,
          localSha: currentSha,
          remoteSha: storedInfo.remoteSha,
          author: storedInfo.author,
          date: storedInfo.modifiedAt,
        });
      }
    } catch (error) {
      console.error(`Error checking file ${filePath}:`, error);
    }
  }
  
  for (const [filePath, info] of Object.entries(state.files)) {
    if (!processedFiles.has(filePath) && shouldTrackFile(filePath) && info.remoteSha) {
      const { contentType, slug } = parseContentPath(filePath);
      changesMap.set(filePath, {
        file: filePath,
        status: 'deleted',
        source: 'local',
        contentType,
        slug,
        localSha: '',
        remoteSha: info.remoteSha,
        author: info.author,
        date: info.modifiedAt,
      });
    }
  }
  
  return Array.from(changesMap.values());
}

export function updateSyncStateAfterCommit(
  commitSha: string,
  committedFiles: string[]
): void {
  const state = loadSyncState();
  
  state.lastSyncedCommit = commitSha;
  state.lastSyncedAt = new Date().toISOString();
  
  for (const filePath of committedFiles) {
    if (!shouldTrackFile(filePath)) {
      continue;
    }
    
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const sha = computeFileSha(content);
      const stats = fs.statSync(fullPath);
      
      state.files[filePath] = {
        sha,
        lastModified: stats.mtimeMs,
        remoteSha: sha,
      };
    } else {
      delete state.files[filePath];
    }
  }
  
  saveSyncState(state);
}

export function initializeSyncStateFromRemote(
  commitSha: string,
  remoteFiles: Array<{ path: string; sha: string }>
): void {
  const existingState = loadSyncState() as SyncStateWithConfig;
  const state: SyncStateWithConfig = {
    config: existingState.config || DEFAULT_CONFIG,
    ...(existingState.webhook ? { webhook: existingState.webhook } : {}),
    lastSyncedCommit: commitSha,
    lastSyncedAt: new Date().toISOString(),
    files: {},
  };
  
  for (const file of remoteFiles) {
    if (!shouldTrackFile(file.path)) {
      continue;
    }
    
    const fullPath = path.join(process.cwd(), file.path);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const localSha = computeFileSha(content);
      const stats = fs.statSync(fullPath);
      
      state.files[file.path] = {
        sha: localSha,
        lastModified: stats.mtimeMs,
        remoteSha: file.sha,
      };
    }
  }
  
  saveSyncState(state);
}

export function rebuildSyncStateFromLocal(commitSha: string): void {
  const currentFiles = getAllContentFiles();
  const existingState = loadSyncState() as SyncStateWithConfig;
  const state: SyncStateWithConfig = {
    config: existingState.config || DEFAULT_CONFIG,
    ...(existingState.webhook ? { webhook: existingState.webhook } : {}),
    lastSyncedCommit: commitSha,
    lastSyncedAt: new Date().toISOString(),
    files: {},
  };
  
  for (const filePath of currentFiles) {
    if (!shouldTrackFile(filePath)) {
      continue;
    }
    
    const fullPath = path.join(process.cwd(), filePath);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const sha = computeFileSha(content);
      const stats = fs.statSync(fullPath);

      const existing = existingState.files[filePath];
      const hadLocalChanges = existing && existing.remoteSha && existing.sha !== existing.remoteSha;

      state.files[filePath] = {
        sha,
        lastModified: stats.mtimeMs,
        remoteSha: hadLocalChanges ? existing.remoteSha : sha,
        ...(hadLocalChanges && existing.author ? { author: existing.author } : {}),
        ...(hadLocalChanges && existing.modifiedAt ? { modifiedAt: existing.modifiedAt } : {}),
      };
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }
  }
  
  saveSyncState(state);
}

export function getLastSyncedCommit(): string | null {
  const state = loadSyncState();
  return state.lastSyncedCommit;
}

export function getFileStatus(filePath: string): {
  exists: boolean;
  localSha: string | null;
  remoteSha: string | null;
  hasConflict: boolean;
  status: 'synced' | 'modified' | 'added' | 'deleted' | 'conflict' | 'unknown';
} {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  if (!shouldTrackFile(relativePath)) {
    return { exists: false, localSha: null, remoteSha: null, hasConflict: false, status: 'unknown' };
  }
  
  const state = loadSyncState();
  const fullPath = path.join(process.cwd(), relativePath);
  const storedInfo = state.files[relativePath];
  
  if (!fs.existsSync(fullPath)) {
    if (storedInfo?.remoteSha) {
      return { exists: false, localSha: null, remoteSha: storedInfo.remoteSha, hasConflict: false, status: 'deleted' };
    }
    return { exists: false, localSha: null, remoteSha: null, hasConflict: false, status: 'unknown' };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const localSha = computeFileSha(content);
  const remoteSha = storedInfo?.remoteSha || null;
  
  if (!remoteSha) {
    return { exists: true, localSha, remoteSha: null, hasConflict: false, status: 'added' };
  }
  
  if (localSha === remoteSha) {
    return { exists: true, localSha, remoteSha, hasConflict: false, status: 'synced' };
  }
  
  return { exists: true, localSha, remoteSha, hasConflict: false, status: 'modified' };
}

export function updateFileAfterPull(filePath: string, pulledFromCommit?: string): void {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  if (!shouldTrackFile(relativePath)) {
    return;
  }
  
  const state = loadSyncState();
  const fullPath = path.join(process.cwd(), relativePath);
  
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const sha = computeFileSha(content);
    const stats = fs.statSync(fullPath);
    
    state.files[relativePath] = {
      sha,
      lastModified: stats.mtimeMs,
      remoteSha: sha,
      pulledFromCommit,
    };
    
    saveSyncState(state);
  }
}

export function wasFilePulledFromCommit(filePath: string, commitSha: string): boolean {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  const state = loadSyncState();
  const fileInfo = state.files[relativePath];
  
  if (!fileInfo || !fileInfo.pulledFromCommit) {
    return false;
  }
  
  return fileInfo.pulledFromCommit === commitSha;
}

export function updateFileAfterCommit(filePath: string, commitSha: string): void {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  if (!shouldTrackFile(relativePath)) {
    return;
  }
  
  const state = loadSyncState();
  const fullPath = path.join(process.cwd(), relativePath);
  
  state.lastSyncedCommit = commitSha;
  state.lastSyncedAt = new Date().toISOString();
  
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const sha = computeFileSha(content);
    const stats = fs.statSync(fullPath);
    
    state.files[relativePath] = {
      sha,
      lastModified: stats.mtimeMs,
      remoteSha: sha,
    };
  } else {
    delete state.files[relativePath];
  }
  
  saveSyncState(state);
}

export function isFileSynced(filePath: string): boolean {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  const state = loadSyncState();
  const fileInfo = state.files[relativePath];
  
  if (!fileInfo) {
    return false;
  }
  
  return fileInfo.sha === fileInfo.remoteSha;
}

export function discardLocalChanges(filePath: string): boolean {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  if (!shouldTrackFile(relativePath)) {
    return false;
  }
  
  const state = loadSyncState();
  const fullPath = path.join(process.cwd(), relativePath);
  
  if (!fs.existsSync(fullPath)) {
    delete state.files[relativePath];
    saveSyncState(state);
    return true;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const sha = computeFileSha(content);
  const stats = fs.statSync(fullPath);
  
  state.files[relativePath] = {
    sha,
    lastModified: stats.mtimeMs,
    remoteSha: sha,
  };
  
  saveSyncState(state);
  return true;
}

export function removeFileFromState(filePath: string): void {
  const relativePath = filePath.startsWith('marketing-content/') 
    ? filePath 
    : `marketing-content/${filePath}`;
  
  const state = loadSyncState();
  delete state.files[relativePath];
  saveSyncState(state);
}

export function getWebhookInfo(): WebhookInfo | undefined {
  const state = loadSyncState() as SyncStateWithConfig;
  return state.webhook;
}

export function setWebhookInfo(webhook: WebhookInfo): void {
  const state = loadSyncState() as SyncStateWithConfig;
  state.webhook = webhook;
  saveSyncState(state);
}

export function clearWebhookInfo(): void {
  const state = loadSyncState() as SyncStateWithConfig;
  delete state.webhook;
  saveSyncState(state);
}
