import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReportStatuses } from './api';

const status = (id: string, date: string, parent: string | null = null) => ({
  id,
  created_at: date,
  url: null,
  content: '',
  spoiler_text: '',
  visibility: 'public',
  favourites_count: 0,
  reblogs_count: 0,
  replies_count: 0,
  in_reply_to_id: parent,
  in_reply_to_account_id: parent ? 'account' : null,
  media_attachments: [],
});

function response(data: unknown, link: string | null = null, code = 200): Response {
  return {
    ok: code < 400,
    status: code,
    headers: new Headers(link ? { Link: link } : {}),
    json: async () => data,
  } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('getReportStatuses', () => {
  it('lädt mehr als eine Seite, erhält Selbstantworten und erkennt die Berliner Jahresgrenze', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          [status('new', '2026-01-01T00:30:00Z', 'old')],
          '<https://test.social/api/v1/accounts/account/statuses?max_id=old>; rel="next"',
        ),
      )
      .mockResolvedValueOnce(response([status('old', '2025-12-31T22:59:00Z')]));
    vi.stubGlobal('fetch', fetch);
    const progress = vi.fn();
    const result = await getReportStatuses(
      'https://test.social',
      'account',
      2026,
      new AbortController().signal,
      progress,
    );
    expect(result.historyComplete).toBe(true);
    expect(result.statuses.map((item) => item.id)).toEqual(['new', 'old']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0][0])).not.toContain('exclude_replies');
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it('behält bereits geladene Daten bei Rate Limit und markiert den Abruf als unvollständig', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          [status('first', '2026-06-01T00:00:00Z')],
          '<https://test.social/api/v1/accounts/account/statuses?max_id=1>; rel="next"',
        ),
      )
      .mockResolvedValueOnce(response({}, null, 429));
    vi.stubGlobal('fetch', fetch);
    const result = await getReportStatuses(
      'https://test.social',
      'account',
      2026,
      new AbortController().signal,
    );
    expect(result.statuses).toHaveLength(1);
    expect(result.historyComplete).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('wirft bei Abbruch einen AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      getReportStatuses('https://test.social', 'account', 2026, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('kennzeichnet abgeschnittene volle Seiten ohne nächsten Link', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response(
            Array.from({ length: 40 }, (_, index) => status(String(index), '2026-06-01T00:00:00Z')),
          ),
        ),
    );
    const result = await getReportStatuses(
      'https://test.social',
      'account',
      2026,
      new AbortController().signal,
    );
    expect(result.historyComplete).toBe(false);
  });

  it('kennzeichnet Serverfehler und Seitenbudget als Teilstand', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, null, 500)));
    const failed = await getReportStatuses(
      'https://test.social',
      'account',
      2026,
      new AbortController().signal,
    );
    expect(failed.historyComplete).toBe(false);
    expect(failed.error).toBeTruthy();

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response(
            [status('first', '2026-06-01T00:00:00Z')],
            '<https://test.social/api/v1/accounts/account/statuses?max_id=1>; rel="next"',
          ),
        ),
    );
    const limited = await getReportStatuses(
      'https://test.social',
      'account',
      2026,
      new AbortController().signal,
      undefined,
      1,
    );
    expect(limited.historyComplete).toBe(false);
    expect(limited.requests).toBe(1);
  });
});
