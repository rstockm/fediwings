import type { z } from 'zod';
import { MastodonApiError } from '../api';
import type { StatusCollection } from '../api';
import { fetchWithTimeout } from '../http';
import { msg } from '../i18n';
import type {
  AtprotoTarget,
  MastodonAccount,
  MastodonStatus,
  MastodonStatusContext,
  MastodonStatusWithAccount,
} from '../types';
import { APPVIEW_ORIGIN, AtprotoError } from './identity';
import {
  getAuthorFeedSchema,
  getPostThreadSchema,
  getProfilesSchema,
  getRepostedBySchema,
  postViewSchema,
  profileViewDetailedSchema,
  REPOST_REASON,
  threadNodeSchema,
  toAccount,
  toStatus,
  toStatusWithAccount,
  xrpcErrorSchema,
} from './schemas';

const REQUEST_TIMEOUT_MS = 12_000;

export const FEED_PAGE_SIZE = 100;
export const MAX_FEED_PAGES = 2;
export const REPOSTS_PAGE_SIZE = 100;
/** Harte Obergrenze von app.bsky.actor.getProfiles. */
export const PROFILE_BATCH_SIZE = 25;

/**
 * Ein XRPC-Aufruf gegen die öffentliche AppView. Fehler werden in `MastodonApiError`
 * übersetzt, damit die bestehende Fehler- und 429-Behandlung unverändert greift.
 */
