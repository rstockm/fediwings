import { expect, test } from '@playwright/test';

test('display headings render Inter Tight Latin glyphs instead of fallback glyphs', async ({
  page,
}) => {
  await page.goto('/');
  const metrics = await page.evaluate(async () => {
    await document.fonts.ready;
    const reference = new FontFace(
      'Inter Tight Reference',
      `url("${new URL('fonts/inter-tight-latin.woff2', document.baseURI).href}")`,
      { weight: '100 900' },
    );
    document.fonts.add(await reference.load());
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = '400 50px "Inter Tight"';
    const displayWidth = context.measureText('Wie weit').width;
    context.font = '400 50px "Inter Tight Reference"';
    const referenceWidth = context.measureText('Wie weit').width;
    context.font = '400 50px Arial';
    const fallbackWidth = context.measureText('Wie weit').width;
    return {
      displayWidth,
      referenceWidth,
      fallbackWidth,
      loadedLatin: [...document.fonts].some(
        (font) =>
          font.family === 'Inter Tight' &&
          font.status === 'loaded' &&
          font.unicodeRange.includes('U+0-FF'),
      ),
    };
  });

  // Compare against the Google Fonts Latin face in the same browser:
  // headless and desktop Chromium can round advance widths differently.
  // A loaded Latin-Extended face alone does not guarantee Latin glyph coverage.
  expect(metrics.loadedLatin).toBe(true);
  expect(metrics.displayWidth).toBe(metrics.referenceWidth);
  expect(Math.abs(metrics.displayWidth - metrics.fallbackWidth)).toBeGreaterThan(1);
  await expect(page.locator('.hero h1')).toHaveCSS('font-weight', '400');
  await expect(page.locator('.hero h1')).toHaveCSS('letter-spacing', 'normal');
  await expect(page.locator('.hero h1')).toHaveCSS('font-kerning', 'normal');
});
