import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAnchoredSeries,
  buildMonthlySeries,
  fetchFollowerEvents,
  type FollowerProgress,
} from './followers';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const notification = (id: string, date: string, type = 'follow') => ({
  id,
  type,
  created_at: date,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildMonthlySeries', () => {
  it('bucktet Events pro Monat aufsteigend', () => {
    const series = buildMonthlySeries([
      { id: '1', type: 'follow', date: '2026-03-05T10:00:00Z' },
      { id: '2', type: 'follow', date: '2026-03-20T10:00:00Z' },
      { id: '3', type: 'follow', date: '2025-11-01T10:00:00Z' },
      { id: '4', type: 'follow_request', date: '2026-03-21T10:00:00Z' },
    ]);
    expect(series).toEqual([
      { month: '2025-11', count: 1 },
      { month: '2026-03', count: 3 },
    ]);
  });

  it('liefert eine leere Serie ohne Events', () => {
    expect(buildMonthlySeries([])).toEqual([]);
  });
});

describe('buildAnchoredSeries', () => {
  it('verankert die Kurve an der aktuellen Followerzahl', () => {
    const events = [
      { id: '1', type: 'follow', date: '2026-01-10T00:00:00Z' },
      { id: '2', type: 'follow', date: '2026-02-10T00:00:00Z' },
      { id: '3', type: 'follow', date: '2026-02-20T00:00:00Z' },
    ];
    const series = buildAnchoredSeries(events, 1000);
    expect(series.totalFollows).toBe(3);
    expect(series.start).toBe(997);
    expect(series.historyIncomplete).toBe(false);
    expect(series.months).toEqual(['2026-01', '2026-02']);
    expect(series.points).toEqual([997, 998, 1000]);
  });

  it('markiert eine unvollstaendige Historie bei negativem Start', () => {
    const series = buildAnchoredSeries(
      [{ id: '1', type: 'follow', date: '2026-01-10T00:00:00Z' }],
      2,
    );
    expect(series.start).toBe(1);
    expect(series.historyIncomplete).toBe(false);

    const incomplete = buildAnchoredSeries(
      [
        { id: '1', type: 'follow', date: '2026-01-10T00:00:00Z' },
        { id: '2', type: 'follow', date: '2026-01-11T00:00:00Z' },
        { id: '3', type: 'follow', date: '2026-01-12T00:00:00Z' },
      ],
      2,
    );
    expect(incomplete.start).toBe(-1);
    expect(incomplete.historyIncomplete).toBe(true);
  });
});

describe('fetchFollowerEvents', () => {
  function page(from: number, count: number, year: number) {
    return Array.from({ length: count }, (_, index) => {
      const id = from - index;
      const month = String((id % 12) + 1).padStart(2, '0');
      return notification(String(id), `${year}-${month}-05T10:00:00Z`);
    });
  }

  it('folgt dem max_id-Cursor bis zu einer unvollstaendigen Seite', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        if (!url.includes('max_id=')) {
          return Promise.resolve(jsonResponse(page(200, 80, 2026)));
        }
        if (url.includes('max_id=121')) {
          return Promise.resolve(jsonResponse(page(120, 80, 2025)));
        }
        if (url.includes('max_id=41')) {
          return Promise.resolve(jsonResponse(page(40, 40, 2024)));
        }
        return Promise.resolve(jsonResponse([]));
      }),
    );

    const progresses: FollowerProgress[] = [];
    const result = await fetchFollowerEvents(
      'https://test.social',
      'tok',
      new AbortController().signal,
      (progress) => progresses.push(progress),
    );

    expect(result.truncated).toBe(false);
    expect(result.requests).toBe(3);
    expect(result.events.length).toBe(200);
    expect(result.events[0]).toMatchObject({ id: '200', type: 'follow' });
    expect(calls[0]).toContain('types%5B%5D=follow');
    expect(calls[0]).toContain('types%5B%5D=follow_request');
    expect(calls[1]).toContain('max_id=121');
    expect(calls[2]).toContain('max_id=41');
    expect(progresses.at(-1)).toEqual({ requests: 3, events: 200, oldest: '2024-02-05T10:00:00Z' });
  });

  it('markiert den Verlauf als gekuerzt, wenn das Seitenbudget erreicht ist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          jsonResponse(url.includes('max_id=') ? page(120, 80, 2025) : page(200, 80, 2026)),
        ),
      ),
    );

    const result = await fetchFollowerEvents(
      'https://test.social',
      'tok',
      new AbortController().signal,
      undefined,
      2,
    );
    expect(result.requests).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.events.length).toBe(160);
  });

  it('bricht mit dem Signal ab', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse([notification('1', '2026-01-01T00:00:00Z')]))),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchFollowerEvents('https://test.social', 'tok', controller.signal),
    ).rejects.toThrow('Abgebrochen');
  });
});
