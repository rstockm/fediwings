import { describe, expect, it } from 'vitest';
import { groupStatusesIntoThreads } from './thread';
import type { MastodonStatus } from './types';

const ACCOUNT_ID = 'account-1';

const status = (
  overrides: Partial<MastodonStatus> & Pick<MastodonStatus, 'id'>,
): MastodonStatus => ({
  created_at: '2026-08-30T10:00:00Z',
  url: null,
  content: '<p>x</p>',
  spoiler_text: '',
  visibility: 'public',
  favourites_count: 0,
  reblogs_count: 0,
  replies_count: 0,
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  media_attachments: [],
  ...overrides,
});

describe('groupStatusesIntoThreads', () => {
  it('fasst eine Selbst-Antwort-Kette zu einem Thread mit der Wurzel zusammen', () => {
    const root = status({ id: 'a', created_at: '2026-08-30T10:00:00Z' });
    const reply = status({
      id: 'b',
      created_at: '2026-08-30T11:00:00Z',
      in_reply_to_id: 'a',
      in_reply_to_account_id: ACCOUNT_ID,
    });
    const reply2 = status({
      id: 'c',
      created_at: '2026-08-30T12:00:00Z',
      in_reply_to_id: 'b',
      in_reply_to_account_id: ACCOUNT_ID,
    });

    const [card] = groupStatusesIntoThreads([reply, root, reply2], ACCOUNT_ID);
    expect(card.status.id).toBe('a');
    expect(card.threadSize).toBe(3);
    expect(card.threadStatuses.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(card.threadTruncated).toBe(false);
  });

  it('markiert einen Thread als teilweise, wenn die Wurzel ausserhalb des Fensters liegt', () => {
    const reply = status({
      id: 'b',
      in_reply_to_id: 'a',
      in_reply_to_account_id: ACCOUNT_ID,
    });
    const reply2 = status({
      id: 'c',
      in_reply_to_id: 'b',
      in_reply_to_account_id: ACCOUNT_ID,
    });

    const [card] = groupStatusesIntoThreads([reply2, reply], ACCOUNT_ID);
    expect(card.status.id).toBe('b');
    expect(card.threadSize).toBe(2);
    expect(card.threadTruncated).toBe(true);
  });

  it('behaelt Antworten auf fremde Accounts als einzelne Karten ohne Teil-Kennzeichnung', () => {
    const foreign = status({
      id: 'c',
      in_reply_to_id: 'z',
      in_reply_to_account_id: 'other-account',
    });
    const alone = status({ id: 'd' });

    const cards = groupStatusesIntoThreads([foreign, alone], ACCOUNT_ID);
    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.threadSize === 1 && !card.threadTruncated)).toBe(true);
  });

  it('stuert Karten nach Wurzel-Datum absteigend', () => {
    const older = status({ id: 'a1', created_at: '2026-08-01T00:00:00Z' });
    const newer = status({ id: 'b1', created_at: '2026-08-30T00:00:00Z' });

    const [first] = groupStatusesIntoThreads([older, newer], ACCOUNT_ID);
    expect(first.status.id).toBe('b1');
  });
});
