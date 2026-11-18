import { getReportStatuses, type ReportStatusCollection } from './api';
import { analyzePosts, preparePosts } from './analysis';
import type { AnalysisProgress, PostReach } from './types';

export interface ReportLoadProgress {
  phase: 'statuses' | 'reach';
  requests: number;
  oldestFetchedAt: string | null;
  analysis?: AnalysisProgress;
}

export interface ReportLoadResult {
  analyzedAt?: string;
  posts: PostReach[];
  historyComplete: boolean;
  oldestFetchedAt: string | null;
  error: string | null;
}

// Only one connected account is retained, in memory, for five minutes.
export const REPORT_CACHE_MS = 5 * 60_000;
let cache: {
  key: string;
  createdAt: number;
  collection: ReportStatusCollection | null;
  years: Map<number, ReportLoadResult>;
} | null = null;

/**
 * Fetch all available statuses before selecting thread roots for the year.
 * Later self-replies remain attached to their root, including across years.
 */
export async function loadReport(
  origin: string,
  accountId: string,
  followers: number,
  year: number,
  signal: AbortSignal,
  onProgress: (progress: ReportLoadProgress) => void,
  boosterLists = true,
  options?: { cacheKey: string; refresh?: boolean },
): Promise<ReportLoadResult> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const key = options
    ? `${options.cacheKey}|${origin}|${accountId}|${followers}|${boosterLists}`
    : '';
  if (
    options &&
    (options.refresh || cache?.key !== key || Date.now() - cache.createdAt > REPORT_CACHE_MS)
  ) {
    cache = { key, createdAt: Date.now(), collection: null, years: new Map() };
  }
  const activeCache = options ? cache : null;
  const cachedResult = activeCache?.years.get(year);
  if (cachedResult) return cachedResult;
  const previous = activeCache?.collection;
  const covered =
    previous &&
    (previous.exhausted ||
      (previous.oldestFetchedAt !== null &&
        Date.parse(previous.oldestFetchedAt) < Date.UTC(year - 1, 11, 31, 23)));
  const collection = covered
    ? { ...previous, requests: 0, historyComplete: true, error: null }
    : await getReportStatuses(
        origin,
        accountId,
        year,
        signal,
        (requests, oldest) => onProgress({ phase: 'statuses', requests, oldestFetchedAt: oldest }),
        100,
        !boosterLists,
        previous?.nextUrl ? previous : undefined,
      );
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  if (activeCache) activeCache.collection = collection;
  if (collection.error && collection.requests === 0 && collection.statuses.length === 0) {
    throw new Error(collection.error);
  }
  const formatter = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' });
  const initial = preparePosts(collection.statuses, followers, accountId).filter((post) => {
    const timestamp = new Date(post.status.created_at);
    return Number.isFinite(timestamp.getTime()) && Number(formatter.format(timestamp)) === year;
  });
  const posts = await analyzePosts(
    origin,
    initial,
    signal,
    {
      onPost: () => {},
      onProgress: (analysis) =>
        onProgress({
          phase: 'reach',
          requests: collection.requests,
          oldestFetchedAt: collection.oldestFetchedAt,
          analysis,
        }),
    },
    { boosterLists },
  );
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const result = {
    analyzedAt: new Date().toISOString(),
    posts,
    historyComplete: collection.historyComplete,
    oldestFetchedAt: collection.oldestFetchedAt,
    error: collection.error,
  };
  if (
    activeCache &&
    result.historyComplete &&
    posts.every((post) => post.state === 'complete' && !post.threadTruncated)
  ) {
    activeCache.years.set(year, result);
  }
  return result;
}
