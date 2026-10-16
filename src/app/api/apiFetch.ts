const baseUrl = (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ?? '';
let currentToken: string | null = null;
let generation = 0;
let refreshInFlight: Promise<string | null> | null = null;
const sessionTokens = new Set<string>();

function tokenSession(token: string | null): string | null {
  try {
    const payload = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return `${payload.sub}:${payload.ver}`;
  } catch { return null; }
}

const staleSession = () => new Response(JSON.stringify({ error: {
  code: 'STALE_SESSION', message: 'Your session changed. Please retry from the current account.',
} }), { status: 409, headers: { 'Content-Type': 'application/json' } });

export function setSessionToken(token: string | null) {
  if (token === currentToken) return;
  generation += 1;
  currentToken = token;
  sessionTokens.clear();
  if (token) sessionTokens.add(token);
}

async function renewToken(): Promise<string | null> {
  if (!refreshInFlight) {
    const expectedGeneration = generation;
    const expectedSession = tokenSession(currentToken);
    refreshInFlight = (async () => {
      const response = await fetch(`${baseUrl}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401 && generation === expectedGeneration) {
          setSessionToken(null);
          window.dispatchEvent(new Event('authenticflavors:unauthorized'));
        }
        return null;
      }
      const result = await response.json();
      if (expectedGeneration !== generation) return null;
      if (expectedSession && tokenSession(result.accessToken) !== expectedSession) {
        setSessionToken(null);
        window.dispatchEvent(new Event('authenticflavors:unauthorized'));
        return null;
      }
      currentToken = result.accessToken;
      sessionTokens.add(result.accessToken);
      window.dispatchEvent(new CustomEvent('authenticflavors:refreshed', { detail: result }));
      return result.accessToken;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const authorization = headers.get('Authorization');
  const suppliedToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (suppliedToken && currentToken && !sessionTokens.has(suppliedToken)) return staleSession();
  if (suppliedToken && currentToken && sessionTokens.has(suppliedToken)) headers.set('Authorization', `Bearer ${currentToken}`);
  const requestGeneration = generation;
  const response = await fetch(input, { ...init, headers, credentials: 'include' });
  if (suppliedToken && requestGeneration !== generation) return staleSession();
  if (!suppliedToken || response.status !== 401) return response;
  const error = await response.clone().json().catch(() => ({}));
  // Revoked sessions must never silently recover as a different account.
  if (error.error?.code !== 'TOKEN_EXPIRED') return response;
  const token = await renewToken();
  if (!token) return response;
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers, credentials: 'include' });
}

export function receiptEndpoint(path: string) {
  if (!/^\/api\/payments\/receipt\/\d+$/.test(path)) throw new Error('Invalid receipt location');
  return `${baseUrl}${path}`;
}
