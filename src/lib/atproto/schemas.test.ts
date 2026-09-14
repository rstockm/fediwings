import { describe, expect, it } from 'vitest';
import { postViewSchema, textToHtml, toAccount, toStatus } from './schemas';

const AUTHOR_DID = 'did:plc:ks6l7qs37543awud4jyfl7o3';

function postView(overrides: Record<string, unknown> = {}) {
  return postViewSchema.parse({
    uri: `at://${AUTHOR_DID}/app.bsky.feed.post/3mvcx2radks2k`,
    cid: 'bafy',
    author: { did: AUTHOR_DID, handle: 'dracoblue.de', displayName: 'dracoblue' },
    record: { text: 'hallo welt', createdAt: '2026-09-12T11:10:59.959Z' },
    replyCount: 1,
    repostCount: 4,
    likeCount: 7,
    quoteCount: 2,
    indexedAt: '2026-09-12T11:11:00.000Z',
    ...overrides,
  });
}

describe('textToHtml', () => {
  it('maskiert HTML und uebersetzt Zeilenumbrueche', () => {
    expect(textToHtml('a <b> &\n"c"')).toBe('<p>a &lt;b&gt; &amp;<br />&quot;c&quot;</p>');
  });

  it('liefert fuer leeren Text nichts', () => {
    expect(textToHtml('   ')).toBe('');
  });
});

describe('toStatus', () => {
  it('bildet Kennzahlen und die at-URI als ID ab', () => {
    const status = toStatus(postView());

    expect(status.id).toBe(`at://${AUTHOR_DID}/app.bsky.feed.post/3mvcx2radks2k`);
    expect(status.url).toBe('https://bsky.app/profile/dracoblue.de/post/3mvcx2radks2k');
    expect(status.favourites_count).toBe(7);
    expect(status.reblogs_count).toBe(4);
    expect(status.replies_count).toBe(1);
    expect(status.quotes_count).toBe(2);
    expect(status.visibility).toBe('public');
    expect(status.in_reply_to_id).toBeNull();
    expect(status.in_reply_to_account_id).toBeNull();
  });

  it('uebernimmt den Eltern-Post als Reply-Zeiger', () => {
    const parent = `at://${AUTHOR_DID}/app.bsky.feed.post/3mqjm2vqq222s`;
    const status = toStatus(
      postView({
        record: {
          text: 'antwort',
          createdAt: '2026-09-12T11:20:00.000Z',
          reply: { parent: { uri: parent }, root: { uri: parent } },
        },
      }),
    );

    expect(status.in_reply_to_id).toBe(parent);
    expect(status.in_reply_to_account_id).toBe(AUTHOR_DID);
  });

  it('uebersetzt Bild-Embeds in media_attachments', () => {
    const status = toStatus(
      postView({
        embed: {
          $type: 'app.bsky.embed.images#view',
          images: [
            {
              thumb: 'https://cdn.bsky.app/thumb.jpg',
              fullsize: 'https://cdn.bsky.app/full.jpg',
              alt: 'Ein Foto',
            },
          ],
        },
      }),
    );

    expect(status.media_attachments).toEqual([
      {
        type: 'image',
        url: 'https://cdn.bsky.app/full.jpg',
        preview_url: 'https://cdn.bsky.app/thumb.jpg',
        description: 'Ein Foto',
      },
    ]);
  });

  it('greift bei recordWithMedia auf den Medienteil durch', () => {
    const status = toStatus(
      postView({
        embed: {
          $type: 'app.bsky.embed.recordWithMedia#view',
          media: {
            $type: 'app.bsky.embed.images#view',
            images: [{ fullsize: 'https://cdn.bsky.app/f.jpg' }],
          },
          record: {},
        },
      }),
    );

    expect(status.media_attachments).toHaveLength(1);
    expect(status.media_attachments[0].preview_url).toBeNull();
  });

  it('behandelt Link-Vorschauen nicht als Medium', () => {
    const status = toStatus(
      postView({
        embed: {
          $type: 'app.bsky.embed.external#view',
          external: { uri: 'https://example.com', title: 't', description: 'd' },
        },
      }),
    );

    expect(status.media_attachments).toEqual([]);
  });
});

describe('toAccount', () => {
  it('kennzeichnet das Protokoll und setzt das Handle als acct', () => {
    const account = toAccount({
      did: AUTHOR_DID,
      handle: 'dracoblue.de',
      displayName: 'dracoblue',
      avatar: 'https://cdn.bsky.app/a.jpg',
      followersCount: 176,
    });

    expect(account).toMatchObject({
      id: AUTHOR_DID,
      acct: 'dracoblue.de',
      display_name: 'dracoblue',
      followers_count: 176,
      protocol: 'atproto',
      url: 'https://bsky.app/profile/dracoblue.de',
    });
  });

  it('faellt ohne Followerzahl auf 0 zurueck', () => {
    expect(toAccount({ did: AUTHOR_DID, handle: 'x.de' }).followers_count).toBe(0);
  });
});
