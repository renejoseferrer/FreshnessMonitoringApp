import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const PRODUCT_BUCKET = String(import.meta.env.VITE_SUPABASE_PRODUCT_BUCKET || 'product-photos').trim();
const ADMIN_OPERATORS_FUNCTION = String(import.meta.env.VITE_SUPABASE_ADMIN_OPERATORS_FUNCTION || 'admin-operators').trim();
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;

const emptyStoreData = () => ({
  dashboard: [],
  productDB: [],
  operators: [],
});

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeNameKey = (value) => String(value || '').trim().toLowerCase();

const requireClient = () => {
  if (!supabase) {
    throw new Error(getSupabaseConfigError());
  }

  return supabase;
};

const throwIfError = (error, fallbackMessage) => {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
};

const getPhotoUrl = (photoPath) => {
  if (!photoPath) {
    return '';
  }

  const client = requireClient();
  const { data } = client.storage.from(PRODUCT_BUCKET).getPublicUrl(photoPath);
  return data.publicUrl || '';
};

const mapSession = (user, profile) => ({
  id: user.id,
  email: user.email || profile.email || '',
  displayName: profile.display_name || user.user_metadata?.display_name || user.email || 'User',
  role: profile.role,
  active: profile.active !== false,
});

const mapOperator = (row) => ({
  id: row.id,
  email: row.email || '',
  displayName: row.display_name || row.email || '',
  active: row.active !== false,
  createdAt: row.created_at,
});

const mapDashboardItem = (row) => ({
  id: row.id,
  name: row.name,
  plu: row.plu || '',
  barcode: row.barcode || '',
  photoPath: row.photo_path || '',
  photo: getPhotoUrl(row.photo_path),
  expiration: row.expiration || '',
  updatedBy: row.updated_by_name || '',
  updatedAt: row.updated_at || '',
});

const mapCatalogItem = (row) => ({
  id: row.id,
  name: row.name,
  plu: row.plu || '',
  barcode: row.barcode || '',
  photoPath: row.photo_path || '',
  photo: getPhotoUrl(row.photo_path),
});

const mapActivity = (row) => ({
  id: row.id,
  timestamp: row.timestamp,
  actor: row.actor,
  actorRole: row.actor_role,
  action: row.action,
  productName: row.product_name || '',
  details: row.details || '',
});

const fetchProfile = async (client, userId) => {
  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, role, active, created_at')
    .eq('id', userId)
    .maybeSingle();

  throwIfError(error, 'Could not load your user profile.');
  return data;
};

const requireActiveProfile = async (client) => {
  const { data, error } = await client.auth.getUser();
  throwIfError(error, 'Could not validate the current session.');

  if (!data.user) {
    throw new Error('Login required.');
  }

  const profile = await fetchProfile(client, data.user.id);

  if (!profile) {
    await client.auth.signOut();
    throw new Error('Your profile is missing. Run the Supabase SQL setup and create the developer user first.');
  }

  if (profile.active === false) {
    await client.auth.signOut();
    throw new Error('This account is disabled. Contact the developer account owner.');
  }

  return { user: data.user, profile };
};

const requireDeveloperProfile = async (client) => {
  const { user, profile } = await requireActiveProfile(client);

  if (profile.role !== 'developer') {
    throw new Error('Developer access required.');
  }

  return { user, profile };
};

