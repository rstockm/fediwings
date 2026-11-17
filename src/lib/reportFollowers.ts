import type { AnchoredSeries, MonthlyPoint } from './followers';

export interface ReportFollowerHistory {
  monthly: MonthlyPoint[];
  anchored: AnchoredSeries;
  partial: boolean;
}

export function reportFollowerHistory(
  history: ReportFollowerHistory,
  year: number,
): {
  followers: Array<number | null>;
  follows: Array<number | null>;
} {
  const followers: Array<number | null> = Array(12).fill(null);
  const follows: Array<number | null> = Array(12).fill(null);
  const indexFor = (month: string): number => {
    const match = /^(\d{4})-(\d{2})$/u.exec(month);
    if (!match || Number(match[1]) !== year) return -1;
    const index = Number(match[2]) - 1;
    return index >= 0 && index < 12 ? index : -1;
  };
  for (const point of history.monthly) {
    const index = indexFor(point.month);
    if (index !== -1) follows[index] = point.count;
  }
  const ordinal = (month: string): number | null => {
    const match = /^(\d{4})-(\d{2})$/u.exec(month);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
    return Number(match[1]) * 12 + Number(match[2]) - 1;
  };
  history.anchored.months.forEach((month, index) => {
    const start = ordinal(month);
    if (start === null) return;
    const next = history.anchored.months[index + 1];
    const end = next ? (ordinal(next) ?? start + 1) : start + 1;
    const value = history.anchored.points[index + 1] ?? null;
    for (
      let current = Math.max(start, year * 12);
      current < Math.min(end, (year + 1) * 12);
      current += 1
    ) {
      const monthIndex = current - year * 12;
      followers[monthIndex] = value;
      follows[monthIndex] ??= 0;
    }
  });
  return { followers, follows };
}
