import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  clearHandshake,
  createPkcePair,
  exchangeCode,
  loadHandshake,
  OAuthError,
  parseCallback,
  randomState,
  redirectUri,
  registerApp,
  saveHandshake,
} from './oauth';

afterEach(() => {
  vi.unstubAllGlobals();
  clearHandshake();
});

describe('createPkcePair', () => {
  it('erzeugt einen Verifier und passenden S256-Challenge', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{84,88}$/);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(challenge).toBe(expected);
  });
});

describe('randomState', () => {
  it('erzeugt unterschiedliche Noncen', () => {
    expect(randomState()).not.toBe(randomState());
  });
});

describe('registerApp', () => {
  it('registriert eine App mit FediWings-Redirect und Scope', async () => {
    const stub = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ client_id: 'cid', client_secret: 'cs' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', stub);

    const client = await registerApp('https://test.social');
    expect(client).toEqual({ clientId: 'cid', clientSecret: 'cs' });

    const [url, init] = stub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test.social/api/v1/apps');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('client_name')).toBe('FediWings');
    expect(body.get('redirect_uris')).toBe(redirectUri());
    expect(body.get('scopes')).toBe('read:notifications');
  });

  it('wirft bei HTTP-Fehlern einen OAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
    await expect(registerApp('https://test.social')).rejects.toThrow(OAuthError);
  });
});

describe('buildAuthorizeUrl', () => {
  it('enthaelt PKCE und State', () => {
    const url = new URL(buildAuthorizeUrl('https://test.social', 'cid', 'challenge', 'state-1'));
    expect(url.origin).toBe('https://test.social');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('read:notifications');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri());
  });
});

describe('exchangeCode', () => {
  it('sendet Verifier und Code und liefert das Access-Token', async () => {
    const stub = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: 'tok-1', token_type: 'Bearer' }), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', stub);

    const token = await exchangeCode(
      'https://test.social',
      { clientId: 'cid', clientSecret: 'cs' },
      'the-code',
      'the-verifier',
    );
    expect(token).toBe('tok-1');

    const [url, init] = stub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test.social/oauth/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('client_id')).toBe('cid');
  });

  it('wirft ohne Access-Token einen OAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
    );
    await expect(
      exchangeCode('https://test.social', { clientId: 'cid', clientSecret: 'cs' }, 'c', 'v'),
    ).rejects.toThrow(OAuthError);
  });
});

describe('Handshake im Sitzungsspeicher', () => {
  it('rundet speichern und laden ab', () => {
    const handshake = {
      origin: 'https://test.social',
      clientId: 'cid',
      clientSecret: 'cs',
      verifier: 'v',
      state: 's',
      acct: 'alice@test.social',
      followers: 1000,
    };
    saveHandshake(handshake);
    expect(loadHandshake()).toEqual(handshake);
    clearHandshake();
    expect(loadHandshake()).toBeNull();
  });

  it('liefert null bei kaputten Daten', () => {
    sessionStorage.setItem('fediscope:oauth-handshake-v1', '{broken');
    expect(loadHandshake()).toBeNull();
    sessionStorage.removeItem('fediscope:oauth-handshake-v1');
  });
});

describe('parseCallback', () => {
  const base = 'https://app.example/';

  it('extrahiert Code und State', () => {
    const callback = parseCallback(new URL(`${base}?code=abc&state=s1`) as unknown as Location);
    expect(callback).toEqual({ code: 'abc', state: 's1' });
  });

  it('liefert den Fehlercode des Servers', () => {
    const callback = parseCallback(new URL(`${base}?error=access_denied`) as unknown as Location);
    expect(callback).toEqual({ error: 'access_denied' });
  });

  it('liefert null ohne OAuth-Parameter', () => {
    expect(parseCallback(new URL(base) as unknown as Location)).toBeNull();
  });
});
