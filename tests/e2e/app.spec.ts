import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function makeStatus(id: string, date: string): Record<string, unknown> {
  return {
    id,
    created_at: date,
    url: `https://test.social/@alice/${id}`,
    content: `<p>Beitrag ${id}</p>`,
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 0,
    reblogs_count: 0,
    replies_count: 0,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
  };
}

function daysAgo(days: number, hour = 10): string {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

const account = {
  id: 'account-1',
  username: 'alice',
  acct: 'alice',
  display_name: 'Alice Example',
  url: 'https://test.social/@alice',
  uri: 'https://test.social/users/alice',
  avatar_static:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="88" height="88"%3E%3Crect width="88" height="88" fill="%238b7cff"/%3E%3C/svg%3E',
  followers_count: 1000,
  hide_collections: false,
};

const statuses = [
  {
    id: 'status-1',
    created_at: daysAgo(2),
    url: 'https://test.social/@alice/status-1',
    content: '<p>Ein Testbeitrag aus dem Fediverse.</p>',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 12,
    reblogs_count: 2,
    replies_count: 1,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [
      {
        type: 'image',
        url: 'https://media.test.social/status-1/photo.jpg',
        preview_url: 'https://media.test.social/status-1/photo-small.jpg',
        description: 'Ein Foto zur Illustration',
      },
    ],
  },
  {
    id: 'status-3',
    created_at: daysAgo(2, 11),
    url: 'https://test.social/@alice/status-3',
    content: '<p>Eine Antwort im selben Thread.</p>',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 5,
    reblogs_count: 1,
    replies_count: 0,
    in_reply_to_id: 'status-1',
    in_reply_to_account_id: 'account-1',
    media_attachments: [],
  },
  {
    id: 'status-2',
    created_at: daysAgo(3),
    url: 'https://test.social/@alice/status-2',
    content: '<p>Ein Beitrag ohne Boosts.</p>',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 4,
    reblogs_count: 0,
    replies_count: 0,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    media_attachments: [],
  },
  {
    id: 'status-foreign-reply',
    created_at: daysAgo(1),
    url: 'https://test.social/@alice/status-foreign-reply',
    content: '<p>Antwort auf einen fremden Beitrag.</p>',
    spoiler_text: '',
    visibility: 'public',
    favourites_count: 100,
    reblogs_count: 0,
    replies_count: 0,
    in_reply_to_id: 'remote-status',
    in_reply_to_account_id: 'remote-account',
    media_attachments: [],
  },
];

async function mockMastodon(page: Page, software = 'mastodon') {
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
    await route.fulfill({ json: { software: { name: software }, version: '4.5.0' } });
  });
  await page.route('https://test.social/api/v2/instance', async (route) => {
    await route.fulfill({ json: { domain: 'test.social', title: 'Test', version: '4.5.0' } });
  });
  await page.route('https://test.social/api/v1/accounts/lookup?*', async (route) => {
    await route.fulfill({ json: account });
  });
  await page.route('https://test.social/api/v1/accounts/account-1/statuses?*', async (route) => {
    await route.fulfill({ json: statuses });
  });
  await page.route('https://test.social/api/v1/statuses/status-1', async (route) => {
    await route.fulfill({ json: { ...statuses[0], account } });
  });
  await page.route('https://test.social/api/v1/statuses/status-1/context', async (route) => {
    await route.fulfill({
      json: {
        ancestors: [],
        descendants: [{ ...statuses[1], account }],
      },
    });
  });
  await page.route(
    'https://test.social/api/v1/statuses/status-1/reblogged_by?limit=80',
    async (route) => {
      await route.fulfill({
        json: [
          {
            ...account,
            id: 'booster-1',
            username: 'bob',
            acct: 'bob@remote.social',
            uri: 'https://remote.social/users/bob',
            followers_count: 250,
          },
        ],
        headers: {
          Link: '<https://test.social/api/v1/statuses/status-1/reblogged_by?limit=80&max_id=2>; rel="next"',
          'Access-Control-Expose-Headers':
            'Link, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
          'X-RateLimit-Limit': '300',
          'X-RateLimit-Remaining': '298',
        },
      });
    },
  );
  await page.route(
    'https://test.social/api/v1/statuses/status-1/reblogged_by?limit=80&max_id=2',
    async (route) => {
      await route.fulfill({
        json: [
          {
            ...account,
            id: 'booster-2',
            username: 'carol',
            acct: 'carol@elsewhere.social',
            uri: 'https://elsewhere.social/users/carol',
            followers_count: 500,
          },
        ],
        headers: {
          'X-RateLimit-Limit': '300',
          'X-RateLimit-Remaining': '297',
        },
      });
    },
  );
  await page.route(
    'https://test.social/api/v1/statuses/status-3/reblogged_by?limit=80',
    async (route) => {
      await route.fulfill({
        json: [
          {
            ...account,
            id: 'booster-3',
            username: 'dave',
            acct: 'dave@third.social',
            uri: 'https://third.social/users/dave',
            followers_count: 300,
          },
        ],
        headers: {
          'X-RateLimit-Limit': '300',
          'X-RateLimit-Remaining': '296',
        },
      });
    },
  );
}

