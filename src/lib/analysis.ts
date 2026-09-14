import { MastodonApiError } from './api';
import { mastodonBoosterSource, type BoosterCursor, type BoosterSource } from './boosters';
import { msg } from './i18n';
import { initialReach, updateReach } from './reach';
import { groupStatusesIntoThreads } from './thread';
import type {
  AnalysisProgress,
  MastodonStatus,
  MastodonStatusContext,
  MastodonStatusWithAccount,
  PostReach,
} from './types';

const MAX_CONCURRENCY = 2;
const MAX_PAGES_PER_POST = 10;
const MAX_REQUESTS = 120;

interface AnalysisCallbacks {
  onPost: (index: number, result: PostReach) => void;
  onProgress: (progress: AnalysisProgress) => void;
}

export interface AnalysisOptions {
  boosterLists?: boolean;
  /** Backend-spezifische Booster-Quelle; ohne Angabe wird die Mastodon-API genutzt. */
  boosterSource?: BoosterSource;
  /** Meldung, wenn das Backend gar keine öffentliche Booster-Liste hat. */
  noBoosterListMessage?: string;
}

function abortError(): DOMException {
  return new DOMException('Die Analyse wurde abgebrochen.', 'AbortError');
}

function waitUntil(timestamp: number, signal: AbortSignal): Promise<void> {
  const delay = Math.max(0, timestamp - Date.now());
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timeout = window.setTimeout(resolve, delay);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(abortError());
      },
      { once: true },
    );
  });
}

export function preparePosts(
  statuses: MastodonStatus[],
  authorFollowers: number,
  accountId: string,
  maxThreads = Infinity,
): PostReach[] {
  return groupStatusesIntoThreads(statuses, accountId)
    .slice(0, maxThreads)
    .map((card) => initialReach(card, authorFollowers));
}

export function prepareSharedPost(
  status: MastodonStatusWithAccount,
  context: MastodonStatusContext,
): PostReach {
  const authorStatuses = new Map<string, MastodonStatus>();
  for (const candidate of [...context.ancestors, status, ...context.descendants]) {
    if (candidate.account.id === status.account.id) authorStatuses.set(candidate.id, candidate);
  }

  const post = preparePosts(
    [...authorStatuses.values()],
    status.account.followers_count,
    status.account.id,
  ).find((candidate) =>
    candidate.threadStatuses.some((threadStatus) => threadStatus.id === status.id),
  );

  if (!post) throw new Error(msg('error.analysisNoThread'));
  return post;
}

export async function analyzePosts(
  origin: string,
  initial: PostReach[],
  signal: AbortSignal,
  callbacks: AnalysisCallbacks,
  options: AnalysisOptions = {},
): Promise<PostReach[]> {
  const results = [...initial];
  const boosterLists = options.boosterLists ?? true;
  const source = options.boosterSource ?? mastodonBoosterSource(origin);
  const queue = boosterLists
    ? results.map((_, index) => index).filter((index) => results[index].boosts > 0)
    : [];
  let requests = 0;
  let completedPosts = results.length - queue.length;

  const progress = (waitingUntil?: number) =>
    callbacks.onProgress({ completedPosts, totalPosts: results.length, requests, waitingUntil });

  if (!boosterLists) {
    const completed = results.map((result) => {
      if (result.boosts > 0) {
        return {
          ...result,
          state: 'partial' as const,
          error: options.noBoosterListMessage ?? msg('error.pixelfedNoBoosters'),
        };
      }
      return result.state === 'pending' ? { ...result, state: 'complete' as const } : result;
    });
    completed.forEach((result, index) => callbacks.onPost(index, result));
    progress();
    return completed;
  }

  progress();

  async function analyze(index: number): Promise<void> {
    let result: PostReach = { ...results[index], state: 'loading' };
    let pages = 0;
    let unfinished = false;
    let noBoostList = false;
    let remainingParts = 0;
    const seen = new Set<string>();
    let followerSum = 0;

    callbacks.onPost(index, result);

    try {
      outer: for (const part of result.threadStatuses) {
        let cursor: BoosterCursor | null = { statusId: part.id, token: null };

        while (cursor && pages < MAX_PAGES_PER_POST && requests < MAX_REQUESTS) {
          if (signal.aborted) throw abortError();
          requests += 1;
          progress();

          let page;
          try {
            page = await source.page(cursor, signal);
          } catch (error) {
            if (error instanceof MastodonApiError && error.status === 429 && error.resetAt) {
              progress(error.resetAt);
              await waitUntil(error.resetAt, signal);
              page = await source.page(cursor, signal);
              requests += 1;
            } else if (error instanceof MastodonApiError && error.status === 404) {
              noBoostList = true;
              break outer;
            } else {
              throw error;
            }
          }

          requests += page.requests - 1;

          for (const account of page.accounts) {
            if (seen.has(account.key)) continue;
            seen.add(account.key);
            followerSum += account.followers;
          }

          pages += 1;
          result = updateReach(result, seen.size, followerSum, pages);
          results[index] = result;
          callbacks.onPost(index, result);
          cursor = page.next;

          if (
            cursor &&
            page.rateLimit.remaining !== null &&
            page.rateLimit.remaining <= 1 &&
            page.rateLimit.resetAt &&
            page.rateLimit.resetAt > Date.now()
          ) {
            progress(page.rateLimit.resetAt);
            await waitUntil(page.rateLimit.resetAt, signal);
          }
        }

        if (!cursor) {
          remainingParts += 1;
          if (pages >= MAX_PAGES_PER_POST || requests >= MAX_REQUESTS) {
            unfinished = remainingParts < result.threadStatuses.length;
            break outer;
          }
          continue;
        }

        unfinished = true;
        break outer;
      }

      result = {
        ...result,
        state: noBoostList || unfinished ? 'partial' : 'complete',
        error: noBoostList
          ? (options.noBoosterListMessage ?? msg('error.serverNoBoosterList'))
          : unfinished
            ? msg('error.analysisBudget')
            : undefined,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      result = {
        ...result,
        state: result.pagesLoaded > 0 ? 'partial' : 'error',
        error: error instanceof Error ? error.message : msg('error.analysisBoosterLoad'),
      };
    }

    results[index] = result;
    callbacks.onPost(index, result);
    completedPosts += 1;
    progress();
  }

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      if (signal.aborted) throw abortError();
      const index = queue.shift();
      if (index !== undefined) await analyze(index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, () => worker()),
  );
  return results;
}