export async function xrpc<T extends z.ZodType>(
  appview: string,
  method: string,
  params: Record<string, string | string[]>,
  schema: T,
  signal?: AbortSignal,
): Promise<z.output<T>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((entry) => search.append(key, entry));
    else search.set(key, value);
  }

  let response: Response;
  let timedOut = false;
  try {
    const result = await fetchWithTimeout(
      `${appview}/xrpc/${method}?${search}`,
      { headers: { Accept: 'application/json' } },
      signal,
      REQUEST_TIMEOUT_MS,
    );
    response = result.response;
    timedOut = result.timedOut;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    throw new MastodonApiError(timedOut ? msg('error.apiTimeout') : msg('error.apiUnreachable'));
  }

  if (!response.ok) {
    let detail: string | null = null;
    try {
      detail = xrpcErrorSchema.parse(await response.json()).error ?? null;
    } catch {
      detail = null;
    }
    const messages: Record<number, string> = {
      400: msg('error.atprotoRequest', { detail: detail ?? String(response.status) }),
      401: msg('error.api401'),
      404: msg('error.api404'),
      429: msg('error.api429'),
    };
    throw new MastodonApiError(
      messages[response.status] ?? msg('error.apiHttp', { status: response.status }),
      response.status,
      null,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new MastodonApiError(msg('error.apiJson'), response.status);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new MastodonApiError(msg('error.apiInvalid'));
  return parsed.data;
}

export async function getAtprotoAccount(
  target: AtprotoTarget,
  signal?: AbortSignal,
): Promise<MastodonAccount> {
  const profile = await xrpc(
    target.appview,
    'app.bsky.actor.getProfile',
    { actor: target.did },
    profileViewDetailedSchema,
    signal,
  );
  return toAccount(profile);
}

function isSelfReplyOrOriginal(status: MastodonStatus, did: string): boolean {
  return status.in_reply_to_id === null || status.in_reply_to_account_id === did;
}

/**
 * Beiträge des Autors laden. `posts_with_replies` ist nötig, weil `posts_no_replies`
 * auch die eigenen Thread-Fortsetzungen ausblendet; fremde Antworten und Reposts
 * werden anschließend verworfen.
 */
export async function getAtprotoStatuses(
  target: AtprotoTarget,
  signal?: AbortSignal,
): Promise<StatusCollection> {
  const statuses: MastodonStatus[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let requests = 0;
  let oldestFetchedAt: string | null = null;
  let historyComplete = false;

  do {
    const params: Record<string, string> = {
      actor: target.did,
      limit: String(FEED_PAGE_SIZE),
      filter: 'posts_with_replies',
    };
    if (cursor) params.cursor = cursor;

    const page = await xrpc(
      target.appview,
      'app.bsky.feed.getAuthorFeed',
      params,
      getAuthorFeedSchema,
      signal,
    );
    requests += 1;

    for (const item of page.feed) {
      if (item.reason?.$type === REPOST_REASON) continue;
      if (item.post.author.did !== target.did) continue;
      if (seen.has(item.post.uri)) continue;
      seen.add(item.post.uri);

      const status = toStatus(item.post);
      const timestamp = Date.parse(status.created_at);
      if (Number.isFinite(timestamp)) {
        if (oldestFetchedAt === null || timestamp < Date.parse(oldestFetchedAt)) {
          oldestFetchedAt = status.created_at;
        }
      }
      if (isSelfReplyOrOriginal(status, target.did)) statuses.push(status);
    }

    historyComplete = !page.cursor && page.feed.length < FEED_PAGE_SIZE;
    cursor = page.cursor ?? null;
  } while (cursor && requests < MAX_FEED_PAGES);

  return { statuses, requests, oldestFetchedAt, historyComplete };
}

/** Followerzahlen für bis zu 25 DIDs auf einmal. */
export async function getAtprotoFollowerCounts(
  appview: string,
  dids: string[],
  signal?: AbortSignal,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (dids.length === 0) return counts;

  const page = await xrpc(
    appview,
    'app.bsky.actor.getProfiles',
    { actors: dids },
    getProfilesSchema,
    signal,
  );
  for (const profile of page.profiles) counts.set(profile.did, profile.followersCount);
  return counts;
}

export async function getAtprotoReposts(
  appview: string,
  uri: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<{ dids: string[]; cursor: string | null }> {
  const params: Record<string, string> = { uri, limit: String(REPOSTS_PAGE_SIZE) };
  if (cursor) params.cursor = cursor;

  const page = await xrpc(
    appview,
    'app.bsky.feed.getRepostedBy',
    params,
    getRepostedBySchema,
    signal,
  );
  return { dids: page.repostedBy.map((profile) => profile.did), cursor: page.cursor ?? null };
}

/** Eltern- und Antwortkette eines Beitrags flach einsammeln. */
function collectThread(node: z.output<typeof threadNodeSchema>): {
  ancestors: MastodonStatusWithAccount[];
  descendants: MastodonStatusWithAccount[];
} {
  const ancestors: MastodonStatusWithAccount[] = [];
  const descendants: MastodonStatusWithAccount[] = [];

  let parent: unknown = node.parent;
  while (parent) {
    const parsed = threadNodeSchema.safeParse(parent);
    if (!parsed.success) break;
    ancestors.unshift(toStatusWithAccount(parsed.data.post));
    parent = parsed.data.parent;
  }

  const queue: unknown[] = [...(node.replies ?? [])];
  while (queue.length > 0) {
    const parsed = threadNodeSchema.safeParse(queue.shift());
    if (!parsed.success) continue;
    descendants.push(toStatusWithAccount(parsed.data.post));
    queue.push(...(parsed.data.replies ?? []));
  }

  return { ancestors, descendants };
}

export interface SharedAtprotoPost {
  status: MastodonStatusWithAccount;
  context: MastodonStatusContext;
}

/**
 * Einen geteilten Beitrag samt Thread laden. Der Autor wird über sein Handle aufgelöst,
 * weil eine bsky.app-URL nur Handle und Record-Key enthält.
 */
export async function getAtprotoSharedPost(
  appview: string,
  did: string,
  rkey: string,
  signal?: AbortSignal,
): Promise<SharedAtprotoPost> {
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const thread = await xrpc(
    appview,
    'app.bsky.feed.getPostThread',
    { uri, depth: '10', parentHeight: '10' },
    getPostThreadSchema,
    signal,
  );

  const post = postViewSchema.safeParse(thread.thread.post);
  if (!post.success) throw new AtprotoError(msg('error.apiInvalid'));

  const account = await xrpc(
    appview,
    'app.bsky.actor.getProfile',
    { actor: did },
    profileViewDetailedSchema,
    signal,
  );

  return {
    status: { ...toStatus(post.data), account: toAccount(account) },
    context: collectThread(thread.thread),
  };
}

export { APPVIEW_ORIGIN };
