import type { MastodonStatus } from './types';

export const INSIGHT_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1_000;

export type PostingInsightKey = 'reach' | 'interactions' | 'likes' | 'boosts';

export interface PostingReachDatum {
  id: string;
  createdAt: string;
  value: number;
}

export interface PostingInsightMetric {
  key: PostingInsightKey;
  currentTotal: number;
  previousTotal: number;
  changePercent: number | null;
  currentSeries: number[];
  previousSeries: number[];
  maxDailyValue: number;
  currentComplete: boolean;
  comparisonComplete: boolean;
}

export interface PostingInsights {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  currentComplete: boolean;
  comparisonComplete: boolean;
  metrics: PostingInsightMetric[];
}

export interface PostingInsightCoverage {
  historyComplete: boolean;
  oldestFetchedAt: string | null;
  reachSelectionComplete: boolean;
}

type CounterInsightKey = Exclude<PostingInsightKey, 'reach'>;

const counterMetricValue: Record<CounterInsightKey, (status: MastodonStatus) => number> = {
  interactions: (status) => status.favourites_count + status.reblogs_count + status.replies_count,
  likes: (status) => status.favourites_count,
  boosts: (status) => status.reblogs_count,
};

const metricKeys: PostingInsightKey[] = ['reach', 'interactions', 'likes', 'boosts'];

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function validTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildPostingInsights(
  statuses: MastodonStatus[],
  referenceDate: Date,
  coverage: PostingInsightCoverage,
  reachData: PostingReachDatum[],
): PostingInsights {
  const referenceDay = startOfUtcDay(referenceDate);
  const currentStart = referenceDay - (INSIGHT_PERIOD_DAYS - 1) * DAY_MS;
  const currentEnd = referenceDay + DAY_MS;
  const previousStart = currentStart - INSIGHT_PERIOD_DAYS * DAY_MS;
  const oldestFetchedAt = validTimestamp(coverage.oldestFetchedAt);
  const currentComplete =
    coverage.historyComplete || (oldestFetchedAt !== null && oldestFetchedAt <= currentStart);
  const comparisonComplete =
    coverage.historyComplete || (oldestFetchedAt !== null && oldestFetchedAt <= previousStart);
  const uniqueStatuses = [...new Map(statuses.map((status) => [status.id, status])).values()];
  const uniqueReachData = [...new Map(reachData.map((datum) => [datum.id, datum])).values()];
  const oldestAnalyzedAt = uniqueReachData.reduce<number | null>((oldest, datum) => {
    const timestamp = Date.parse(datum.createdAt);
    if (!Number.isFinite(timestamp)) return oldest;
    return oldest === null ? timestamp : Math.min(oldest, timestamp);
  }, null);

  const metrics = metricKeys.map((key) => {
    const currentSeries = Array<number>(INSIGHT_PERIOD_DAYS).fill(0);
    const previousSeries = Array<number>(INSIGHT_PERIOD_DAYS).fill(0);
    const metricCurrentComplete =
      currentComplete &&
      (key !== 'reach' ||
        coverage.reachSelectionComplete ||
        (oldestAnalyzedAt !== null && oldestAnalyzedAt <= currentStart));
    const metricComparisonComplete =
      comparisonComplete &&
      (key !== 'reach' ||
        coverage.reachSelectionComplete ||
        (oldestAnalyzedAt !== null && oldestAnalyzedAt <= previousStart));
    const data =
      key === 'reach'
        ? uniqueReachData.map((datum) => ({ createdAt: datum.createdAt, value: datum.value }))
        : uniqueStatuses.map((status) => ({
            createdAt: status.created_at,
            value: counterMetricValue[key](status),
          }));

    for (const datum of data) {
      const timestamp = Date.parse(datum.createdAt);
      if (!Number.isFinite(timestamp)) continue;
      if (timestamp >= currentStart && timestamp < currentEnd) {
        const index = Math.floor((timestamp - currentStart) / DAY_MS);
        currentSeries[index] += datum.value;
      } else if (timestamp >= previousStart && timestamp < currentStart) {
        const index = Math.floor((timestamp - previousStart) / DAY_MS);
        previousSeries[index] += datum.value;
      }
    }

    const currentTotal = currentSeries.reduce((sum, value) => sum + value, 0);
    const previousTotal = previousSeries.reduce((sum, value) => sum + value, 0);
    const changePercent =
      metricComparisonComplete && previousTotal > 0
        ? Math.round(((currentTotal - previousTotal) / previousTotal) * 1_000) / 10
        : null;

    return {
      key,
      currentTotal,
      previousTotal,
      changePercent,
      currentSeries,
      previousSeries,
      maxDailyValue: Math.max(
        1,
        ...currentSeries,
        ...(metricComparisonComplete ? previousSeries : []),
      ),
      currentComplete: metricCurrentComplete,
      comparisonComplete: metricComparisonComplete,
    };
  });

  return {
    currentStart: dateKey(currentStart),
    currentEnd: dateKey(referenceDay),
    previousStart: dateKey(previousStart),
    previousEnd: dateKey(currentStart - DAY_MS),
    currentComplete,
    comparisonComplete,
    metrics,
  };
}
