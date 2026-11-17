import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ReportCharts from './ReportCharts.svelte';

const labels = ['Jan', 'Feb', 'Mär', 'Apr'];

describe('ReportCharts', () => {
  it('zeigt die Farbskala pro Monatsänderung und erklärt die Legende', () => {
    const { container } = render(ReportCharts, {
      labels,
      rows: [{ key: 'reach', label: 'Reichweite', values: [10, 20, 15, 35] }],
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
      rows: [{ key: 'reach', label: 'Reichweite', values: [null, 30, null] }],
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

  it('zeichnet die Mittelwertlinie ohne Beschriftung und nennt den Wert oben rechts', () => {
    const { container } = render(ReportCharts, {
      labels,
      rows: [{ key: 'reach', label: 'Reichweite', values: [10, 20, 15, 35] }],
    });
    const mean = container.querySelector<HTMLElement>('.chart-mean');
    expect(mean).toBeTruthy();
    expect(mean?.style.top).toBe('50%');
    expect(mean?.textContent?.trim()).toBe('');
    const label = container.querySelector<HTMLElement>('.chart-card-head .chart-mean-value');
    expect(label?.textContent).toContain('Mittelwert: 20');
    expect(label?.parentElement?.querySelector('h4')?.textContent).toBe('Reichweite');
  });

  it('rundet Mittelwerte von Wachstum, Reichweite und Interaktionen auf ganze Zahlen', () => {
    const { container } = render(ReportCharts, {
      labels,
      rows: [
        { key: 'growth', label: 'Follower-Wachstum', values: [1, 2, 2, 4] },
        { key: 'reach', label: 'Reichweite', values: [10, 11, 12, 12] },
        { key: 'interactions', label: 'Interaktionen', values: [3, 4, 4, 5] },
      ],
    });
    const values = [...container.querySelectorAll<HTMLElement>('.chart-mean-value')].map((node) =>
      node.textContent?.trim(),
    );
    expect(values).toEqual(['Mittelwert: 2', 'Mittelwert: 11', 'Mittelwert: 4']);
  });

  it('lässt den Mittelwert beim absoluten Follower-Stand weg', () => {
    const { container } = render(ReportCharts, {
      labels,
      rows: [{ key: 'followers', label: 'Follower', values: [990, 995, 997, 1000] }],
    });
    expect(container.querySelector('.chart-mean')).toBeNull();
    expect(container.querySelector('.chart-mean-value')).toBeNull();
    expect(container.querySelector('.chart-meta')?.textContent).toContain('Höchster Monatswert');
  });

  it('behält den Leerhinweis für Reihen ganz ohne Monatswerte', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan', 'Feb'],
      rows: [{ key: 'reach', label: 'Reichweite', values: [null, null] }],
    });
    expect(screen.getByText('Noch keine Monatswerte vorhanden.')).toBeTruthy();
    expect(container.querySelector('.chart-mean')).toBeNull();
  });

  it('blendet Monate nach dem laufenden Monat aus', () => {
    const { container } = render(ReportCharts, {
      labels: ['Jan*', 'Feb', 'Mär'],
      rows: [{ key: 'reach', label: 'Reichweite', values: [10, 20, 30] }],
    });
    expect(container.querySelectorAll('.chart-bar')).toHaveLength(1);
  });
});
