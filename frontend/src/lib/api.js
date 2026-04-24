/**
 * API Client — Frontend utility for Express backend calls
 *
 * [AV-004] feat: core layout, navigation, theme
 * [WS-6] v5.6.0 — added auth-aware methods for logged-in API calls
 *
 * Centralized fetch wrapper. All API calls go through here so
 * error handling, base URL, and headers are consistent.
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const { products } = await api.get('/products?category=tees');
 *   const { product } = await api.get(`/products/${slug}`);
 *
 *   // Auth-required calls (pass JWT from session.user.apiToken):
 *   const { orders } = await api.authGet('/account/orders', token);
 *   await api.authPost('/account/wishlist/abc', {}, token);
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiError extends Error {
  constructor(status, data) {
    super(data?.error?.message || 'An error occurred');
    this.status = status;
    this.code = data?.error?.code || 'UNKNOWN';
    this.details = data?.error?.details || null;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return data;
}

function authHeaders(token) {
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const api = {
  get: (path) => request(path, { method: 'GET' }),

  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: (path, body) =>
    request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (path) => request(path, { method: 'DELETE' }),

  // Auth-aware variants — pass session.user.apiToken as second arg
  authGet: (path, token) =>
    request(path, { method: 'GET', headers: authHeaders(token) }),

  authPost: (path, body, token) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: authHeaders(token),
    }),

  authPut: (path, body, token) =>
    request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: authHeaders(token),
    }),

  authDelete: (path, token) =>
    request(path, { method: 'DELETE', headers: authHeaders(token) }),
};

export { api, ApiError };
