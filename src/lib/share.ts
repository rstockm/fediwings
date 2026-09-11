import { msg } from './i18n';

const SHARE_PREFIX = '#share=';
const MAX_POST_URL_LENGTH = 4096;

export interface SharedPostTarget {
  url: string;
  origin: string;
  statusId: string;
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
