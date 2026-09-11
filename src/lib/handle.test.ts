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
