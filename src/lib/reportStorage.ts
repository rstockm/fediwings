import Dexie, { type EntityTable } from 'dexie';
import type { AggregatedReport } from './reports';

export interface FollowerObservation {
  accountKey: string;
  observedAt: string;
  followers: number;
}

export interface StoredReport {
  version: 1;
  key: string;
  accountKey: string;
  handle: string;
  savedAt: string;
  analyzedAt: string;
  model: 'net-reach-v1';
  report: AggregatedReport;
}

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
  await db.transaction('rw', db.reports, db.followers, async () => {
    await db.reports.put(record);
    await db.followers.put(observation);
  });
}

export async function readReport(
  accountKey: string,
  year: number,
): Promise<StoredReport | undefined> {
  const record = await db.reports.get(reportKey(accountKey, year));
  return record?.version === 1 ? record : undefined;
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
