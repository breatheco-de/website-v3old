import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { gcs } from './gcs';

const SYNC_LOG_PATH = path.join(process.cwd(), 'marketing-content', '.sync-log-state.txt');
const GCS_SYNC_LOG_KEY = 'sync/sync-log-state.txt';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MAX_LOG_LINES = 500;

const INSTANCE_ID = crypto.randomBytes(2).toString('hex');

let REPLIT_CHECKPOINT = '?';
try {
  REPLIT_CHECKPOINT = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  REPLIT_CHECKPOINT = '?';
}

let GITHUB_COMMIT: string | null = null;

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleanUrl = url.replace(/\.git$/, '');
    const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) return { owner: match[1], repo: match[2] };
    return null;
  } catch {
    return null;
  }
}

export async function refreshGithubCommit(): Promise<void> {
  const token = process.env.GITHUB_TOKEN || '';
  const repoUrl = process.env.GITHUB_REPO_URL || '';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const parsed = parseGitHubUrl(repoUrl);
  if (!token || !parsed) return;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?sha=${branch}&per_page=1`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (res.ok) {
      const commits = await res.json() as Array<{ sha: string }>;
      if (commits.length > 0) {
        GITHUB_COMMIT = commits[0].sha.slice(0, 8);
      }
    }
  } catch {
    // silently ignore - GITHUB_COMMIT stays as previous value or null
  }
}

export function getGithubCommit(): string | null {
  return GITHUB_COMMIT;
}

type SyncLogCategory =
  | 'RESTART'
  | 'RECONCILE'
  | 'WEBHOOK'
  | 'AUTO-PULL'
  | 'COMMIT'
  | 'CONFLICT'
  | 'ERROR';

let logLines: string[] = [];
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function formatEntry(category: SyncLogCategory, message: string): string {
  const ts = new Date().toISOString();
  return `${ts} [${category}] ${message}`;
}

function loadLocal(): void {
  try {
    if (fs.existsSync(SYNC_LOG_PATH)) {
      const raw = fs.readFileSync(SYNC_LOG_PATH, 'utf-8');
      logLines = raw.split('\n').filter(l => l.trim() !== '');
    } else {
      logLines = [];
    }
  } catch {
    logLines = [];
  }
  loaded = true;
}

function saveLocal(): void {
  try {
    const dir = path.dirname(SYNC_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SYNC_LOG_PATH, logLines.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.error('[SyncLog] Error saving local log:', error);
  }
}

async function saveToBucket(): Promise<void> {
  if (!IS_PRODUCTION || !gcs.available) return;
  try {
    const content = logLines.join('\n') + '\n';
    await gcs.upload(GCS_SYNC_LOG_KEY, Buffer.from(content, 'utf-8'), 'text/plain');
  } catch (error) {
    console.error('[SyncLog] Error saving log to bucket:', error);
  }
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    saveLocal();
    await saveToBucket();
  }, 2000);
}

function trimLog(): void {
  if (logLines.length > MAX_LOG_LINES) {
    logLines = logLines.slice(logLines.length - MAX_LOG_LINES);
  }
}

export async function loadSyncLog(): Promise<void> {
  if (loaded) return;

  if (IS_PRODUCTION && gcs.available) {
    try {
      const exists = await gcs.exists(GCS_SYNC_LOG_KEY);
      if (exists) {
        const data = await gcs.download(GCS_SYNC_LOG_KEY);
        if (data) {
          logLines = data.toString('utf-8').split('\n').filter(l => l.trim() !== '');
          loaded = true;
          saveLocal();
          return;
        }
      }
    } catch (error) {
      console.error('[SyncLog] Error loading from bucket:', error);
    }
  }

  loadLocal();
}

export function logSync(category: SyncLogCategory, message: string): void {
  if (!loaded) loadLocal();

  const entry = formatEntry(category, message);
  logLines.push(entry);
  trimLog();
  scheduleSave();

  console.log(`[SyncLog] ${entry}`);
}

export function getInstanceId(): string {
  return INSTANCE_ID;
}

export function getReplitCheckpoint(): string {
  return REPLIT_CHECKPOINT;
}

export function getSyncLogText(): string {
  if (!loaded) loadLocal();
  return logLines.join('\n');
}

export function getRecentEntries(count: number = 20): string[] {
  if (!loaded) loadLocal();
  return logLines.slice(-count);
}

export async function flushSyncLog(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveLocal();
  await saveToBucket();
}

export async function clearSyncLog(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  logLines = [];
  saveLocal();
  await saveToBucket();
  logSync('RESTART', `Log cleared (instance=${INSTANCE_ID}, checkpoint=${REPLIT_CHECKPOINT})`);
}
