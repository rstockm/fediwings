import { describe, expect, it } from 'vitest';
import { prepareSharedPost } from './analysis';
import type { MastodonAccount, MastodonStatusWithAccount } from './types';

const author: MastodonAccount = {
  id: 'account-1',
  username: 'alice',
  acct: 'alice',
  display_name: 'Alice',
  url: 'https://example.social/@alice',
  avatar_static: 'https://example.social/alice.png',
  followers_count: 1000,
};

function status(
  id: string,
  account = author,
  overrides: Partial<MastodonStatusWithAccount> = {},
): MastodonStatusWithAccount {
  return {
    id,
    account,
    created_at: `2026-09-05T10:0${id.length}:00.000Z`,
    url: `https://example.social/@${account.username}/${id}`,
    content: `<p>${id}</p>`,
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 2,
    reblogs_count: 1,
    replies_count: 0,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
    ...overrides,
  };
}

describe('prepareSharedPost', () => {
  it('bildet nur den Eigen-Thread und verwendet dieselbe initiale Reichweitenlogik', () => {
    const root = status('root');
    const reply = status('reply', author, {
      in_reply_to_id: root.id,
      in_reply_to_account_id: author.id,
      favourites_count: 3,
      reblogs_count: 2,
    });
    const stranger = { ...author, id: 'account-2', username: 'bob', followers_count: 500 };
    const foreignReply = status('foreign', stranger, {
      in_reply_to_id: root.id,
      in_reply_to_account_id: author.id,
    });

    const result = prepareSharedPost(root, {
      ancestors: [],
      descendants: [reply, foreignReply],
    });

    expect(result.threadStatuses.map((entry) => entry.id)).toEqual(['root', 'reply']);
    expect(result.authorFollowers).toBe(1000);
    expect(result.likes).toBe(5);
    expect(result.interactions).toBe(5);
    expect(result.boosts).toBe(3);
    expect(result.grossReach).toBe(1000);
    expect(result.netReach).toBe(102);
  });
});
