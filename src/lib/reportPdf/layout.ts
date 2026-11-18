export interface PdfPalette {
  ink: string;
  paper: string;
  muted: string;
  violet: string;
  lime: string;
  riseSoft: string;
  decline: string;
  declineSoft: string;
}
export const pdfLayout = { margin: 54, body: 11, table: 9, meta: 8.5, width: 487.28 } as const;

/** A browser adapter keeps the existing CSS tokens the color source of truth. */
export function readPdfPalette(): PdfPalette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => {
    const value = css.getPropertyValue(name).trim();
    if (!/^#[a-f0-9]{6}$/iu.test(value)) throw new Error(`Missing PDF design token: ${name}`);
    return value;
  };
  return {
    ink: token('--ink'),
    paper: token('--paper-raised'),
    muted: token('--text-on-light'),
    violet: token('--violet-strong'),
    lime: token('--lime'),
    riseSoft: token('--chart-rise-soft'),
    decline: token('--chart-decline'),
    declineSoft: token('--chart-decline-soft'),
  };
}
