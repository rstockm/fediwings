import { msg } from './i18n';
import { cardServiceResponseSchema, cardShareTokenSchema } from './schemas';
import type { CardServiceResponse, CardSnapshot, MastodonAccount, PostReach } from './types';

const SHARE_PREFIX = '#share=';
const MAX_POST_URL_LENGTH = 4096;

export interface SharedPostTarget {
  url: string;
  origin: string;
  statusId: string;
}

type CardServiceErrorCode = 'unavailable' | 'rejected' | 'rateLimited' | 'failed';

export class CardServiceError extends Error {
  constructor(public readonly code: CardServiceErrorCode) {
    super(code);
    this.name = 'CardServiceError';
  }
}

export function parseSharedPostUrl(value: string): SharedPostTarget {
  if (!value || value.length > MAX_POST_URL_LENGTH) {
    throw new Error(msg('error.shareNoUrl'));
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(msg('error.shareNoUrl'));
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(msg('error.shareInsecure'));
  }

  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length < 2) {
    throw new Error(msg('error.shareNoId'));
  }

  let statusId: string;
  try {
    statusId = decodeURIComponent(pathSegments.at(-1)!);
  } catch {
    throw new Error(msg('error.shareInvalidId'));
  }
  if (!statusId || statusId.length > 256 || statusId.includes('/')) {
    throw new Error(msg('error.shareInvalidId'));
  }

  url.search = '';
  url.hash = '';
  return { url: url.href, origin: url.origin, statusId };
}

export function hasSharedThreadHash(hash: string): boolean {
  return hash.startsWith(SHARE_PREFIX);
}

export function decodeSharedPost(hash: string): SharedPostTarget {
  if (!hasSharedThreadHash(hash) || hash.length > MAX_POST_URL_LENGTH * 3 + SHARE_PREFIX.length) {
    throw new Error(msg('error.shareInvalid'));
  }

  try {
    return parseSharedPostUrl(decodeURIComponent(hash.slice(SHARE_PREFIX.length)));
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(msg('error.shareInvalid'));
  }
}

export function createSharedThreadUrl(postUrl: string | null, baseUrl: string): string {
  if (!postUrl) throw new Error(msg('error.shareNoPostUrl'));
  const target = parseSharedPostUrl(postUrl);
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = `${SHARE_PREFIX.slice(1)}${encodeURIComponent(target.url)}`;
  return url.href;
}

function cardServiceUrl(): URL | null {
  const runtimeConfig = (globalThis as { __fediWingsCardServiceUrl?: unknown })
    .__fediWingsCardServiceUrl;
  const configured =
    (typeof runtimeConfig === 'string'
      ? runtimeConfig
      : import.meta.env.VITE_CARD_SERVICE_URL
    )?.trim() ?? '';
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function cardServiceAvailable(): boolean {
  return cardServiceUrl() !== null;
}

export function fullHandle(account: MastodonAccount): string {
  if (account.acct.includes('@')) return `@${account.acct}`;
  try {
    return `@${account.acct}@${new URL(account.url).hostname}`;
  } catch {
    return `@${account.acct}`;
  }
}

export function contentExcerpt(html: string, maximum = 280): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const image of document.querySelectorAll('img[alt]')) {
    image.replaceWith(document.createTextNode(` ${image.getAttribute('alt') ?? ''} `));
  }
  const text = (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= maximum ? text : `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

export function createCardSnapshot(
  result: PostReach,
  account: MastodonAccount,
  analyzedAt: string,
): CardSnapshot {
  if (!result.status.url) throw new Error(msg('error.shareNoPostUrl'));
  if (result.state !== 'complete' && result.state !== 'partial') {
    throw new CardServiceError('rejected');
  }
  const sensitive = result.status.sensitive || Boolean(result.status.spoiler_text.trim());
  const contentWarning = result.status.spoiler_text.trim() || (sensitive ? 'Sensibler Inhalt' : '');
  const excerpt = sensitive ? `CW: ${contentWarning}` : contentExcerpt(result.status.content, 280);
  return {
    version: 1,
    sourceUrl: parseSharedPostUrl(result.status.url).url,
    account: {
      url: account.url,
      displayName: account.display_name.trim() || fullHandle(account),
      handle: fullHandle(account),
      avatarUrl: account.avatar_static,
    },
    content: {
      excerpt,
      thumbnailUrl: sensitive
        ? null
        : (result.thumbnail?.preview_url ?? result.thumbnail?.url ?? null),
      contentWarning,
      sensitive,
    },
    metrics: {
      netReach: result.netReach,
      grossReach: result.grossReach,
      likes: result.likes,
      boosts: result.boosts,
    },
    analysisState: result.state,
    analyzedAt,
    algorithmVersion: 'net-reach-v1',
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new CardServiceError('failed');
  }
}

function responseUrl(value: string, service: URL): string {
  const url = new URL(value);
  if (url.origin !== service.origin) throw new CardServiceError('failed');
  return url.href;
}

export async function createCardShare(
  snapshot: CardSnapshot,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<CardServiceResponse> {
  const service = cardServiceUrl();
  if (!service) throw new CardServiceError('unavailable');
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(new URL('/api/v1/share-token/', service), { mode: 'cors' });
  } catch {
    throw new CardServiceError('unavailable');
  }
  if (!tokenResponse.ok) throw new CardServiceError('unavailable');
  const token = cardShareTokenSchema.safeParse(await readJson(tokenResponse));
  if (!token.success) throw new CardServiceError('failed');

  let response: Response;
  try {
    response = await fetch(new URL('/api/v1/cards/', service), {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'X-FediWings-Token': token.data.token,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(snapshot),
    });
  } catch {
    throw new CardServiceError('unavailable');
  }
  if (response.status === 429) throw new CardServiceError('rateLimited');
  if (!response.ok) throw new CardServiceError('rejected');
  const parsed = cardServiceResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new CardServiceError('failed');
  return {
    ...parsed.data,
    url: responseUrl(parsed.data.url, service),
    imageUrl: responseUrl(parsed.data.imageUrl, service),
  };
}
