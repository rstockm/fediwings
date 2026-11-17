import { describe, expect, it } from 'vitest';
import { aggregateReport } from './reports';
import { preparePosts } from './analysis';
import type { MastodonStatus } from './types';

function status(
  id: string,
  created_at: string,
  values: Partial<MastodonStatus> = {},
): MastodonStatus {
  return {
    id,
    created_at,
    url: null,
    content: '',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 0,
    reblogs_count: 0,
    replies_count: 0,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
    ...values,
  };
}

describe('aggregateReport', () => {
  it('ordnet Threads dem Berliner Startmonat zu und addiert alle Interaktionen einschließlich Quotes', () => {
    const posts = preparePosts(
      [
        status('a', '2026-01-31T23:30:00Z', {
          favourites_count: 4,
          reblogs_count: 2,
          replies_count: 1,
          quotes_count: 3,
        }),
      ],
      100,
      'account',
    ).map((post) => ({ ...post, state: 'complete' as const, netReach: 50 }));
    const report = aggregateReport(2026, posts, new Date('2026-03-01T12:00:00Z'));
    expect(report.months[0].threads).toBe(0);
    expect(report.months[1]).toMatchObject({
      threads: 1,
      interactions: 10,
      reach: 50,
      engagement: 20,
    });
    expect(report.total.interactions).toBe(10);
    expect(report.months[3].threads).toBeNull();
  });

  it('zeigt bei null Reichweite keine Engagement Rate und kennzeichnet Teilstände', () => {
    const [post] = preparePosts([status('a', '2026-01-01T00:00:00Z')], 0, 'account');
    const report = aggregateReport(2026, [{ ...post, state: 'partial' }], new Date('2026-02-01'));
    expect(report.months[0].engagement).toBeNull();
    expect(report.months[0].reachComplete).toBe(false);
  });

  it('kennzeichnet unvollständige Historie und fasst Jahreswerte ohne Zukunftsmonate zusammen', () => {
    const posts = preparePosts(
      [
        status('a', '2026-01-01T00:00:00Z', { favourites_count: 5 }),
        status('b', '2026-02-01T00:00:00Z', { favourites_count: 7 }),
      ],
      100,
      'account',
    );
    const report = aggregateReport(2026, posts, new Date('2026-02-20T00:00:00Z'), false);
    expect(report.total.interactions).toBe(12);
    expect(report.total.threads).toBe(2);
    expect(report.total.counterComplete).toBe(false);
    expect(report.months[0].reachComplete).toBe(false);
    expect(report.months[2].interactions).toBeNull();
  });
});
