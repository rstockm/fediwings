import { describe, expect, it } from 'vitest';
import {
  decodeStoredReport,
  followerGrowth,
  monthEndFollowers,
  reportAccountKey,
  reportKey,
  type StoredReport,
} from './reportStorage';
import { pdfFixture } from './reportPdf/fixtures';

describe('report storage', () => {
  it('liest V1 und V2, prüft Snapshotzuordnung und übernimmt keine fremden Metadaten', () => {
    const snapshot = pdfFixture();
    const base = {
      key: reportKey('a', 2025),
      accountKey: 'a',
      handle: snapshot.handle,
      savedAt: snapshot.analyzedAt,
      analyzedAt: snapshot.analyzedAt,
      model: 'net-reach-v1' as const,
      report: snapshot.report,
    };
    const legacy: StoredReport = { ...base, version: 1 };
    expect(decodeStoredReport(legacy, 'a', 2025)).toEqual(legacy);
    const current: StoredReport = {
      ...base,
      version: 2,
      pdfSnapshot: { ...snapshot, accessToken: 'secret' } as typeof snapshot,
    };
    const parsed = decodeStoredReport(current, 'a', 2025);
    expect(parsed?.version).toBe(2);
    expect(parsed?.version === 2 && parsed.pdfSnapshot).not.toHaveProperty('accessToken');
    expect(decodeStoredReport(current, 'b', 2025)).toBeUndefined();
    expect(decodeStoredReport(current, 'a', 2026)).toBeUndefined();
    expect(
      decodeStoredReport({ ...current, pdfSnapshot: { ...snapshot, year: 2026 } }, 'a', 2025),
    ).toBeUndefined();
  });
  it('trennt Accounts, Instanzen und Jahre ohne Kollisionen', () => {
    const a = reportAccountKey('https://a.social', '1');
    const b = reportAccountKey('https://b.social', '1');
    expect(a).not.toBe(b);
    expect(reportKey(a, 2025)).not.toBe(reportKey(a, 2026));
  });

  it('wertet nur echte Berliner Monatsendtage und nimmt den letzten Stand', () => {
    const months = monthEndFollowers(
      [
        { accountKey: 'a', observedAt: '2026-01-30T23:30:00Z', followers: 10 },
        { accountKey: 'a', observedAt: '2026-01-31T20:00:00Z', followers: 12 },
        { accountKey: 'a', observedAt: '2026-02-01T00:00:00Z', followers: 100 },
        { accountKey: 'a', observedAt: 'invalid', followers: 99 },
      ],
      2026,
    );
    expect(months[0]).toEqual({ count: 12, observedAt: '2026-01-31T20:00:00Z' });
    expect(months[1]).toBeNull();
  });

  it('berechnet Netto-Wachstum aus aufeinanderfolgenden Monatsendständen', () => {
    const data = [
      { accountKey: 'a', observedAt: '2025-12-31T20:00:00Z', followers: 100 },
      { accountKey: 'a', observedAt: '2026-01-31T20:00:00Z', followers: 90 },
      { accountKey: 'a', observedAt: '2026-03-31T20:00:00Z', followers: 120 },
    ];
    expect(followerGrowth(data, 2026).slice(0, 3)).toEqual([-10, null, null]);
  });
});
