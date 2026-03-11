// Google Calendar API client.
// Uses GIS OAuth popup to get a short-lived access token. Requires VITE_GOOGLE_CLIENT_ID.

const GCAL_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly openid email profile';

const PLACEHOLDER = 'your-client-id.apps.googleusercontent.com';
const DEV_LS_KEY  = 'axis_dev_gclient_id';

// Priority: env var → localStorage dev override
export function getClientId(): string | undefined {
  const envId   = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const validEnv = envId && envId.trim() !== '' && envId !== PLACEHOLDER ? envId : undefined;

  // In dev mode, allow a localStorage override so the client ID can be set
  // from the browser without restarting the dev server.
  const localId = (import.meta.env.DEV && !validEnv)
    ? (localStorage.getItem(DEV_LS_KEY) ?? undefined) || undefined
    : undefined;

  const resolved = validEnv ?? localId;

  if (import.meta.env.DEV) {
    console.log('[AXIS] VITE_GOOGLE_CLIENT_ID (env):', envId ?? '(not set)');
    if (localId) console.log('[AXIS] Using localStorage dev override:', localId);
    console.log('[AXIS] Resolved client ID:', resolved ?? '(none)');
  }

  return resolved;
}

export function setDevClientIdOverride(id: string): void {
  if (!import.meta.env.DEV) return;
  if (id.trim()) {
    localStorage.setItem(DEV_LS_KEY, id.trim());
  } else {
    localStorage.removeItem(DEV_LS_KEY);
  }
}

export function isGoogleConfigured(): boolean {
  const id = getClientId();
  return !!id && id.trim() !== '' && id !== PLACEHOLDER;
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: { access_token: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

let _scriptReady = false;
let _scriptLoading = false;
const _scriptCallbacks: Array<() => void> = [];

function loadGISScript(): Promise<void> {
  if (_scriptReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (_scriptLoading) { _scriptCallbacks.push(resolve); return; }
    _scriptLoading = true;
    _scriptCallbacks.push(resolve);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      _scriptReady = true;
      _scriptCallbacks.forEach(cb => cb());
      _scriptCallbacks.length = 0;
    };
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

export async function requestGoogleAccessToken(): Promise<string> {
  const clientId = getClientId();
  if (!clientId || !isGoogleConfigured()) throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
  await loadGISScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: r => {
        if (r.error) return reject(new Error(r.error));
        resolve(r.access_token);
      },
    });
    client.requestAccessToken();
  });
}

async function gFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export async function fetchGoogleProfile(token: string): Promise<GoogleProfile> {
  const d = await gFetch<{ sub: string; email: string; name: string; picture: string }>(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    token,
  );
  return { id: d.sub, email: d.email, name: d.name, picture: d.picture };
}

export interface GCalEntry {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole: string;
}

export async function fetchGoogleCalendars(token: string): Promise<GCalEntry[]> {
  const d = await gFetch<{ items?: GCalEntry[] }>(
    `${GCAL_API}/users/me/calendarList?fields=items(id,summary,description,backgroundColor,primary,selected,accessRole)`,
    token,
  );
  return (d.items ?? []).filter(c => c.accessRole !== 'none');
}

export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
}

export async function fetchGoogleCalendarEvents(
  token: string,
  calendarId: string,
  lookaheadDays = 60,
): Promise<GCalEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + lookaheadDays * 86_400_000).toISOString();
  const items: GCalEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GCAL_API}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('fields', 'nextPageToken,items(id,summary,description,location,start,end,status)');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const page = await gFetch<{ items?: GCalEvent[]; nextPageToken?: string }>(url.toString(), token);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return items;
}

export function normalizeGoogleEvent(
  e: GCalEvent,
  userId: string,
  connectedAccountId: string,
  externalCalendarId: string,
) {
  const isAllDay = !e.start.dateTime;
  const startAt = e.start.dateTime ?? `${e.start.date}T00:00:00Z`;
  const endAt   = e.end.dateTime   ?? `${e.end.date}T00:00:00Z`;
  const status  = e.status === 'cancelled' ? 'cancelled'
                : e.status === 'tentative' ? 'tentative'
                : 'confirmed';

  return {
    user_id:              userId,
    connected_account_id: connectedAccountId,
    external_calendar_id: externalCalendarId,
    provider_event_id:    e.id,
    title:                e.summary?.trim() || '(No title)',
    description:          e.description ?? null,
    start_at:             startAt,
    end_at:               endAt,
    is_all_day:           isAllDay,
    location:             e.location ?? null,
    status,
    last_synced_at:       new Date().toISOString(),
    raw_payload:          e,
  };
}
