import { afterEach, describe, expect, it } from 'vitest';
import { consumeOAuthReturn, saveOAuthReturn, type OAuthReturnSnapshot } from './oauthReturn';

const status = {
  id: 'status-1',
  created_at: '2026-09-15T10:00:00.000Z',
  url: 'https://test.social/@alice/status-1',
  content: '<p>Test</p>',
  spoiler_text: '',
  sensitive: false,
  visibility: 'public',
  favourites_count: 2,
  reblogs_count: 3,
  replies_count: 1,
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  media_attachments: [],
};

function snapshot(savedAt = new Date().toISOString()): OAuthReturnSnapshot {
  return {
    version: 1,
    state: 'state-1',
    savedAt,
    view: 'analyse',
    analysis: {
      handle: '@alice@test.social',
      postLimit: 20,
      rememberHandles: false,
      phase: 'complete',
      message: 'fertig',
      origin: 'https://test.social',
      account: {
        id: 'account-1',
        username: 'alice',
        acct: 'alice',
        display_name: 'Alice',
        url: 'https://test.social/@alice',
        avatar_static: 'https://test.social/avatar.png',
        followers_count: 100,
      },
      platform: { id: 'mastodon', name: 'Mastodon', mastodonApi: true },
      posts: [
        {
          status,
          threadStatuses: [status],
          threadTruncated: false,
          threadSize: 1,
          thumbnail: null,
          state: 'complete',
          authorFollowers: 100,
          likes: 2,
          interactions: 3,
          boosts: 3,
          quotes: 0,
          visibleBoosters: 3,
          boosterFollowers: 50,
          grossReach: 150,
          netReach: 30,
          unattributedBoosts: 0,
          pagesLoaded: 1,
        },
      ],
      insightStatuses: [status],
      insightReferenceTime: Date.now(),
      analyzedAt: '2026-09-16T10:00:00.000Z',
      insightHistoryComplete: true,
      insightOldestFetchedAt: status.created_at,
      insightReachSelectionComplete: true,
      progress: { completedPosts: 1, totalPosts: 1, requests: 4 },
      sort: 'boosts',
      expandedStatusIds: ['status-1'],
      scrollY: 420,
    },
  };
}

afterEach(() => sessionStorage.clear());

describe('OAuth return snapshot', () => {
  it('stellt einen passenden Snapshot genau einmal wieder her', () => {
    saveOAuthReturn(snapshot());
    expect(consumeOAuthReturn('state-1')).toMatchObject({
      view: 'analyse',
      analysis: { sort: 'boosts', expandedStatusIds: ['status-1'], scrollY: 420 },
    });
    expect(consumeOAuthReturn('state-1')).toBeNull();
  });

  it('verwirft einen Snapshot mit fremdem OAuth-State', () => {
    saveOAuthReturn(snapshot());
    expect(consumeOAuthReturn('state-2')).toBeNull();
    expect(consumeOAuthReturn('state-1')).toBeNull();
  });

  it('verwirft einen mehr als 15 Minuten alten Snapshot', () => {
    saveOAuthReturn(snapshot(new Date(Date.now() - 16 * 60 * 1000).toISOString()));
    expect(consumeOAuthReturn('state-1')).toBeNull();
  });
});
