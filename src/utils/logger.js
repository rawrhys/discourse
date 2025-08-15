// src/utils/logger.js

const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const resolveInitialLevel = () => {
  const envLevel = (import.meta?.env?.VITE_LOG_LEVEL || '').toString().toLowerCase();
  if (envLevel && envLevel in LEVELS) return envLevel;
  return import.meta?.env?.DEV ? 'info' : 'warn';
};

let currentLevel = resolveInitialLevel();

const shouldLog = (levelName) => {
  const target = LEVELS[levelName] ?? LEVELS.info;
  const curr = LEVELS[currentLevel] ?? LEVELS.info;
  return target <= curr;
};

const formatArgs = (args) => args;

const logger = {
  get level() {
    return currentLevel;
  },
  setLevel(levelName) {
    const normalized = String(levelName || '').toLowerCase();
    if (!(normalized in LEVELS)) return false;
    currentLevel = normalized;
    // Persist for this session
    try {
      sessionStorage.setItem('LOG_LEVEL', currentLevel);
    } catch {}
    return true;
  },
  error: (...args) => {
    if (shouldLog('error')) console.error(...formatArgs(args));
  },
  warn: (...args) => {
    if (shouldLog('warn')) console.warn(...formatArgs(args));
  },
  info: (...args) => {
    if (shouldLog('info')) console.log(...formatArgs(args));
  },
  debug: (...args) => {
    if (shouldLog('debug')) console.debug(...formatArgs(args));
  },
  trace: (...args) => {
    if (shouldLog('trace')) console.debug(...formatArgs(args));
  },
};

// Restore level from session if present
try {
  const saved = sessionStorage.getItem('LOG_LEVEL');
  if (saved && saved in LEVELS) currentLevel = saved;
} catch {}

// Optional: expose runtime control in the browser for quick toggling
if (typeof window !== 'undefined') {
  window.setLogLevel = (lvl) => logger.setLevel(lvl);
  window.getLogLevel = () => logger.level;
}

export default logger; 