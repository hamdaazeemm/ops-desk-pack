import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Message, TriageCache } from '../shared/types.ts';

export const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(APP_DIR, 'data');
export const INBOX_PATH = join(APP_DIR, '..', 'pack', 'inbox.json');
export const CACHE_PATH = join(DATA_DIR, 'triage-cache.json');
export const STATE_PATH = join(DATA_DIR, 'state.json');

type Registers = {
  vendors: { name: string; match: string[]; domains: string[]; phone_on_file: string }[];
  ndas: { counterparty: string; match: string[]; status: string; circulated: string; executed: string | null }[];
  signatories: string[];
};

export const registers: Registers = JSON.parse(readFileSync(join(DATA_DIR, 'registers.json'), 'utf8'));

export function loadInbox(): Message[] {
  return JSON.parse(readFileSync(INBOX_PATH, 'utf8')).messages;
}

export function loadCache(): TriageCache | null {
  if (!existsSync(CACHE_PATH)) return null;
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
}

/** Minimal .env loader so the app has no dotenv dependency. */
export function loadEnv() {
  for (const p of [join(APP_DIR, '.env'), join(APP_DIR, '..', '.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
