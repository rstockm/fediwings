import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const account = {
  id: 'account-1',
  username: 'alice',
  acct: 'alice',
  display_name: 'Alice Example',
  url: 'https://test.social/@alice',
  avatar_static:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="88" height="88"%3E%3Crect width="88" height="88" fill="%238b7cff"/%3E%3C/svg%3E',
  followers_count: 1000,
};

const secondAccount = {
  id: 'account-2',
  username: 'bob',
  acct: 'bob',
  display_name: 'Bob Example',
  url: 'https://test.social/@bob',
  avatar_static:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="88" height="88"%3E%3Crect width="88" height="88" fill="%23ff9b52"/%3E%3C/svg%3E',
  followers_count: 500,
};

function notification(id: string, date: string) {
  return { id, type: 'follow', created_at: date, account: { id, acct: `user-${id}` } };
}

function bulk(from: number, count: number, date: string) {
  return Array.from({ length: count }, (_, index) => notification(String(from - index), date));
}

async function mockInstance(page: Page) {
  await page.route('https://test.social/api/v1/accounts/*/statuses?*', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route('https://test.social/api/v2/instance', async (route) => {
    await route.fulfill({ json: { domain: 'test.social', title: 'Test', version: '4.5.0' } });
  });
  await page.route('https://test.social/.well-known/nodeinfo', async (route) => {
    await route.fulfill({
      json: {
        links: [
          {
            rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
            href: 'https://test.social/nodeinfo/2.1',
          },
        ],
      },
    });
  });
  await page.route('https://test.social/nodeinfo/2.1', async (route) => {
    await route.fulfill({ json: { software: { name: 'mastodon' } } });
  });
  await page.route('https://test.social/api/v1/accounts/lookup?*', async (route) => {
    await route.fulfill({ json: account });
  });
}

async function mockSecondAccount(page: Page) {
  await page.route('https://test.social/api/v1/accounts/lookup?*', async (route) => {
    const acct = new URL(route.request().url()).searchParams.get('acct') ?? '';
    await route.fulfill({ json: acct.startsWith('bob') ? secondAccount : account });
  });
  await page.route('https://test.social/api/v1/accounts/account-2/statuses?*', async (route) => {
    await route.fulfill({ json: [] });
  });
}

async function mockOAuthFlow(page: Page) {
  await page.route('https://test.social/api/v1/apps', async (route) => {
    await route.fulfill({ json: { client_id: 'cid', client_secret: 'cs' } });
  });
  await page.route('https://test.social/oauth/authorize?*', async (route) => {
    const url = new URL(route.request().url());
    const redirect = url.searchParams.get('redirect_uri') ?? 'https://127.0.0.1:4173/';
    const state = url.searchParams.get('state') ?? '';
    await route.fulfill({
      status: 302,
      headers: { Location: `${redirect}?code=e2e-code&state=${state}` },
    });
  });
  await page.route('https://test.social/oauth/token', async (route) => {
    await route.fulfill({ json: { access_token: 'tok-1', token_type: 'Bearer' } });
  });
  await page.route('https://test.social/api/v1/accounts/verify_credentials', async (route) => {
    await route.fulfill({ json: account });
  });
  await page.route('https://test.social/oauth/revoke', async (route) => {
    await route.fulfill({ json: {} });
  });
  await page.route('https://test.social/api/v1/notifications?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.getAll('types[]').includes('favourite')) {
      await route.fulfill({
        json: [
          {
            id: '204',
            type: 'reblog',
            created_at: '2026-04-02T10:00:00Z',
            status: { id: 'post-1' },
          },
          {
            id: '203',
            type: 'favourite',
            created_at: '2026-03-31T22:00:00Z',
            status: { id: 'older-post' },
          },
          {
            id: '202',
            type: 'mention',
            created_at: '2026-02-02T10:00:00Z',
            status: { id: 'reply' },
          },
        ],
      });
      return;
    }
    const maxId = url.searchParams.get('max_id');
    if (!maxId) {
      await route.fulfill({ json: bulk(200, 80, '2026-03-05T10:00:00Z') });
      return;
    }
    if (maxId === '121') {
      await route.fulfill({ json: bulk(120, 80, '2026-02-01T10:00:00Z') });
      return;
    }
    if (maxId === '41') {
      await route.fulfill({
        json: [
          notification('31', '2026-01-01T10:00:00Z'),
          notification('30', '2025-12-01T10:00:00Z'),
        ],
      });
      return;
    }
    await route.fulfill({ json: [] });
  });
}

