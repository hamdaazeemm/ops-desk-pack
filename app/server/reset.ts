import { rmSync } from 'node:fs';
import { STATE_PATH } from './data.ts';

rmSync(STATE_PATH, { force: true });
console.log('Desk state cleared. It will be rebuilt from the triage cache on next start.');
