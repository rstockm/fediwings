import { aggregateReport } from '../reports';
import type { ReportLoadResult } from '../reportLoader';
import type { ReportInteractionHistory } from '../reportInteractions';
import type { ReportPdfSnapshot } from './model';

export type TitleMetric = 'followers' | 'threads' | 'interactions' | 'reach' | 'engagement';
export interface TitleChange {
  percent: number;
  start: number;
  end: number;
  basis: 'months' | 'years';
  endMonth: number;
  currentEnd?: string;
  previousEnd?: string;
}
function berlinParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  return (key: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === key)!.value);
}
export function comparisonEnd(year: number, analyzedAt: string): string {
  const time = new Date(analyzedAt);
  const p = berlinParts(time);
  if (year < p('year')) return new Date(Date.UTC(year + 1, 0, 1) - 3600000 - 1).toISOString();
  return time.toISOString();
}
/** Same Berlin wall-clock cutoff one year earlier, including February 29 clamping. */
export function previousYearEnd(currentEnd: string): string {
  const p = berlinParts(new Date(currentEnd));
  const y = p('year') - 1,
    m = p('month') - 1;
  const d = Math.min(p('day'), new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  const milliseconds = new Date(currentEnd).getUTCMilliseconds();
  const desired = Date.UTC(y, m, d, p('hour'), p('minute'), p('second'), milliseconds);
  let candidate = desired - 3600000;
  for (let i = 0; i < 3; i += 1) {
    const q = berlinParts(new Date(candidate));
    const represented = Date.UTC(
      q('year'),
      q('month') - 1,
      q('day'),
      q('hour'),
      q('minute'),
      q('second'),
      new Date(candidate).getUTCMilliseconds(),
    );
    candidate += desired - represented;
  }
  return new Date(candidate).toISOString();
}
export function prepareAnnualComparison(
  year: number,
  analyzedAt: string,
  previous: ReportLoadResult,
  interactions?: ReportInteractionHistory,
): NonNullable<ReportPdfSnapshot['annualComparison']> {
  const currentEnd = comparisonEnd(year, analyzedAt);
  const previousEnd = previousYearEnd(currentEnd);
  const posts = previous.posts.filter(
    (post) => Date.parse(post.status.created_at) <= Date.parse(previousEnd),
  );
  return {
    year: year - 1,
    analyzedAt: previous.analyzedAt ?? analyzedAt,
    currentEnd,
    previousEnd,
    total: aggregateReport(
      year - 1,
      posts,
      new Date(previousEnd),
      previous.historyComplete,
      interactions,
    ).total,
  };
}
export function titleFollowers(s: ReportPdfSnapshot): {
  value: number | null;
  observedAt: string | null;
  month: number;
  reconstructed: boolean;
} {
  const observation = s.followerObservation;
  if (observation && berlinParts(new Date(observation.observedAt))('year') === s.year)
    return {
      value: observation.count,
      observedAt: observation.observedAt,
      month: berlinParts(new Date(observation.observedAt))('month') - 1,
      reconstructed: false,
    };
  const month = s.community
    .map((item, i) => item.followers !== null && s.months[i] !== 'future')
    .lastIndexOf(true);
  const point = s.community[month];
  return {
    value: point?.followers ?? null,
    observedAt: point?.observedAt ?? null,
    month,
    reconstructed: point?.source === 'reconstructed',
  };
}
export function titleChange(s: ReportPdfSnapshot, key: TitleMetric): TitleChange | null {
  if (key === 'reach' || key === 'interactions' || key === 'threads') {
    const previous = s.annualComparison;
    if (!previous || previous.year !== s.year - 1) return null;
    const complete = (p: typeof s.report.total) =>
      key === 'reach'
        ? p.reachComplete
        : key === 'interactions'
          ? (p.interactionsComplete ?? (!s.report.interactionBasis && p.counterComplete))
          : p.counterComplete;
    const start = previous.total[key],
      end = s.report.total[key];
    if (
      !complete(previous.total) ||
      !complete(s.report.total) ||
      start === null ||
      start <= 0 ||
      end === null
    )
      return null;
    return {
      percent: (100 * (end - start)) / start,
      start,
      end,
      basis: 'years',
      endMonth: 11,
      currentEnd: previous.currentEnd,
      previousEnd: previous.previousEnd,
    };
  }
  const endMonth = s.months.lastIndexOf('closed');
  if (endMonth < 1) return null;
  let start: number | null, end: number | null;
  if (key === 'followers') {
    const first = s.community[0],
      last = s.community[endMonth];
    if (
      (first.partial && first.source === 'reconstructed') ||
      (last.partial && last.source === 'reconstructed')
    )
      return null;
    start = first.followers;
    end = last.followers;
  } else {
    const first = s.report.months[0],
      last = s.report.months[endMonth];
    if (
      !first.counterComplete ||
      !first.reachComplete ||
      !last.counterComplete ||
      !last.reachComplete
    )
      return null;
    start = first.engagement;
    end = last.engagement;
  }
  return start !== null && start > 0 && end !== null
    ? { percent: (100 * (end - start)) / start, start, end, basis: 'months', endMonth }
    : null;
}