test('analysiert einen Account ueber mehrere Booster-Seiten', async ({ page }) => {
  await mockMastodon(page);
  await page.goto('/');

  await expect(page.getByText('von Ralf Stockmann', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'FediWings MVP' })).toHaveAttribute(
    'href',
    'https://github.com/rstockm/fediwings',
  );
  await expect(page.getByLabel('Threads')).toHaveValue('80');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();

  await expect(page.getByRole('heading', { name: 'Alice Example' })).toBeVisible();
  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();
  const viewport = page.viewportSize();
  const tabsBox = await page.locator('.view-tabs').boundingBox();
  expect(tabsBox).not.toBeNull();
  expect(Math.abs(tabsBox!.x + tabsBox!.width / 2 - viewport!.width / 2)).toBeLessThanOrEqual(1);
  if (viewport!.width > 1050) {
    const [heroBox, searchBox] = await Promise.all([
      page.locator('.hero').boundingBox(),
      page.locator('.search-shell').boundingBox(),
    ]);
    expect(heroBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(searchBox!.width).toBeGreaterThan(heroBox!.width * 0.85);
  }
  const insights = page.getByRole('region', { name: '30 Tage. Direkt vergleichbar.' });
  await expect(insights.locator('.insight-card')).toHaveCount(4);
  await expect(insights.locator('.insight-card').first()).toContainText('Netto-Reichweite');
  await expect(
    insights
      .locator('.insight-card')
      .filter({ hasText: 'Interaktionen' })
      .locator('strong')
      .first(),
  ).toHaveText('25');
  await expect(
    insights.locator('.insight-card').filter({ hasText: 'Likes' }).locator('strong').first(),
  ).toHaveText('21');
  await expect(
    insights.locator('.insight-card').filter({ hasText: 'Boosts' }).locator('strong').first(),
  ).toHaveText('3');
  await expect(insights.getByText('Antworten', { exact: true })).toHaveCount(0);
  await expect(insights.locator('.insight-chart-wrap')).toHaveCount(4);
  await expect(insights.getByText('keine %-Basis')).toHaveCount(4);
  await expect(page.getByText('Antwort auf einen fremden Beitrag.')).toHaveCount(0);
  await expect(page.getByText('Ein Testbeitrag aus dem Fediverse.')).toBeVisible();
  await expect(page.getByText('Thread · 2 Postings')).toBeVisible();

  const thumb = page.locator('.post-thumb img').first();
  await expect(thumb).toBeVisible();
  await expect(thumb).toHaveAttribute('src', 'https://media.test.social/status-1/photo-small.jpg');
  await expect(thumb).toHaveAttribute('alt', 'Ein Foto zur Illustration');
  const clamp = await page
    .locator('.post-content')
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));
  expect(clamp).toBe('2');
  const previewParagraphDisplay = await page
    .locator('.post-content-preview p')
    .first()
    .evaluate((el) => getComputedStyle(el).display);
  expect(previewParagraphDisplay).toBe('inline');

  const cards = page.locator('.post-card');
  await expect(cards.locator('.post-thumb')).toHaveCount(2);
  await expect(cards.locator('.post-thumb-empty')).toHaveCount(1);
  await expect(cards.locator('.post-thumb-empty svg')).toHaveCount(1);
  await expect(cards.locator('.state-pill')).toHaveCount(0);
  const visualPositions = await cards
    .locator('.post-visual')
    .evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().x)),
    );
  expect(new Set(visualPositions).size).toBe(1);

  const threadCard = cards.filter({ hasText: 'Ein Testbeitrag aus dem Fediverse.' });
  await expect(threadCard.locator('.post-meta .post-date-link')).toHaveAttribute(
    'href',
    'https://test.social/@alice/status-1',
  );
  await expect(threadCard.locator('.post-actions')).toHaveCount(0);
  const metrics = threadCard.locator('.post-metrics');
  await expect(metrics).toContainText('2.050');
  await expect(metrics).toContainText('269');
  await expect(metrics).toContainText('Netto-Reichweite');
  await expect(metrics.locator('.reach-level-track')).toHaveCount(1);
  await expect(metrics.locator('.reach-level-track').first()).toHaveAttribute(
    'aria-valuetext',
    '100 Prozent der höchsten Netto-Reichweite',
  );
  await expect(cards.nth(1).locator('.reach-level-track').first()).toHaveAttribute(
    'aria-valuetext',
    '9 Prozent der höchsten Netto-Reichweite',
  );

  const primaryFontSize = await metrics
    .locator('.metric-primary-value')
    .first()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const secondaryFontSize = await metrics
    .locator('.metric-secondary dd')
    .first()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(primaryFontSize).toBeGreaterThan(secondaryFontSize * 1.5);

  const [primaryValueBox, reachLevelBox] = await Promise.all([
    metrics.locator('.metric-primary-value').first().boundingBox(),
    metrics.locator('.reach-level').first().boundingBox(),
  ]);
  expect(primaryValueBox).not.toBeNull();
  expect(reachLevelBox).not.toBeNull();
  expect(
    primaryValueBox!.x + primaryValueBox!.width <= reachLevelBox!.x + 1 ||
      primaryValueBox!.y + primaryValueBox!.height <= reachLevelBox!.y + 1,
  ).toBe(true);

  const [netMetricBox, secondaryMetricBox] = await Promise.all([
    metrics.locator('.reach-metric').boundingBox(),
    metrics.locator('.metric-secondary').first().boundingBox(),
  ]);
  expect(netMetricBox).not.toBeNull();
  expect(secondaryMetricBox).not.toBeNull();
  expect(netMetricBox!.y + netMetricBox!.height).toBeLessThanOrEqual(secondaryMetricBox!.y + 1);

  const metricsOverflow = await metrics.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(metricsOverflow).toBe(false);

  const renderedFillRatio = (cardIndex: number) =>
    cards
      .nth(cardIndex)
      .locator('.reach-level')
      .first()
      .evaluate((element) => {
        const track = element.querySelector<HTMLElement>('.reach-level-track');
        const fill = element.querySelector<HTMLElement>('.reach-level-fill');
        if (!track || !fill) return 0;
        const style = getComputedStyle(track);
        const contentWidth =
          track.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight);
        return fill.getBoundingClientRect().width / contentWidth;
      });

  await expect.poll(() => renderedFillRatio(1)).toBeLessThan(0.12);
  const fillRatios = await Promise.all([renderedFillRatio(0), renderedFillRatio(1)]);
  expect(fillRatios[0]).toBeGreaterThan(0.95);
  expect(fillRatios[1]).toBeGreaterThan(0.07);
  expect(fillRatios[1]).toBeLessThan(0.12);

  const details = threadCard.locator('details');
  const reply = threadCard.getByText('Eine Antwort im selben Thread.');
  await expect(details.locator('summary')).toHaveAttribute(
    'aria-label',
    'Vollständigen Thread anzeigen',
  );
  await expect(reply).toBeHidden();

  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('summary')).toHaveAttribute('aria-label', 'Thread einklappen');
  await expect(reply).toBeVisible();

  const actionButtons = threadCard.locator('.post-details-actions button');
  await expect(actionButtons).toHaveCount(1);
  await expect(actionButtons.first()).toHaveAccessibleName('Beitrag teilen');
  const [actionBox, detailsBarBox] = await Promise.all([
    actionButtons.first().boundingBox(),
    threadCard.locator('.post-details-bar').boundingBox(),
  ]);
  expect(actionBox).not.toBeNull();
  expect(detailsBarBox).not.toBeNull();
  expect(actionBox!.y).toBeGreaterThanOrEqual(detailsBarBox!.y);
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(
    detailsBarBox!.y + detailsBarBox!.height,
  );
  await actionButtons.first().click();
  await expect(details).toHaveAttribute('open', '');

  await expect(threadCard.locator('.thread-posts > li')).toHaveCount(1);
  await expect(threadCard.locator('.post-media-grid')).toBeVisible();

  const expandedClamp = await threadCard
    .locator('.post-content')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));
  expect(expandedClamp).toBe('none');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('vergleicht gemeldete Interaktionen mit den 30 Tagen davor', async ({ page }) => {
  await mockMastodon(page);
  await page.route('https://test.social/api/v1/accounts/account-1/statuses?*', async (route) => {
    await route.fulfill({
      json: [
        {
          ...makeStatus('current-1', daysAgo(2)),
          favourites_count: 12,
          reblogs_count: 3,
          replies_count: 2,
        },
        {
          ...makeStatus('current-2', daysAgo(15)),
          favourites_count: 8,
          reblogs_count: 1,
          replies_count: 1,
        },
        {
          ...makeStatus('previous', daysAgo(35)),
          favourites_count: 5,
          reblogs_count: 2,
          replies_count: 1,
        },
      ],
    });
  });
  await page.route('https://test.social/api/v1/statuses/*/reblogged_by*', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();

  const card = page.locator('.insight-card').filter({ hasText: 'Interaktionen' });
  await expect(card.locator('.insight-total-row strong')).toHaveText('27');
  await expect(card.locator('.insight-change')).toHaveText('↑ +237,5%');
  await expect(card.locator('footer strong')).toHaveText('8');
  const chart = card.getByRole('slider', {
    name: 'Interaktionen: aktuell 27, in den 30 Tagen davor 8',
  });
  await expect(chart).toHaveAccessibleName('Interaktionen: aktuell 27, in den 30 Tagen davor 8');
  await expect(chart.locator('.insight-axis-label')).toHaveCount(3);
  await chart.hover({ position: { x: 120, y: 40 } });
  await expect(chart.locator('.insight-tooltip')).toBeVisible();
});

test('uebergibt den analysierten Account ohne Reload an den Follower-Tab', async ({ page }) => {
  await mockMastodon(page);
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();
  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();

  await page.evaluate(() => {
    (window as Window & { __fediWingsNoReload?: string }).__fediWingsNoReload = 'alive';
  });
  await page.getByRole('link', { name: 'Follower' }).click();
  await expect(
    page.getByRole('button', { name: 'Follower-Verlauf mit Login abrufen' }),
  ).toBeVisible();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveValue('@alice@test.social');
  await expect(page.getByText('1.000')).toBeVisible();
  const marker = await page.evaluate(
    () => (window as Window & { __fediWingsNoReload?: string }).__fediWingsNoReload,
  );
  expect(marker).toBe('alive');
});

test('teilt einen vollstaendigen Thread als eigenstaendige Landing-Page', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __fediWingsCardServiceUrl?: string }).__fediWingsCardServiceUrl = '';
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { __fediWingsShareUrl?: string }).__fediWingsShareUrl = data.url;
      },
    });
  });
  await mockMastodon(page);
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();
  const threadCard = page.locator('.post-card').filter({
    hasText: 'Ein Testbeitrag aus dem Fediverse.',
  });
  await threadCard.locator('summary').click();
  await threadCard.getByRole('button', { name: 'Beitrag teilen' }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __fediWingsShareUrl?: string }).__fediWingsShareUrl ?? '',
      ),
    )
    .toBe(`${new URL('.', page.url()).href}#share=https%3A%2F%2Ftest.social%2F%40alice%2Fstatus-1`);
  const sharedUrl = await page.evaluate(
    () => (window as Window & { __fediWingsShareUrl?: string }).__fediWingsShareUrl!,
  );
  expect(sharedUrl.length).toBeLessThan(120);

  await page.goto(sharedUrl);
  await expect(page).toHaveTitle('Geteilte Thread-Analyse | FediWings');
  await expect(
    page.getByRole('heading', { name: 'Ein Fediverse-Thread. Seine Reichweite.' }),
  ).toBeVisible();
  const thread = page.getByRole('article', { name: 'Thread mit 2 Postings' });
  const stats = page.getByRole('complementary', { name: 'Netto-Reichweite' });
  await expect(thread.getByText('Ein Testbeitrag aus dem Fediverse.')).toBeVisible();
  await expect(thread.getByText('Eine Antwort im selben Thread.')).toBeVisible();
  await expect(thread.locator('.shared-thread-entry')).toHaveCount(2);
  await expect(stats).toContainText('2.050');
  await expect(stats).toContainText('269');
  await expect(stats).toContainText('17');
  await expect(stats).toContainText('3');

  const [threadBox, statsBox] = await Promise.all([thread.boundingBox(), stats.boundingBox()]);
  expect(threadBox).not.toBeNull();
  expect(statsBox).not.toBeNull();
  if (page.viewportSize()!.width > 720) {
    expect(threadBox!.x).toBeLessThan(statsBox!.x);
  } else {
    expect(statsBox!.y).toBeLessThan(threadBox!.y);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking).toEqual([]);
});

