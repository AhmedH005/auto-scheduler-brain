/**
 * API Client for AutoSchedule Backend
 * 
 * Usage: Import and use after exporting the project.
 * Set API_BASE_URL to your backend address.
 * 
 * This client handles JWT auth with automatic token refresh.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

function loadTokens() {
  accessToken = localStorage.getItem('access_token');
  refreshToken = localStorage.getItem('refresh_token');
}

function saveTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { clearTokens(); return false; }
    const data = await res.json();
    saveTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  loadTokens();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──

export async function signup(email: string, password: string) {
  const data = await request<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function login(email: string, password: string) {
  const data = await request<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout() {
  loadTokens();
  if (refreshToken) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  clearTokens();
}

export function isAuthenticated(): boolean {
  loadTokens();
  return !!accessToken;
}

// ── Resources ──

export const api = {
  me: () => request<{ userId: string; email: string }>('/me'),

  tasks: {
    list: () => request<any[]>('/tasks'),
    get: (id: string) => request<any>(`/tasks/${id}`),
    create: (data: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  },

  blocks: {
    list: (params?: { from?: string; to?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return request<any[]>(`/blocks${query ? `?${query}` : ''}`);
    },
    create: (data: any) => request<any>('/blocks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/blocks/${id}`, { method: 'DELETE' }),
  },

  anchors: {
    list: () => request<any[]>('/anchors'),
    get: (id: string) => request<any>(`/anchors/${id}`),
    create: (data: any) => request<any>('/anchors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/anchors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/anchors/${id}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => request<any>('/settings'),
    update: (data: any) => request<any>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  scheduler: {
    generate: () => request<any>('/scheduler/generate', { method: 'POST' }),
    recalculate: () => request<any>('/scheduler/recalculate', { method: 'POST' }),
  },
};
