import { describe, expect, it } from 'vitest';
import {
  createSharedThreadUrl,
  contentExcerpt,
  createCardSnapshot,
  decodeSharedPost,
  fullHandle,
  hasSharedThreadHash,
  parseSharedPostUrl,
} from './share';
import type { MastodonAccount, PostReach } from './types';

const postUrl = 'https://example.social/@alice/114000000000000001';

const account: MastodonAccount = {
  id: 'account-1',
  username: 'alice',
  acct: 'alice',
  display_name: 'Alice Example',
  url: 'https://example.social/@alice',
  avatar_static: 'https://example.social/avatar.png',
  followers_count: 1000,
};

const result: PostReach = {
  status: {
    id: 'post-1',
    created_at: '2026-09-10T18:45:00.000Z',
    url: postUrl,
    content: '<p>Hallo <img alt=":fedi:" src="emoji.png"> Fediverse</p>',
    spoiler_text: '',
    sensitive: false,
    visibility: 'public',
    favourites_count: 12,
    reblogs_count: 3,
    replies_count: 1,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
  },
  threadStatuses: [],
  threadTruncated: false,
  threadSize: 1,
  thumbnail: {
    type: 'image',
    url: 'https://example.social/image.jpg',
    preview_url: 'https://example.social/image-small.jpg',
  },
  state: 'complete',
  authorFollowers: 1000,
  likes: 12,
  interactions: 13,
  boosts: 3,
  quotes: 0,
  visibleBoosters: 2,
  boosterFollowers: 240,
  grossReach: 1240,
  netReach: 730,
  unattributedBoosts: 1,
  pagesLoaded: 1,
};

describe('Share-Links', () => {
  it('liest Instanz und Status-ID aus einer öffentlichen Beitrags-URL', () => {
    expect(parseSharedPostUrl(`${postUrl}?tracking=test#fragment`)).toEqual({
      url: postUrl,
      origin: 'https://example.social',
      statusId: '114000000000000001',
    });
  });

  it('überträgt ausschließlich die Beitrags-URL im Fragment', () => {
    const sharedUrl = createSharedThreadUrl(
      postUrl,
      'https://fediwings.example/app/?source=test#old',
    );
    const url = new URL(sharedUrl);

    expect(url.search).toBe('');
    expect(decodeURIComponent(url.hash)).toBe(`#share=${postUrl}`);
    expect(sharedUrl.length).toBeLessThan(160);
  });

  it('dekodiert das Fragment zu einem Analyseziel', () => {
    const hash = `#share=${encodeURIComponent(postUrl)}`;

    expect(hasSharedThreadHash(hash)).toBe(true);
    expect(decodeSharedPost(hash)).toEqual({
      url: postUrl,
      origin: 'https://example.social',
      statusId: '114000000000000001',
    });
  });

  it('weist unsichere und unvollständige Beitrags-URLs zurück', () => {
    expect(() => parseSharedPostUrl('http://example.social/@alice/123')).toThrow('HTTPS');
    expect(() => parseSharedPostUrl('https://example.social/@alice')).toThrow('Beitrags-ID');
    expect(() => decodeSharedPost('#share=%E0%A4%A')).toThrow();
    expect(() => decodeSharedPost('#other=value')).toThrow('ungültig');
  });

  it('teilt keinen Beitrag ohne öffentliche URL', () => {
    expect(() => createSharedThreadUrl(null, 'https://fediwings.example/')).toThrow(
      'keine öffentliche URL',
    );
  });

  it('erstellt einen validierbaren Card-Snapshot ohne HTML und mit vollstaendigem Handle', () => {
    const snapshot = createCardSnapshot(result, account, '2026-09-10T19:00:00.000Z');

    expect(fullHandle(account)).toBe('@alice@example.social');
    expect(snapshot.content.excerpt).toBe('Hallo :fedi: Fediverse');
    expect(snapshot.content.thumbnailUrl).toBe('https://example.social/image-small.jpg');
    expect(snapshot.metrics).toEqual({ netReach: 730, grossReach: 1240, likes: 12, boosts: 3 });
  });

  it('laesst bei CW und sensitiven Medien keinen verborgenen Inhalt in den Snapshot', () => {
    const sensitive = {
      ...result,
      status: {
        ...result.status,
        content: '<p>Verborgener Inhalt</p>',
        spoiler_text: 'Spoiler',
        sensitive: true,
      },
    };
    const snapshot = createCardSnapshot(sensitive, account, '2026-09-10T19:00:00.000Z');

    expect(snapshot.content).toEqual({
      excerpt: 'CW: Spoiler',
      thumbnailUrl: null,
      contentWarning: 'Spoiler',
      sensitive: true,
    });
    expect(contentExcerpt('<p>a  b</p>', 1)).toBe('…');
  });
});
