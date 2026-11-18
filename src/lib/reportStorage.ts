import Dexie, { type EntityTable } from 'dexie';
import type { AggregatedReport } from './reports';
import { pdfSnapshotSchema, type ReportPdfSnapshot } from './reportPdf/model';

export interface FollowerObservation {
  accountKey: string;
  observedAt: string;
  followers: number;
}

interface StoredReportBase {
  key: string;
  accountKey: string;
  handle: string;
  savedAt: string;
  analyzedAt: string;
  model: 'net-reach-v1';
  report: AggregatedReport;
}
export type StoredReport = StoredReportBase &
  ({ version: 1 } | { version: 2; pdfSnapshot: ReportPdfSnapshot });

interface ReportDatabase extends Dexie {
  reports: EntityTable<StoredReport, 'key'>;
  followers: EntityTable<FollowerObservation, 'observedAt'>;
}

const db = new Dexie('fediwings-reports') as ReportDatabase;
db.version(1).stores({
  reports: '&key, accountKey',
  followers: '[accountKey+observedAt], accountKey',
});

export function reportAccountKey(origin: string, accountId: string): string {
  return JSON.stringify([origin, accountId]);
}

export function reportKey(accountKey: string, year: number): string {
  return JSON.stringify([accountKey, year]);
}

export async function saveReport(
  record: StoredReport,
  observation: FollowerObservation,
): Promise<void> {
  if (record.accountKey !== observation.accountKey) throw new Error('account-mismatch');
  const safe =
    record.version === 2
      ? { ...record, pdfSnapshot: pdfSnapshotSchema.parse(record.pdfSnapshot) }
      : record;
  await db.transaction('rw', db.reports, db.followers, async () => {
    await db.reports.put(safe);
    await db.followers.put(observation);
  });
}

export async function readReport(
  accountKey: string,
  year: number,
): Promise<StoredReport | undefined> {
  const record = await db.reports.get(reportKey(accountKey, year));
  return decodeStoredReport(record, accountKey, year);
}

export function decodeStoredReport(
  record: StoredReport | undefined,
  accountKey: string,
  year: number,
): StoredReport | undefined {
  if (!record || record.accountKey !== accountKey || record.report.year !== year) return undefined;
  if (record?.version === 1) return record;
  if (record?.version === 2) {
    const parsed = pdfSnapshotSchema.safeParse(record.pdfSnapshot);
    if (parsed.success && parsed.data.year === year && parsed.data.handle === record.handle) {
      return { ...record, pdfSnapshot: parsed.data };
    }
  }
  return undefined;
}

export async function removeReport(accountKey: string, year: number): Promise<void> {
  await db.reports.delete(reportKey(accountKey, year));
}

export async function listFollowerObservations(accountKey: string): Promise<FollowerObservation[]> {
  return db.followers.where('accountKey').equals(accountKey).sortBy('observedAt');
}

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Only observations from the last calendar day qualify as month-end values. */
export function monthEndFollowers(
  observations: FollowerObservation[],
  year: number,
): Array<{ count: number; observedAt: string } | null> {
  const result: Array<{ count: number; observedAt: string } | null> = Array(12).fill(null);
  for (const entry of observations) {
    const timestamp = new Date(entry.observedAt);
    if (
      !Number.isFinite(timestamp.getTime()) ||
      !Number.isSafeInteger(entry.followers) ||
      entry.followers < 0
    )
      continue;
    const parts = berlinDate.formatToParts(timestamp);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const y = value('year');
    const m = value('month');
    const day = value('day');
    if (y !== year || m < 1 || m > 12 || day !== new Date(Date.UTC(y, m, 0)).getUTCDate()) continue;
    const previous = result[m - 1];
    if (!previous || Date.parse(previous.observedAt) < timestamp.getTime()) {
      result[m - 1] = { count: entry.followers, observedAt: entry.observedAt };
    }
  }
  return result;
}

export function followerGrowth(
  observations: FollowerObservation[],
  year: number,
): Array<number | null> {
  const months = monthEndFollowers(observations, year);
  const lastDecember = monthEndFollowers(observations, year - 1)[11];
  return months.map((item, index) => {
    const previous = index === 0 ? lastDecember : months[index - 1];
    return item && previous ? item.count - previous.count : null;
  });
}
