export interface PdfAxis {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

function round(value: number): number {
  return Number(value.toPrecision(12));
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = [1, 2, 2.5, 5, 10].find((item) => item >= normalized) ?? 10;
  return factor * magnitude;
}

function withTicks(min: number, max: number, step: number): PdfAxis {
  const ticks: number[] = [];
  for (let value = min; value <= max + step * 1e-9; value += step) ticks.push(round(value));
  return { min: round(min), max: round(max), step: round(step), ticks };
}

/**
 * Rounded chart axis. Monthly count charts start at zero. Follower levels barely
 * move within a year, so that chart uses a padded window around the shown values.
 * The window is printed on the axis and the table keeps every absolute value.
 */
export function chartAxis(values: Array<number | null>, zoomed = false): PdfAxis {
  const numbers = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (!numbers.length) return withTicks(0, 1, 1);
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  if (zoomed) {
    if (low === high) {
      const padding = Math.max(1, Math.abs(low) * 0.02);
      const min = Math.max(0, low - padding);
      const max = high + padding;
      return withTicks(min, max, niceStep((max - min) / 3));
    }
    const step = niceStep((high - low) / 3);
    const min = Math.max(0, Math.floor((low - step / 2) / step) * step);
    const max = Math.ceil((high + step / 2) / step) * step;
    return withTicks(min, max, step);
  }
  const step = niceStep(Math.max(1, high) / 5);
  if (high <= 0) return withTicks(0, 1, 1);
  const max = Math.ceil(high / step) * step;
  return withTicks(0, max, step);
}

const suffixes: Record<'de' | 'en', Array<[number, string]>> = {
  de: [
    [1e12, 'Bio.'],
    [1e9, 'Mrd.'],
    [1e6, 'Mio.'],
    [1e3, 'Tsd.'],
  ],
  en: [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ],
};

const integer = (locale: 'de' | 'en', digits = 0) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/**
 * Axis labels stay short and readable: small values are printed in full,
 * larger ones use a localised thousand/million/billion suffix. Decimal places
 * follow the tick distance, so neighbouring ticks never collapse to one label.
 */
export function axisLabels(axis: PdfAxis, locale: 'de' | 'en'): string[] {
  const magnitude = Math.max(Math.abs(axis.min), Math.abs(axis.max), axis.step);
  const match =
    magnitude >= 1e4 ? suffixes[locale].find(([scale]) => magnitude >= scale) : undefined;
  const divisor = match?.[0] ?? 1;
  const suffix = match?.[1] ?? '';
  const ratio = axis.step / divisor;
  let decimals = ratio >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(ratio)) + 1);
  const formatted = (value: number, digits: number) =>
    value === 0
      ? '0'
      : `${integer(locale, digits).format(value / divisor)}${suffix ? ` ${suffix}` : ''}`;
  while (
    decimals < 6 &&
    new Set(axis.ticks.map((tick) => formatted(tick, decimals))).size < axis.ticks.length
  )
    decimals += 1;
  return axis.ticks.map((tick) => formatted(tick, decimals));
}
