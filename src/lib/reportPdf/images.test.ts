import { afterEach, describe, expect, it, vi } from 'vitest';
import { pdfFixture } from './fixtures';
import { loadReportPdfImages } from './images';

function withImages() {
  const snapshot = pdfFixture();
  snapshot.avatarUrl = 'https://example.social/avatar.png';
  for (const post of snapshot.topPosts) post.imageUrl = `https://example.social/${post.id}.jpg`;
  return snapshot;
}

describe('PDF-Medien', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lädt bei Netzwerk- oder CORS-Fehlern still keine Bilder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(loadReportPdfImages(withImages())).resolves.toEqual({
      avatar: null,
      posts: {},
    });
  });

  it('ruft für unsichere Bildquellen kein Netzwerk ab', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const snapshot = withImages();
    snapshot.avatarUrl = 'javascript:alert(1)';
    snapshot.topPosts[0].imageUrl = 'data:image/png;base64,AAAA';
    await loadReportPdfImages(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalledWith('javascript:alert(1)', expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith('data:image/png;base64,AAAA', expect.anything());
  });

  it('verwirft Nicht-Bild- und übergroße Antworten', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        blob: async () =>
          url.endsWith('avatar.png')
            ? { type: 'text/plain', size: 10 }
            : { type: 'image/jpeg', size: 9_000_000 },
      })),
    );
    await expect(loadReportPdfImages(withImages())).resolves.toEqual({
      avatar: null,
      posts: {},
    });
  });

  it('verkleinert geladene Bilder und gibt Data-URLs zurück', async () => {
    const drawImage = vi.fn();
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      save: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      clip: vi.fn(),
      drawImage,
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      (type) => `data:${type};base64,AAAA`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['image'], { type: 'image/png' }),
      })),
    );

    const images = await loadReportPdfImages(withImages());
    expect(Object.keys(images.posts)).toHaveLength(5);
    expect(images.avatar).toBe('data:image/png;base64,AAAA');
    expect(images.posts['demo-0']).toBe('data:image/jpeg;base64,AAAA');
    expect(drawImage).toHaveBeenCalledTimes(6);
    expect(close).toHaveBeenCalledTimes(6);
  });
});
