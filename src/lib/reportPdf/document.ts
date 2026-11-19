import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { reportInsights } from './insights';
import { cleanText, type PdfOptions, type ReportPdfSnapshot } from './model';

export type PdfCopy = typeof de.reports.pdf;
export interface PdfSeries {
  id: string;
  tableId: string;
  label: string;
  unit: string;
  values: Array<number | null>;
  status: Array<'closed' | 'current' | 'future'>;
  partial: boolean[];
  strictCoverage?: boolean;
}
export interface ReportDocument {
  snapshot: ReportPdfSnapshot;
  options: PdfOptions;
  copy: PdfCopy;
  series: PdfSeries[];
  insights: string[];
}

export function buildReportDocument(
  snapshot: ReportPdfSnapshot,
  options: PdfOptions,
): ReportDocument {
  const base = (options.locale === 'en' ? en.reports.pdf : de.reports.pdf) as PdfCopy;
  const copy: PdfCopy = snapshot.report.interactionBasis
    ? {
        ...base,
        engagement: base.threadEngagement,
        rate: base.threadRate,
        interactionDefinition: base.notificationDefinition,
      }
    : base;
  const number = (value: number) =>
    new Intl.NumberFormat(options.locale, { maximumFractionDigits: 1 }).format(value);
  const month = (i: number) =>
    new Intl.DateTimeFormat(options.locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(snapshot.year, i, 1)),
    );
  const series: PdfSeries[] = (['reach', 'interactions', 'threads'] as const).map((key) => ({
    id: `chart-${key}`,
    tableId: 'table-months',
    label: copy[key],
    unit: copy.count,
    values: snapshot.report.months.map((p) => p[key]),
    status: [...snapshot.months],
    strictCoverage: key === 'interactions' && Boolean(snapshot.report.interactionBasis),
    partial: snapshot.report.months.map((p) =>
      key === 'reach'
        ? !p.reachComplete
        : key === 'interactions'
          ? !(p.interactionsComplete ?? p.counterComplete)
          : !p.counterComplete,
    ),
  }));
  if (snapshot.community.some((p) => p.followers !== null))
    series.push({
      id: 'chart-followers',
      tableId: 'table-months',
      label: copy.followers,
      unit: copy.count,
      values: snapshot.community.map((p) => p.followers),
      status: [...snapshot.months],
      partial: snapshot.community.map((p) => p.partial && p.source === 'reconstructed'),
    });
  const insights = reportInsights(snapshot).map((insight) => {
    const vars: Record<string, string> =
      insight.key === 'peak'
        ? {
            month: month(insight.month),
            value: number(insight.value),
            percent: number(insight.percent),
          }
        : insight.key === 'reachChange'
          ? {
              month: month(insight.month),
              previous: month(insight.previous),
              percent: `${insight.percent > 0 ? '+' : ''}${number(insight.percent)}`,
            }
          : { value: number(insight.value), previous: number(insight.previous) };
    return copy[insight.key].replace(/\{(\w+)\}/gu, (_, key: string) => vars[key] ?? '');
  });
  return {
    snapshot,
    copy,
    series,
    insights,
    options: {
      ...options,
      title: cleanText(options.title, 120) || copy.defaultTitle,
      organization: cleanText(options.organization, 100),
    },
  };
}

/** Table and chart read this same series, never independently formatted API data. */
export function seriesTableRows(series: PdfSeries) {
  return series.values.map((value, month) => ({
    month,
    value,
    unit: series.unit,
    status: series.status[month],
    partial: series.partial[month],
  }));
}
