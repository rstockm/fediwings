import { fetchWithTimeout } from './http';
import { msg } from './i18n';
import { instanceSchema, webFingerSchema } from './schemas';
import type { InstanceTarget, ParsedHandle } from './types';

const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9_.-]*$/i;
export const INSTANCE_TIMEOUT_MS = 6_000;
const WEBFINGER_TIMEOUT_MS = 8_000;

export class HandleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandleError';
  }
}

export function parseHandle(value: string): ParsedHandle {
  const normalized = value.trim().replace(/^@/, '');
  const separator = normalized.lastIndexOf('@');

  if (separator < 1 || separator === normalized.length - 1) {
    throw new HandleError(msg('error.handleEmpty'));
  }

  const username = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1).toLowerCase();

  if (!USERNAME_PATTERN.test(username)) {
    throw new HandleError(msg('error.handleUsername'));
  }

  let origin: URL;
  try {
    origin = new URL(`https://${domain}`);
  } catch {
    throw new HandleError(msg('error.handleDomain'));
  }

  if (
    origin.hostname !== domain ||
    !domain.includes('.') ||
    origin.username ||
    origin.password ||
    origin.port
  ) {
    throw new HandleError(msg('error.handleDomainPublic'));
  }

  return { username, domain, acct: `${username}@${domain}` };
}

type InstanceProbe = 'ok' | 'unreachable' | 'other';

async function probeInstance(origin: string, signal?: AbortSignal): Promise<InstanceProbe> {
  let response: Response;

  try {
    response = (
      await fetchWithTimeout(
        `${origin}/api/v2/instance`,
        { headers: { Accept: 'application/json' } },
        signal,
        INSTANCE_TIMEOUT_MS,
      )
    ).response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    return 'unreachable';
  }

  if (!response.ok) return 'other';

  try {
    instanceSchema.parse(await response.json());
    return 'ok';
  } catch {
    return 'other';
  }
}

export async function resolveHandle(value: string, signal?: AbortSignal): Promise<InstanceTarget> {
  const parsed = parseHandle(value);
  const directOrigin = `https://${parsed.domain}`;

  const directProbe = await probeInstance(directOrigin, signal);
  if (directProbe === 'ok') {
    return { ...parsed, origin: directOrigin };
  }
  if (directProbe === 'unreachable') {
    throw new HandleError(msg('error.handleServer'));
  }

  let response: Response;
  try {
    response = (
      await fetchWithTimeout(
        `${directOrigin}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${parsed.acct}`)}`,
        { headers: { Accept: 'application/jrd+json, application/json' } },
        signal,
        WEBFINGER_TIMEOUT_MS,
      )
    ).response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    throw new HandleError(msg('error.handleServer'));
  }

  if (!response.ok) {
    throw new HandleError(msg('error.handleWebfinger'));
  }

  let webFinger: ReturnType<typeof webFingerSchema.parse> | null = null;
  try {
    webFinger = webFingerSchema.parse(await response.json());
  } catch {
    throw new HandleError(msg('error.handleWebfingerInvalid'));
  }

  const selfLink = webFinger.links.find(
    (link) => link.rel === 'self' && link.href?.startsWith('https://'),
  );

  if (!selfLink?.href) {
    throw new HandleError(msg('error.handleWebfingerInsecure'));
  }

  const actorUrl = new URL(selfLink.href);
  const origin = actorUrl.origin;
  const actorProbe = await probeInstance(origin, signal);
  if (actorProbe === 'unreachable') {
    throw new HandleError(msg('error.handleServer'));
  }
  if (actorProbe !== 'ok') {
    throw new HandleError(msg('error.handleNoApi'));
  }

  return { ...parsed, origin };
}
