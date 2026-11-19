import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadReportInteractions } from './reportInteractions';
import { aggregateReport } from './reports';

const origin = 'https://test.social';
const cutoff = new Date('2026-11-19T13:00:00Z');
const signal = new AbortController().signal;
const event = (id: string, type: string, created_at: string, statusId = 'old-post') => ({
  id,
  type,
  created_at,
  status: { id: statusId },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Report-Interaktionen', () => {
  it('paginiert, dedupliziert und zählt Long-Tail-Ereignisse in Berliner Zeit ohne neues Posting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(cutoff.getTime());
    const boost = event('4', 'reblog', '2026-03-31T22:00:00Z');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          [
            event('6', 'quote', '2026-04-03T00:00:00Z', 'quote-post'),
            event('5', 'mention', '2026-04-03T00:00:00Z', 'quote-post'),
            boost,
          ],
          { headers: { Link: `<${origin}/api/v1/notifications?max_id=4>; rel="next"` } },
        ),
      )
      .mockResolvedValueOnce(
        Response.json([
          boost,
          event('3', 'favourite', '2026-03-31T21:59:59Z'),
          event('2', 'mention', '2026-02-01T10:00:00Z', 'reply'),
          event('1', 'follow', '2026-02-01T09:00:00Z'),
        ]),
      );
    vi.stubGlobal('fetch', fetch);
    const history = await loadReportInteractions(origin, 'test-token', 2026, signal);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.getAll('types[]')).toEqual([
      'favourite',
      'reblog',
      'mention',
      'quote',
    ]);
    const report = aggregateReport(2026, [], cutoff, false, history);
    expect(report.months[0]).toMatchObject({ interactions: null, interactionsComplete: false });
    expect(report.months[1]).toMatchObject({ interactions: 1, interactionsComplete: false });
    expect(report.months[2]).toMatchObject({ interactions: 1, interactionsComplete: true });
    expect(report.months[3]).toMatchObject({
      threads: 0,
      interactions: 2,
      engagement: null,
      interactionsComplete: true,
    });
    expect(report.months[4]).toMatchObject({ interactions: 0, interactionsComplete: true });
    expect(report.total).toMatchObject({ interactions: 4, interactionsComplete: false });
    expect(report.months[11].interactions).toBeNull();
  });

  it.each(['empty', 'failure', 'foreign-link'])(
    'erfindet keine Nullwerte bei fehlender Historie: %s',
    async (mode) => {
      const fetch = vi.fn().mockResolvedValue(
        mode === 'failure'
          ? new Response(null, { status: 401 })
          : Response.json([], {
              headers:
                mode === 'foreign-link'
                  ? {
                      Link: '<https://elsewhere.example/api/v1/notifications?max_id=1>; rel="next"',
                    }
                  : undefined,
            }),
      );
      vi.stubGlobal('fetch', fetch);
      const history = await loadReportInteractions(origin, 'test-token', 2026, signal);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(aggregateReport(2026, [], cutoff, true, history).total).toMatchObject({
        interactions: null,
        interactionsComplete: false,
        reach: 0,
      });
    },
  );

  it('respektiert einen Abbruch', async () => {
    await expect(
      loadReportInteractions(origin, 'test-token', 2026, AbortSignal.abort()),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('setzt nach 40 Seiten mit dem nächsten Cursor fort und zählt Überschneidungen nicht doppelt', async () => {
    const fetch = vi.fn(async (request: string) => {
      const cursor = Number(new URL(request).searchParams.get('max_id'));
      if (cursor === 40)
        return Response.json([
          event('40', 'reblog', '2026-06-01T08:00:00Z'),
          event('41', 'favourite', '2025-12-01T08:00:00Z'),
        ]);
      const id = cursor + 1;
      return Response.json([event(String(id), 'reblog', '2026-06-01T08:00:00Z')], {
        headers: { Link: `<${origin}/api/v1/notifications?max_id=${id}>; rel="next"` },
      });
    });
    vi.stubGlobal('fetch', fetch);
    const first = await loadReportInteractions(origin, 'test-token', 2026, signal);
    expect(first).toMatchObject({ stop: 'budget', cursor: '40' });
    expect(first.timestamps).toHaveLength(40);
    const second = await loadReportInteractions(origin, 'test-token', 2026, signal, undefined, {
      resume: first,
    });
    expect(second).toMatchObject({ stop: 'end', oldest: Date.parse('2025-12-01T08:00:00Z') });
    expect(second.timestamps).toHaveLength(41);
    expect(fetch).toHaveBeenCalledTimes(41);
    expect(new URL(fetch.mock.calls[40][0]).searchParams.get('max_id')).toBe('40');
  });

  it('nutzt die Historie beim Jahreswechsel nur in derselben Sitzung und bis zur Aktualisierung', async () => {
    const fetch = vi.fn(async () => Response.json([event('1', 'reblog', '2025-01-01T08:00:00Z')]));
    vi.stubGlobal('fetch', fetch);
    const options = { cacheKey: 'test-session-a' };
    const load = (year: number, config: { cacheKey: string; refresh?: boolean } = options) =>
      loadReportInteractions(origin, 'test-token', year, signal, undefined, config);
    const history = await load(2026);
    expect(await load(2025)).toBe(history);
    expect(fetch).toHaveBeenCalledTimes(1);
    await load(2025, { ...options, refresh: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    await load(2025, { cacheKey: 'test-session-b' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
