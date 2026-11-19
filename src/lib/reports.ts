import type { PostReach } from './types';
import type { ReportInteractionHistory } from './reportInteractions';

export interface ReportPeriod {
  threads: number | null;
  interactions: number | null;
  reach: number | null;
  engagement: number | null;
  counterComplete: boolean;
  reachComplete: boolean;
  /** Separate from the completeness of thread counters used for engagement. */
  interactionsComplete?: boolean;
}

export interface AggregatedReport {
  year: number;
  months: ReportPeriod[];
  total: ReportPeriod;
  interactionBasis?: 'notification-time';
  reusedInteractionMonths?: number[];
}

const berlinMonth = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
});
const berlinHour = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Berlin',
  hour: 'numeric',
  hourCycle: 'h23',
});

function berlinMonthStart(year: number, month: number): number {
  const utcMidnight = Date.UTC(year, month - 1, 1);
  // Berlin's UTC offset at midnight on the first day of a month is 1h or 2h.
  return utcMidnight - Number(berlinHour.format(utcMidnight)) * 3_600_000;
}

function yearMonth(date: Date): [number, number] {
  const parts = berlinMonth.formatToParts(date);
  return [
    Number(parts.find((part) => part.type === 'year')?.value),
    Number(parts.find((part) => part.type === 'month')?.value),
  ];
}

function emptyPeriod(future: boolean): ReportPeriod {
  return {
    threads: future ? null : 0,
    interactions: future ? null : 0,
    reach: future ? null : 0,
    engagement: null,
    counterComplete: true,
    reachComplete: true,
  };
}

export function aggregateReport(
  year: number,
  posts: PostReach[],
  referenceDate: Date,
  historyComplete = true,
  interactionHistory?: ReportInteractionHistory,
): AggregatedReport {
  const [currentYear, currentMonth] = yearMonth(referenceDate);
  const months = Array.from({ length: 12 }, (_, index) =>
    emptyPeriod(year > currentYear || (year === currentYear && index + 1 > currentMonth)),
  );
  for (const period of months) {
    if (period.threads !== null) {
      period.counterComplete = historyComplete;
      period.reachComplete = historyComplete;
    }
  }
  const seen = new Set<string>();

  for (const post of posts) {
    if (seen.has(post.status.id)) continue;
    seen.add(post.status.id);
    const timestamp = new Date(post.status.created_at);
    if (!Number.isFinite(timestamp.getTime())) continue;
    const [postYear, month] = yearMonth(timestamp);
    if (postYear !== year || month < 1 || month > 12) continue;
    const period = months[month - 1];
    if (period.threads === null || period.interactions === null || period.reach === null) continue;
    period.threads += 1;
    period.interactions += post.threadStatuses.reduce(
      (sum, status) =>
        sum +
        status.favourites_count +
        status.reblogs_count +
        status.replies_count +
        (status.quotes_count ?? 0),
      0,
    );
    period.reach += post.netReach;
    period.counterComplete &&= !post.threadTruncated;
    period.reachComplete &&= post.state === 'complete' && !post.threadTruncated;
  }

  for (const period of months) {
    if (period.reach && period.interactions !== null) {
      period.engagement = (100 * period.interactions) / period.reach;
    }
  }
  const total = months.reduce<ReportPeriod>((sum, period) => {
    sum.threads! += period.threads ?? 0;
    sum.interactions! += period.interactions ?? 0;
    sum.reach! += period.reach ?? 0;
    sum.counterComplete &&= period.counterComplete;
    sum.reachComplete &&= period.reachComplete;
    return sum;
  }, emptyPeriod(false));
  if (total.reach && total.interactions !== null) {
    total.engagement = (100 * total.interactions) / total.reach;
  }
  const report = { year, months, total };
  return interactionHistory
    ? applyInteractionHistory(report, interactionHistory, referenceDate)
    : report;
}

export function applyInteractionHistory(
  base: AggregatedReport,
  interactionHistory: ReportInteractionHistory,
  referenceDate: Date,
): AggregatedReport {
  const { year } = base;
  const months = base.months.map((period) => ({ ...period }));
  const total = { ...base.total };
  // Engagement was calculated using only counters of the threads in each period.
  // Overwrite the separate interaction metric with dated account-wide events.
  const { timestamps, oldest, observedAt } = interactionHistory;
  const cutoff = Math.min(referenceDate.getTime(), observedAt);
  const [endYear, endMonth] = yearMonth(new Date(cutoff));
  const counts: number[] = Array(12).fill(0);
  for (const timestamp of timestamps) {
    if (timestamp > cutoff) continue;
    const [eventYear, eventMonth] = yearMonth(new Date(timestamp));
    if (eventYear === year) counts[eventMonth - 1]++;
  }

  for (const [i, period] of months.entries()) {
    period.interactions = null;
    delete period.interactionsComplete;
    if (period.threads === null) continue;
    const month = i + 1;
    period.interactionsComplete =
      oldest !== null &&
      oldest <= berlinMonthStart(year, month) &&
      (year < endYear || (year === endYear && month <= endMonth));
    if (period.interactionsComplete || counts[i] > 0) period.interactions = counts[i];
  }
  updateInteractionTotal(months, total);
  return { year, months, total, interactionBasis: 'notification-time' };
}

function updateInteractionTotal(months: ReportPeriod[], total: ReportPeriod): void {
  const available = months.filter((period) => period.interactions !== null);
  total.interactions = available.length
    ? available.reduce((sum, period) => sum + (period.interactions ?? 0), 0)
    : null;
  total.interactionsComplete = months.every(
    (period) => period.threads === null || period.interactionsComplete,
  );
}

/** Reuse whole closed months only. Never add a snapshot count to a live count. */
export function reuseStoredInteractions(
  live: AggregatedReport,
  stored: AggregatedReport,
  storedAt: string,
): AggregatedReport {
  if (!live.interactionBasis || !stored.interactionBasis || live.year !== stored.year) return live;
  const date = new Date(storedAt);
  if (!Number.isFinite(date.getTime())) return live;
  const [year, month] = yearMonth(date);
  const reused: number[] = [];
  const months = live.months.map((period, i) => {
    const saved = stored.months[i];
    if (
      period.interactionsComplete !== false ||
      !saved?.interactionsComplete ||
      saved.interactions === null ||
      year < live.year ||
      (year === live.year && i + 1 >= month)
    )
      return period;
    reused.push(i);
    return { ...period, interactions: saved.interactions, interactionsComplete: true };
  });
  if (!reused.length) return live;
  const total = { ...live.total };
  updateInteractionTotal(months, total);
  return { ...live, months, total, reusedInteractionMonths: reused };
}
