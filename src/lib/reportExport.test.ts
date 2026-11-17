import { describe, expect, it } from 'vitest';
import { reportAsCsv, reportAsTsv, type ReportExport } from './reportExport';

const report: ReportExport = {
  handle: '@alice@example.org',
  year: 2026,
  analyzedAt: '2026-02-01',
  modelNote: 'Modell',
  headers: ['Jan', 'Feb'],
  rows: [
    { label: 'Reichweite', values: [0, null] },
    { label: '=SUM(1;2)', values: ['-text', -5] },
    { label: 'Zeile\t"Text"', values: ['A;B', 'A\nB'] },
  ],
};

describe('Report-Export', () => {
  it('schützt Formeltexte und erhält Null und fehlende Werte im TSV', () => {
    const text = reportAsTsv(report);
    expect(text).toContain("'@alice@example.org");
    expect(text).toContain('Reichweite\t0\t');
    expect(text).toContain("'=SUM(1;2)\t'-text\t-5");
    expect(text).toContain('Zeile "Text"');
  });

  it('quotiert CSV-Trennzeichen und Zeilenumbrüche', () => {
    const text = reportAsCsv(report);
    expect(text.startsWith('\ufeff')).toBe(true);
    expect(text).toContain('"Zeile\t""Text"""');
    expect(text).toContain('"A;B";"A\nB"');
  });
});
