import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const account = {
  id: 'pdf-demo',
  username: 'demo',
  acct: 'demo',
  display_name: 'DEMO · synthetische Beispieldaten',
  url: 'https://test.social/@demo',
  avatar_static: '',
  followers_count: 1500,
};
async function demoReport(page: Page) {
  await page.addInitScript((account) => {
    sessionStorage.setItem(
      'fediscope:follower-session-v2',
      JSON.stringify({
        token: 'demo-token',
        clientId: 'demo-client',
        clientSecret: 'demo-secret',
        origin: 'https://test.social',
        account,
        savedAt: '2026-01-01T12:00:00Z',
      }),
    );
  }, account);
  await page.route('https://test.social/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/statuses')) {
      await route.fulfill({
        json: Array.from({ length: 6 }, (_, i) => ({
          id: `demo-post-${i}`,
          created_at: `2025-0${i + 1}-15T12:00:00Z`,
          url: `https://test.social/@demo/demo-post-${i}`,
          content: `<p>DEMO · Öffentliche Bibliotheken verbinden Menschen, Wissen und neue Perspektiven. Beitrag ${i + 1}.</p>`,
          spoiler_text: '',
          visibility: 'public',
          favourites_count: 600 + i * 50,
          reblogs_count: 0,
          replies_count: 10,
          quotes_count: 2,
          in_reply_to_id: null,
          in_reply_to_account_id: null,
          media_attachments: [],
        })),
      });
    } else if (url.pathname.includes('notifications')) await route.fulfill({ json: [] });
    else if (
      url.pathname.includes('accounts/lookup') ||
      url.pathname.includes('verify_credentials')
    )
      await route.fulfill({ json: account });
    else if (url.pathname.includes('nodeinfo'))
      await route.fulfill({ json: { software: { name: 'mastodon' } } });
    else if (url.pathname.includes('instance'))
      await route.fulfill({ json: { domain: 'test.social', title: 'Demo', version: '4.5.0' } });
    else await route.fulfill({ json: [] });
  });
  await page.goto('/?view=reports');
  await expect(page.getByRole('button', { name: 'PDF-Bericht erstellen' })).toBeEnabled();
  await page.getByLabel('Jahr', { exact: true }).selectOption('2025');
  await expect(page.getByRole('button', { name: 'PDF-Bericht erstellen' })).toBeEnabled();
}

test('PDF lokal mit Top 5, Tabellen, Vorschau und Speicherung exportieren', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await demoReport(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const persistedBefore = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('fediwings-reports');
      r.onsuccess = () => resolve(r.result);
    });
    const count = await new Promise<number>((resolve) => {
      const r = db.transaction('reports').objectStore('reports').count();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return count;
  });
  const action = page.getByRole('button', { name: 'PDF-Bericht erstellen' });
  await action.click();
  const dialog = page.getByRole('dialog', { name: 'Executive Report' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vorschau erstellen' })).toBeEnabled();
  await page.getByLabel('Organisation (optional)').fill('DEMO · synthetische Beispieldaten');
  const renderRequestStart = requests.length;
  await page.getByRole('button', { name: 'Vorschau erstellen' }).click();
  await expect(page.getByRole('link', { name: 'PDF herunterladen' })).toBeVisible({
    timeout: 30000,
  });
  const a11y = await new AxeBuilder({ page }).include('.pdf-dialog').analyze();
  expect(a11y.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    requests
      .slice(renderRequestStart)
      .filter((url) => !url.startsWith('blob:') && !url.startsWith('http://127.0.0.1:4173/')),
  ).toEqual([]);
  expect(
    requests.filter(
      (url) =>
        !url.startsWith('blob:') &&
        !url.startsWith('http://127.0.0.1:4173/') &&
        !url.startsWith('https://test.social/'),
    ),
  ).toEqual([]);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'PDF herunterladen' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath('report.pdf');
  await download.saveAs(path);
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
  expect(text).toContain('Top 5 Beiträge');
  expect(text).toContain('Datentabelle');
  expect(text).toContain('Interaktionen: 862');
  expect(text).not.toContain('demo-token');
  await page.evaluate(async (expected) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('fediwings-reports');
      r.onsuccess = () => resolve(r.result);
    });
    const count = await new Promise<number>((resolve) => {
      const r = db.transaction('reports').objectStore('reports').count();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    if (count !== expected) throw new Error('PDF persisted data');
  }, persistedBefore);
  if (process.env.PDF_SCREENSHOTS && testInfo.project.name !== 'narrow') {
    await page.screenshot({
      path: `docs/screenshots/report-pdf-${testInfo.project.name === 'mobile' ? 'mobile' : 'desktop'}.png`,
    });
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(action).toBeFocused();
  await page.getByRole('button', { name: 'Report speichern', exact: true }).click();
  await expect(page.getByText('Report lokal gespeichert.')).toBeVisible();
  // A later live analysis must not leak into the saved PDF snapshot.
  await page.route('https://test.social/api/v1/accounts/pdf-demo/statuses?*', async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'later-post',
          created_at: '2025-02-15T12:00:00Z',
          url: 'https://test.social/@demo/later-post',
          content: '<p>New live content, not part of the saved report</p>',
          spoiler_text: '',
          visibility: 'public',
          favourites_count: 10000,
          reblogs_count: 0,
          replies_count: 10,
          quotes_count: 2,
          in_reply_to_id: null,
          in_reply_to_account_id: null,
          media_attachments: [],
        },
      ],
    });
  });
  await page.reload();
  await page.getByLabel('Jahr', { exact: true }).selectOption('2025');
  await expect(action).toBeEnabled();
  await page.getByRole('button', { name: 'Gespeicherten Stand öffnen' }).click();
  await expect(page.getByText('Gespeicherter Stand geöffnet.')).toBeVisible();
  await action.click();
  await page.getByRole('button', { name: 'Vorschau erstellen' }).click();
  await expect(page.getByRole('link', { name: 'PDF herunterladen' })).toBeVisible();
  const restoredDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'PDF herunterladen' }).click();
  const restoredPath = testInfo.outputPath('restored.pdf');
  await (await restoredDownload).saveAs(restoredPath);
  const restoredText = execFileSync('pdftotext', ['-layout', restoredPath, '-'], {
    encoding: 'utf8',
  });
  expect(restoredText).toContain('Interaktionen: 862');
  expect(restoredText).toContain('Originalbeitrag öffnen');
  expect(restoredText).not.toContain('New live content');
  expect(restoredText).not.toContain('Interaktionen: 10.012');
  expect(errors).toEqual([]);
});
