import { getRebloggers } from './api';
import { nextLink } from './pagination';
import type { RateLimit } from './types';

const MASTODON_PAGE_SIZE = 80;

const NO_RATE_LIMIT: RateLimit = { limit: null, remaining: null, resetAt: null };

/** Position innerhalb der Booster-Liste eines Beitrags. `token === null` heißt „erste Seite". */
export interface BoosterCursor {
  statusId: string;
  token: string | null;
}

export interface BoosterPage {
  /** Bereits entdoppelbar: `key` identifiziert das Konto protokollübergreifend. */
  accounts: Array<{ key: string; followers: number }>;
  next: BoosterCursor | null;
  rateLimit: RateLimit;
  /** Tatsächlich abgesetzte HTTP-Anfragen – AT Proto braucht Zusatzabrufe für Followerzahlen. */
  requests: number;
}

/**
 * Quelle für die Liste der Konten, die einen Beitrag geteilt haben. Kapselt die
 * Unterschiede zwischen Mastodons `reblogged_by` (Link-Header) und
 * `app.bsky.feed.getRepostedBy` (Cursor im Body).
 */
export interface BoosterSource {
  page(cursor: BoosterCursor, signal: AbortSignal): Promise<BoosterPage>;
}

export function mastodonBoosterSource(origin: string): BoosterSource {
  return {
    async page(cursor, signal) {
      const url =
        cursor.token ??
        `${origin}/api/v1/statuses/${encodeURIComponent(cursor.statusId)}/reblogged_by?limit=${MASTODON_PAGE_SIZE}`;
      const result = await getRebloggers(url, signal);
      const next = nextLink(result.link, origin);

      return {
        accounts: result.data.map((account) => ({
          key: account.uri ?? account.acct,
          followers: account.followers_count,
        })),
        next: next ? { statusId: cursor.statusId, token: next } : null,
        rateLimit: result.rateLimit,
        requests: 1,
      };
    },
  };
}

export { NO_RATE_LIMIT };
