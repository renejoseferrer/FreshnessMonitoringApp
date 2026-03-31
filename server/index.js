import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ensureStoreFile, readStore, writeStore } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const config = {
  port: Number(process.env.PORT || 4000),
  developerUsername: (process.env.DEV_USERNAME || 'developer').trim(),
  developerPassword: process.env.DEV_PASSWORD || 'ChangeMe123!',
  staffPassword: process.env.STAFF_PASSWORD || process.env.DEV_PASSWORD || 'ChangeMe123!',
  jwtSecret: process.env.JWT_SECRET || 'local-dev-only-secret-change-before-sharing',
};

const app = express();

ensureStoreFile();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const sanitizeOperator = (operator) => ({
  id: operator.id,
  username: operator.username,
  displayName: operator.displayName,
  active: operator.active !== false,
  createdAt: operator.createdAt,
});

const sanitizeActivity = (entry) => ({
  id: entry.id,
  timestamp: entry.timestamp,
  actor: entry.actor,
  actorRole: entry.actorRole,
  action: entry.action,
  productName: entry.productName || '',
  details: entry.details || '',
});

const createSession = ({ username, displayName, role }) => ({
  username,
  displayName: displayName || username,
  role,
});

const signToken = (session) => jwt.sign(session, config.jwtSecret, { expiresIn: '12h' });

const buildBootstrapPayload = (session, store) => ({
  session,
  data: {
    dashboard: store.dashboard,
    productDB: store.productDB,
    ...(session.role === 'developer' ? { operators: store.operators.map(sanitizeOperator) } : {}),
  },
});

const appendActivity = (store, request, activity) => writeStore({
  ...store,
  activityLog: [
    ...(Array.isArray(store.activityLog) ? store.activityLog : []),
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: request.session.displayName,
      actorRole: request.session.role,
      action: activity.action,
      productName: activity.productName || '',
      details: activity.details || '',
    },
  ],
});

const authenticate = (request, response, next) => {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    response.status(401).json({ message: 'Login required.' });
    return;
  }

  try {
    request.session = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    response.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
};

const requireDeveloper = (request, response, next) => {
  if (request.session?.role !== 'developer') {
    response.status(403).json({ message: 'Developer access required.' });
    return;
  }

  next();
};

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/auth/login', async (request, response) => {
  await wait(350);

  const username = normalizeValue(request.body?.username);
  const password = String(request.body?.password || '');

  if (!username || !password) {
    response.status(400).json({ message: 'Username and password are required.' });
    return;
  }

  if (username === normalizeValue(config.developerUsername) && password === config.developerPassword) {
    const session = createSession({
      username: config.developerUsername,
      displayName: 'Developer',
      role: 'developer',
    });
    const store = readStore();
    response.json({ token: signToken(session), ...buildBootstrapPayload(session, store) });
    return;
  }

  const store = readStore();
  const operator = store.operators.find((entry) => normalizeValue(entry.username) === username);

  if (!operator || operator.active === false || password !== config.staffPassword) {
    response.status(401).json({ message: 'Invalid username or password.' });
    return;
  }

  const session = createSession({
    username: operator.username,
    displayName: operator.displayName || operator.username,
    role: 'operator',
  });

  response.json({ token: signToken(session), ...buildBootstrapPayload(session, store) });
});

app.get('/api/bootstrap', authenticate, (request, response) => {
  const store = readStore();
  response.json(buildBootstrapPayload(request.session, store));
});

app.post('/api/dashboard/save', authenticate, (request, response) => {
  const form = request.body?.form || {};
  const editProductId = request.body?.editProductId || null;
  const name = String(form.name || '').trim();
  const quantity = String(form.quantity || '').trim();
  const expiration = String(form.expiration || '').trim();

  if (!name || !quantity || !expiration) {
    response.status(400).json({ message: 'Name, quantity, and expiration are required.' });
    return;
  }

  const store = readStore();
  const existingCatalogProduct = store.productDB.find(
    (entry) => normalizeValue(entry.name) === normalizeValue(name)
  );

  if (!existingCatalogProduct && !form.photo) {
    response.status(400).json({ message: 'Photo is required for new products.' });
    return;
  }

  const masterRecord = {
    name,
    plu: String(form.plu || '').trim(),
    barcode: String(form.barcode || '').trim(),
    photo: form.photo || existingCatalogProduct?.photo || '',
  };

  const nextCatalog = existingCatalogProduct
    ? store.productDB.map((entry) => (
        normalizeValue(entry.name) === normalizeValue(name) ? masterRecord : entry
      ))
    : [...store.productDB, masterRecord];

  const dashboardRecord = {
    name,
    plu: masterRecord.plu,
    barcode: masterRecord.barcode,
    photo: masterRecord.photo,
    quantity,
    expiration,
    updatedBy: request.session.displayName,
    updatedAt: new Date().toISOString(),
  };

  const nextDashboard = editProductId
    ? store.dashboard.map((entry) => (
        entry.id === editProductId ? { ...dashboardRecord, id: editProductId } : entry
      ))
    : [...store.dashboard, { ...dashboardRecord, id: crypto.randomUUID() }];

  const nextStore = writeStore({
    ...store,
    productDB: nextCatalog,
    dashboard: nextDashboard,
  });

  const loggedStore = appendActivity(nextStore, request, {
    action: editProductId ? 'updated-expiration' : 'added-expiration',
    productName: name,
    details: editProductId
      ? `Updated expiration date to ${expiration} for ${name}.`
      : `Added ${name} with expiration date ${expiration}.`,
  });

  response.json({
    dashboard: loggedStore.dashboard,
    productDB: loggedStore.productDB,
  });
});

