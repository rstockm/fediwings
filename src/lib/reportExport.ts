export type ExportCell = string | number | null;

export interface ReportExport {
  handle: string;
  year: number;
  analyzedAt: string;
  modelNote: string;
  locale?: 'de' | 'en';
  headers: string[];
  rows: Array<{ label: string; values: ExportCell[] }>;
}

function safeText(text: string): string {
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text;
}

function exportRows(report: ReportExport): ExportCell[][] {
  return [
    ['Account', report.handle],
    ['Jahr / Year', report.year],
    ['Datenstand / As of', report.analyzedAt],
    [report.modelNote],
    ['', ...report.headers],
    ...report.rows.map((row) => [row.label, ...row.values]),
  ];
}

function value(cell: ExportCell, locale: 'de' | 'en'): string {
  return cell === null
    ? ''
    : typeof cell === 'number'
      ? new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 }).format(cell)
      : safeText(cell);
}

export function reportAsTsv(report: ReportExport): string {
  return exportRows(report)
    .map((row) =>
      row.map((cell) => value(cell, report.locale ?? 'de').replace(/[\t\r\n]/gu, ' ')).join('\t'),
    )
    .join('\r\n');
}

export function reportAsCsv(report: ReportExport): string {
  return (
    '\ufeff' +
    exportRows(report)
      .map((row) =>
        row.map((cell) => `"${value(cell, report.locale ?? 'de').replace(/"/gu, '""')}"`).join(';'),
      )
      .join('\r\n')
  );
}
