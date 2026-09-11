import { appRegistrationSchema, oauthTokenSchema } from './schemas';
import { fetchWithTimeout } from './http';
import { msg } from './i18n';

export const OAUTH_SCOPE = 'read:notifications';
export const OAUTH_PENDING_KEY = 'fediscope:oauth-handshake-v1';
const OAUTH_TIMEOUT_MS = 10_000;

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface OAuthHandshake {
  origin: string;
  clientId: string;
  clientSecret: string;
  verifier: string;
  state: string;
  acct: string;
  followers: number;
}

export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function randomState(): string {
  return randomString(16);
}

async function postForm(origin: string, path: string, body: URLSearchParams, signal?: AbortSignal) {
  let response: Response;
  try {
    response = (
      await fetchWithTimeout(
        `${origin}${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
        signal,
        OAUTH_TIMEOUT_MS,
      )
    ).response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    throw new OAuthError(msg('error.handleServer'));
  }

  if (!response.ok) {
    throw new OAuthError(msg('error.oauthRejected', { status: response.status }));
  }

  try {
    return await response.json();
  } catch {
    throw new OAuthError(msg('error.oauthInvalid'));
  }
}

export async function registerApp(origin: string, signal?: AbortSignal): Promise<OAuthClient> {
  const body = new URLSearchParams({
    client_name: 'FediWings',
    redirect_uris: redirectUri(),
    scopes: OAUTH_SCOPE,
    website: `${window.location.origin}${window.location.pathname}`,
  });
  const json = await postForm(origin, '/api/v1/apps', body, signal);
  const parsed = appRegistrationSchema.safeParse(json);
  if (!parsed.success) throw new OAuthError(msg('error.oauthAppRegistration'));
  return { clientId: parsed.data.client_id, clientSecret: parsed.data.client_secret };
}

export function buildAuthorizeUrl(
  origin: string,
  clientId: string,
  challenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    force_login: 'true',
  });
  return `${origin}/oauth/authorize?${params}`;
}

export async function exchangeCode(
  origin: string,
  client: OAuthClient,
  code: string,
  verifier: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const json = await postForm(origin, '/oauth/token', body, signal);
  const parsed = oauthTokenSchema.safeParse(json);
  if (!parsed.success) throw new OAuthError(msg('error.oauthToken'));
  return parsed.data.access_token;
}

export function saveHandshake(handshake: OAuthHandshake): void {
  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(handshake));
  } catch {
    throw new OAuthError(
      'Der Login kann in diesem Browser-Modus nicht gestartet werden (kein Sitzungsspeicher).',
    );
  }
}

export function loadHandshake(): OAuthHandshake | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as OAuthHandshake).origin !== 'string' ||
      typeof (parsed as OAuthHandshake).clientId !== 'string' ||
      typeof (parsed as OAuthHandshake).clientSecret !== 'string' ||
      typeof (parsed as OAuthHandshake).verifier !== 'string' ||
      typeof (parsed as OAuthHandshake).state !== 'string'
    ) {
      return null;
    }
    return parsed as OAuthHandshake;
  } catch {
    return null;
  }
}

export function clearHandshake(): void {
  try {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    // Sitzungsspeicher nicht verfuegbar: nichts zu aufzuraeumen.
  }
}

export const FOLLOWER_SESSION_KEY = 'fediscope:follower-session-v1';

export interface FollowerSession {
  token: string;
  origin: string;
  acct: string;
  followers: number;
  savedAt: string;
}

export function saveFollowerSession(session: FollowerSession): void {
  try {
    sessionStorage.setItem(FOLLOWER_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Sitzungsspeicher nicht verfuegbar: der Token gilt nur fuer diese Ansicht.
  }
}

export function loadFollowerSession(): FollowerSession | null {
  try {
    const raw = sessionStorage.getItem(FOLLOWER_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as FollowerSession).token !== 'string' ||
      typeof (parsed as FollowerSession).origin !== 'string' ||
      typeof (parsed as FollowerSession).acct !== 'string' ||
      typeof (parsed as FollowerSession).followers !== 'number'
    ) {
      return null;
    }
    return parsed as FollowerSession;
  } catch {
    return null;
  }
}

export function clearFollowerSession(): void {
  try {
    sessionStorage.removeItem(FOLLOWER_SESSION_KEY);
  } catch {
    // Sitzungsspeicher nicht verfuegbar: nichts zu aufzuraeumen.
  }
}

export interface OAuthCallback {
  code: string;
  state: string;
}

export function parseCallback(location: Location): OAuthCallback | { error: string } | null {
  const params = new URLSearchParams(location.search);
  const error = params.get('error');
  if (error) return { error };
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;
  return { code, state };
}
