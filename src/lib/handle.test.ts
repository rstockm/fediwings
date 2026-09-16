import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HandleError,
  INSTANCE_TIMEOUT_MS,
  parseHandle,
  resolveHandle,
  resolveTarget,
} from './handle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseHandle', () => {
  it('normalisiert einen vollstaendigen Handle', () => {
    expect(parseHandle('  @Alice@Example.Social  ')).toEqual({
      username: 'Alice',
      domain: 'example.social',
      acct: 'Alice@example.social',
    });
  });

  it('normalisiert eine Unicode-Domain zu Punycode', () => {
    expect(parseHandle('@lfdi@BaWÜ.social')).toEqual({
      username: 'lfdi',
      domain: 'xn--baw-joa.social',
      acct: 'lfdi@xn--baw-joa.social',
    });
  });

  it('lehnt Handles ohne Domain ab', () => {
    expect(() => parseHandle('@alice')).toThrow(HandleError);
  });

  it('lehnt Ports und Zugangsdaten ab', () => {
    expect(() => parseHandle('@alice@example.social:8443')).toThrow(HandleError);
    expect(() => parseHandle('@alice@user:pass@example.social')).toThrow(HandleError);
  });

  it('lehnt Pfade und Query-Parameter in der Domain ab', () => {
    expect(() => parseHandle('@alice@example.social/path')).toThrow(HandleError);
    expect(() => parseHandle('@alice@example.social?path')).toThrow(HandleError);
  });
});

describe('resolveHandle', () => {
  it('verwendet fuer Unicode-Domains den kanonischen Punycode-Origin', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ version: '4.6.4' }))),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveHandle('@lfdi@bawü.social')).resolves.toEqual({
      username: 'lfdi',
      domain: 'xn--baw-joa.social',
      acct: 'lfdi@xn--baw-joa.social',
      origin: 'https://xn--baw-joa.social',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://xn--baw-joa.social/api/v2/instance',
      expect.anything(),
    );
  });

  it('faellt fuer Akkoma ohne v2-Instanzendpunkt auf v1 zurueck', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        if (url === 'https://akkoma.example/api/v2/instance') {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Not implemented' }), { status: 404 }),
          );
        }
        if (url === 'https://akkoma.example/api/v1/instance') {
          return Promise.resolve(
            new Response(JSON.stringify({ version: '2.7.2 (compatible; Akkoma 3.20.0)' })),
          );
        }
        return Promise.reject(new TypeError(`Unexpected URL: ${url}`));
      }),
    );

    await expect(resolveHandle('@thomas@akkoma.example')).resolves.toEqual({
      username: 'thomas',
      domain: 'akkoma.example',
      acct: 'thomas@akkoma.example',
      origin: 'https://akkoma.example',
    });
    expect(calls).toEqual([
      'https://akkoma.example/api/v2/instance',
      'https://akkoma.example/api/v1/instance',
    ]);
  });

  it('bricht bei einer haengenden Instanz mit Zeitueberschreitung ab', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init.signal as AbortSignal;
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      ),
    );

    const promise = resolveHandle('@alice@hanging.example').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(INSTANCE_TIMEOUT_MS + 100);

    const error = await promise;
    expect(error).toBeInstanceOf(HandleError);
    expect((error as Error).message).toContain('nicht erreichbar');
  });
});

describe('resolveTarget', () => {
  const DID = 'did:plc:ks6l7qs37543awud4jyfl7o3';

  function stub(routes: Record<string, { body?: unknown; status?: number }>) {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        const route = routes[url];
        if (!route) return Promise.reject(new TypeError(`Unexpected URL: ${url}`));
        return Promise.resolve(
          new Response(JSON.stringify(route.body ?? {}), { status: route.status ?? 200 }),
        );
      }),
    );
    return calls;
  }

  it('leitet ein Fediverse-Handle unveraendert an den Mastodon-Pfad', async () => {
    const calls = stub({
      'https://example.social/api/v2/instance': { body: { version: '4.3.0' } },
    });

    await expect(resolveTarget('@alice@example.social')).resolves.toEqual({
      backend: 'mastodon',
      username: 'alice',
      domain: 'example.social',
      acct: 'alice@example.social',
      origin: 'https://example.social',
    });
    expect(calls).toEqual(['https://example.social/api/v2/instance']);
  });

  it('loest eine nackte Domain ueber AT Protocol auf', async () => {
    stub({
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=dracoblue.de': {
        body: { did: DID },
      },
      [`https://plc.directory/${encodeURIComponent(DID)}`]: {
        body: {
          id: DID,
          alsoKnownAs: ['at://dracoblue.de'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://eurosky.social',
            },
          ],
        },
      },
    });

    const target = await resolveTarget('@dracoblue.de');
    expect(target.backend).toBe('atproto');
    expect(target.acct).toBe('dracoblue.de');
    expect(target.origin).toBe('https://eurosky.social');
  });

  it('faellt fuer eine nicht-AT-Proto-Domain auf den Fediverse-Pfad zurueck', async () => {
    const calls = stub({
      'https://example.social/xrpc/nope': {},
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=example.social': {
        body: { error: 'InvalidRequest' },
        status: 400,
      },
    });

    // Ohne Benutzernamen kann der Mastodon-Pfad nicht greifen; entscheidend ist die Reihenfolge.
    await expect(resolveTarget('example.social')).rejects.toBeInstanceOf(HandleError);
    expect(calls).toEqual([
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=example.social',
    ]);
  });
});
