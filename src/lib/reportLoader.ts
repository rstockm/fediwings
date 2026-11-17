import { getReportStatuses } from './api';
import { analyzePosts, preparePosts } from './analysis';
import type { AnalysisProgress, PostReach } from './types';

export interface ReportLoadProgress {
  phase: 'statuses' | 'reach';
  requests: number;
  oldestFetchedAt: string | null;
  analysis?: AnalysisProgress;
}

export interface ReportLoadResult {
  posts: PostReach[];
  historyComplete: boolean;
  oldestFetchedAt: string | null;
  error: string | null;
}

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
): Promise<ReportLoadResult> {
  const collection = await getReportStatuses(
    origin,
    accountId,
    year,
    signal,
    (requests, oldest) => onProgress({ phase: 'statuses', requests, oldestFetchedAt: oldest }),
    100,
    !boosterLists,
  );
  if (collection.error && collection.requests === 0) throw new Error(collection.error);
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
  return {
    posts,
    historyComplete: collection.historyComplete,
    oldestFetchedAt: collection.oldestFetchedAt,
    error: collection.error,
  };
}
