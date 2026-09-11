import { fetchWithTimeout } from './http';
import { nodeInfoIndexSchema, nodeInfoSchema } from './schemas';
import type { ServerPlatform } from './types';

const NODEINFO_TIMEOUT_MS = 6_000;

const KNOWN_SOFTWARE: Record<string, string> = {
  mastodon: 'Mastodon',
  pixelfed: 'Pixelfed',
  pleroma: 'Pleroma',
  akkoma: 'Akkoma',
  hometown: 'Hometown',
  'glitch-soc': 'Glitch-Soc',
  friendica: 'Friendica',
  gotosocial: 'GoToSocial',
  sharkey: 'Sharkey',
  misskey: 'Misskey',
  firefish: 'Firefish',
  iceshrimp: 'Iceshrimp',
};

export const UNKNOWN_PLATFORM: ServerPlatform = {
  id: 'unknown',
  name: 'ActivityPub-Server',
  mastodonApi: true,
};

export async function detectPlatform(
  origin: string,
  signal?: AbortSignal,
): Promise<ServerPlatform> {
  try {
    const index = await fetchWithTimeout(
      `${origin}/.well-known/nodeinfo`,
      { headers: { Accept: 'application/json' } },
      signal,
      NODEINFO_TIMEOUT_MS,
    );
    if (!index.response.ok) return UNKNOWN_PLATFORM;

    const links = nodeInfoIndexSchema.parse(await index.response.json()).links;
    const profileUrl =
      links.find((link) => link.rel.endsWith('/schema/2.1'))?.href ??
      links.find((link) => link.rel.endsWith('/schema/2.0'))?.href;
    if (!profileUrl) return UNKNOWN_PLATFORM;

    const profile = await fetchWithTimeout(
      profileUrl,
      { headers: { Accept: 'application/json' } },
      signal,
      NODEINFO_TIMEOUT_MS,
    );
    if (!profile.response.ok) return UNKNOWN_PLATFORM;

    const software = nodeInfoSchema.parse(await profile.response.json()).software;
    const name = KNOWN_SOFTWARE[software.name.toLowerCase()];
    if (!name) return UNKNOWN_PLATFORM;
    return { id: software.name.toLowerCase(), name, mastodonApi: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    return UNKNOWN_PLATFORM;
  }
}
