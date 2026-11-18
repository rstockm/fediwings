import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportPdfDialog from './ReportPdfDialog.svelte';
import { pdfFixture } from '../lib/reportPdf/fixtures';
import { renderReportPdf } from '../lib/reportPdf/render';

vi.mock('../lib/reportPdf/render', () => ({ renderReportPdf: vi.fn() }));
beforeEach(() => {
  vi.mocked(renderReportPdf)
    .mockReset()
    .mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:pdf-demo'),
      revokeObjectURL: vi.fn(),
    }),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PDF-Dialog', () => {
  it('erzeugt lokal, verwendet denselben Blob für Vorschau und Download und gibt ihn frei', async () => {
    const onclose = vi.fn();
    render(ReportPdfDialog, { snapshot: pdfFixture(), onclose });
    await fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'PDF herunterladen' })).toBeInTheDocument(),
    );
    const link = screen.getByRole('link', { name: 'PDF herunterladen' });
    expect(link.getAttribute('href')).toBe('blob:pdf-demo');
    expect(screen.getByTitle('PDF-Vorschau')).toHaveAttribute('src', 'blob:pdf-demo');
    expect(renderReportPdf).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-demo');
    expect(onclose).toHaveBeenCalled();
  });
  it('zeigt Fehler und erlaubt einen neuen Versuch', async () => {
    vi.mocked(renderReportPdf).mockRejectedValueOnce(new Error('font unavailable'));
    render(ReportPdfDialog, { snapshot: pdfFixture(), onclose: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('erneut versuchen'));
    await fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'PDF herunterladen' })).toBeInTheDocument(),
    );
  });
  it('verwirft verspätete Ergebnisse nach Schließen', async () => {
    let finish!: (value: Blob) => void;
    vi.mocked(renderReportPdf).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(ReportPdfDialog, { snapshot: pdfFixture(), onclose: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    await waitFor(() => expect(renderReportPdf).toHaveBeenCalled());
    await fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    finish(new Blob(['old']));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'PDF herunterladen' })).not.toBeInTheDocument(),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('invalidiert Vorschau bei Eingabeänderung und Auswahlwechsel', async () => {
    const view = render(ReportPdfDialog, { snapshot: pdfFixture(), onclose: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'PDF herunterladen' })).toBeInTheDocument(),
    );
    await fireEvent.input(screen.getByLabelText('Organisation (optional)'), {
      target: { value: 'Neue Organisation' },
    });
    expect(screen.queryByRole('link', { name: 'PDF herunterladen' })).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    const next = pdfFixture();
    next.year = 2024;
    next.handle = '@other@example.social';
    await view.rerender({ snapshot: next, onclose: vi.fn() });
    expect(screen.getByText('@other@example.social · 2024')).toBeInTheDocument();
  });
  it('verwirft eine laufende Erstellung nach Account- und Jahreswechsel', async () => {
    let finish!: (value: Blob) => void;
    vi.mocked(renderReportPdf).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(ReportPdfDialog, { snapshot: pdfFixture(), onclose: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Vorschau erstellen' }));
    await waitFor(() => expect(renderReportPdf).toHaveBeenCalled());
    const next = pdfFixture();
    next.year = 2024;
    next.handle = '@other@example.social';
    await view.rerender({ snapshot: next, onclose: vi.fn() });
    finish(new Blob(['old']));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'PDF herunterladen' })).not.toBeInTheDocument(),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
