import { parseHandle } from './handle';

/** Parse untrusted handles without network requests or HTML interpretation. */
export function readDeepLinkHandle(search: string, hash = ''): string | null {
  if (search.length > 2048 || hash) return null;
  const params = new URLSearchParams(search);
  if (
    params.has('code') ||
    params.has('error') ||
    params.getAll('view').length > 1 ||
    (params.has('view') && params.get('view') !== 'analyse')
  )
    return null;
  const values = params.getAll('handle');
  if (values.length !== 1) return null;
  const value = values[0];
  if (!value || value.length > 320 || /[\u0000-\u0020\u007f]/u.test(value)) return null;

  try {
    const parsed = parseHandle(value);
    const labels = parsed.domain.split('.');
    if (
      parsed.username.length > 64 ||
      parsed.domain.length > 253 ||
      labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
      !/[a-z]/i.test(labels[labels.length - 1]) ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/i.test(
        parsed.domain,
      )
    )
      return null;
    return parsed.acct;
  } catch {
    return null;
  }
}

export function shouldAutostartDeepLink(search: string, hash = ''): boolean {
  if (!readDeepLinkHandle(search, hash)) return false;
  const flags = new URLSearchParams(search).getAll('autostart');
  return flags.length === 1 && flags[0] === '1';
}