test('erstellt und teilt eine individuelle Card ueber den konfigurierten Service', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as Window & { __fediWingsCardServiceUrl?: string }).__fediWingsCardServiceUrl =
      'https://cards.test';
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { __fediWingsCardUrl?: string }).__fediWingsCardUrl = data.url;
      },
    });
  });
  const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173' };
  await page.route('https://cards.test/api/v1/share-token/', async (route) => {
    await route.fulfill({ json: { token: 'test-token', expiresIn: 300 }, headers: cors });
  });
  await page.route('https://cards.test/api/v1/cards/', async (route) => {
    const snapshot = route.request().postDataJSON();
    expect(await route.request().headerValue('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(snapshot.account.handle).toBe('@alice@test.social');
    expect(snapshot.content.excerpt).toBe('Ein Testbeitrag aus dem Fediverse.');
    await route.fulfill({
      status: 201,
      headers: cors,
      json: {
        id: '7Yp2mK9q',
        url: 'https://cards.test/s/7Yp2mK9q/',
        imageUrl: 'https://cards.test/s/7Yp2mK9q/card.png',
        createdAt: '2026-09-11T12:00:00.000Z',
      },
    });
  });
  await mockMastodon(page);
  await page.goto('/');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();
  const threadCard = page.locator('.post-card').filter({
    hasText: 'Ein Testbeitrag aus dem Fediverse.',
  });
  await threadCard.getByRole('button', { name: 'Beitrag teilen' }).click();

  const dialog = page.getByRole('dialog', { name: 'Analyse teilen' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Deine individuelle Vorschaukarte ist bereit.')).toBeVisible();
  await expect(dialog.locator('img')).toHaveAttribute(
    'src',
    'https://cards.test/s/7Yp2mK9q/card.png',
  );
  await dialog.getByRole('button', { name: 'Teilen' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __fediWingsCardUrl?: string }).__fediWingsCardUrl ?? '',
      ),
    )
    .toBe('https://cards.test/s/7Yp2mK9q/');

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking).toEqual([]);
});

