import type { ReportPdfSnapshot } from './model';
import { safePdfUrl } from './model';

/** Data URLs handed to pdfmake. Remote images must be embedded because the
 * exporter denies runtime URL access and external media servers do not
 * reliably send CORS headers. */
export interface PdfImages {
  avatar: string | null;
  posts: Record<string, string>;
}

export const emptyPdfImages: PdfImages = { avatar: null, posts: {} };

const timeoutMs = 6000;
const maxBytes = 8_000_000;
const avatarSize = 96;
const postWidth = 240;
const postHeight = 180;
const supportedTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

async function fetchBlob(url: string): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!supportedTypes.has(blob.type) || blob.size === 0 || blob.size > maxBytes) return null;
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to the <img> decoder below.
    }
  }
  if (typeof Image === 'undefined') return null;
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement) {
  const width = source.width || ('naturalWidth' in source ? source.naturalWidth : 0);
  const height = source.height || ('naturalHeight' in source ? source.naturalHeight : 0);
  return { width, height };
}

function draw(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  circle: boolean,
): string | null {
  if (typeof document === 'undefined') return null;
  const { width: sourceWidth, height: sourceHeight } = sourceSize(source);
  if (!sourceWidth || !sourceHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  if (circle) {
    context.save();
    context.beginPath();
    context.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
    context.clip();
  }
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    source,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  if (circle) context.restore();
  try {
    return circle ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

async function loadImage(url: string | null, circle: boolean): Promise<string | null> {
  const safe = safePdfUrl(url);
  if (!safe) return null;
  const blob = await fetchBlob(safe);
  if (!blob) return null;
  const source = await decode(blob);
  if (!source) return null;
  const result = circle
    ? draw(source, avatarSize, avatarSize, true)
    : draw(source, postWidth, postHeight, false);
  if ('close' in source) source.close();
  return result;
}

/** Loads the account avatar and the top-post thumbnails; every failure is silent. */
export async function loadReportPdfImages(snapshot: ReportPdfSnapshot): Promise<PdfImages> {
  const entries = await Promise.all(
    snapshot.topPosts.map(
      async (post) => [post.id, await loadImage(post.imageUrl ?? null, false)] as const,
    ),
  );
  const posts: Record<string, string> = {};
  for (const [id, data] of entries) if (data) posts[id] = data;
  return {
    avatar: await loadImage(snapshot.avatarUrl ?? null, true),
    posts,
  };
}
