/**
 * Logger — detailed logs for strategy debugging
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'api' | 'trade' | 'signal';

const COLORS: Record<string, string> = {
  debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m',
  error: '\x1b[31m', api: '\x1b[35m', trade: '\x1b[32m', signal: '\x1b[34m',
  reset: '\x1b[0m'
};

let verbose = false;
let logFile: string | null = null;

export function setVerbose(v: boolean) { verbose = v; }

export function setLogFile(file: string) {
  logFile = file;
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function log(level: LogLevel, message: string, data?: any) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  const line = data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;

  if (verbose || level !== 'debug') {
    const color = COLORS[level] || '';
    console.error(`${color}${line}${COLORS.reset}`);
  }

  if (logFile) {
    fs.appendFileSync(path.join(LOG_DIR, logFile), line + '\n');
  }
}
