import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadReport } from './reportLoader';
import type { MastodonStatus } from './types';

function status(id: string, date: string, parent: string | null = null): MastodonStatus {
  return {
    id,
    created_at: date,
    url: null,
    content: '',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 1,
    reblogs_count: 0,
    replies_count: 0,
    in_reply_to_id: parent,
    in_reply_to_account_id: parent ? 'account' : null,
    media_attachments: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('loadReport', () => {
  it('ordnet Antworten über Jahresgrenzen dem Startthread zu und nutzt die vorhandene Reichweitenberechnung', async () => {
    const data = [
      status('new', '2027-01-01T01:00:00Z', 'root'),
      status('root', '2026-12-31T21:00:00Z'),
      status('old', '2025-12-31T22:00:00Z'),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => data,
      }),
    );
    const result = await loadReport(
      'https://test.social',
      'account',
      100,
      2026,
      new AbortController().signal,
      () => {},
    );
    expect(result.historyComplete).toBe(true);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].threadSize).toBe(2);
    expect(result.posts[0].netReach).toBeGreaterThan(0);
    expect(result.posts[0].state).toBe('complete');
  });

  it('kennzeichnet Threads mit fehlendem Ausgangsbeitrag als abgeschnitten', async () => {
    const data = [status('reply', '2026-02-01T00:00:00Z', 'missing')];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => data,
      }),
    );
    const result = await loadReport(
      'https://test.social',
      'account',
      10,
      2026,
      new AbortController().signal,
      () => {},
    );
    expect(result.posts[0].threadTruncated).toBe(true);
  });

  it('kennzeichnet Beiträge ohne verfügbare Boosterlisten als Teilstand', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [
          {
            ...status('root', '2026-02-01T00:00:00Z'),
            url: 'https://test.social/p/1',
            reblogs_count: 1,
          },
        ],
      }),
    );
    const result = await loadReport(
      'https://test.social',
      'account',
      10,
      2026,
      new AbortController().signal,
      () => {},
      false,
    );
    expect(result.posts[0].state).toBe('partial');
  });
});