test('zeigt fuer einen ungueltigen Share-Link einen sicheren Fehlerzustand', async ({ page }) => {
  await page.goto('/#share=j.invalid');

  await expect(
    page.getByRole('heading', { name: 'Diese Analyse kann nicht geöffnet werden.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zur FediWings-Startseite' })).toBeVisible();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveCount(0);
});

test('bleibt auf einem mobilen Viewport ohne horizontalen Ueberlauf bedienbar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Wie weit trägt/ })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByRole('button', { name: 'Analysieren' })).toBeVisible();
});

test('haelt das Hero-Emblem auch auf breiten Screens in der Textspalte', async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 965 });
  await page.goto('/');

  const positions = await page.evaluate(() => {
    const copy = document.querySelector('.hero-copy')!.getBoundingClientRect();
    const emblem = document.querySelector('.hero-emblem')!.getBoundingClientRect();
    const search = document.querySelector('.search-shell')!.getBoundingClientRect();
    return {
      copyLeft: copy.left,
      copyRight: copy.right,
      emblemLeft: emblem.left,
      emblemRight: emblem.right,
      searchLeft: search.left,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(positions.emblemLeft).toBeGreaterThanOrEqual(positions.copyLeft);
  expect(positions.emblemRight).toBeLessThanOrEqual(positions.copyRight + 1);
  expect(positions.emblemRight).toBeLessThan(positions.searchLeft);
  expect(positions.overflow).toBe(false);
});

test('wechselt ueber die Reiter auf die ausfuehrliche Methodikseite', async ({ page }) => {
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const analysisTab = navigation.getByRole('link', { name: 'Analyse' });
  const methodologyTab = navigation.getByRole('link', { name: 'Methodik' });
  await expect(analysisTab).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.privacy-line')).toHaveCount(0);

  await methodologyTab.click();
  await expect(page).toHaveURL(/\?view=methodik$/);
  await expect(page).toHaveTitle('Methodik | FediWings');
  await expect(methodologyTab).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Was die Zahlen wirklich sagen.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vom Handle zur Reichweite.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'So wenig Last wie möglich.' })).toBeVisible();
  const curveChart = page.getByRole('img', {
    name: 'Netto-Reichweite nach Boosts für null, zehn und fünfzig Interaktionen',
  });
  await expect(curveChart).toBeVisible();
  await expect(curveChart.locator('.reach-curve')).toHaveCount(3);
  await page.getByText('Technische Formel ansehen').click();
  await expect(page.getByText('0,0165 × G', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking).toEqual([]);

  await analysisTab.click();
  await expect(page.getByLabel('Vollständiger Fediverse-Handle')).toBeVisible();
});

