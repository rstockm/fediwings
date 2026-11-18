import { describe, expect, it } from 'vitest';
import { aggregateReport } from '../reports';
import { initialReach } from '../reach';
import type { MastodonStatus, PostReach } from '../types';
import { buildReportDocument, seriesTableRows } from './document';
import { pdfFixture } from './fixtures';
import { reportInsights } from './insights';
import { cleanText, pdfSnapshotSchema, safePdfUrl } from './model';
import { plainText, preparePdfSnapshot, selectTopPosts } from './prepare';
import { pdfDefinition } from './render';
import { pdfText } from './glyphs';

function post(id = '1', overrides: Partial<MastodonStatus> = {}): PostReach {
  const status: MastodonStatus = {
    id,
    created_at: '2025-02-01T12:00:00Z',
    url: `https://example.social/@demo/${id}`,
    content: '<p>Ein öffentlicher Beitrag</p>',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 5,
    reblogs_count: 2,
    replies_count: 3,
    quotes_count: 4,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
    ...overrides,
  };
  return {
    ...initialReach(
      { status, threadStatuses: [status], threadSize: 1, threadTruncated: false },
      100,
    ),
    state: 'complete',
    netReach: 50,
  };
}
const options = {
  title: 'Jahresreport',
  organization: 'Demo',
  locale: 'de' as const,
  createdAt: '2026-01-15T12:00:00Z',
};

describe('PDF-Daten und Top 5', () => {
  it('prüft versionierte Snapshots und entfernt fremde Metadaten', () => {
    const s = pdfFixture();
    expect(pdfSnapshotSchema.parse({ ...s, accessToken: 'secret' })).not.toHaveProperty(
      'accessToken',
    );
    expect(
      pdfSnapshotSchema.safeParse({ ...s, topPosts: Array(6).fill(s.topPosts[0]) }).success,
    ).toBe(false);
    expect(pdfSnapshotSchema.safeParse({ ...s, report: { ...s.report, months: [] } }).success).toBe(
      false,
    );
  });
  it('zählt alle Report-Interaktionen, dedupliziert und sortiert deterministisch', () => {
    const a = post('a'),
      b = post('b'),
      c = post('c', { created_at: '2025-03-01T12:00:00Z' }),
      d = post('d', { favourites_count: 6 });
    const e = { ...post('e'), netReach: 51 };
    expect(
      selectTopPosts(
        [
          a,
          b,
          c,
          d,
          e,
          a,
          post('private', { visibility: 'private' }),
          post('old', { created_at: '2024-01-01T00:00:00Z' }),
        ],
        2025,
      ).map((p) => p.id),
    ).toEqual(['e', 'd', 'c', 'a', 'b']);
    expect(selectTopPosts([a], 2025)[0].interactions).toBe(14);
    expect(selectTopPosts([], 2025)).toEqual([]);
    expect(selectTopPosts([a, b, c, d], 2025)).toHaveLength(4);
    expect(selectTopPosts([a, b, c, d, e, post('f')], 2025)).toHaveLength(5);
  });
  it('verwendet Berliner Jahresgrenzen und Root-Datum', () => {
    expect(
      selectTopPosts([post('boundary', { created_at: '2024-12-31T23:30:00Z' })], 2025),
    ).toHaveLength(1);
  });
  it('übernimmt keine aktiven Inhalte, unsicheren Links oder sensiblen Auszüge', () => {
    expect(
      plainText('<script>alert(1)</script><p>A &amp; B</p><img src=x onerror=alert(1)><p>C</p>'),
    ).toBe('A & B C');
    expect(
      selectTopPosts([post('cw', { spoiler_text: 'Warnung', content: 'privater Auszug' })], 2025)[0]
        .excerpt,
    ).toBe('Warnung');
    expect(selectTopPosts([post('s', { sensitive: true })], 2025)[0].excerpt).toBe('');
    expect(safePdfUrl('javascript:alert(1)')).toBeNull();
    expect(safePdfUrl('https://user:pass@example.social')).toBeNull();
    expect(safePdfUrl(null)).toBeNull();
    expect(cleanText('A\u0000B')).toBe('A B');
    expect(Array.from(plainText('😀'.repeat(300)))).toHaveLength(240);
  });
  it('übernimmt Aggregate und Quellen ohne falsches Nettowachstum', () => {
    const posts = [post()];
    const report = aggregateReport(2025, posts, new Date('2025-03-15T12:00:00Z'));
    const s = preparePdfSnapshot({
      handle: 'demo',
      displayName: 'Demo',
      report,
      posts,
      analyzedAt: '2025-03-15T12:00:00Z',
      observations: [
        { accountKey: 'a', observedAt: '2024-12-31T12:00:00Z', followers: 100 },
        { accountKey: 'a', observedAt: '2025-01-31T12:00:00Z', followers: 90 },
      ],
      history: {
        partial: true,
        monthly: [{ month: '2025-02', count: 6 }],
        anchored: {
          months: ['2025-02'],
          points: [90, 96],
          start: 90,
          current: 96,
          totalFollows: 6,
          historyIncomplete: true,
        },
      },
    });
    expect(s.report).toEqual(report);
    expect(s.months.slice(0, 4)).toEqual(['closed', 'closed', 'current', 'future']);
    expect(s.community[0]).toMatchObject({ followers: 90, source: 'observed', netChange: -10 });
    expect(s.community[1]).toMatchObject({ source: 'reconstructed', follows: 6, netChange: null });
    expect(s.community[3].followers).toBeNull();
    expect(s.report.total.engagement).toBe(28);
  });
  it('erfindet keine historischen Zusatzdaten für Legacy-Reports', () => {
    const s = preparePdfSnapshot({
      handle: 'demo',
      displayName: 'Demo',
      report: pdfFixture().report,
      analyzedAt: '2026-01-15T12:00:00Z',
      legacy: true,
      observations: [{ accountKey: 'a', observedAt: '2025-01-31T12:00:00Z', followers: 999 }],
    });
    expect(s.topAvailable).toBe(false);
    expect(s.community.every((p) => p.followers === null)).toBe(true);
  });
});

