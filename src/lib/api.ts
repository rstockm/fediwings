import type { z } from 'zod';
import { msg } from './i18n';
import { fetchWithTimeout } from './http';
import { nextLink } from './pagination';
import {
  accountListSchema,
  accountSchema,
  pixelfedStatusListSchema,
  statusContextSchema,
  statusListSchema,
  statusWithAccountSchema,
} from './schemas';
import type {
  ApiPage,
  MastodonAccount,
  MastodonStatus,
  MastodonStatusContext,
  MastodonStatusWithAccount,
  RateLimit,
} from './types';

const REQUEST_TIMEOUT_MS = 12_000;

export class MastodonApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
    public readonly resetAt: number | null = null,
  ) {
    super(message);
    this.name = 'MastodonApiError';
  }
}

function readRateLimit(headers: Headers): RateLimit {
  const number = (name: string) => {
    const value = headers.get(name);
    return value === null || Number.isNaN(Number(value)) ? null : Number(value);
  };
  const reset = headers.get('X-RateLimit-Reset');
  const resetAt = reset ? Date.parse(reset) : null;

  return {
    limit: number('X-RateLimit-Limit'),
    remaining: number('X-RateLimit-Remaining'),
    resetAt: resetAt !== null && !Number.isNaN(resetAt) ? resetAt : null,
  };
}

async function get<T extends z.ZodType>(
  url: string,
  schema: T,
  signal?: AbortSignal,
): Promise<ApiPage<z.output<T>>> {
  let response: Response;
  let timedOut = false;

  try {
    const result = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/json' } },
      signal,
      REQUEST_TIMEOUT_MS,
    );
    response = result.response;
    timedOut = result.timedOut;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted)
      throw error;
    throw new MastodonApiError(timedOut ? msg('error.apiTimeout') : msg('error.apiUnreachable'));
  }

  const rateLimit = readRateLimit(response.headers);
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: msg('error.api401'),
      404: msg('error.api404'),
      429: msg('error.api429'),
    };
    throw new MastodonApiError(
      messages[response.status] ?? msg('error.apiHttp', { status: response.status }),
      response.status,
      rateLimit.resetAt,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new MastodonApiError(msg('error.apiJson'), response.status);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new MastodonApiError(msg('error.apiInvalid'));
  }

  return { data: parsed.data, link: response.headers.get('Link'), rateLimit };
}

export async function getAccount(
  origin: string,
  acct: string,
  signal?: AbortSignal,
  platformId?: string,
): Promise<MastodonAccount> {
  const lookup = (candidate: string) =>
    get(
      `${origin}/api/v1/accounts/lookup?acct=${encodeURIComponent(candidate)}`,
      accountSchema,
      signal,
    );

  if (platformId === 'friendica') {
    // Friendica requires a login for /accounts/lookup (unlike Mastodon), so a
    // lookup attempt would always fail with 401. The Mastodon-compatible
    // route /accounts/{name} resolves the local nickname anonymously instead.
    const localName = acct.split('@')[0];
    try {
      return (
        await get(
          `${origin}/api/v1/accounts/${encodeURIComponent(localName)}`,
          accountSchema,
          signal,
        )
      ).data;
    } catch (error) {
      if (error instanceof MastodonApiError && (error.status === 401 || error.status === 403)) {
        throw new MastodonApiError(msg('error.apiLoginRequired'), error.status);
      }
      throw error;
    }
  }

  try {
    return (await lookup(acct)).data;
  } catch (error) {
    const localName = acct.split('@')[0];
    if (
      acct.includes('@') &&
      localName !== acct &&
      error instanceof MastodonApiError &&
      (error.status === 400 || error.status === 404)
    ) {
      return (await lookup(localName)).data;
    }
    throw error;
  }
}

export async function getStatus(
  origin: string,
  statusId: string,
  signal?: AbortSignal,
): Promise<MastodonStatusWithAccount> {
  return (
    await get(
      `${origin}/api/v1/statuses/${encodeURIComponent(statusId)}`,
      statusWithAccountSchema,
      signal,
    )
  ).data;
}

export async function getStatusContext(
  origin: string,
  statusId: string,
  signal?: AbortSignal,
): Promise<MastodonStatusContext> {
  return (
    await get(
      `${origin}/api/v1/statuses/${encodeURIComponent(statusId)}/context`,
      statusContextSchema,
      signal,
    )
  ).data;
}

export const STATUSES_PER_PAGE = 40;
export const MAX_STATUS_PAGES = 4;
export const PIXELFED_STATUSES_PER_PAGE = 24;

export interface StatusCollection {
  statuses: MastodonStatus[];
  requests: number;
  oldestFetchedAt: string | null;
  historyComplete: boolean;
}

function isOriginalOrSelfReply(status: MastodonStatus, accountId: string): boolean {
  return status.in_reply_to_id === null || status.in_reply_to_account_id === accountId;
}

function olderDate(current: string | null, statuses: MastodonStatus[]): string | null {
  return statuses.reduce((oldest, status) => {
    const timestamp = Date.parse(status.created_at);
    if (!Number.isFinite(timestamp)) return oldest;
    if (oldest === null || timestamp < Date.parse(oldest)) return status.created_at;
    return oldest;
  }, current);
}

