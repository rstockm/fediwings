import { reportChanges } from '../reportCharts';
import type { PdfSeries } from './document';
import type { PdfPalette } from './layout';

/** Equivalent to the online chart's color-mix(in srgb, accent N%, base). */
function mix(accent: string, base: string, percent: number): string {
  const channel = (color: string, offset: number) => parseInt(color.slice(offset, offset + 2), 16);
  return (
    '#' +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          (channel(accent, offset) * percent) / 100 + channel(base, offset) * (1 - percent / 100),
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export function pdfBarColors(series: PdfSeries, palette: PdfPalette) {
  const future = series.status.indexOf('future');
  const changes = reportChanges(series.values.slice(0, future < 0 ? series.values.length : future));
  return series.values.map((value, index) => {
    if (value === null || series.status[index] === 'future') return null;
    const change = changes[index];
    const down = change.direction === 'down';
    const base = down ? palette.declineSoft : palette.riseSoft;
    const accent = down
      ? palette.decline
      : change.direction === 'up'
        ? palette.lime
        : palette.riseSoft;
    const color = mix(accent, base, Math.round(change.intensity * 100));
    return { ...change, color, shade: mix(color, palette.ink, 88) };
  });
}
