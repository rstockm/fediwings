import type { ReportPdfSnapshot } from './model';
import { comparisonEnd, previousYearEnd } from './comparisons';

/** Synthetic, deterministic fixtures. Never presented as authenticated live data. */
export function pdfFixture(variant = 'complete'): ReportPdfSnapshot {
  const months = Array.from({ length: 12 }, (_, i) => ({
    threads: [12, 13, 14, 12, 16, 17, 15, 19, 20, 22, 21, 23][i],
    interactions: [600, 697, 794, 640, 988, 1085, 930, 1279, 1376, 1570, 1473, 1667][i],
    reach: [18000, 20100, 22200, 19500, 26400, 28500, 24000, 32700, 34800, 39000, 36900, 41100][i],
    engagement: 0,
    counterComplete: true,
    reachComplete: true,
  }));
  for (const month of months) month.engagement = (100 * month.interactions) / month.reach;
  const sum = (key: 'threads' | 'interactions' | 'reach') => months.reduce((s, m) => s + m[key], 0);
  const snapshot: ReportPdfSnapshot = {
    version: 1,
    model: 'net-reach-v1',
    handle: '@demo@example.social',
    displayName: 'Demo · synthetische Beispieldaten',
    year: 2025,
    analyzedAt: '2026-01-15T11:00:00.000Z',
    origin: 'live',
    report: {
      year: 2025,
      months,
      total: {
        threads: sum('threads'),
        interactions: sum('interactions'),
        reach: sum('reach'),
        engagement: (100 * sum('interactions')) / sum('reach'),
        counterComplete: true,
        reachComplete: true,
      },
    },
    months: Array(12).fill('closed'),
    community: months.map((_, i) => ({
      followers: 1200 + i * 44,
      source: i % 2 ? 'reconstructed' : 'observed',
      observedAt: i % 2 ? null : new Date(Date.UTC(2025, i + 1, 0, 12)).toISOString(),
      netChange: i === 0 ? 44 : null,
      follows: 48 + i,
      partial: false,
    })),
    topAvailable: true,
    rankingComplete: true,
    topPosts: Array.from({ length: 5 }, (_, i) => ({
      id: `demo-${i}`,
      createdAt: `2025-${String(i + 2).padStart(2, '0')}-15T12:00:00.000Z`,
      url: `https://example.social/@demo/demo-${i}`,
      excerpt: [
        'Bibliotheken verbinden Menschen, Wissen und neue Perspektiven. Unser Rückblick auf ein Jahr gemeinsamer Projekte und offener Begegnungen.',
        'Ein neuer Raum für Austausch: Heute öffnen wir unsere Türen für Ideen aus der Stadtgesellschaft. Was möchten Sie gemeinsam mit uns gestalten?',
        'Digitale Teilhabe braucht zugängliche Angebote. Wir stellen die nächsten Schritte unseres Programms vor und laden zum Mitmachen ein.',
        'Wissen wächst, wenn wir es teilen. Danke an alle, die diesen offenen Workshop mit Erfahrungen und Fragen bereichert haben.',
        'Eine starke Community entsteht im Dialog. Fünf Einblicke aus unserem Alltag und eine Einladung, die Zukunft gemeinsam zu entwickeln.',
      ][i],
      contentWarning: false,
      sensitive: false,
      reach: 17000 - i * 1000,
      interactions: 500 - i * 50,
      complete: true,
    })),
  };
  if (variant === 'partial') {
    snapshot.report.months[3].reachComplete = false;
    snapshot.report.total.reachComplete = false;
    snapshot.rankingComplete = false;
    snapshot.topPosts[1].complete = false;
    snapshot.community[2].partial = true;
  }
  if (variant === 'large') {
    for (const [i, period] of snapshot.report.months.entries()) {
      period.reach = 80_000_000_000_000 + i * 1_000_000_000;
      period.interactions = 1_000_000_000_000 + i * 1_000_000;
      period.engagement = (100 * period.interactions) / period.reach;
      snapshot.community[i].followers = 9_000_000_000_000 + i * 1_000_000;
    }
    for (const key of ['reach', 'interactions'] as const) {
      snapshot.report.total[key] = snapshot.report.months.reduce(
        (sum, period) => sum + period[key]!,
        0,
      );
    }
    snapshot.report.total.engagement =
      (100 * snapshot.report.total.interactions!) / snapshot.report.total.reach!;
  }
  if (variant === 'current') {
    snapshot.analyzedAt = '2025-07-15T11:00:00.000Z';
    snapshot.months = snapshot.months.map((_, i) =>
      i < 6 ? 'closed' : i === 6 ? 'current' : 'future',
    );
    snapshot.report.months = snapshot.report.months.map((p, i) =>
      i <= 6 ? p : { ...p, reach: null, interactions: null, threads: null, engagement: null },
    );
    snapshot.community = snapshot.community.map((p, i) =>
      i <= 6
        ? p
        : {
            ...p,
            followers: null,
            netChange: null,
            follows: null,
            source: 'missing',
            observedAt: null,
          },
    );
    for (const key of ['threads', 'interactions', 'reach'] as const)
      snapshot.report.total[key] = snapshot.report.months.reduce(
        (sum, p) => sum + (p[key] ?? 0),
        0,
      );
    snapshot.report.total.engagement =
      (100 * snapshot.report.total.interactions!) / snapshot.report.total.reach!;
  }
  if (variant === 'legacy' || variant === 'empty') {
    snapshot.community = snapshot.community.map(() => ({
      followers: null,
      source: 'missing',
      observedAt: null,
      netChange: null,
      follows: null,
      partial: false,
    }));
    snapshot.topPosts = [];
    if (variant === 'legacy') {
      snapshot.origin = 'legacy';
      snapshot.topAvailable = false;
    } else {
      snapshot.report.months = snapshot.report.months.map((p) => ({
        ...p,
        reach: 0,
        interactions: 0,
        threads: 0,
        engagement: null,
      }));
      snapshot.report.total = { ...snapshot.report.months[0] };
    }
  }
  if (variant !== 'legacy') {
    const currentEnd = comparisonEnd(snapshot.year, snapshot.analyzedAt);
    snapshot.annualComparison = {
      year: snapshot.year - 1,
      analyzedAt: snapshot.analyzedAt,
      currentEnd,
      previousEnd: previousYearEnd(currentEnd),
      total: {
        ...snapshot.report.total,
        reach: snapshot.report.total.reach! / 1.25,
        interactions: snapshot.report.total.interactions! / 0.9,
        threads: Math.round(snapshot.report.total.threads! * 0.8),
        counterComplete: true,
        reachComplete: true,
      },
    };
  }
  return snapshot;
}