export async function getStatuses(
  origin: string,
  accountId: string,
  signal?: AbortSignal,
): Promise<StatusCollection> {
  const params = new URLSearchParams({
    limit: String(STATUSES_PER_PAGE),
    exclude_reblogs: 'true',
    exclude_replies: 'true',
  });

  const statuses: MastodonStatus[] = [];
  let url: string | null =
    `${origin}/api/v1/accounts/${encodeURIComponent(accountId)}/statuses?${params}`;
  let requests = 0;
  let oldestFetchedAt: string | null = null;
  let historyComplete = false;

  while (url && requests < MAX_STATUS_PAGES) {
    let page: ApiPage<MastodonStatus[]>;
    try {
      page = await get(url, statusListSchema, signal);
    } catch (error) {
      if (error instanceof MastodonApiError && error.status === 429 && error.resetAt) {
        const delay = Math.max(0, error.resetAt - Date.now());
        await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
        page = await get(url, statusListSchema, signal);
      } else {
        throw error;
      }
    }

    oldestFetchedAt = olderDate(oldestFetchedAt, page.data);
    statuses.push(...page.data.filter((status) => isOriginalOrSelfReply(status, accountId)));
    requests += 1;
    const next = nextLink(page.link, origin);
    historyComplete = next === null && page.data.length < STATUSES_PER_PAGE;
    url = next;
  }

  return { statuses, requests, oldestFetchedAt, historyComplete };
}

export interface ReportStatusCollection extends StatusCollection {
  error: string | null;
  nextUrl?: string | null;
  exhausted?: boolean;
}

/**
 * Load the public account history through the start of a Berlin calendar year.
 * Unlike the short analysis, include replies so self-reply threads can be grouped.
 */
export async function getReportStatuses(
  origin: string,
  accountId: string,
  year: number,
  signal: AbortSignal,
  onProgress?: (requests: number, oldestFetchedAt: string | null) => void,
  maxPages = 100,
  pixelfed = false,
  previous?: ReportStatusCollection,
): Promise<ReportStatusCollection> {
  const boundary = Date.UTC(year - 1, 11, 31, 23);
  const params = new URLSearchParams({
    limit: String(STATUSES_PER_PAGE),
    exclude_reblogs: 'true',
  });
  let url: string | null = pixelfed
    ? `${origin}/api/pixelfed/v1/accounts/${encodeURIComponent(accountId)}/statuses?limit=${PIXELFED_STATUSES_PER_PAGE}`
    : `${origin}/api/v1/accounts/${encodeURIComponent(accountId)}/statuses?${params}`;
  if (previous) url = previous.nextUrl ?? null;
  const statuses: MastodonStatus[] = [...(previous?.statuses ?? [])];
  const seen = new Set<string>(statuses.map((status) => status.id));
  const visited = new Set<string>();
  let requests = 0;
  let oldestFetchedAt: string | null = previous?.oldestFetchedAt ?? null;
  let historyComplete = false;
  let exhausted = previous?.exhausted ?? false;
  let error: string | null = null;

  while (url && requests < maxPages) {
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    if (visited.has(url)) break;
    visited.add(url);
    try {
      const page: ApiPage<MastodonStatus[]> = pixelfed
        ? await get(url, pixelfedStatusListSchema, signal)
        : await get(url, statusListSchema, signal);
      requests += 1;
      oldestFetchedAt = olderDate(oldestFetchedAt, page.data);
      for (const status of page.data) {
        if (!seen.has(status.id) && isOriginalOrSelfReply(status, accountId)) {
          seen.add(status.id);
          statuses.push(status);
        }
      }
      onProgress?.(requests, oldestFetchedAt);
      const relation = pixelfed ? 'prev' : 'next';
      const next = nextLink(page.link, origin, relation);
      const nextDeclared = page.link
        ?.split(',')
        .some((entry) => new RegExp(`;\\s*rel="?${relation}"?(?:\\s*;|\\s*$)`, 'i').test(entry));
      exhausted =
        !next &&
        !nextDeclared &&
        page.data.length < (pixelfed ? PIXELFED_STATUSES_PER_PAGE : STATUSES_PER_PAGE);
      url = next;
      if ((oldestFetchedAt !== null && Date.parse(oldestFetchedAt) < boundary) || exhausted) {
        historyComplete = true;
        break;
      }
    } catch (caught) {
      if (signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError')) {
        throw caught;
      }
      error = caught instanceof Error ? caught.message : msg('error.apiUnreachable');
      break;
    }
  }
  return { statuses, requests, oldestFetchedAt, historyComplete, error, nextUrl: url, exhausted };
}

export function getRebloggers(
  url: string,
  signal?: AbortSignal,
): Promise<ApiPage<MastodonAccount[]>> {
  return get(url, accountListSchema, signal);
}

export async function getPixelfedStatuses(
  origin: string,
  accountId: string,
  signal?: AbortSignal,
): Promise<StatusCollection> {
  let url: string | null =
    `${origin}/api/pixelfed/v1/accounts/${encodeURIComponent(accountId)}/statuses?limit=${PIXELFED_STATUSES_PER_PAGE}`;
  const statuses: MastodonStatus[] = [];
  let requests = 0;
  let oldestFetchedAt: string | null = null;
  let historyComplete = false;

  while (url && requests < MAX_STATUS_PAGES) {
    const page = await get(url, pixelfedStatusListSchema, signal);
    oldestFetchedAt = olderDate(oldestFetchedAt, page.data);
    statuses.push(...page.data.filter((status) => isOriginalOrSelfReply(status, accountId)));
    requests += 1;
    const next = nextLink(page.link, origin, 'prev');
    historyComplete = next === null && page.data.length < PIXELFED_STATUSES_PER_PAGE;
    url = next;
  }

  return { statuses, requests, oldestFetchedAt, historyComplete };
}
