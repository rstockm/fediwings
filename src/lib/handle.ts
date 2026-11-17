import { fetchWithTimeout } from './http';
import { msg } from './i18n';
import { instanceSchema, webFingerSchema } from './schemas';
import type { InstanceTarget, ParsedHandle } from './types';

const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9_.-]*$/i;
const DOMAIN_URL_SYNTAX_PATTERN = /[\s/:?#\\@%[\]]/u;
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
  const domainInput = normalized.slice(separator + 1).toLowerCase();

  if (!USERNAME_PATTERN.test(username)) {
    throw new HandleError(msg('error.handleUsername'));
  }

  let origin: URL;
  try {
    origin = new URL(`https://${domainInput}`);
  } catch {
    throw new HandleError(msg('error.handleDomain'));
  }

  const domain = origin.hostname;

  if (
    DOMAIN_URL_SYNTAX_PATTERN.test(domainInput) ||
    !domain.includes('.') ||
    origin.username ||
    origin.password ||
    origin.port
  ) {
    throw new HandleError(msg('error.handleDomainPublic'));
  }

  return { username, domain, acct: `${username}@${domain}` };
}

type InstanceProbe =
  | { state: 'ok' }
  | { state: 'unreachable' }
  | { state: 'rate-limited' }
  | { state: 'http'; status: number }
  | { state: 'missing' };

const MISSING_ENDPOINT_STATUS = new Set([404, 405, 501]);

async function probeInstance(origin: string, signal?: AbortSignal): Promise<InstanceProbe> {
  const paths = ['/api/v2/instance', '/api/v1/instance'];
  let responded = false;
  let problemStatus: number | null = null;
  let rateLimited = false;

  for (const path of paths) {
    let response: Response;
    try {
      response = (
        await fetchWithTimeout(
          `${origin}${path}`,
          { headers: { Accept: 'application/json' } },
          signal,
          INSTANCE_TIMEOUT_MS,
        )
      ).response;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
        throw error;
      // A single failing endpoint must not hide the other API version.
      continue;
    }

    responded = true;

    if (!response.ok) {
      if (response.status === 429) {
        rateLimited = true;
      } else if (!MISSING_ENDPOINT_STATUS.has(response.status)) {
        problemStatus ??= response.status;
      }
      continue;
    }

    try {
      instanceSchema.parse(await response.json());
      return { state: 'ok' };
    } catch {
      // A challenge or error page can answer with 200; try the other endpoint.
    }
  }

  if (!responded) return { state: 'unreachable' };
  if (rateLimited) return { state: 'rate-limited' };
  if (problemStatus !== null) return { state: 'http', status: problemStatus };
  return { state: 'missing' };
}

function probeError(probe: InstanceProbe): HandleError | null {
  if (probe.state === 'ok') return null;
  if (probe.state === 'unreachable') return new HandleError(msg('error.handleServer'));
  if (probe.state === 'rate-limited') return new HandleError(msg('error.handleRateLimited'));
  if (probe.state === 'http') {
    return new HandleError(msg('error.apiHttp', { status: probe.status }));
  }
  return new HandleError(msg('error.handleNoApi'));
}

export async function resolveHandle(value: string, signal?: AbortSignal): Promise<InstanceTarget> {
  const parsed = parseHandle(value);
  const directOrigin = `https://${parsed.domain}`;

  const directProbe = await probeInstance(directOrigin, signal);
  if (directProbe.state === 'ok') {
    return { ...parsed, origin: directOrigin };
  }
  if (directProbe.state === 'unreachable') {
    throw new HandleError(msg('error.handleServer'));
  }
  if (directProbe.state === 'rate-limited') {
    throw new HandleError(msg('error.handleRateLimited'));
  }
  if (directProbe.state === 'http' && directProbe.status >= 500) {
    throw new HandleError(msg('error.apiHttp', { status: directProbe.status }));
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
    if (response.status === 429) {
      throw new HandleError(msg('error.handleRateLimited'));
    }
    if (response.status === 403 || response.status >= 500) {
      throw new HandleError(msg('error.apiHttp', { status: response.status }));
    }
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
  const error = probeError(actorProbe);
  if (error) throw error;

  return { ...parsed, origin };
}