async function connectOwnInstance(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Eigene Daten ergänzen' })).toBeVisible();
  await page.getByRole('button', { name: 'Mit test.social verbinden' }).click();
}

test('Reports und alter Follower-Link öffnen dieselbe Ansicht', async ({ page }) => {
  await page.goto('/?view=reports');
  await expect(page.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveTitle('Reports | FediWings');
  await page.goto('/?view=follower');
  await expect(page.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
});

test('erstellt optionale öffentliche ZLB-Reportscreenshots', async ({ page }) => {
  test.skip(
    !process.env.LIVE_REPORT_SCREENSHOTS,
    'Nur für ausdrücklich angestoßene Live-Aufnahmen',
  );
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@zlb_berlin@openbiblio.social');
  await expect(page.locator('.reports-panel')).toHaveCount(0);
  await page.locator('main').screenshot({ path: 'docs/screenshots/reports-connect-desktop.png' });
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.locator('main').screenshot({ path: 'docs/screenshots/reports-connect-mobile.png' });
});

test('lädt, speichert und öffnet einen Jahresreport und exportiert CSV', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copiedReport: string }).copiedReport = text;
        },
      },
    });
  });
  await page.route('https://test.social/api/v1/accounts/account-1/statuses?*', async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'post-1',
          created_at: '2026-02-01T10:00:00Z',
          url: 'https://test.social/@alice/post-1',
          content: '<p>Test</p>',
          spoiler_text: '',
          visibility: 'public',
          favourites_count: 5,
          reblogs_count: 0,
          replies_count: 1,
          in_reply_to_id: null,
          in_reply_to_account_id: null,
          media_attachments: [],
        },
      ],
    });
  });
  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await expect(page.getByRole('button', { name: 'Laden', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await page.getByLabel('Jahr', { exact: true }).selectOption('2026');
  await expect(page.getByRole('rowheader', { name: 'Interaktionen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Der Jahresverlauf' })).toBeVisible();
  const exportGroup = page.getByRole('group', { name: 'Export' });
  await expect(exportGroup.getByRole('button')).toHaveCount(3);
  const exportBox = await exportGroup.boundingBox();
  const reportTableBox = await page.getByRole('table').boundingBox();
  expect(exportBox).not.toBeNull();
  expect(reportTableBox).not.toBeNull();
  expect(exportBox!.y).toBeLessThan(reportTableBox!.y);
  const reachPlot = page.locator('.chart-card', { hasText: 'Reichweite' }).locator('.chart-plot');
  const reachBox = await reachPlot.boundingBox();
  expect(reachBox).not.toBeNull();
  await reachPlot.hover({ position: { x: reachBox!.width * (1.5 / 12), y: reachBox!.height / 2 } });
  await expect(page.locator('.chart-hover-tip')).toHaveText(/Feb/);
  await expect(page.locator('.chart-hover-line')).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(page.locator('.chart-hover-tip')).toHaveCount(0);
  const interactions = page.getByRole('row', { name: 'Interaktionen' }).getByRole('cell');
  await expect(interactions.nth(0)).toHaveText('—');
  await expect(interactions.nth(1)).toHaveText('1 !');
  await expect(interactions.nth(2)).toHaveText('0');
  await expect(interactions.nth(3)).toHaveText('2');
  await expect(interactions.last()).toHaveText('3 !');
  await expect(page.getByRole('row', { name: 'Postings' }).getByRole('cell').nth(3)).toHaveText(
    '0',
  );
  if (process.env.UPDATE_REPORT_INTERACTION_SCREENSHOTS) {
    const panel = page.locator('.reports-panel');
    await page.mouse.move(0, 0);
    for (const [name, width, height] of [
      ['desktop', 1440, 1000],
      ['mobile', 390, 1100],
    ] as const) {
      await page.setViewportSize({ width, height });
      await panel
        .locator('.reports-scroll')
        .screenshot({ path: `docs/screenshots/reports-${name}.png` });
      await panel
        .locator('.report-charts')
        .screenshot({ path: `docs/screenshots/reports-charts-${name}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (item) => item.impact === 'serious' || item.impact === 'critical',
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('region', { name: 'Monats- und Jahresreport' }).last().focus();
  await expect(page.getByRole('region', { name: 'Monats- und Jahresreport' }).last()).toBeFocused();
  await page.getByRole('button', { name: 'Für Excel kopieren' }).click();
  await expect(page.getByText('Tabelle kopiert.')).toBeVisible();
  await expect(page.locator('.reports-action-status')).toHaveText('Tabelle kopiert.');
  expect(
    await page.evaluate(() => (window as unknown as { copiedReport: string }).copiedReport),
  ).toContain('Interaktionen\t\t1\t0\t2\t');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV herunterladen' }).click();
  expect((await download).suggestedFilename()).toBe('fediwings-report-2026.csv');
  await page.getByRole('button', { name: 'Report speichern' }).click();
  await expect(page.getByText('Report lokal gespeichert.')).toBeVisible();
  await expect(page.getByText(/Gespeicherter Stand:/)).toBeVisible();
  await expect(page.locator('.reports-saved-state button')).toHaveText(
    'Gespeicherten Stand löschen',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Gespeicherten Stand öffnen' }).click();
  await expect(page.getByText('Gespeicherter Stand geöffnet.')).toBeVisible();
  await expect(interactions.nth(3)).toHaveText('2');
  await expect(interactions.last()).toHaveText('3 !');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Gespeicherten Stand löschen' }).click();
  await expect(page.getByText(/Gespeicherter Stand gelöscht/)).toBeVisible();
  await expect(page.getByText('Noch kein gespeicherter Stand für dieses Jahr.')).toBeVisible();
});

test('Report bleibt bei gesperrtem lokalem Speicher nutzbar', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await mockInstance(page);
  await mockOAuthFlow(page);
  await page.route('https://test.social/api/v1/accounts/account-1/statuses?*', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByText('Lokaler Speicher ist nicht verfügbar.')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Interaktionen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSV herunterladen' })).toBeEnabled();
});

test('zeigt ohne Verbindung keine Statistiken und lädt keine Reportdaten', async ({ page }) => {
  await mockInstance(page);
  const statusRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/statuses?')) statusRequests.push(request.url());
  });
  await page.goto('/?view=follower');

  await expect(page.getByRole('heading', { name: 'Wie wächst dein Account?' })).toBeVisible();
  await expect(page.getByText('Account wählen · Instanz verbinden')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }),
  ).toBeDisabled();

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();

  await expect(page.locator('.follower-snapshot').getByText('1.000')).toHaveCount(0);
  await expect(page.locator('.reports-panel')).toHaveCount(0);
  await expect(page.locator('.follower-charts')).toHaveCount(0);
  expect(statusRequests).toEqual([]);
  await expect(page.getByRole('dialog', { name: 'Eigene Daten ergänzen' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('laedt nach Login beide Verlaufscharts', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await expect(page.locator('.follower-hero')).toHaveClass(/follower-hero-collapsed/);
  await connectOwnInstance(page);

  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();

  const monthlyChart = page.getByRole('img', { name: /Neue Follower pro Monat/ });
  await expect(monthlyChart).toBeVisible();
  await expect(monthlyChart).toContainText('Dez');

  const anchoredChart = page.getByRole('img', { name: /Kumulierte Follower von 838 bis 1000/ });
  await expect(anchoredChart).toBeVisible();
  await expect(page.getByRole('row', { name: /Follower-Wachstum/ })).toContainText('80');
  await expect(page.getByRole('row', { name: /Follower\*innen/ })).toContainText('1.000');
  await expect(
    page
      .getByRole('row', { name: /Follower\*innen/ })
      .getByRole('cell')
      .nth(0),
  ).toHaveText('840');
  await expect(
    page
      .getByRole('row', { name: /Follower-Wachstum/ })
      .getByRole('cell')
      .nth(1),
  ).toHaveText('80');
  await expect(page.getByRole('rowheader', { name: /Follower-Verlauf \(verankert\)/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole('rowheader', { name: 'Follow-Benachrichtigungen' })).toHaveCount(0);
  await expect(page.getByText(/Unfollows fehlen/)).toBeVisible();

  await expect(page.getByText('Kumuliert aus 162 Follow-Ereignissen')).toBeVisible();
  await expect(
    page.locator('.follower-snapshot').getByText('Mastodon', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '@alice · verbunden' })).toBeVisible();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toBeEnabled();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('zeigt waehrend des Ladens einen Fortschritt an', async ({ page }, testInfo) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  let firstNotifications = true;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://test.social/api/v1/notifications?*', async (route) => {
    if (firstNotifications) {
      firstNotifications = false;
      await gate;
    }
    await route.fallback();
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);

  const progress = page.getByRole('progressbar', {
    name: 'Report und Follower-Verlauf werden geladen',
  });
  await expect(progress).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(1);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.locator('.follower-charts')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Report speichern' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Abbrechen', exact: true })).toHaveCount(1);
  if (process.env.UPDATE_COMBINED_REPORT_SCREENSHOTS && testInfo.project.name === 'chromium') {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .locator('main')
      .screenshot({ path: 'docs/screenshots/reports-loading-demo-desktop.png' });
    await page.setViewportSize({ width: 390, height: 1100 });
    await page
      .locator('main')
      .screenshot({ path: 'docs/screenshots/reports-loading-demo-mobile.png' });
  }
  release();
  await expect(progress).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /Neue Follower pro Monat/ })).toBeVisible();
});

test('verwendet beide Ergebnisse beim Ansichtswechsel und Jahreswechsel erneut', async ({
  page,
}) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/v1\/(notifications|accounts\/.*\/statuses|accounts\/lookup)/.test(request.url())) {
      requests.push(request.url());
    }
  });
  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();
  const count = requests.length;
  await page.getByRole('link', { name: 'Analyse', exact: true }).click();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();
  expect(requests).toHaveLength(count);
  await page.getByLabel('Jahr', { exact: true }).selectOption('2025');
  await expect(page.getByRole('table')).toBeVisible();
  expect(requests).toHaveLength(count);
  await page.getByRole('button', { name: 'Live-Report laden' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(requests.length).toBeGreaterThan(count);
});

test('behält den Login über Reload und Ansichtswechsel bei', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  let tokenExchanges = 0;
  await page.route('https://test.social/oauth/token', async (route) => {
    tokenExchanges += 1;
    await route.fulfill({ json: { access_token: 'tok-1', token_type: 'Bearer' } });
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();
  await expect(
    page.locator('.follower-snapshot').getByText('Mastodon', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verlauf neu laden' })).toBeVisible();
  expect(tokenExchanges).toBe(1);

  await page.getByRole('button', { name: 'Verlauf neu laden' }).click();
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();
  expect(tokenExchanges).toBe(1);
});

for (const detectable of [true, false]) {
  test(`erkennt die Server-Software nach Reload ohne gespeicherte Metadaten (${detectable ? 'Mastodon' : 'unbekannt'})`, async ({
    page,
  }) => {
    await mockInstance(page);
    await mockOAuthFlow(page);
    await page.goto('/?view=reports');
    await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
    await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
    await connectOwnInstance(page);
    await expect(page.getByRole('table')).toBeVisible();
    await page.evaluate(() => sessionStorage.removeItem('fediscope:last-account-v1'));
    if (!detectable) {
      await page.route('https://test.social/.well-known/nodeinfo', async (route) => {
        await route.fulfill({ status: 503, json: {} });
      });
    }
    await page.reload();
    await expect(
      page
        .locator('.follower-snapshot')
        .getByText(detectable ? 'Mastodon' : 'Nicht erkannt', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
}

test('löscht die Sitzung beim Abmelden und verlangt einen neuen Login', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  let revocations = 0;
  await page.route('https://test.social/oauth/revoke', async (route) => {
    revocations += 1;
    await route.fulfill({ json: {} });
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();

  await page.getByRole('button', { name: '@alice · verbunden' }).click();
  await page.getByRole('button', { name: 'Verbindung trennen' }).click();
  await expect.poll(() => revocations).toBe(1);
  await expect(page.locator('.reports-panel')).toHaveCount(0);
  await expect(page.locator('.follower-charts')).toHaveCount(0);
  await expect(page.locator('.follower-snapshot')).toHaveCount(0);
  const stored = await page.evaluate(() => sessionStorage.getItem('fediscope:follower-session-v2'));
  expect(stored).toBeNull();

  await page.reload();
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }),
  ).toBeVisible();
});

test('warnt nach lokalem Abmelden vor fehlgeschlagenem Server-Widerruf', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  await page.route('https://test.social/oauth/revoke', async (route) => {
    await route.fulfill({ status: 500, json: {} });
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();
  await page.getByRole('button', { name: '@alice · verbunden' }).click();
  await page.getByRole('button', { name: 'Verbindung trennen' }).click();

  await expect(
    page.getByText(/Serverzugriff konnte nicht automatisch widerrufen werden/),
  ).toBeVisible();
  const stored = await page.evaluate(() => sessionStorage.getItem('fediscope:follower-session-v2'));
  expect(stored).toBeNull();
});

test('verwirft den Token beim Login mit einem anderen Account', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  let revocations = 0;
  let notificationRequests = 0;
  await page.route('https://test.social/api/v1/accounts/verify_credentials', async (route) => {
    await route.fulfill({ json: { ...account, id: 'account-2', acct: 'mallory' } });
  });
  await page.route('https://test.social/oauth/revoke', async (route) => {
    revocations += 1;
    await route.fulfill({ status: 500, json: {} });
  });
  await page.route('https://test.social/api/v1/notifications?*', async (route) => {
    notificationRequests += 1;
    await route.fulfill({ json: [] });
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);

  await expect(page.getByText(/Angemeldet wurde @mallory/)).toBeVisible();
  await expect(
    page.getByText(/Serverzugriff konnte nicht automatisch widerrufen werden/),
  ).toBeVisible();
  await expect.poll(() => revocations).toBe(1);
  expect(notificationRequests).toBe(0);
  const stored = await page.evaluate(() => sessionStorage.getItem('fediscope:follower-session-v2'));
  expect(stored).toBeNull();
});

test('übernimmt den zuletzt analysierten Account und dessen Followerzahl aus der Sitzung', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'fediscope:last-account-v1',
      JSON.stringify({
        handle: '@alice@test.social',
        acct: 'alice@test.social',
        followers: 1000,
        origin: 'https://test.social',
        platformId: 'mastodon',
        platformName: 'Mastodon',
        source: 'analyse',
        savedAt: '2026-09-11T00:00:00.000Z',
      }),
    );
    localStorage.setItem(
      'fediscope:hidden-handles-v1',
      JSON.stringify([{ handle: 'alice@test.social', savedAt: '2026-01-01T00:00:00.000Z' }]),
    );
  });
  await page.goto('/?view=follower');

  const input = page.getByLabel('Vollständiger Fediverse-Handle');
  await expect(input).toHaveValue('@alice@test.social');
  await expect(page.locator('.reports-panel')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }),
  ).toBeVisible();

  await input.click();
  await expect(
    page
      .locator('#follower-saved-handles-listbox')
      .getByRole('option', { name: 'alice@test.social' }),
  ).toBeVisible();
});

test('uebergibt den im Follower-Tab geladenen Account ohne Reload an die Analyse', async ({
  page,
}) => {
  await mockInstance(page);
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Eigene Daten ergänzen' })).toBeVisible();
  await page.getByRole('button', { name: 'Nicht jetzt', exact: true }).click();

  await page.evaluate(() => {
    (window as Window & { __fediWingsNoReload?: string }).__fediWingsNoReload = 'alive';
  });
  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page.getByRole('button', { name: 'Analysieren' })).toBeVisible();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveValue('@alice@test.social');
  const marker = await page.evaluate(
    () => (window as Window & { __fediWingsNoReload?: string }).__fediWingsNoReload,
  );
  expect(marker).toBe('alive');
});

test('meldet einen abgebrochenen Login verstaendlich', async ({ page }) => {
  await page.goto('/?view=follower');
  await page.evaluate(() => {
    sessionStorage.setItem(
      'fediscope:oauth-handshake-v2',
      JSON.stringify({
        origin: 'https://test.social',
        clientId: 'cid',
        clientSecret: 'cs',
        verifier: 'verifier',
        state: 'state-1',
        accountId: 'account-1',
        acct: 'alice@test.social',
        returnView: 'follower',
      }),
    );
  });
  await page.goto('/?error=access_denied&state=state-1');
  await expect(
    page.getByText('Login im Server-Interface abgebrochen. Es wurden keine Daten übertragen.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\?view=reports$/);
  const handshake = await page.evaluate(() =>
    sessionStorage.getItem('fediscope:oauth-handshake-v2'),
  );
  expect(handshake).toBeNull();
});

test('schließt die appweite Verbindung auch nach einem Ansichtswechsel ab', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  let verificationStarted = false;
  let revocations = 0;
  let releaseVerification = () => undefined;
  const verificationGate = new Promise<void>((resolve) => {
    releaseVerification = resolve;
  });
  await page.route('https://test.social/api/v1/accounts/verify_credentials', async (route) => {
    verificationStarted = true;
    await verificationGate;
    try {
      await route.fulfill({ json: account });
    } catch {
      // Navigation aborts the delayed browser request.
    }
  });
  await page.route('https://test.social/oauth/revoke', async (route) => {
    revocations += 1;
    await route.fulfill({ json: {} });
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect.poll(() => verificationStarted).toBe(true);
  await page.getByRole('link', { name: 'Analyse' }).click();
  releaseVerification();

  await expect(page.getByRole('button', { name: 'Analysieren' })).toBeVisible();
  await expect(page.getByRole('button', { name: '@alice · verbunden' })).toBeVisible();
  expect(revocations).toBe(0);
  const stored = await page.evaluate(() => sessionStorage.getItem('fediscope:follower-session-v2'));
  expect(stored).not.toBeNull();
});

test('wechselt in Reports auf einen anderen Account und ersetzt die Sitzung', async ({ page }) => {
  await mockInstance(page);
  await mockSecondAccount(page);
  await mockOAuthFlow(page);
  let loginAccount = account;
  let loginToken = 'tok-alice';
  const revocations: string[] = [];
  const historyTokens: string[] = [];
  await page.route('https://test.social/api/v1/accounts/verify_credentials', async (route) => {
    await route.fulfill({ json: loginAccount });
  });
  await page.route('https://test.social/oauth/token', async (route) => {
    await route.fulfill({ json: { access_token: loginToken, token_type: 'Bearer' } });
  });
  await page.route('https://test.social/oauth/revoke', async (route) => {
    revocations.push(new URLSearchParams(route.request().postData() ?? '').get('token') ?? '');
    await route.fulfill({ json: {} });
  });
  await page.route('https://test.social/api/v1/notifications?*', async (route) => {
    historyTokens.push(route.request().headers()['authorization'] ?? '');
    await route.fulfill({ json: [] });
  });

  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('button', { name: '@alice · verbunden' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();

  const input = page.getByLabel('Vollständiger Fediverse-Handle');
  await expect(input).toBeEnabled();
  await input.fill('@bob@test.social');
  loginAccount = secondAccount;
  loginToken = 'tok-bob';
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();

  await expect(
    page.getByText('Die aktuelle Analyse betrifft einen anderen Account.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mit test.social verbinden' }).click();

  await expect(page.getByRole('button', { name: '@bob · verbunden' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '@bob', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect.poll(() => revocations).toEqual(['tok-alice']);
  await expect.poll(() => historyTokens.at(-1)).toBe('Bearer tok-bob');

  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('fediscope:follower-session-v2') ?? 'null'),
  );
  expect(stored?.account?.acct).toBe('bob');
  const last = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('fediscope:last-account-v1') ?? 'null'),
  );
  expect(last?.acct).toBe('bob@test.social');

  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveValue('@bob@test.social');
});

test('zeigt nach einem Analysewechsel nicht die Zahlen der verbundenen Sitzung', async ({
  page,
}) => {
  await mockInstance(page);
  await mockSecondAccount(page);
  await mockOAuthFlow(page);

  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();

  await page.getByRole('link', { name: 'Analyse' }).click();
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@bob@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();
  await expect(
    page.getByText('Für diese Auswahl wurden keine öffentlichen Beiträge gefunden.'),
  ).toBeVisible();
  await expect(page.locator('.account-card').getByText('@bob', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveValue('@bob@test.social');
  await expect(page.getByRole('button', { name: '@alice · verbunden' })).toBeVisible();
  await expect(page.getByText(/Noch nicht verbunden: @bob/)).toBeVisible();
  await expect(page.locator('.reports-panel')).toHaveCount(0);
  await expect(page.locator('.follower-charts')).toHaveCount(0);
  await expect(page.locator('.follower-snapshot')).toHaveCount(0);

  await page.getByRole('link', { name: 'Analyse' }).click();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveValue('@bob@test.social');
});

test('behält die bestehende Sitzung, wenn der Kontowechsel scheitert', async ({ page }) => {
  await mockInstance(page);
  await mockSecondAccount(page);
  await mockOAuthFlow(page);
  let loginAccount = account;
  let loginToken = 'tok-alice';
  const revocations: string[] = [];
  await page.route('https://test.social/api/v1/accounts/verify_credentials', async (route) => {
    await route.fulfill({ json: loginAccount });
  });
  await page.route('https://test.social/oauth/token', async (route) => {
    await route.fulfill({ json: { access_token: loginToken, token_type: 'Bearer' } });
  });
  await page.route('https://test.social/oauth/revoke', async (route) => {
    revocations.push(new URLSearchParams(route.request().postData() ?? '').get('token') ?? '');
    await route.fulfill({ json: {} });
  });

  await page.goto('/?view=reports');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await connectOwnInstance(page);
  await expect(page.getByRole('button', { name: '@alice · verbunden' })).toBeVisible();

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@bob@test.social');
  loginAccount = { ...secondAccount, id: 'account-9', acct: 'mallory', username: 'mallory' };
  loginToken = 'tok-bob';
  await page.getByRole('button', { name: 'Eigene Instanz verbinden', exact: true }).click();
  await page.getByRole('button', { name: 'Mit test.social verbinden' }).click();

  await expect(page.getByText(/Angemeldet wurde @mallory/)).toBeVisible();
  await expect(page.getByRole('button', { name: '@alice · verbunden' })).toBeVisible();
  await expect.poll(() => revocations).toEqual(['tok-bob']);
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('fediscope:follower-session-v2') ?? 'null'),
  );
  expect(stored?.account?.acct).toBe('alice');
  expect(stored?.token).toBe('tok-alice');
});
