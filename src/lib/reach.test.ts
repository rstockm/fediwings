import { describe, expect, it } from 'vitest';
import { calculateNetReach, initialReach, updateReach } from './reach';
import type { ThreadCard } from './types';

const status = (overrides: Partial<ThreadCard['status']> = {}): ThreadCard['status'] => ({
  id: 'post-1',
  created_at: '2026-08-30T10:00:00Z',
  url: 'https://social.example/@alice/post-1',
  content: '<p>Hallo Fediverse</p>',
  spoiler_text: '',
  visibility: 'public',
  favourites_count: 12,
  reblogs_count: 3,
  replies_count: 1,
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  media_attachments: [],
  ...overrides,
});

const card = (statuses: ThreadCard['status'][]): ThreadCard => ({
  status: statuses[0],
  threadStatuses: statuses,
  threadTruncated: false,
  threadSize: statuses.length,
});

describe('Reichweitenberechnung', () => {
  it('addiert Autor- und Booster-Follower', () => {
    const result = updateReach(initialReach(card([status()]), 1_000), 2, 450, 1);
    expect(result.grossReach).toBe(1_450);
    expect(result.netReach).toBe(178);
    expect(result.unattributedBoosts).toBe(1);
  });

  it('erzeugt fuer Beitraege ohne Boosts sofort ein vollstaendiges Ergebnis', () => {
    const result = initialReach(card([status({ reblogs_count: 0 })]), 1_000);
    expect(result.state).toBe('complete');
    expect(result.grossReach).toBe(1_000);
    expect(result.netReach).toBe(30);
  });

  it('aggregiert Interaktionen und Boosts ueber alle Thread-Teile', () => {
    const result = initialReach(
      card([
        status({ reblogs_count: 2, favourites_count: 10, replies_count: 2 }),
        status({ id: 'post-2', reblogs_count: 1, favourites_count: 5, replies_count: 3 }),
      ]),
      1_000,
    );
    expect(result.likes).toBe(15);
    expect(result.interactions).toBe(20);
    expect(result.boosts).toBe(3);
    expect(result.threadSize).toBe(2);
    expect(result.state).toBe('pending');
  });

  it('gewichtet Fediverse-Boosts doppelt und deckelt die Schaetzung am Brutto-Potenzial', () => {
    expect(calculateNetReach(1_000, 0, 0)).toBe(17);
    expect(calculateNetReach(1_000, 3, 18)).toBe(131);
    expect(calculateNetReach(1_000, 10_000, 10_000)).toBe(1_000);
  });

  it('faellt nie unter die Summe aus Likes und Boosts', () => {
    expect(calculateNetReach(1_000, 0, 0, 16)).toBe(17);
    expect(calculateNetReach(100, 0, 0, 80)).toBe(80);
    expect(calculateNetReach(50, 2, 10, 16)).toBe(16);
    expect(calculateNetReach(10, 2, 10, 16)).toBe(10);
    expect(calculateNetReach(67, 2, 14, 16)).toBe(16);
  });

  it('hebt kleine Netto-Ergebnisse auf die Likes-Boosts-Untergrenze', () => {
    const result = updateReach(initialReach(card([status({ favourites_count: 30 })]), 67), 0, 0, 0);
    expect(result.likes).toBe(30);
    expect(result.boosts).toBe(3);
    expect(result.netReach).toBeGreaterThanOrEqual(result.likes + result.boosts);
    expect(result.netReach).toBeLessThanOrEqual(result.grossReach);
  });

  it('berechnet unattributedBoosts gegen den Thread-summerten Boostwert', () => {
    let result = initialReach(
      card([status({ reblogs_count: 2 }), status({ id: 'post-2', reblogs_count: 1 })]),
      1_000,
    );
    result = updateReach(result, 2, 350, 1);
    expect(result.unattributedBoosts).toBe(1);
  });
});
