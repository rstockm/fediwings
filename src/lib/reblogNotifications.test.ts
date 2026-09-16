import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedNotificationError, ReblogNotificationCache } from './reblogNotifications';

function response(body: unknown, link: string | null = null, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(link ? { Link: link } : {}),
    json: () => Promise.resolve(body),
  } as Response;
}

function event(id: string, statusId: string, createdAt: string) {
  return { id, type: 'reblog', created_at: createdAt, status: { id: statusId } };
}

afterEach(() => vi.unstubAllGlobals());

describe('ReblogNotificationCache', () => {
  it('laedt genau eine Seite, reduziert Daten und sendet den Token nur an die Session-Origin', async () => {
    const stub = vi.fn(() =>
      Promise.resolve(
        response([
          {
            ...event('notification-a', 'status-1', '2026-09-15T12:00:00Z'),
            account: { id: 'booster-1', display_name: 'Nicht speichern' },
          },
        ]),
      ),
    );
    vi.stubGlobal('fetch', stub);
    const cache = new ReblogNotificationCache('https://test.social', 'secret-token');

    await cache.loadNext(new AbortController().signal);

    expect(cache.requests).toBe(1);
    expect(cache.eventsFor(['status-1'])).toEqual([
      {
        id: 'notification-a',
        statusId: 'status-1',
        createdAt: '2026-09-15T12:00:00Z',
      },
    ]);
    const [url, init] = stub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('types%5B%5D=reblog');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret-token');
  });

  it('folgt nur einem sicheren Link derselben Origin und dedupliziert String-IDs', async () => {
    const stub = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          [event('01JABC', 'status-1', '2026-09-15T12:00:00Z')],
          '<https://test.social/api/v1/notifications?max_id=01JABC>; rel="next"',
        ),
      )
      .mockResolvedValueOnce(
        response([
          event('01JABC', 'status-1', '2026-09-15T12:00:00Z'),
          event('01JABB', 'status-1', '2026-09-14T12:00:00Z'),
        ]),
      );
    vi.stubGlobal('fetch', stub);
    const cache = new ReblogNotificationCache('https://test.social', 'token');

    await cache.loadNext(new AbortController().signal);
    await cache.loadNext(new AbortController().signal);

    expect(cache.requests).toBe(2);
    expect(cache.eventsFor(['status-1']).map((item) => item.id)).toEqual(['01JABB', '01JABC']);
    expect(cache.covers('2026-09-14T13:00:00Z')).toBe(true);
  });

  it('verwirft einen Pagination-Link zu einer fremden Origin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          response(
            [event('1', 'status-1', '2026-09-15T12:00:00Z')],
            '<https://evil.example/api/v1/notifications?max_id=1>; rel="next"',
          ),
        ),
      ),
    );
    const cache = new ReblogNotificationCache('https://test.social', 'token');
    await cache.loadNext(new AbortController().signal);
    expect(cache.exhausted).toBe(true);
  });

  it('liefert den HTTP-Status typisiert weiter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response({}, null, 401))),
    );
    const cache = new ReblogNotificationCache('https://test.social', 'token');
    await expect(cache.loadNext(new AbortController().signal)).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<AuthenticatedNotificationError>);
  });
});
