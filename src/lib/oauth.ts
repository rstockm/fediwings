import { accountSchema, appRegistrationSchema, oauthTokenSchema } from './schemas';
import { fetchWithTimeout } from './http';
import { msg } from './i18n';
import type { MastodonAccount } from './types';

export const OAUTH_SCOPE = 'read:accounts read:notifications';
export const OAUTH_PENDING_KEY = 'fediscope:oauth-handshake-v2';
const LEGACY_OAUTH_PENDING_KEY = 'fediscope:oauth-handshake-v1';
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
  accountId: string;
  acct: string;
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

function isSecureOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value;
  } catch {
    return false;
  }
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function randomState(): string {
  return randomString(16);
}

async function postFormResponse(
  origin: string,
  path: string,
  body: URLSearchParams,
  signal?: AbortSignal,
): Promise<Response> {
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

  return response;
}

async function postForm(
  origin: string,
  path: string,
  body: URLSearchParams,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await postFormResponse(origin, path, body, signal);

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

export async function verifyCredentials(
  origin: string,
  token: string,
  signal?: AbortSignal,
): Promise<MastodonAccount> {
  let response: Response;
  try {
    response = (
      await fetchWithTimeout(
        `${origin}/api/v1/accounts/verify_credentials`,
        { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
        signal,
        OAUTH_TIMEOUT_MS,
      )
    ).response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    throw new OAuthError(msg('error.oauthVerify'));
  }

  if (!response.ok) throw new OAuthError(msg('error.oauthVerify'));
  try {
    const parsed = accountSchema.safeParse(await response.json());
    if (!parsed.success) throw new OAuthError(msg('error.oauthVerify'));
    return parsed.data;
  } catch (error) {
    if (error instanceof OAuthError) throw error;
    throw new OAuthError(msg('error.oauthVerify'));
  }
}

export async function revokeToken(
  origin: string,
  client: OAuthClient,
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    token,
  });
  await postFormResponse(origin, '/oauth/revoke', body, signal);
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
      !isSecureOrigin((parsed as OAuthHandshake).origin) ||
      typeof (parsed as OAuthHandshake).clientId !== 'string' ||
      typeof (parsed as OAuthHandshake).clientSecret !== 'string' ||
      typeof (parsed as OAuthHandshake).verifier !== 'string' ||
      typeof (parsed as OAuthHandshake).state !== 'string' ||
      typeof (parsed as OAuthHandshake).accountId !== 'string' ||
      typeof (parsed as OAuthHandshake).acct !== 'string'
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
    sessionStorage.removeItem(LEGACY_OAUTH_PENDING_KEY);
  } catch {
    // Sitzungsspeicher nicht verfuegbar: nichts zu aufzuraeumen.
  }
}

export const FOLLOWER_SESSION_KEY = 'fediscope:follower-session-v2';
const LEGACY_FOLLOWER_SESSION_KEY = 'fediscope:follower-session-v1';

export interface FollowerSession {
  token: string;
  origin: string;
  clientId: string;
  clientSecret: string;
  account: MastodonAccount;
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
    sessionStorage.removeItem(LEGACY_FOLLOWER_SESSION_KEY);
    const raw = sessionStorage.getItem(FOLLOWER_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      sessionStorage.removeItem(FOLLOWER_SESSION_KEY);
      return null;
    }
    const candidate = parsed as FollowerSession;
    const account = accountSchema.safeParse(candidate.account);
    let accountOrigin = '';
    if (account.success) {
      try {
        accountOrigin = new URL(account.data.url).origin;
      } catch {
        accountOrigin = '';
      }
    }
    if (
      typeof candidate.token !== 'string' ||
      candidate.token.length === 0 ||
      typeof candidate.clientId !== 'string' ||
      candidate.clientId.length === 0 ||
      typeof candidate.clientSecret !== 'string' ||
      candidate.clientSecret.length === 0 ||
      typeof candidate.savedAt !== 'string' ||
      !isSecureOrigin(candidate.origin) ||
      !account.success ||
      account.data.id.length === 0 ||
      accountOrigin !== candidate.origin
    ) {
      sessionStorage.removeItem(FOLLOWER_SESSION_KEY);
      return null;
    }
    return { ...candidate, account: account.data };
  } catch {
    try {
      sessionStorage.removeItem(FOLLOWER_SESSION_KEY);
    } catch {
      // Sitzungsspeicher nicht verfügbar: nichts weiter aufzuräumen.
    }
    return null;
  }
}

export function clearFollowerSession(): void {
  try {
    sessionStorage.removeItem(FOLLOWER_SESSION_KEY);
    sessionStorage.removeItem(LEGACY_FOLLOWER_SESSION_KEY);
  } catch {
    // Sitzungsspeicher nicht verfuegbar: nichts zu aufzuraeumen.
  }
}

export interface OAuthCallback {
  code: string;
  state: string;
}

export function parseCallback(
  location: Location,
): OAuthCallback | { error: string; state: string | null } | { invalid: true } | null {
  const params = new URLSearchParams(location.search);
  const error = params.get('error');
  if (error) return { error, state: params.get('state') };
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return code || state ? { invalid: true } : null;
  return { code, state };
}
