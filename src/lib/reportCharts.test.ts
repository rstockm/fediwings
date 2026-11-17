import { describe, expect, it } from 'vitest';
import { reportBars, reportChanges, reportMean, reportScaleTicks } from './reportCharts';

describe('reportMean', () => {
  it('mittelt die sichtbaren Monatswerte und verortet den Mittelwert auf der Achse', () => {
    expect(reportMean([10, 20, 15, 35])).toEqual({ value: 20, top: 50 });
  });

  it('behandelt negative Werte relativ zur Nullachse', () => {
    expect(reportMean([-10, 10])).toEqual({ value: 0, top: 50 });
  });

  it('ignoriert fehlende Werte und liefert ohne Zahlen keinen Mittelwert', () => {
    expect(reportMean([0, null])).toEqual({ value: 0, top: 100 });
    expect(reportMean([null, null])).toBeNull();
  });
});

describe('reportBars', () => {
  it('skaliert positive und negative Werte getrennt von fehlenden Werten', () => {
    const result = reportBars([20, -10, 0, null]);
    expect(result.baseline).toBeCloseTo(200 / 3);
    expect(result.bars[0]).toMatchObject({ top: 0 });
    expect(result.bars[1].top).toBeCloseTo(result.baseline);
    expect(result.bars[1].height).toBeCloseTo(100 / 3);
    expect(result.bars[2].value).toBe(0);
    expect(result.bars[3].value).toBeNull();
  });

  it('behandelt ausschließlich null oder fehlende Werte ohne Division durch null', () => {
    expect(reportBars([0, null])).toEqual({
      baseline: 100,
      bars: [
        { value: 0, top: 100, height: 0 },
        { value: null, top: 100, height: 0 },
      ],
    });
  });

  it('beschriftet die Skala passend für positive, negative und reine Nullwerte', () => {
    expect(reportScaleTicks([20, -20])).toEqual([
      { value: 20, top: 0 },
      { value: 10, top: 25 },
      { value: 0, top: 50 },
      { value: -10, top: 75 },
      { value: -20, top: 100 },
    ]);
    expect(reportScaleTicks([0, null])).toEqual([{ value: 0, top: 100 }]);
  });

  it('verwendet runde Skalen und skaliert Balken und Achse identisch', () => {
    const ticks = reportScaleTicks([244881]);
    expect(ticks.map((tick) => tick.value)).toEqual([300000, 200000, 100000, 0]);
    expect(ticks[1].top).toBeCloseTo(100 / 3);
    expect(ticks[2].top).toBeCloseTo(200 / 3);
    expect(reportBars([244881]).bars[0].height).toBeCloseTo((244881 / 300000) * 100);
  });
});

describe('reportChanges', () => {
  it('skaliert Anstieg und Rückgang am größten absoluten Monatsunterschied', () => {
    expect(reportChanges([10, 20, 15, 35])).toEqual([
      { direction: 'up', intensity: 0.5 },
      { direction: 'up', intensity: 0.5 },
      { direction: 'down', intensity: 0.25 },
      { direction: 'up', intensity: 1 },
    ]);
  });

  it('zählt fehlende Monate als null und unveränderte Werte als neutral', () => {
    expect(reportChanges([null, 5, 5, null, 0, -2])).toEqual([
      { direction: 'neutral', intensity: 0 },
      { direction: 'up', intensity: 1 },
      { direction: 'neutral', intensity: 0 },
      { direction: 'down', intensity: 1 },
      { direction: 'neutral', intensity: 0 },
      { direction: 'down', intensity: 0.4 },
    ]);
  });

  it('behandelt reine Nulländerungen ohne Division durch null', () => {
    expect(reportChanges([0, 0, 0]).every((change) => change.intensity === 0)).toBe(true);
  });
});