test('wechselt die Sprache zu Englisch und behält die Auswahl', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Wie weit trägt dein Post im Fediverse?' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');

  const language = page.getByRole('group', { name: 'Sprache' });
  await language.getByRole('button', { name: 'EN' }).click();
  await expect(
    page.getByRole('heading', { name: 'How far does your post travel in the Fediverse?' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Analyse' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'EN' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'How far does your post travel in the Fediverse?' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'EN' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('erkennt einen Pixelfed-Server ueber NodeInfo und analysiert ihn wie gewohnt', async ({
  page,
}) => {
  await mockMastodon(page, 'pixelfed');
  await page.route('https://test.social/api/v1/accounts/lookup?*', async (route) => {
    await route.fulfill({ status: 400, json: { error: 'Record not found' } });
  });
  await page.route('https://test.social/api/v1/accounts/lookup?acct=alice', async (route) => {
    await route.fulfill({ json: account });
  });
  let rebloggedByRequested = false;
  await page.route('https://test.social/api/v1/statuses/*/reblogged_by*', async (route) => {
    rebloggedByRequested = true;
    await route.abort();
  });
  await page.route(
    'https://test.social/api/pixelfed/v1/accounts/account-1/statuses?*',
    async (route) => {
      await route.fulfill({
        json: [
          {
            id: 'status-1',
            created_at: daysAgo(2),
            url: 'https://test.social/p/alice/status-1',
            content: '<p>Ein Pixelfed-Beitrag.</p>',
            spoiler_text: '',
            visibility: 'public',
            favourites_count: 12,
            reblogs_count: 2,
            reply_count: 1,
            in_reply_to_id: null,
            in_reply_to_account_id: null,
            media_attachments: [],
          },
        ],
      });
    },
  );
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();

  await expect(page.getByRole('heading', { name: 'Alice Example' })).toBeVisible();
  await expect(page.getByText('· Pixelfed', { exact: false })).toBeVisible();
  await expect(
    page.getByText('Die Analyse ist abgeschlossen, enthält aber gekennzeichnete Teilergebnisse.'),
  ).toBeVisible();
  await expect(
    page.getByText('Pixelfed stellt keine öffentlichen Booster-Listen bereit; Brutto zählt nur'),
  ).toBeVisible();
  await expect(page.locator('.post-card').first()).toContainText('Ein Pixelfed-Beitrag.');
  expect(rebloggedByRequested).toBe(false);
});

