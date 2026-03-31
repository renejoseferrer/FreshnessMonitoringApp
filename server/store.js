import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DATA_DIR = path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(createDefaultStore(), null, 2));
  }
};

export const readStore = () => {
  ensureStoreFile();

  try {
    const rawValue = fs.readFileSync(STORE_PATH, 'utf8');
    return normalizeStore(JSON.parse(rawValue));
  } catch {
    const fallbackStore = createDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallbackStore, null, 2));
    return fallbackStore;
  }
};

export const writeStore = (store) => {
  ensureStoreFile();

  const nextStore = normalizeStore(store);
  nextStore.metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(nextStore, null, 2));
  return nextStore;
};