app.delete('/api/dashboard/:id', authenticate, (request, response) => {
  const store = readStore();
  const deletedProduct = store.dashboard.find((entry) => entry.id === request.params.id);
  const nextStore = writeStore({
    ...store,
    dashboard: store.dashboard.filter((entry) => entry.id !== request.params.id),
  });

  const loggedStore = appendActivity(nextStore, request, {
    action: 'deleted-item',
    productName: deletedProduct?.name || '',
    details: deletedProduct
      ? `Deleted ${deletedProduct.name} from the dashboard.`
      : 'Deleted a dashboard item.',
  });

  response.json({
    dashboard: loggedStore.dashboard,
    productDB: loggedStore.productDB,
  });
});

app.post('/api/dashboard/clear', authenticate, requireDeveloper, (_request, response) => {
  const store = readStore();
  const nextStore = writeStore({
    ...store,
    dashboard: [],
  });

  const loggedStore = appendActivity(nextStore, _request, {
    action: 'cleared-dashboard',
    details: 'Cleared all dashboard items.',
  });

  response.json({
    dashboard: loggedStore.dashboard,
    productDB: loggedStore.productDB,
  });
});

app.post('/api/database/clear', authenticate, requireDeveloper, (_request, response) => {
  const store = readStore();
  const nextStore = writeStore({
    ...store,
    dashboard: [],
    productDB: [],
  });

  const loggedStore = appendActivity(nextStore, _request, {
    action: 'cleared-database',
    details: 'Cleared the dashboard and product database.',
  });

  response.json({
    dashboard: loggedStore.dashboard,
    productDB: loggedStore.productDB,
  });
});

app.get('/api/admin/activity', authenticate, requireDeveloper, (_request, response) => {
  const store = readStore();
  response.json({
    activities: [...(store.activityLog || [])]
      .sort((leftEntry, rightEntry) => new Date(rightEntry.timestamp) - new Date(leftEntry.timestamp))
      .map(sanitizeActivity),
  });
});

app.get('/api/admin/operators', authenticate, requireDeveloper, (_request, response) => {
  const store = readStore();
  response.json({ operators: store.operators.map(sanitizeOperator) });
});

app.post('/api/admin/operators', authenticate, requireDeveloper, (request, response) => {
  const username = String(request.body?.username || '').trim();
  const displayName = String(request.body?.displayName || '').trim();

  if (!username) {
    response.status(400).json({ message: 'Operator username is required.' });
    return;
  }

  const normalizedUsername = normalizeValue(username);
  if (normalizedUsername === normalizeValue(config.developerUsername)) {
    response.status(400).json({ message: 'That username is reserved for the developer login.' });
    return;
  }

  const store = readStore();
  const usernameTaken = store.operators.some((entry) => normalizeValue(entry.username) === normalizedUsername);
  if (usernameTaken) {
    response.status(400).json({ message: 'That operator username already exists.' });
    return;
  }

  const nextStore = writeStore({
    ...store,
    operators: [
      ...store.operators,
      {
        id: crypto.randomUUID(),
        username,
        displayName: displayName || username,
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const loggedStore = appendActivity(nextStore, request, {
    action: 'created-login',
    details: `Created the user login ${username}.`,
  });

  response.status(201).json({ operators: loggedStore.operators.map(sanitizeOperator) });
});

app.put('/api/admin/operators/:id', authenticate, requireDeveloper, (request, response) => {
  const store = readStore();
  const operator = store.operators.find((entry) => entry.id === request.params.id);

  if (!operator) {
    response.status(404).json({ message: 'Operator not found.' });
    return;
  }

  const nextUsername = request.body?.username !== undefined ? String(request.body.username).trim() : operator.username;
  const nextDisplayName = request.body?.displayName !== undefined ? String(request.body.displayName).trim() : operator.displayName;
  const nextActive = request.body?.active !== undefined ? Boolean(request.body.active) : operator.active !== false;

  if (!nextUsername) {
    response.status(400).json({ message: 'Operator username cannot be empty.' });
    return;
  }

  const normalizedUsername = normalizeValue(nextUsername);
  const usernameTaken = store.operators.some(
    (entry) => entry.id !== operator.id && normalizeValue(entry.username) === normalizedUsername
  );

  if (usernameTaken || normalizedUsername === normalizeValue(config.developerUsername)) {
    response.status(400).json({ message: 'That operator username is not available.' });
    return;
  }

  const nextStore = writeStore({
    ...store,
    operators: store.operators.map((entry) => (
      entry.id === operator.id
        ? {
            ...entry,
            username: nextUsername,
            displayName: nextDisplayName || nextUsername,
            active: nextActive,
          }
        : entry
    )),
  });

  const loggedStore = appendActivity(nextStore, request, {
    action: nextActive ? 'updated-login' : 'disabled-login',
    details: nextActive
      ? `Updated the user login ${nextUsername}.`
      : `Disabled the user login ${nextUsername}.`,
  });

  response.json({ operators: loggedStore.operators.map(sanitizeOperator) });
});

app.delete('/api/admin/operators/:id', authenticate, requireDeveloper, (request, response) => {
  const store = readStore();
  const deletedOperator = store.operators.find((entry) => entry.id === request.params.id);
  const nextStore = writeStore({
    ...store,
    operators: store.operators.filter((entry) => entry.id !== request.params.id),
  });

  const loggedStore = appendActivity(nextStore, request, {
    action: 'deleted-login',
    details: deletedOperator
      ? `Deleted the user login ${deletedOperator.username}.`
      : 'Deleted a user login.',
  });

  response.json({ operators: loggedStore.operators.map(sanitizeOperator) });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Shared local API running on http://localhost:${config.port}`);
  console.log(`Developer username: ${config.developerUsername}`);
});