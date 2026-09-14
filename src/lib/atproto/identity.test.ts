import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtprotoError, parseAtprotoIdentifier, resolveAtprotoHandle } from './identity';

const DID = 'did:plc:ks6l7qs37543awud4jyfl7o3';

function didDocument(endpoint = 'https://eurosky.social') {
  return {
    id: DID,
    alsoKnownAs: ['at://dracoblue.de'],
    service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: endpoint }],
  };
}

function stubFetch(routes: Record<string, { body?: unknown; status?: number }>) {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseAtprotoIdentifier', () => {
  it('akzeptiert nackte Domains mit und ohne fuehrendes @', () => {
    expect(parseAtprotoIdentifier('dracoblue.de')).toBe('dracoblue.de');
    expect(parseAtprotoIdentifier('  @DracoBlue.de ')).toBe('dracoblue.de');
    expect(parseAtprotoIdentifier('alice.bsky.social')).toBe('alice.bsky.social');
  });

  it('akzeptiert DIDs unveraendert', () => {
    expect(parseAtprotoIdentifier(DID)).toBe(DID);
    expect(parseAtprotoIdentifier('did:web:example.com')).toBe('did:web:example.com');
  });

  it('lehnt Fediverse-Handles und Nicht-Domains ab', () => {
    expect(parseAtprotoIdentifier('@alice@example.social')).toBeNull();
    expect(parseAtprotoIdentifier('alice')).toBeNull();
    expect(parseAtprotoIdentifier('https://example.com/x')).toBeNull();
  });
});

describe('resolveAtprotoHandle', () => {
  it('loest Handle ueber die AppView und den PDS aus dem DID-Dokument auf', async () => {
    const calls = stubFetch({
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=dracoblue.de': {
        body: { did: DID },
      },
      [`https://plc.directory/${encodeURIComponent(DID)}`]: { body: didDocument() },
    });

    await expect(resolveAtprotoHandle('@dracoblue.de')).resolves.toEqual({
      did: DID,
      handle: 'dracoblue.de',
      pdsOrigin: 'https://eurosky.social',
      appview: 'https://public.api.bsky.app',
    });
    expect(calls).toHaveLength(2);
  });

  it('ueberspringt die Handle-Aufloesung bei einer DID', async () => {
    const calls = stubFetch({
      [`https://plc.directory/${encodeURIComponent(DID)}`]: { body: didDocument() },
    });

    const target = await resolveAtprotoHandle(DID);
    expect(target.handle).toBe('dracoblue.de');
    expect(calls).toEqual([`https://plc.directory/${encodeURIComponent(DID)}`]);
  });

  it('nutzt fuer did:web das well-known-Dokument', async () => {
    stubFetch({
      'https://example.com/.well-known/did.json': {
        body: { ...didDocument(), id: 'did:web:example.com', alsoKnownAs: [] },
      },
    });

    const target = await resolveAtprotoHandle('did:web:example.com');
    expect(target.pdsOrigin).toBe('https://eurosky.social');
    expect(target.handle).toBe('did:web:example.com');
  });

  it('meldet ein unaufloesbares Handle', async () => {
    stubFetch({
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=nope.example': {
        body: { error: 'InvalidRequest', message: 'Unable to resolve handle' },
        status: 400,
      },
    });

    await expect(resolveAtprotoHandle('nope.example')).rejects.toBeInstanceOf(AtprotoError);
  });

  it('meldet ein DID-Dokument ohne Personal Data Server', async () => {
    stubFetch({
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=dracoblue.de': {
        body: { did: DID },
      },
      [`https://plc.directory/${encodeURIComponent(DID)}`]: {
        body: {
          id: DID,
          service: [{ id: '#x', type: 'Other', serviceEndpoint: 'https://x.example' }],
        },
      },
    });

    await expect(resolveAtprotoHandle('dracoblue.de')).rejects.toThrow(/Personal Data Server/i);
  });

  it('lehnt einen unsicheren PDS-Endpunkt ab', async () => {
    stubFetch({
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=dracoblue.de': {
        body: { did: DID },
      },
      [`https://plc.directory/${encodeURIComponent(DID)}`]: {
        body: didDocument('http://insecure.example'),
      },
    });

    await expect(resolveAtprotoHandle('dracoblue.de')).rejects.toBeInstanceOf(AtprotoError);
  });
});
