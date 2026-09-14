import { afterEach, describe, expect, it, vi } from 'vitest';
import { atprotoBoosterSource } from './boosters';

const APPVIEW = 'https://public.api.bsky.app';

function profile(did: string, followersCount: number) {
  return { did, handle: `${did}.example`, followersCount };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('atprotoBoosterSource', () => {
  it('laedt Followerzahlen in Bloecken von 25 nach', async () => {
    const dids = Array.from({ length: 30 }, (_, index) => `did:plc:r${index}`);
    const calls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('app.bsky.feed.getRepostedBy')) {
          return Promise.resolve(
            new Response(JSON.stringify({ repostedBy: dids.map((did) => profile(did, 0)) })),
          );
        }
        const actors = parsed.searchParams.getAll('actors');
        return Promise.resolve(
          new Response(JSON.stringify({ profiles: actors.map((did) => profile(did, 10)) })),
        );
      }),
    );

    const page = await atprotoBoosterSource(APPVIEW).page(
      { statusId: 'at://did:plc:a/app.bsky.feed.post/1', token: null },
      new AbortController().signal,
    );

    // 1x getRepostedBy + 2x getProfiles (25 + 5)
    expect(page.requests).toBe(3);
    expect(calls).toHaveLength(3);
    expect(new URL(calls[1]).searchParams.getAll('actors')).toHaveLength(25);
    expect(new URL(calls[2]).searchParams.getAll('actors')).toHaveLength(5);
    expect(page.accounts).toHaveLength(30);
    expect(page.accounts.every((entry) => entry.followers === 10)).toBe(true);
    expect(page.next).toBeNull();
  });

  it('reicht den Cursor der naechsten Seite weiter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('getRepostedBy')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ cursor: 'next-page', repostedBy: [profile('did:plc:a', 0)] }),
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ profiles: [profile('did:plc:a', 42)] })),
        );
      }),
    );

    const page = await atprotoBoosterSource(APPVIEW).page(
      { statusId: 'at://did:plc:a/app.bsky.feed.post/1', token: null },
      new AbortController().signal,
    );

    expect(page.next).toEqual({
      statusId: 'at://did:plc:a/app.bsky.feed.post/1',
      token: 'next-page',
    });
    expect(page.accounts).toEqual([{ key: 'did:plc:a', followers: 42 }]);
  });

  it('setzt fehlende Followerzahlen auf 0 statt zu scheitern', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes('getRepostedBy')
                ? { repostedBy: [profile('did:plc:a', 0), profile('did:plc:b', 0)] }
                : { profiles: [profile('did:plc:a', 5)] },
            ),
          ),
        ),
      ),
    );

    const page = await atprotoBoosterSource(APPVIEW).page(
      { statusId: 'at://did:plc:a/app.bsky.feed.post/1', token: null },
      new AbortController().signal,
    );

    expect(page.accounts).toEqual([
      { key: 'did:plc:a', followers: 5 },
      { key: 'did:plc:b', followers: 0 },
    ]);
  });
});
