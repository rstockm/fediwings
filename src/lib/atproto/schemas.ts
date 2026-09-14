import { z } from 'zod';
import type { MastodonAccount, MastodonMediaAttachment, MastodonStatus } from '../types';

export const resolveHandleSchema = z.object({ did: z.string() });

export const didDocumentSchema = z.object({
  id: z.string(),
  alsoKnownAs: z.array(z.string()).optional(),
  service: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        serviceEndpoint: z.string(),
      }),
    )
    .optional(),
});

export const xrpcErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

const nonNegative = z
  .number()
  .int()
  .nonnegative()
  .nullish()
  .transform((value) => value ?? 0);

/** app.bsky.actor.defs#profileView – ohne followersCount (z. B. aus getRepostedBy). */
export const profileViewSchema = z.object({
  did: z.string(),
  handle: z.string(),
  displayName: z.string().nullish(),
  avatar: z.string().nullish(),
});

/** app.bsky.actor.defs#profileViewDetailed */
export const profileViewDetailedSchema = profileViewSchema.extend({
  followersCount: nonNegative,
  followsCount: nonNegative,
  postsCount: nonNegative,
});

export const getProfilesSchema = z.object({
  profiles: z.array(profileViewDetailedSchema),
});

export const getRepostedBySchema = z.object({
  cursor: z.string().nullish(),
  repostedBy: z.array(profileViewSchema),
});

const imageViewSchema = z.object({
  thumb: z.string().nullish(),
  fullsize: z.string(),
  alt: z.string().nullish(),
});

/**
 * Nur die Embeds, die echte Medien tragen. Link-Vorschauen (`app.bsky.embed.external#view`)
 * und zitierte Posts entsprechen Mastodons `card`/Quote und gehören nicht in `media_attachments`.
 */
type EmbedView = { $type?: string; images?: unknown; playlist?: unknown; media?: unknown };

function mediaFromEmbed(embed: unknown): MastodonMediaAttachment[] {
  if (!embed || typeof embed !== 'object') return [];
  const view = embed as EmbedView;

  if (view.$type === 'app.bsky.embed.recordWithMedia#view') return mediaFromEmbed(view.media);

  if (view.$type === 'app.bsky.embed.images#view') {
    const images = z.array(imageViewSchema).safeParse(view.images);
    if (!images.success) return [];
    return images.data.map((image) => ({
      type: 'image',
      url: image.fullsize,
      preview_url: image.thumb ?? null,
      description: image.alt ?? null,
    }));
  }

  if (view.$type === 'app.bsky.embed.video#view') {
    const video = z
      .object({ playlist: z.string(), thumbnail: z.string().nullish(), alt: z.string().nullish() })
      .safeParse(view);
    if (!video.success) return [];
    return [
      {
        type: 'video',
        url: video.data.playlist,
        preview_url: video.data.thumbnail ?? null,
        description: video.data.alt ?? null,
      },
    ];
  }

  return [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Klartext aus dem Record in das HTML-Format, das PostCard erwartet (dort via DOMPurify bereinigt). */
export function textToHtml(text: string): string {
  if (!text.trim()) return '';
  return `<p>${escapeHtml(text).replace(/\r?\n/g, '<br />')}</p>`;
}

/** `at://did:plc:xyz/app.bsky.feed.post/3abc` → `3abc` */
export function rkeyFromUri(uri: string): string {
  return uri.split('/').at(-1) ?? uri;
}

/** `at://did:plc:xyz/app.bsky.feed.post/3abc` → `did:plc:xyz` */
export function didFromUri(uri: string): string | null {
  const match = uri.match(/^at:\/\/([^/]+)/);
  return match ? match[1] : null;
}

export function postWebUrl(handleOrDid: string, uri: string): string {
  return `https://bsky.app/profile/${encodeURIComponent(handleOrDid)}/post/${encodeURIComponent(rkeyFromUri(uri))}`;
}

export function toAccount(
  profile: z.output<typeof profileViewSchema> & { followersCount?: number },
): MastodonAccount {
  return {
    id: profile.did,
    username: profile.handle,
    acct: profile.handle,
    display_name: profile.displayName ?? profile.handle,
    url: `https://bsky.app/profile/${encodeURIComponent(profile.handle)}`,
    uri: `at://${profile.did}`,
    avatar_static: profile.avatar ?? '',
    followers_count: profile.followersCount ?? 0,
    protocol: 'atproto',
  };
}

const postRecordSchema = z.object({
  text: z.string().nullish(),
  createdAt: z.string(),
  reply: z
    .object({
      parent: z.object({ uri: z.string() }),
      root: z.object({ uri: z.string() }),
    })
    .nullish(),
});

/** app.bsky.feed.defs#postView */
export const postViewSchema = z.object({
  uri: z.string(),
  cid: z.string(),
  author: profileViewSchema,
  record: postRecordSchema,
  embed: z.unknown().nullish(),
  replyCount: nonNegative,
  repostCount: nonNegative,
  likeCount: nonNegative,
  quoteCount: nonNegative,
  indexedAt: z.string(),
});

export type PostView = z.output<typeof postViewSchema>;

/**
 * Ein postView in das interne Mastodon-Format. Die vollständige `at://`-URI bleibt als `id`
 * erhalten, weil `app.bsky.feed.getRepostedBy` nur darüber adressierbar ist.
 */
export function toStatus(post: PostView): MastodonStatus {
  const parentUri = post.record.reply?.parent.uri ?? null;

  return {
    id: post.uri,
    created_at: post.record.createdAt,
    url: postWebUrl(post.author.handle, post.uri),
    content: textToHtml(post.record.text ?? ''),
    spoiler_text: '',
    sensitive: false,
    visibility: 'public',
    favourites_count: post.likeCount,
    reblogs_count: post.repostCount,
    replies_count: post.replyCount,
    quotes_count: post.quoteCount,
    in_reply_to_id: parentUri,
    in_reply_to_account_id: parentUri ? didFromUri(parentUri) : null,
    media_attachments: mediaFromEmbed(post.embed),
  };
}

export function toStatusWithAccount(post: PostView) {
  return { ...toStatus(post), account: toAccount(post.author) };
}

export const feedViewPostSchema = z.object({
  post: postViewSchema,
  reason: z.object({ $type: z.string() }).nullish(),
});

export const getAuthorFeedSchema = z.object({
  cursor: z.string().nullish(),
  feed: z.array(feedViewPostSchema),
});

/** Reposts im Autoren-Feed sind fremde Beiträge und entsprechen `exclude_reblogs=true`. */
export const REPOST_REASON = 'app.bsky.feed.defs#reasonRepost';

/**
 * Eine Ebene von `app.bsky.feed.defs#threadViewPost`. Die Rekursion wird in `api.ts`
 * schrittweise aufgelöst, statt sie über `z.lazy` in den Typ zu ziehen.
 */
export const threadNodeSchema = z.object({
  post: postViewSchema,
  parent: z.unknown().nullish(),
  replies: z.array(z.unknown()).nullish(),
});

export const getPostThreadSchema = z.object({
  thread: threadNodeSchema,
});
