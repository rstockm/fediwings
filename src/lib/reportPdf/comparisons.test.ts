import { describe, expect, it } from 'vitest';
import { pdfFixture } from './fixtures';
import {
  comparisonEnd,
  prepareAnnualComparison,
  previousYearEnd,
  titleChange,
  titleFollowers,
} from './comparisons';
import { pdfBarColors } from './colors';
import { buildReportDocument } from './document';
import { reportChanges } from '../reportCharts';

const palette = {
  ink: '#17181b',
  paper: '#faf9f5',
  muted: '#5c5a62',
  violet: '#5d4cf0',
  lime: '#c7f36b',
  riseSoft: '#93b873',
  decline: '#ff9d55',
  declineSoft: '#d99a63',
};
const options = {
  title: 'Demo',
  organization: '',
  locale: 'de' as const,
  createdAt: '2026-01-15T12:00:00Z',
};
describe('PDF-Farben und Titelvergleiche', () => {
  it('verwendet Richtung und normierte Intensität der Online-Version', () => {
    const doc = buildReportDocument(pdfFixture(), options),
      series = doc.series[0];
    series.values = [10, 20, 5, 5, ...Array(8).fill(null)];
    series.status = ['closed', 'closed', 'closed', 'current', ...Array(8).fill('future')];
    const colors = pdfBarColors(series, palette),
      changes = reportChanges(series.values.slice(0, 4));
    for (let i = 0; i < 4; i++) expect(colors[i]).toMatchObject(changes[i]);
    expect(colors[2]?.color).toBe(palette.decline);
    expect(colors[3]?.color).toBe(palette.riseSoft);
    expect(colors[4]).toBeNull();
    expect(series.values[4]).toBeNull();
    series.values = [10, 30, ...Array(10).fill(null)];
    series.status = ['closed', 'current', ...Array(10).fill('future')];
    expect(pdfBarColors(series, palette)[1]?.color).toBe(palette.lime);
  });
  it('vergleicht bei Summen das Vorjahr statt Januar und Dezember', () => {
    const s = pdfFixture();
    s.report.total.reach = 200;
    s.annualComparison!.total.reach = 100;
    s.report.months[0].reach = 50;
    s.report.months[11].reach = 55;
    expect(titleChange(s, 'reach')).toMatchObject({
      basis: 'years',
      percent: 100,
      start: 100,
      end: 200,
    });
    s.report.total.interactions = 90;
    s.annualComparison!.total.interactions = 100;
    expect(titleChange(s, 'interactions')?.percent).toBe(-10);
    s.report.total.threads = 50;
    s.annualComparison!.total.threads = 25;
    expect(titleChange(s, 'threads')?.percent).toBe(100);
  });
  it('vergleicht Follower und Engagement von Januar bis Dezember', () => {
    const s = pdfFixture();
    s.community[0].followers = 1000;
    s.community[11].followers = 1500;
    s.report.months[0].engagement = 1;
    s.report.months[11].engagement = 2;
    expect(titleChange(s, 'followers')).toMatchObject({
      basis: 'months',
      percent: 50,
      endMonth: 11,
    });
    expect(titleChange(s, 'engagement')?.percent).toBe(100);
    expect(titleFollowers(s).value).toBe(1500);
    s.followerObservation = { count: 9999, observedAt: '2026-01-15T12:00:00Z' };
    expect(titleFollowers(s).value).toBe(1500);
    const current = pdfFixture('current');
    current.followerObservation = { count: 1700, observedAt: '2025-07-15T11:00:00Z' };
    expect(titleFollowers(current).value).toBe(1700);
    expect(titleChange(current, 'followers')?.endMonth).toBe(5);
  });
  it('erfindet keine Raten bei Null, fehlendem Vorjahr oder Teilständen', () => {
    const s = pdfFixture();
    s.annualComparison!.total.reach = 0;
    expect(titleChange(s, 'reach')).toBeNull();
    s.annualComparison = null;
    expect(titleChange(s, 'threads')).toBeNull();
    s.community[0].followers = null;
    expect(titleChange(s, 'followers')).toBeNull();
    s.report.months[11].reachComplete = false;
    expect(titleChange(s, 'engagement')).toBeNull();
  });
  it('begrenzt Teiljahre auf denselben Berliner Zeitraum und behandelt Schaltjahre', () => {
    expect(comparisonEnd(2025, '2026-04-10T10:00:00Z')).toBe('2025-12-31T22:59:59.999Z');
    expect(previousYearEnd('2025-12-31T22:59:59.999Z')).toBe('2024-12-31T22:59:59.999Z');
    expect(previousYearEnd('2024-02-29T11:30:00Z')).toBe('2023-02-28T11:30:00.000Z');
    const s = pdfFixture('current');
    expect(s.annualComparison?.previousEnd).toBe('2024-07-15T11:00:00.000Z');
  });
  it('vergleicht nur abgedeckte Reaktionswerte bis zum Vorjahresstichtag', () => {
    const s = pdfFixture('current');
    s.report.interactionBasis = 'notification-time';
    s.report.total.interactions = 2;
    s.report.total.interactionsComplete = true;
    s.annualComparison = prepareAnnualComparison(
      s.year,
      s.analyzedAt,
      { posts: [], historyComplete: false, oldestFetchedAt: null, error: null },
      {
        timestamps: [Date.parse('2024-07-15T10:00:00Z'), Date.parse('2024-07-15T12:00:00Z')],
        oldest: Date.parse('2023-12-31T23:00:00Z'),
        observedAt: Date.parse(s.analyzedAt),
      },
    );
    expect(s.annualComparison.total.interactions).toBe(1);
    expect(titleChange(s, 'interactions')?.percent).toBe(100);
    s.annualComparison.total.interactionsComplete = false;
    expect(titleChange(s, 'interactions')).toBeNull();
  });
});
