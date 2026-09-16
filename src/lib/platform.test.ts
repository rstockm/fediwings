import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectPlatform, UNKNOWN_PLATFORM } from './platform';

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function stubFetch(routes: Array<{ url: string; body?: unknown; ok?: boolean }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string) => {
      const route = routes.find(({ url }) => url === _url);
      if (!route) return Promise.reject(new TypeError('Network error'));
      return Promise.resolve(jsonResponse(route.body, route.ok));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectPlatform', () => {
  it('erkennt Pixelfed ueber NodeInfo 2.1', async () => {
    stubFetch([
      {
        url: 'https://pix.example/.well-known/nodeinfo',
        body: {
          links: [
            {
              rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
              href: 'https://pix.example/nodeinfo/2.0',
            },
            {
              rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
              href: 'https://pix.example/nodeinfo/2.1',
            },
          ],
        },
      },
      { url: 'https://pix.example/nodeinfo/2.1', body: { software: { name: 'pixelfed' } } },
    ]);

    const platform = await detectPlatform('https://pix.example');
    expect(platform).toEqual({ id: 'pixelfed', name: 'Pixelfed', protocol: 'mastodon' });
  });

  it('faellt auf NodeInfo 2.0 zurueck und erkennt Akkoma', async () => {
    stubFetch([
      {
        url: 'https://akk.example/.well-known/nodeinfo',
        body: {
          links: [
            {
              rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
              href: 'https://akk.example/nodeinfo/2.0',
            },
          ],
        },
      },
      { url: 'https://akk.example/nodeinfo/2.0', body: { software: { name: 'akkoma' } } },
    ]);

    const platform = await detectPlatform('https://akk.example');
    expect(platform.name).toBe('Akkoma');
  });

  it('liefert den generischen Fallback bei fehlendem NodeInfo', async () => {
    stubFetch([]);
    const platform = await detectPlatform('https://broken.example');
    expect(platform).toEqual(UNKNOWN_PLATFORM);
  });

  it('liefert den generischen Fallback bei unbekannter Software', async () => {
    stubFetch([
      {
        url: 'https://exotic.example/.well-known/nodeinfo',
        body: {
          links: [
            {
              rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
              href: 'https://exotic.example/nodeinfo/2.0',
            },
          ],
        },
      },
      { url: 'https://exotic.example/nodeinfo/2.0', body: { software: { name: 'exotic' } } },
    ]);

    const platform = await detectPlatform('https://exotic.example');
    expect(platform).toEqual(UNKNOWN_PLATFORM);
  });
});
