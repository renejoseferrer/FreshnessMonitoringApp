import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'server', 'data');
const TEMP_DATA_DIR = path.join(os.tmpdir(), 'expiration-monitoring-app-data');
const REQUESTED_DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR)
  : DEFAULT_DATA_DIR;
const NODE_ENV = (process.env.NODE_ENV || 'development').trim().toLowerCase();
const ALLOW_EPHEMERAL_STORAGE = process.env.ALLOW_EPHEMERAL_STORAGE === 'true';
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

let activeDataDir = '';
let dataDirWarningShown = false;

const shouldAllowFallbackStorage = () => {
  if (ALLOW_EPHEMERAL_STORAGE) {
    return true;
  }

  if (NODE_ENV === 'production') {
    return false;
  }

  return !process.env.DATA_DIR?.trim();
};

const getCandidateDataDirs = () => {
  const candidates = [REQUESTED_DATA_DIR];

  if (shouldAllowFallbackStorage() && REQUESTED_DATA_DIR !== DEFAULT_DATA_DIR) {
    candidates.push(DEFAULT_DATA_DIR);
  }

  if (shouldAllowFallbackStorage() && !candidates.includes(TEMP_DATA_DIR)) {
    candidates.push(TEMP_DATA_DIR);
  }

  return candidates;
};

const getActiveDataDir = () => {
  if (activeDataDir) {
    return activeDataDir;
  }

  let lastError = null;

  for (const candidateDir of getCandidateDataDirs()) {
    try {
      fs.mkdirSync(candidateDir, { recursive: true });
      activeDataDir = candidateDir;

      if (candidateDir !== REQUESTED_DATA_DIR && !dataDirWarningShown) {
        console.warn(`Requested DATA_DIR "${REQUESTED_DATA_DIR}" is unavailable. Falling back to "${candidateDir}".`);
        dataDirWarningShown = true;
      }

      return activeDataDir;
    } catch (error) {
      lastError = error;
    }
  }

  if (!shouldAllowFallbackStorage()) {
    throw new Error(
      `Storage initialization failed for DATA_DIR "${REQUESTED_DATA_DIR}". `
      + 'Persistent storage is required in production. '
      + 'Verify that your Render disk is mounted and DATA_DIR points to it, or set ALLOW_EPHEMERAL_STORAGE=true only for temporary preview environments.'
    );
  }

  throw lastError || new Error('Could not initialize any writable data directory.');
};

const getStorePath = () => path.join(getActiveDataDir(), 'store.json');

export const getStorageInfo = () => {
  const dataDir = getActiveDataDir();

  return {
    dataDir,
    storePath: path.join(dataDir, 'store.json'),
    requestedDataDir: REQUESTED_DATA_DIR,
    usingFallback: dataDir !== REQUESTED_DATA_DIR,
    allowEphemeralStorage: shouldAllowFallbackStorage(),
  };
};

const pruneActivityLog = (activityLog) => {
  const cutoff = Date.now() - SEVEN_DAYS_IN_MS;

  return (Array.isArray(activityLog) ? activityLog : []).filter((entry) => {
    const timestamp = new Date(entry?.timestamp || '').getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
};

const createDefaultStore = () => ({
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  operators: [],
  dashboard: [],
  productDB: [],
  activityLog: [],
});

const normalizeStore = (store) => ({
  metadata: {
    createdAt: store?.metadata?.createdAt || new Date().toISOString(),
    updatedAt: store?.metadata?.updatedAt || new Date().toISOString(),
  },
  operators: Array.isArray(store?.operators) ? store.operators : [],
  dashboard: Array.isArray(store?.dashboard) ? store.dashboard : [],
  productDB: Array.isArray(store?.productDB) ? store.productDB : [],
  activityLog: pruneActivityLog(store?.activityLog),
});

export const ensureStoreFile = () => {
  const storePath = getStorePath();

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(createDefaultStore(), null, 2));
  }
};

export const readStore = () => {
  ensureStoreFile();
  const storePath = getStorePath();

  try {
    const rawValue = fs.readFileSync(storePath, 'utf8');
    return normalizeStore(JSON.parse(rawValue));
  } catch {
    const fallbackStore = createDefaultStore();
    fs.writeFileSync(storePath, JSON.stringify(fallbackStore, null, 2));
    return fallbackStore;
  }
};

export const writeStore = (store) => {
  ensureStoreFile();
  const storePath = getStorePath();

  const nextStore = normalizeStore(store);
  nextStore.metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(nextStore, null, 2));
  return nextStore;
};