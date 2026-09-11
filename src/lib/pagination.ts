export function nextLink(
  header: string | null,
  allowedOrigin: string,
  rel = 'next',
): string | null {
  if (!header) return null;

  for (const entry of header.split(',')) {
    const match = entry.trim().match(/^<([^>]+)>\s*;\s*rel="?([^";]+)"?/i);
    if (!match || match[2] !== rel) continue;

    try {
      const url = new URL(match[1]);
      if (url.origin === allowedOrigin && url.protocol === 'https:') return url.toString();
    } catch {
      return null;
    }
  }

  return null;
}
