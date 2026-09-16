import { fetchWithTimeout } from '../http';
import { msg } from '../i18n';
import type { AtprotoTarget } from '../types';
import { didDocumentSchema, resolveHandleSchema } from './schemas';

/** Öffentliche, unauthentifizierte AppView. Der PDS selbst beantwortet app.bsky.* nur mit Login. */
export const APPVIEW_ORIGIN = 'https://public.api.bsky.app';
export const PLC_DIRECTORY_ORIGIN = 'https://plc.directory';
export const ATPROTO_TIMEOUT_MS = 8_000;

const PDS_SERVICE_TYPE = 'AtprotoPersonalDataServer';
const DID_PATTERN = /^did:(plc|web):[a-z0-9._%:-]+$/i;
const HANDLE_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export class AtprotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtprotoError';
  }
}

function rethrowAbort(error: unknown, signal?: AbortSignal): void {
  if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted) throw error;
}

export function isDid(value: string): boolean {
  return DID_PATTERN.test(value);
}

/**
 * Normalisiert eine Eingabe zu einem AT-Proto-Handle oder einer DID.
 * Akzeptiert `dracoblue.de`, `@dracoblue.de` und `did:plc:…`; gibt bei
 * Fediverse-Handles (`@name@server`) null zurück.
 */
export function parseAtprotoIdentifier(value: string): string | null {
  const trimmed = value.trim();
  if (isDid(trimmed)) return trimmed;

  const withoutAt = trimmed.replace(/^@/, '').toLowerCase();
  if (withoutAt.includes('@') || withoutAt.includes('/')) return null;
  return HANDLE_PATTERN.test(withoutAt) ? withoutAt : null;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = (
      await fetchWithTimeout(
        url,
        { headers: { Accept: 'application/json' } },
        signal,
        ATPROTO_TIMEOUT_MS,
      )
    ).response;
  } catch (error) {
    rethrowAbort(error, signal);
    throw new AtprotoError(msg('error.atprotoUnreachable'));
  }

  if (!response.ok) throw new AtprotoError(msg('error.atprotoHandle'));

  try {
    return await response.json();
  } catch {
    throw new AtprotoError(msg('error.atprotoHandle'));
  }
}

/** Handle → DID über die AppView (im Browser ist keine DNS-TXT-Abfrage möglich). */
async function resolveDid(handle: string, signal?: AbortSignal): Promise<string> {
  const json = await getJson(
    `${APPVIEW_ORIGIN}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    signal,
  );
  const parsed = resolveHandleSchema.safeParse(json);
  if (!parsed.success) throw new AtprotoError(msg('error.atprotoHandle'));
  return parsed.data.did;
}

function didDocumentUrl(did: string): string {
  if (did.startsWith('did:plc:')) return `${PLC_DIRECTORY_ORIGIN}/${encodeURIComponent(did)}`;

  const host = did.slice('did:web:'.length).split(':')[0];
  return `https://${decodeURIComponent(host)}/.well-known/did.json`;
}

/** DID-Dokument laden und den Personal Data Server daraus lesen. */
async function resolvePds(
  did: string,
  signal?: AbortSignal,
): Promise<{ pdsOrigin: string; handle: string | null }> {
  let json: unknown;
  try {
    json = await getJson(didDocumentUrl(did), signal);
  } catch (error) {
    rethrowAbort(error, signal);
    throw new AtprotoError(msg('error.atprotoDid'));
  }

  const parsed = didDocumentSchema.safeParse(json);
  if (!parsed.success) throw new AtprotoError(msg('error.atprotoDid'));

  const service = parsed.data.service?.find((entry) => entry.type === PDS_SERVICE_TYPE);
  if (!service) throw new AtprotoError(msg('error.atprotoNoPds'));

  let pdsOrigin: string;
  try {
    const url = new URL(service.serviceEndpoint);
    if (url.protocol !== 'https:') throw new Error('insecure');
    pdsOrigin = url.origin;
  } catch {
    throw new AtprotoError(msg('error.atprotoNoPds'));
  }

  const alias = parsed.data.alsoKnownAs?.find((entry) => entry.startsWith('at://'));
  return { pdsOrigin, handle: alias ? alias.slice('at://'.length) : null };
}

export async function resolveAtprotoHandle(
  value: string,
  signal?: AbortSignal,
): Promise<AtprotoTarget> {
  const identifier = parseAtprotoIdentifier(value);
  if (!identifier) throw new AtprotoError(msg('error.atprotoHandle'));

  const did = isDid(identifier) ? identifier : await resolveDid(identifier, signal);
  const { pdsOrigin, handle } = await resolvePds(did, signal);

  return {
    did,
    handle: isDid(identifier) ? (handle ?? did) : identifier,
    pdsOrigin,
    appview: APPVIEW_ORIGIN,
  };
}
