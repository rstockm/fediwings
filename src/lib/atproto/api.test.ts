import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAtprotoStatuses } from './api';

const DID = 'did:plc:author';
const TARGET = {
  did: DID,
  handle: 'dracoblue.de',
  pdsOrigin: 'https://eurosky.social',
  appview: 'https://public.api.bsky.app',
};

function post(rkey: string, overrides: Record<string, unknown> = {}) {
  return {
    uri: `at://${DID}/app.bsky.feed.post/${rkey}`,
    cid: 'bafy',
    author: { did: DID, handle: 'dracoblue.de' },
    record: { text: rkey, createdAt: '2026-09-12T11:00:00.000Z' },
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    quoteCount: 0,
    indexedAt: '2026-09-12T11:00:00.000Z',
    ...overrides,
  };
}

function stubFeed(pages: Array<{ cursor?: string; feed: unknown[] }>) {
  const calls: string[] = [];
  let index = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url);
      const page = pages[Math.min(index, pages.length - 1)];
      index += 1;
      return Promise.resolve(new Response(JSON.stringify(page)));
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getAtprotoStatuses', () => {
  it('verwirft Reposts und fremde Antworten, behaelt Self-Threads', async () => {
    const foreign = `at://did:plc:other/app.bsky.feed.post/x`;
    stubFeed([
      {
        feed: [
          { post: post('own') },
          {
            post: post('selfreply', {
              record: {
                text: 'selfreply',
                createdAt: '2026-09-12T11:05:00.000Z',
                reply: {
                  parent: { uri: `at://${DID}/app.bsky.feed.post/own` },
                  root: { uri: `at://${DID}/app.bsky.feed.post/own` },
                },
              },
            }),
          },
          {
            post: post('foreignreply', {
              record: {
                text: 'foreignreply',
                createdAt: '2026-09-12T11:06:00.000Z',
                reply: { parent: { uri: foreign }, root: { uri: foreign } },
              },
            }),
          },
          {
            post: { ...post('reposted'), author: { did: 'did:plc:other', handle: 'other.de' } },
            reason: { $type: 'app.bsky.feed.defs#reasonRepost' },
          },
        ],
      },
    ]);

    const result = await getAtprotoStatuses(TARGET);

    expect(result.statuses.map((status) => status.id)).toEqual([
      `at://${DID}/app.bsky.feed.post/own`,
      `at://${DID}/app.bsky.feed.post/selfreply`,
    ]);
    expect(result.requests).toBe(1);
    expect(result.historyComplete).toBe(true);
  });

  it('folgt dem Cursor bis zum Seitenbudget', async () => {
    const calls = stubFeed([
      { cursor: 'c1', feed: [{ post: post('a') }] },
      { cursor: 'c2', feed: [{ post: post('b') }] },
      { cursor: 'c3', feed: [{ post: post('c') }] },
    ]);

    const result = await getAtprotoStatuses(TARGET);

    expect(result.requests).toBe(2);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[1]).searchParams.get('cursor')).toBe('c1');
    expect(new URL(calls[0]).searchParams.get('filter')).toBe('posts_with_replies');
    expect(result.historyComplete).toBe(false);
  });

  it('meldet den aeltesten geladenen Zeitpunkt', async () => {
    stubFeed([
      {
        feed: [
          { post: post('neu', { record: { text: 'neu', createdAt: '2026-09-12T11:00:00.000Z' } }) },
          { post: post('alt', { record: { text: 'alt', createdAt: '2026-01-01T00:00:00.000Z' } }) },
        ],
      },
    ]);

    const result = await getAtprotoStatuses(TARGET);
    expect(result.oldestFetchedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
