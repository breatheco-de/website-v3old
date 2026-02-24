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

let LOCAL_COMMIT_HASH = '?';
try {
  LOCAL_COMMIT_HASH = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  LOCAL_COMMIT_HASH = '?';
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

export function getLocalCommitHash(): string {
  return LOCAL_COMMIT_HASH;
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
