import type { PostReach } from './types';

export interface ReportPeriod {
  threads: number | null;
  interactions: number | null;
  reach: number | null;
  engagement: number | null;
  counterComplete: boolean;
  reachComplete: boolean;
}

export interface AggregatedReport {
  year: number;
  months: ReportPeriod[];
  total: ReportPeriod;
}

const berlinMonth = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
});

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
  return { year, months, total };
}
