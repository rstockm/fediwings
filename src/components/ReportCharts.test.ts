import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ReportCharts from './ReportCharts.svelte';

describe('ReportCharts', () => {
  it('zeigt die Farbskala pro Monatsänderung und erklärt die Legende', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan', 'Feb', 'Mär', 'Apr'],
      rows: [{ label: 'Reichweite', values: [10, 20, 15, 35] }],
    });
    const bars = [...container.querySelectorAll<HTMLElement>('.chart-bar')];
    expect(bars.map((bar) => bar.style.getPropertyValue('--bar-accent'))).toEqual([
      'var(--lime)',
      'var(--lime)',
      'var(--chart-decline)',
      'var(--lime)',
    ]);
    expect(bars.map((bar) => bar.style.getPropertyValue('--bar-base'))).toEqual([
      'var(--chart-rise-soft)',
      'var(--chart-rise-soft)',
      'var(--chart-decline-soft)',
      'var(--chart-rise-soft)',
    ]);
    expect(bars.map((bar) => bar.style.getPropertyValue('--bar-intensity'))).toEqual([
      '50%',
      '50%',
      '25%',
      '100%',
    ]);
    expect(screen.getByText(/Grün: mindestens so hoch/)).toBeTruthy();
  });

  it('zählt fehlende Monate als 0 und nennt den Sprung ab null', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan', 'Feb', 'Mär'],
      rows: [{ label: 'Reichweite', values: [null, 30, null] }],
    });
    const bars = [...container.querySelectorAll<HTMLElement>('.chart-bar')];
    expect(bars.map((bar) => bar.style.getPropertyValue('--bar-intensity'))).toEqual([
      '0%',
      '100%',
      '100%',
    ]);
    expect(bars.map((bar) => bar.style.getPropertyValue('--bar-accent'))).toEqual([
      'var(--chart-rise-soft)',
      'var(--lime)',
      'var(--chart-decline)',
    ]);
  });

  it('zeichnet den Mittelwert als gestrichelte Linie und nennt den Wert', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan', 'Feb', 'Mär', 'Apr'],
      rows: [{ label: 'Reichweite', values: [10, 20, 15, 35] }],
    });
    const mean = container.querySelector<HTMLElement>('.chart-mean');
    expect(mean).toBeTruthy();
    expect(mean?.style.top).toBe('50%');
    expect(mean?.textContent).toContain('Ø 20');
    expect(container.querySelector('.chart-meta')?.textContent).toContain('Mittelwert: 20');
  });

  it('behält den Leerhinweis für Reihen ganz ohne Monatswerte', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan', 'Feb'],
      rows: [{ label: 'Reichweite', values: [null, null] }],
    });
    expect(screen.getByText('Noch keine Monatswerte vorhanden.')).toBeTruthy();
    expect(container.querySelector('.chart-mean')).toBeNull();
  });

  it('blendet Monate nach dem laufenden Monat aus', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan*', 'Feb', 'Mär'],
      rows: [{ label: 'Reichweite', values: [10, 20, 30] }],
    });
    expect(container.querySelectorAll('.chart-bar')).toHaveLength(1);
  });
});