test('meldet eine haengende Instanz nach Zeitueberschreitung als Fehler', async ({ page }) => {
  await page.route('https://hanging.example/api/v2/instance', () => {});

  await page.goto('/');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@hanging.example');
  await page.getByRole('button', { name: 'Analysieren' }).click();

  await expect(page.getByText('Der Server ist nicht erreichbar')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Analysieren' })).toBeEnabled();
});

test('kann die Verbindung waehrend der Aufloesung abbrechen', async ({ page }) => {
  await page.route('https://hanging.example/api/v2/instance', () => {});

  await page.goto('/');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@hanging.example');
  await page.getByRole('button', { name: 'Analysieren' }).click();

  await page.getByRole('button', { name: 'Verbindung abbrechen' }).click();
  await expect(page.getByText('Analyse abgebrochen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analysieren' })).toBeEnabled();
});

test('erfuehlt wesentliche Barrierefreiheitsregeln nach einer Analyse', async ({ page }) => {
  await mockMastodon(page);
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();
  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();
  await page.locator('.post-card').first().locator('summary').click();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking).toEqual([]);
});

test('speichert bei aktivem Merken den Handle und bietet ihn im Dropdown an', async ({ page }) => {
  await mockMastodon(page);
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByLabel('Merken').check();
  await page.getByRole('button', { name: 'Analysieren' }).click();
  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem('fediscope:hidden-handles-v1'));
  expect(stored).toBeTruthy();
  expect(stored).toContain('alice@test.social');

  await page.reload();
  const input = page.getByLabel('Vollständiger Fediverse-Handle');
  await input.click();
  const option = page.locator('#saved-handles-listbox').getByRole('option', {
    name: 'alice@test.social',
  });
  await expect(option).toBeVisible();
  await option.click();
  await expect(input).toHaveValue('alice@test.social');
  await expect(page.locator('#saved-handles-listbox')).toBeHidden();
});