const fetchStoreData = async (client, profile) => {
  const dashboardPromise = client
    .from('dashboard_items')
    .select('id, name, plu, barcode, photo_path, expiration, updated_by_name, updated_at')
    .order('expiration', { ascending: true })
    .order('updated_at', { ascending: false });

  const catalogPromise = client
    .from('product_catalog')
    .select('id, name, plu, barcode, photo_path')
    .order('name', { ascending: true });

  const operatorsPromise = profile.role === 'developer'
    ? client
        .from('profiles')
        .select('id, email, display_name, role, active, created_at')
        .eq('role', 'operator')
        .order('created_at', { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const [dashboardResult, catalogResult, operatorsResult] = await Promise.all([
    dashboardPromise,
    catalogPromise,
    operatorsPromise,
  ]);

  throwIfError(dashboardResult.error, 'Could not load dashboard items.');
  throwIfError(catalogResult.error, 'Could not load the product catalog.');
  throwIfError(operatorsResult.error, 'Could not load operator accounts.');

  return {
    dashboard: (dashboardResult.data || []).map(mapDashboardItem),
    productDB: (catalogResult.data || []).map(mapCatalogItem),
    operators: (operatorsResult.data || []).map(mapOperator),
  };
};

const appendActivity = async (client, profile, activity) => {
  const { error } = await client
    .from('activity_log')
    .insert({
      actor_user_id: profile.id,
      actor: profile.display_name || profile.email,
      actor_role: profile.role,
      action: activity.action,
      product_name: activity.productName || null,
      details: activity.details || '',
    });

  throwIfError(error, 'Could not write the activity log entry.');
};

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const uploadPhoto = async (client, userId, name, dataUrl) => {
  const blob = await dataUrlToBlob(dataUrl);
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'product';
  const filePath = `${userId}/${Date.now()}-${safeName}.${extension}`;

  const { error } = await client.storage
    .from(PRODUCT_BUCKET)
    .upload(filePath, blob, {
      cacheControl: '3600',
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  throwIfError(error, 'Could not upload the product photo.');
  return filePath;
};

const resolvePhotoPath = async (client, user, form, existingCatalog) => {
  if (!form.photo) {
    return '';
  }

  if (form.photo.startsWith('data:image')) {
    return uploadPhoto(client, user.id, form.name, form.photo);
  }

  return form.photoPath || existingCatalog?.photo_path || '';
};

const invokeOperatorAdmin = async (client, action, payload) => {
  const { data, error } = await client.functions.invoke(ADMIN_OPERATORS_FUNCTION, {
    body: {
      action,
      ...payload,
    },
  });

  throwIfError(error, 'Could not reach the operator admin function.');

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};

export const isSupabaseConfigured = Boolean(supabase);

export const getSupabaseConfigError = () => (
  isSupabaseConfigured
    ? ''
    : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local before starting the app.'
);

export const subscribeToAuthChanges = (callback) => {
  if (!supabase) {
    return () => {};
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const bootstrapAppData = async () => {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  throwIfError(error, 'Could not restore the saved session.');

  if (!data.session?.user) {
    return {
      session: null,
      data: emptyStoreData(),
    };
  }

  const profile = await fetchProfile(client, data.session.user.id);

  if (!profile) {
    await client.auth.signOut();
    throw new Error('Your profile is missing. Run the Supabase SQL setup and create the developer user first.');
  }

  if (profile.active === false) {
    await client.auth.signOut();
    throw new Error('This account is disabled. Contact the developer account owner.');
  }

  return {
    session: mapSession(data.session.user, profile),
    data: await fetchStoreData(client, profile),
  };
};

export const signIn = async ({ email, password }) => {
  const client = requireClient();
  const normalizedEmail = normalizeEmail(email);

  const { error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  throwIfError(error, 'Login failed.');
  return bootstrapAppData();
};

export const signOut = async () => {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  throwIfError(error, 'Could not sign out.');
};

export const saveProduct = async ({ form, editProductId }) => {
  const client = requireClient();
  const { user, profile } = await requireActiveProfile(client);

  const name = String(form.name || '').trim();
  const expiration = String(form.expiration || '').trim();
  const nameKey = normalizeNameKey(name);

  if (!name || !expiration) {
    throw new Error('Name and expiration are required.');
  }

  const existingCatalogResult = await client
    .from('product_catalog')
    .select('id, photo_path')
    .eq('name_key', nameKey)
    .maybeSingle();

  throwIfError(existingCatalogResult.error, 'Could not look up the product catalog record.');

  const photoPath = await resolvePhotoPath(client, user, { ...form, name }, existingCatalogResult.data);

  const catalogRecord = {
    name,
    name_key: nameKey,
    plu: String(form.plu || '').trim() || null,
    barcode: String(form.barcode || '').trim() || null,
    photo_path: photoPath || null,
  };

  const { error: catalogError } = await client
    .from('product_catalog')
    .upsert(catalogRecord, { onConflict: 'name_key' });

  throwIfError(catalogError, 'Could not save the product catalog record.');

  const dashboardRecord = {
    name,
    name_key: nameKey,
    plu: catalogRecord.plu,
    barcode: catalogRecord.barcode,
    photo_path: catalogRecord.photo_path,
    quantity: 1,
    expiration,
    updated_by_user_id: user.id,
    updated_by_name: profile.display_name || profile.email,
  };

  if (editProductId) {
    const { error: updateError } = await client
      .from('dashboard_items')
      .update(dashboardRecord)
      .eq('id', editProductId);

    throwIfError(updateError, 'Could not update the dashboard item.');
  } else {
    const { error: insertError } = await client
      .from('dashboard_items')
      .insert(dashboardRecord);

    throwIfError(insertError, 'Could not create the dashboard item.');
  }

  await appendActivity(client, profile, {
    action: editProductId ? 'updated-expiration' : 'added-expiration',
    productName: name,
    details: editProductId
      ? `Updated expiration date to ${expiration} for ${name}.`
      : `Added ${name} with expiration date ${expiration}.`,
  });

  return fetchStoreData(client, profile);
};

export const deleteDashboardItem = async (productId) => {
  const client = requireClient();
  const { profile } = await requireActiveProfile(client);

  const existingResult = await client
    .from('dashboard_items')
    .select('id, name')
    .eq('id', productId)
    .maybeSingle();

  throwIfError(existingResult.error, 'Could not load the dashboard item.');

  const { error } = await client
    .from('dashboard_items')
    .delete()
    .eq('id', productId);

  throwIfError(error, 'Could not delete the dashboard item.');

  await appendActivity(client, profile, {
    action: 'deleted-item',
    productName: existingResult.data?.name || '',
    details: existingResult.data?.name
      ? `Deleted ${existingResult.data.name} from the dashboard.`
      : 'Deleted a dashboard item.',
  });

  return fetchStoreData(client, profile);
};

export const clearDashboard = async () => {
  const client = requireClient();
  const { profile } = await requireDeveloperProfile(client);

  const { error } = await client
    .from('dashboard_items')
    .delete()
    .not('id', 'is', null);

  throwIfError(error, 'Could not clear the dashboard.');

  await appendActivity(client, profile, {
    action: 'cleared-dashboard',
    details: 'Cleared all dashboard items.',
  });

  return fetchStoreData(client, profile);
};

export const clearDatabase = async () => {
  const client = requireClient();
  const { profile } = await requireDeveloperProfile(client);

  const dashboardDeleteResult = await client
    .from('dashboard_items')
    .delete()
    .not('id', 'is', null);
  throwIfError(dashboardDeleteResult.error, 'Could not clear the dashboard items.');

  const catalogDeleteResult = await client
    .from('product_catalog')
    .delete()
    .not('id', 'is', null);
  throwIfError(catalogDeleteResult.error, 'Could not clear the product catalog.');

  await appendActivity(client, profile, {
    action: 'cleared-database',
    details: 'Cleared the dashboard and product database.',
  });

  return fetchStoreData(client, profile);
};

export const listActivityHistory = async () => {
  const client = requireClient();
  await requireDeveloperProfile(client);

  const { data, error } = await client
    .from('activity_log')
    .select('id, timestamp, actor, actor_role, action, product_name, details')
    .gte('timestamp', new Date(Date.now() - SEVEN_DAYS_IN_MS).toISOString())
    .order('timestamp', { ascending: false });

  throwIfError(error, 'Could not load activity history.');
  return {
    activities: (data || []).map(mapActivity),
  };
};

export const listOperators = async () => {
  const client = requireClient();
  await requireDeveloperProfile(client);

  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, role, active, created_at')
    .eq('role', 'operator')
    .order('created_at', { ascending: true });

  throwIfError(error, 'Could not load operator accounts.');
  return {
    operators: (data || []).map(mapOperator),
  };
};

export const createOperator = async ({ email, displayName }) => {
  const client = requireClient();
  const { profile } = await requireDeveloperProfile(client);

  const normalizedEmail = normalizeEmail(email);

  await invokeOperatorAdmin(client, 'create', {
    email: normalizedEmail,
    displayName: String(displayName || '').trim(),
  });

  await appendActivity(client, profile, {
    action: 'created-login',
    details: `Created the user login ${normalizedEmail}.`,
  });

  return listOperators();
};

export const toggleOperatorActive = async (operatorId, active) => {
  const client = requireClient();
  const { profile } = await requireDeveloperProfile(client);

  const { data: operatorProfile, error: operatorError } = await client
    .from('profiles')
    .select('id, email, role')
    .eq('id', operatorId)
    .eq('role', 'operator')
    .maybeSingle();

  throwIfError(operatorError, 'Could not load the operator account.');

  await invokeOperatorAdmin(client, 'set-active', {
    operatorId,
    active,
  });

  await appendActivity(client, profile, {
    action: active ? 'updated-login' : 'disabled-login',
    details: active
      ? `Updated the user login ${operatorProfile?.email || operatorId}.`
      : `Disabled the user login ${operatorProfile?.email || operatorId}.`,
  });

  return listOperators();
};

export const deleteOperator = async (operatorId) => {
  const client = requireClient();
  const { profile } = await requireDeveloperProfile(client);

  const { data: operatorProfile, error: operatorError } = await client
    .from('profiles')
    .select('id, email, role')
    .eq('id', operatorId)
    .eq('role', 'operator')
    .maybeSingle();

  throwIfError(operatorError, 'Could not load the operator account.');

  await invokeOperatorAdmin(client, 'delete', {
    operatorId,
  });

  await appendActivity(client, profile, {
    action: 'deleted-login',
    details: `Deleted the user login ${operatorProfile?.email || operatorId}.`,
  });

  return listOperators();
};