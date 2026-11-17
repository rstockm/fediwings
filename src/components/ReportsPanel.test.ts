import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPanel from './ReportsPanel.svelte';
import { loadReport } from '../lib/reportLoader';
import { readReport } from '../lib/reportStorage';

const fixture = vi.hoisted(() => ({
  id: '1',
  username: 'alice',
  acct: 'alice',
  display_name: 'Alice',
  url: 'https://test.social/@alice',
  avatar_static: '',
  followers_count: 100,
}));

vi.mock('../lib/api', () => ({ getAccount: vi.fn(async () => fixture) }));
vi.mock('../lib/reportLoader', () => ({
  loadReport: vi.fn(async () => ({
    posts: [],
    historyComplete: false,
    oldestFetchedAt: null,
    error: null,
  })),
}));
vi.mock('../lib/reportStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reportStorage')>();
  return {
    ...actual,
    listFollowerObservations: vi.fn(async () => []),
    readReport: vi.fn(async () => undefined),
  };
});

beforeEach(() => {
  vi.mocked(loadReport).mockClear();
  vi.mocked(readReport).mockReset();
  vi.mocked(readReport).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('ReportsPanel', () => {
  it('lädt den Report beim Öffnen und kennzeichnet unvollständige Daten', async () => {
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report speichern' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Live-Report laden' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Report speichern' })).toBeEnabled();
    expect(screen.getByText('Noch kein gespeicherter Stand für dieses Jahr.')).toBeInTheDocument();
    expect(screen.getAllByText(/Teilstand:/).length).toBeGreaterThan(0);
    expect(screen.getByRole('rowheader', { name: 'Engagement Rate (%)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Der Jahresverlauf' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Engagement Rate (%)' })).toBeInTheDocument();
  });

  it('zeigt einen vorhandenen gespeicherten Stand mit Datum an', async () => {
    vi.mocked(readReport).mockResolvedValue({
      savedAt: '2026-03-01T10:00:00.000Z',
    } as Awaited<ReturnType<typeof readReport>>);
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    await waitFor(() => expect(screen.getByText(/Gespeicherter Stand:/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Gespeicherten Stand löschen' })).toBeEnabled();
  });

  it('bietet die gültigen Jahre als Auswahlliste statt als Zahlen-Spinner an', () => {
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    const select = screen.getByLabelText('Jahr');
    expect(select.tagName).toBe('SELECT');
    const years = [...select.querySelectorAll('option')].map((option) => Number(option.value));
    const currentYear = Number(
      new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(
        new Date(),
      ),
    );
    expect(years[0]).toBe(currentYear);
    expect(years.at(-1)).toBe(2006);
    expect(years).toHaveLength(currentYear - 2006 + 1);
  });

  it('meldet das Kopieren direkt an der Aktionsleiste', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          writes.push(text);
        },
      },
    });
    const { container } = render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
    });
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    await fireEvent.click(screen.getByRole('button', { name: 'Für Excel kopieren' }));

    await waitFor(() => expect(screen.getByText('Tabelle kopiert.')).toBeInTheDocument());
    expect(writes).toHaveLength(1);
    expect(container.querySelector('.reports-action-status')?.textContent).toContain(
      'Tabelle kopiert.',
    );
  });

  it('meldet ein fehlgeschlagenes Kopieren an der Aktionsleiste', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('clipboard unavailable');
        },
      },
    });
    const { container } = render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
    });
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    await fireEvent.click(screen.getByRole('button', { name: 'Für Excel kopieren' }));

    await waitFor(() =>
      expect(screen.getByText('Kopieren fehlgeschlagen. Bitte CSV verwenden.')).toBeInTheDocument(),
    );
    expect(container.querySelector('.reports-action-status-error')).toBeTruthy();
  });

  it('lädt beim Jahreswechsel automatisch neu', async () => {
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    await waitFor(() => expect(vi.mocked(loadReport)).toHaveBeenCalledTimes(1));
    await fireEvent.change(screen.getByLabelText('Jahr'), { target: { value: '2025' } });
    await waitFor(() => expect(vi.mocked(loadReport)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(loadReport).mock.calls[1][3]).toBe(2025);
  });
});
