export interface ReportBar {
  value: number | null;
  top: number;
  height: number;
}

export interface ReportChange {
  direction: 'up' | 'down' | 'neutral';
  intensity: number;
}

/** Missing values count as zero; January compares against a zero baseline. */
export function reportChanges(values: Array<number | null>): ReportChange[] {
  const number = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const differences = values.map((value, index) => {
    return number(value) - number(values[index - 1]);
  });
  const maximum = Math.max(0, ...differences.map((value) => Math.abs(value ?? 0)));
  return differences.map((difference) => ({
    direction: difference === null || difference === 0 ? 'neutral' : difference > 0 ? 'up' : 'down',
    intensity: maximum === 0 || difference === null ? 0 : Math.abs(difference) / maximum,
  }));
}

function chartScale(values: Array<number | null>): {
  min: number;
  max: number;
  step: number;
} {
  const numbers = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const lowest = Math.min(0, ...numbers);
  const highest = Math.max(0, ...numbers);
  const rawStep = (highest - lowest) / 4;
  if (rawStep === 0) return { min: 0, max: 0, step: 0 };
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = [1, 2, 2.5, 5, 10].find((item) => item >= normalized) ?? 10;
  const step = factor * magnitude;
  return {
    min: Number((Math.floor(lowest / step) * step).toPrecision(12)),
    max: Number((Math.ceil(highest / step) * step).toPrecision(12)),
    step,
  };
}

export function reportScaleTicks(values: Array<number | null>): Array<{
  value: number;
  top: number;
}> {
  const { min, max, step } = chartScale(values);
  if (min === max) return [{ value: 0, top: 100 }];
  const steps = Math.round((max - min) / step);
  return Array.from({ length: steps + 1 }, (_, index) => ({
    value: Number((max - index * step).toPrecision(12)),
    top: (index / steps) * 100,
  }));
}

export interface ReportMean {
  value: number;
  top: number;
}

/** Arithmetic mean of all finite values; missing values are ignored. */
export function reportMean(values: Array<number | null>): ReportMean | null {
  const numbers = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (numbers.length === 0) return null;
  const { min, max } = chartScale(values);
  const range = max - min || 1;
  const value = numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
  return {
    value,
    top: max === min ? 100 : ((max - value) / range) * 100,
  };
}

export function reportBars(values: Array<number | null>): {
  baseline: number;
  bars: ReportBar[];
} {
  const { min, max } = chartScale(values);
  const range = max - min || 1;
  const baseline = max === min ? 100 : (max / range) * 100;
  return {
    baseline,
    bars: values.map((value) =>
      value === null || !Number.isFinite(value)
        ? { value: null, top: baseline, height: 0 }
        : {
            value,
            top: max === min ? baseline : ((max - Math.max(value, 0)) / range) * 100,
            height: (Math.abs(value) / range) * 100,
          },
    ),
  };
}
