import { expect, test, type Page } from '@playwright/test';

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

function notification(id: string, date: string) {
  return { id, type: 'follow', created_at: date, account: { id, acct: `user-${id}` } };
}

function bulk(from: number, count: number, date: string) {
  return Array.from({ length: count }, (_, index) => notification(String(from - index), date));
}

async function mockInstance(page: Page) {
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
  await page.route('https://test.social/api/v1/notifications?*', async (route) => {
    const url = new URL(route.request().url());
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

test('zeigt ohne Login die aktuellen Zahlen und kennzeichnet die Login-Grenze', async ({
  page,
}) => {
  await mockInstance(page);
  await page.goto('/?view=follower');

  await expect(page.getByRole('heading', { name: 'Wie wächst dein Account?' })).toBeVisible();
  await expect(page.getByText('ohne Login').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }),
  ).toHaveCount(0);

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Laden' }).click();

  await expect(page.getByText('1.000')).toBeVisible();
  await expect(page.getByText('Mastodon', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }),
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
  await page.getByRole('button', { name: 'Laden' }).click();
  await expect(page.locator('.follower-hero')).toHaveClass(/follower-hero-collapsed/);
  await page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }).click();

  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();

  const monthlyChart = page.getByRole('img', { name: /Neue Follower pro Monat/ });
  await expect(monthlyChart).toBeVisible();
  await expect(monthlyChart).toContainText('Dez');

  const anchoredChart = page.getByRole('img', { name: /Kumulierte Follower von 838 bis 1000/ });
  await expect(anchoredChart).toBeVisible();

  await expect(page.getByText('Kumuliert aus 162 Follow-Ereignissen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('zeigt waehrend des Ladens einen Fortschritt an', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  let firstNotifications = true;
  await page.route('https://test.social/api/v1/notifications?*', async (route) => {
    if (firstNotifications) {
      firstNotifications = false;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.fallback();
  });
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Laden' }).click();
  await page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }).click();

  const progress = page.getByRole('progressbar', { name: 'Follower-Verlauf wird geladen' });
  await expect(progress).toBeVisible();
  await expect(page.getByText('0 von 40 Seiten')).toBeVisible();
  await expect(progress).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /Neue Follower pro Monat/ })).toBeVisible();
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
  await page.getByRole('button', { name: 'Laden' }).click();
  await page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }).click();
  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '@alice', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verlauf neu laden' })).toBeVisible();
  expect(tokenExchanges).toBe(1);

  await page.getByRole('button', { name: 'Verlauf neu laden' }).click();
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();
  expect(tokenExchanges).toBe(1);
});

test('löscht die Sitzung beim Abmelden und verlangt einen neuen Login', async ({ page }) => {
  await mockInstance(page);
  await mockOAuthFlow(page);
  await page.goto('/?view=follower');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Laden' }).click();
  await page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }).click();
  await expect(page.getByRole('img', { name: /Kumulierte Follower/ })).toBeVisible();

  await page.getByRole('button', { name: 'Abmelden' }).click();
  const stored = await page.evaluate(() => sessionStorage.getItem('fediscope:follower-session-v1'));
  expect(stored).toBeNull();

  await page.reload();
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Laden' }).click();
  await expect(
    page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }),
  ).toBeVisible();
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
  await expect(page.getByText('1.000')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }),
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
  await page.getByRole('button', { name: 'Laden' }).click();
  await expect(page.getByText('1.000')).toBeVisible();

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
  await page.goto('/?error=access_denied');
  await expect(
    page.getByText('Login im Server-Interface abgebrochen. Es wurden keine Daten übertragen.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\?view=follower$/);
});