test('Dropdown der gespeicherten Handles reagiert auf Tastatur', async ({ page }) => {
  await mockMastodon(page);
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByLabel('Merken').check();
  await page.getByRole('button', { name: 'Analysieren' }).click();
  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();

  await page.reload();
  const input = page.getByLabel('Vollständiger Fediverse-Handle');
  await input.click();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('alice@test.social');
  await expect(page.locator('#saved-handles-listbox')).toBeHidden();
});

test('Dropdown zeigt alle gespeicherten Handles und wird nicht beschnitten', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'fediscope:hidden-handles-v1',
      JSON.stringify([
        { handle: 'a@one.social', savedAt: '2026-01-01T00:00:00.000Z' },
        { handle: 'b@two.social', savedAt: '2026-01-02T00:00:00.000Z' },
        { handle: 'c@three.social', savedAt: '2026-01-03T00:00:00.000Z' },
      ]),
    );
  });
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').click();
  const listbox = page.locator('#saved-handles-listbox');
  await expect(listbox.getByRole('option')).toHaveCount(3);

  for (const name of ['a@one.social', 'b@two.social', 'c@three.social']) {
    const option = listbox.getByRole('option', { name });
    await expect(option).toBeVisible();
    await option.scrollIntoViewIfNeeded();
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el !== null && el.closest('[role="option"]') !== null;
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(hit).toBe(true);
  }
});

test('speichert ohne aktivem Merken keine Handles', async ({ page }) => {
  await mockMastodon(page);
  await page.goto('/');

  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByRole('button', { name: 'Analysieren' }).click();
  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem('fediscope:hidden-handles-v1'));
  expect(stored).toBeNull();
});

test('laedt weitere Statusseiten nach und Thread-Postings zaehlen nicht auf das Limit', async ({
  page,
}) => {
  const page1 = Array.from({ length: 40 }, (_, i) =>
    makeStatus(`p-${i}`, daysAgo(2, 12 + Math.floor(i / 60))),
  );
  const page2 = Array.from({ length: 10 }, (_, i) =>
    makeStatus(`q-${i}`, daysAgo(3, 11 + Math.floor(i / 60))),
  );
  const nextUrl =
    'https://test.social/api/v1/accounts/account-1/statuses?limit=40&exclude_reblogs=true&exclude_replies=true&max_id=page-0';

  await page.route('https://test.social/.well-known/nodeinfo', async (route) => {
    await route.fulfill({ status: 404 });
  });
  await page.route('https://test.social/api/v2/instance', async (route) => {
    await route.fulfill({ json: { domain: 'test.social', title: 'Test', version: '4.5.0' } });
  });
  await page.route('https://test.social/api/v1/accounts/lookup?*', async (route) => {
    await route.fulfill({ json: account });
  });
  await page.route(
    'https://test.social/api/v1/accounts/account-1/statuses?limit=40*',
    async (route) => {
      if (route.request().url().includes('max_id=')) {
        await route.fulfill({ json: page2 });
      } else {
        await route.fulfill({
          json: page1,
          headers: {
            Link: `<${nextUrl}>; rel="next"`,
            'Access-Control-Expose-Headers': 'Link, X-RateLimit-Limit, X-RateLimit-Remaining',
          },
        });
      }
    },
  );

  await page.goto('/');
  await page.getByLabel('Vollständiger Fediverse-Handle').fill('@alice@test.social');
  await page.getByLabel('Threads').selectOption('80');
  await page.getByRole('button', { name: 'Analysieren' }).click();

  await expect(
    page.getByText('Analyse abgeschlossen. Alle öffentlich auswertbaren Booster'),
  ).toBeVisible();
  await expect(page.locator('.post-card')).toHaveCount(50);
});
