import { describe, expect, it } from 'vitest';
import { buildPostingInsights } from './insights';
import type { MastodonStatus } from './types';

function status(
  id: string,
  createdAt: string,
  likes: number,
  boosts: number,
  replies: number,
): MastodonStatus {
  return {
    id,
    created_at: createdAt,
    url: null,
    content: '',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: likes,
    reblogs_count: boosts,
    replies_count: replies,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
  };
}

describe('buildPostingInsights', () => {
  const referenceDate = new Date('2026-09-11T18:00:00Z');

  it('bildet zwei feste 30-Tage-Zeitraeume aus gemeldeten Postingzaehlern', () => {
    const insights = buildPostingInsights(
      [
        status('current-1', '2026-09-10T10:00:00Z', 12, 3, 2),
        status('current-2', '2026-08-13T08:00:00Z', 8, 1, 1),
        status('previous', '2026-07-20T10:00:00Z', 5, 2, 1),
        status('outside', '2026-07-01T10:00:00Z', 100, 100, 100),
      ],
      referenceDate,
      {
        historyComplete: false,
        oldestFetchedAt: '2026-07-01T10:00:00Z',
        reachSelectionComplete: true,
      },
      [
        { id: 'current-1', createdAt: '2026-09-10T10:00:00Z', value: 100 },
        { id: 'current-2', createdAt: '2026-08-13T08:00:00Z', value: 50 },
        { id: 'previous', createdAt: '2026-07-20T10:00:00Z', value: 40 },
      ],
    );

    expect(insights).toMatchObject({
      currentStart: '2026-08-13',
      currentEnd: '2026-09-11',
      previousStart: '2026-07-14',
      previousEnd: '2026-08-12',
      currentComplete: true,
      comparisonComplete: true,
    });
    expect(
      insights.metrics.map(({ key, currentTotal, previousTotal, changePercent }) => ({
        key,
        currentTotal,
        previousTotal,
        changePercent,
      })),
    ).toEqual([
      { key: 'reach', currentTotal: 150, previousTotal: 40, changePercent: 275 },
      { key: 'interactions', currentTotal: 27, previousTotal: 8, changePercent: 237.5 },
      { key: 'likes', currentTotal: 20, previousTotal: 5, changePercent: 300 },
      { key: 'boosts', currentTotal: 4, previousTotal: 2, changePercent: 100 },
    ]);
  });

  it('weist unvollstaendige Zeitfenster aus statt Teilsummen als 30-Tage-Werte auszugeben', () => {
    const insights = buildPostingInsights(
      [status('recent', '2026-09-10T10:00:00Z', 4, 0, 0)],
      referenceDate,
      {
        historyComplete: false,
        oldestFetchedAt: '2026-09-10T10:00:00Z',
        reachSelectionComplete: false,
      },
      [{ id: 'recent', createdAt: '2026-09-10T10:00:00Z', value: 20 }],
    );

    expect(insights.currentComplete).toBe(false);
    expect(insights.comparisonComplete).toBe(false);
    expect(insights.metrics.every((metric) => metric.changePercent === null)).toBe(true);
  });

  it('berechnet bei einer Vergleichssumme von null keine erfundene Prozentzahl', () => {
    const insights = buildPostingInsights(
      [status('current', '2026-09-10T10:00:00Z', 4, 1, 0)],
      referenceDate,
      {
        historyComplete: true,
        oldestFetchedAt: '2026-09-10T10:00:00Z',
        reachSelectionComplete: true,
      },
      [{ id: 'current', createdAt: '2026-09-10T10:00:00Z', value: 20 }],
    );

    expect(insights.currentComplete).toBe(true);
    expect(insights.comparisonComplete).toBe(true);
    expect(insights.metrics.every((metric) => metric.changePercent === null)).toBe(true);
  });
});
