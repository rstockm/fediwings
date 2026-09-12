import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandleError, INSTANCE_TIMEOUT_MS, parseHandle, resolveHandle } from './handle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseHandle', () => {
  it('normalisiert einen vollstaendigen Handle', () => {
    expect(parseHandle('  @Alice@Example.Social  ')).toEqual({
      username: 'Alice',
      domain: 'example.social',
      acct: 'Alice@example.social',
    });
  });

  it('lehnt Handles ohne Domain ab', () => {
    expect(() => parseHandle('@alice')).toThrow(HandleError);
  });

  it('lehnt Ports und Zugangsdaten ab', () => {
    expect(() => parseHandle('@alice@example.social:8443')).toThrow(HandleError);
    expect(() => parseHandle('@alice@user:pass@example.social')).toThrow(HandleError);
  });
});

describe('resolveHandle', () => {
  it('faellt fuer Akkoma ohne v2-Instanzendpunkt auf v1 zurueck', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        if (url === 'https://akkoma.example/api/v2/instance') {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Not implemented' }), { status: 404 }),
          );
        }
        if (url === 'https://akkoma.example/api/v1/instance') {
          return Promise.resolve(
            new Response(JSON.stringify({ version: '2.7.2 (compatible; Akkoma 3.20.0)' })),
          );
        }
        return Promise.reject(new TypeError(`Unexpected URL: ${url}`));
      }),
    );

    await expect(resolveHandle('@thomas@akkoma.example')).resolves.toEqual({
      username: 'thomas',
      domain: 'akkoma.example',
      acct: 'thomas@akkoma.example',
      origin: 'https://akkoma.example',
    });
    expect(calls).toEqual([
      'https://akkoma.example/api/v2/instance',
      'https://akkoma.example/api/v1/instance',
    ]);
  });

  it('bricht bei einer haengenden Instanz mit Zeitueberschreitung ab', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init.signal as AbortSignal;
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      ),
    );

    const promise = resolveHandle('@alice@hanging.example').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(INSTANCE_TIMEOUT_MS + 100);

    const error = await promise;
    expect(error).toBeInstanceOf(HandleError);
    expect((error as Error).message).toContain('nicht erreichbar');
  });
});
