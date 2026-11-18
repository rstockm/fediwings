import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPanel from './ReportsPanel.svelte';
import { loadReport } from '../lib/reportLoader';
import { readReport } from '../lib/reportStorage';
import { pdfFixture } from '../lib/reportPdf/fixtures';

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
  REPORT_CACHE_MS: 300_000,
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
  vi.mocked(loadReport).mockResolvedValue({
    posts: [],
    historyComplete: false,
    oldestFetchedAt: null,
    error: null,
  });
  vi.mocked(readReport).mockReset();
  vi.mocked(readReport).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('ReportsPanel', () => {
  it('erhält den PDF-Export bei fehlgeschlagenem Vorjahresabruf', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
    vi.mocked(loadReport).mockResolvedValue({
      posts: [],
      historyComplete: true,
      oldestFetchedAt: null,
      error: null,
    });
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'PDF-Bericht erstellen' })).toBeEnabled(),
    );
    vi.mocked(loadReport).mockRejectedValueOnce(new Error('previous-year unavailable'));
    await fireEvent.click(screen.getByRole('button', { name: 'PDF-Bericht erstellen' }));
    await waitFor(() =>
      expect(screen.getByText(/Vorjahresdaten sind nicht verfügbar/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Vorschau erstellen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'CSV herunterladen' })).toBeEnabled();
  });
  it('bricht einen laufenden Vorjahresabruf beim Schließen ab', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
    vi.mocked(loadReport).mockResolvedValue({
      posts: [],
      historyComplete: true,
      oldestFetchedAt: null,
      error: null,
    });
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'PDF-Bericht erstellen' })).toBeEnabled(),
    );
    let signal!: AbortSignal;
    vi.mocked(loadReport).mockImplementationOnce(
      (_o, _a, _f, _y, active) =>
        new Promise((_resolve, reject) => {
          signal = active;
          active.addEventListener('abort', () =>
            reject(new DOMException('Abgebrochen', 'AbortError')),
          );
        }),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'PDF-Bericht erstellen' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Vorschau erstellen' })).toBeDisabled(),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(signal.aborted).toBe(true);
  });
  it('lädt das Vorjahr erst beim PDF-Start und verwendet es anschließend erneut', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
    vi.mocked(loadReport).mockResolvedValue({
      posts: [],
      historyComplete: true,
      oldestFetchedAt: null,
      error: null,
    });
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'PDF-Bericht erstellen' })).toBeEnabled(),
    );
    expect(loadReport).toHaveBeenCalledTimes(1);
    const selectedYear = Number((screen.getByLabelText('Jahr') as HTMLSelectElement).value);
    await fireEvent.click(screen.getByRole('button', { name: 'PDF-Bericht erstellen' }));
    await waitFor(() => expect(loadReport).toHaveBeenCalledTimes(2));
    expect(vi.mocked(loadReport).mock.calls[1][3]).toBe(selectedYear - 1);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Vorschau erstellen' })).toBeEnabled(),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await fireEvent.click(screen.getByRole('button', { name: 'PDF-Bericht erstellen' }));
    expect(loadReport).toHaveBeenCalledTimes(2);
  });
  it('verwirft einen verspätet geöffneten gespeicherten Stand nach Jahreswechsel', async () => {
    render(ReportsPanel, { account: fixture, origin: 'https://test.social', platform: null });
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const selectedYear = Number((screen.getByLabelText('Jahr') as HTMLSelectElement).value);
    let finish!: (value: Awaited<ReturnType<typeof readReport>>) => void;
    vi.mocked(readReport).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const calls = vi.mocked(readReport).mock.calls.length;
    await fireEvent.click(screen.getByRole('button', { name: 'Gespeicherten Stand öffnen' }));
    await waitFor(() => expect(vi.mocked(readReport).mock.calls.length).toBe(calls + 1));
    await fireEvent.change(screen.getByLabelText('Jahr'), {
      target: { value: String(selectedYear - 1) },
    });
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const snapshot = pdfFixture();
    finish({
      version: 1,
      key: 'a',
      accountKey: 'a',
      handle: fixture.acct,
      savedAt: snapshot.analyzedAt,
      analyzedAt: snapshot.analyzedAt,
      model: 'net-reach-v1',
      report: { ...snapshot.report, year: selectedYear },
    });
    await waitFor(() =>
      expect(screen.queryByText('Gespeicherter Stand geöffnet.')).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Jahr')).toHaveValue(String(selectedYear - 1));
  });
  it('wartet auch bei früher fertigem Follower-Verlauf auf den Report', async () => {
    let finishReport!: (value: Awaited<ReturnType<typeof loadReport>>) => void;
    vi.mocked(loadReport).mockImplementationOnce(
      (_origin, _account, _followers, _year, _signal, onProgress) => {
        onProgress({
          phase: 'reach',
          requests: 2,
          oldestFetchedAt: null,
          analysis: { completedPosts: 1, totalPosts: 4, requests: 3 },
        });
        return new Promise((resolve) => {
          finishReport = resolve;
        });
      },
    );
    const loadFollowerHistory = vi.fn(async () => {});
    render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
      loadFollowerHistory,
    });
    await waitFor(() => expect(loadFollowerHistory).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    finishReport({ posts: [], historyComplete: true, oldestFetchedAt: null, error: null });
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  });
  it('zeigt nur einen Fortschritt und gibt Ergebnisse erst nach beiden Abfragen frei', async () => {
    let finishHistory!: () => void;
    const history = new Promise<void>((resolve) => {
      finishHistory = resolve;
    });
    const onbusy = vi.fn();
    const loadFollowerHistory = vi.fn((_account: typeof fixture) => history);
    render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
      loadFollowerHistory,
      onbusy,
    });
    await waitFor(() => expect(loadFollowerHistory).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Report bereit/)).toBeInTheDocument());
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report speichern' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'CSV herunterladen' })).not.toBeInTheDocument();
    finishHistory();
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(onbusy).toHaveBeenLastCalledWith(false);
    expect(loadFollowerHistory.mock.calls[0][0]).toEqual(fixture);
  });

  it('bricht beide Abfragen mit demselben Signal ab und bleibt erneut ladbar', async () => {
    const loadFollowerHistory = vi.fn(
      (_account, signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('cancelled', 'AbortError')),
          );
        }),
    );
    render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
      loadFollowerHistory,
    });
    await waitFor(() => expect(loadFollowerHistory).toHaveBeenCalledTimes(1));
    const signal = loadFollowerHistory.mock.calls[0][1];
    expect(vi.mocked(loadReport).mock.calls[0][4]).toBe(signal);
    await fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Live-Report laden' })).toBeEnabled();
  });

  it('erhält den Report bei fehlgeschlagenem Follower-Abruf als Teilstand', async () => {
    render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
      loadFollowerHistory: async () => {
        throw new Error('notifications unavailable');
      },
    });
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getAllByText(/Teilstand:/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'CSV herunterladen' })).toBeEnabled();
  });

  it('wartet bei Reportfehler auf den Verlauf und gibt dessen Anzeige wieder frei', async () => {
    vi.mocked(loadReport).mockRejectedValueOnce(new Error('statuses unavailable'));
    let finishHistory!: () => void;
    const history = new Promise<void>((resolve) => {
      finishHistory = resolve;
    });
    const onbusy = vi.fn();
    render(ReportsPanel, {
      account: fixture,
      origin: 'https://test.social',
      platform: null,
      loadFollowerHistory: () => history,
      onbusy,
    });
    await waitFor(() => expect(vi.mocked(loadReport)).toHaveBeenCalledTimes(1));
    expect(onbusy).toHaveBeenLastCalledWith(true);
    finishHistory();
    await waitFor(() => expect(screen.getByText('statuses unavailable')).toBeInTheDocument());
    expect(onbusy).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Live-Report laden' })).toBeEnabled();
  });

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