describe('PDF-Redaktion und Tabellenvertrag', () => {
  it('baut höchstens drei belastbare Kernaussagen', () => {
    expect(reportInsights(pdfFixture())).toHaveLength(3);
    const s = pdfFixture('partial');
    expect(reportInsights(s).some((p) => p.key === 'peak')).toBe(false);
    const empty = pdfFixture('empty');
    expect(reportInsights(empty).some((p) => p.key === 'peak' || p.key === 'reachChange')).toBe(
      false,
    );
    const tied = pdfFixture();
    tied.report.months[10].interactions = tied.report.months[11].interactions;
    expect(reportInsights(tied).some((p) => p.key === 'peak')).toBe(false);
    const current = pdfFixture('current');
    expect(
      reportInsights(current)
        .filter((p) => 'month' in p)
        .every((p) => 'month' in p && p.month < 6),
    ).toBe(true);
  });
  it.each(['complete', 'current', 'partial', 'empty', 'legacy'])(
    'deckt sämtliche Grafikdaten tabellarisch ab: %s',
    (variant) => {
      const doc = buildReportDocument(pdfFixture(variant), options);
      for (const series of doc.series) {
        expect(['table-months', 'table-community']).toContain(series.tableId);
        expect(seriesTableRows(series)).toEqual(
          series.values.map((value, month) => ({
            month,
            value,
            unit: series.unit,
            status: series.status[month],
            partial: series.partial[month],
          })),
        );
      }
    },
  );
  it('lokalisiert und begrenzt Titel ohne HTML-Ausführung', () => {
    const de = buildReportDocument(pdfFixture(), options);
    const en = buildReportDocument(pdfFixture(), {
      ...options,
      locale: 'en',
      title: 'A'.repeat(200),
    });
    expect(en.options.title).toHaveLength(120);
    expect(en.copy.reach).toBe('FediWings reach');
    expect(de.insights[0]).toContain('Interaktionsschwerpunkt');
    expect(en.insights[0]).toContain('Interaction focus');
  });
  it('gibt fehlende Schriftzeichen sichtbar aus und rendert jede Tabellenzelle aus der zugehörigen Reihe', () => {
    expect(pdfText('Ää ß 😀 中')).toBe('Ää ß [U+1F600] [U+4E2D]');
    const doc = buildReportDocument(pdfFixture('partial'), options);
    const definition = pdfDefinition(doc, {
      ink: '#17181b',
      paper: '#faf9f5',
      muted: '#5c5a62',
      violet: '#5d4cf0',
      lime: '#c7f36b',
      riseSoft: '#93b873',
      decline: '#ff9d55',
      declineSoft: '#d99a63',
    });
    const nodes = (Array.isArray(definition.content) ? definition.content : []) as unknown as Array<
      Record<string, unknown>
    >;
    const tables = nodes
      .filter((node) => typeof node === 'object' && node !== null && 'table' in node)
      .map((node) => node.table as { body: Array<Array<{ text: string }>> });
    for (const series of doc.series) {
      const table = tables[series.tableId === 'table-months' ? 0 : 1];
      const column =
        series.tableId === 'table-months'
          ? doc.series.filter((s) => s.tableId === 'table-months').indexOf(series) + 1
          : 1;
      for (const row of seriesTableRows(series)) {
        const expected =
          row.status === 'future'
            ? ''
            : `${row.value === null ? '—' : new Intl.NumberFormat('de', { maximumFractionDigits: 0 }).format(row.value)}${row.partial ? ' !' : ''}`;
        expect(table.body[row.month + 1][column].text).toBe(expected);
      }
    }
  });
});
