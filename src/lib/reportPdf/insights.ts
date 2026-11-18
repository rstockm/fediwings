import type { ReportPdfSnapshot } from './model';

export type PdfInsight =
  | { key: 'peak'; month: number; value: number; percent: number }
  | { key: 'reachChange'; month: number; previous: number; percent: number }
  | { key: 'activity'; value: number; previous: number };

export function reportInsights(snapshot: ReportPdfSnapshot): PdfInsight[] {
  const periods = snapshot.report.months;
  const closed = periods
    .map((p, i) =>
      snapshot.months[i] === 'closed' && p.counterComplete && p.reachComplete ? i : -1,
    )
    .filter((i) => i >= 0);
  const results: PdfInsight[] = [];
  if (
    closed.length &&
    snapshot.report.total.counterComplete &&
    snapshot.report.total.reachComplete
  ) {
    const max = Math.max(...closed.map((i) => periods[i].interactions ?? 0));
    const peaks = closed.filter((i) => periods[i].interactions === max);
    const sum = closed.reduce((total, i) => total + (periods[i].interactions ?? 0), 0);
    if (max > 0 && sum > 0 && peaks.length === 1)
      results.push({ key: 'peak', month: peaks[0], value: max, percent: (100 * max) / sum });
  }
  const last = closed.at(-1);
  if (last !== undefined && closed.includes(last - 1)) {
    const previous = periods[last - 1].reach;
    const current = periods[last].reach;
    if (previous != null && previous > 0 && current != null)
      results.push({
        key: 'reachChange',
        month: last,
        previous: last - 1,
        percent: (100 * (current - previous)) / previous,
      });
  }
  if (
    last !== undefined &&
    last >= 5 &&
    Array.from({ length: 6 }, (_, i) => last - i).every((i) => closed.includes(i))
  ) {
    const sum = (from: number) =>
      periods.slice(from, from + 3).reduce((s, p) => s + (p.threads ?? 0), 0);
    results.push({ key: 'activity', value: sum(last - 2), previous: sum(last - 5) });
  }
  return results.slice(0, 3);
}
