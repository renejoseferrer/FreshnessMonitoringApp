const AUTH_TOKEN_KEY = 'expiration-monitor-auth-token';

export const getStoredToken = () => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredToken = (token) => {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    return undefined;
  }

  return token;
};

export const clearStoredToken = () => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    return undefined;
  }

  return undefined;
};

export const apiRequest = async (path, options = {}) => {
  const {
    method = 'GET',
    body,
    token,
    headers = {},
  } = options;

  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};