import { z } from 'zod';
import { fetchWithTimeout } from './http';
import { nextLink } from './pagination';

const TYPES = ['favourite', 'reblog', 'mention', 'quote'] as const;
const PATH = '/api/v1/notifications';
const CACHE_MS = 5 * 60_000;
let cache: {
  key: string;
  value?: { history: ReportInteractionHistory; exhausted: boolean };
} | null = null;
const pageSchema = z.array(
  z.object({
    id: z.string().min(1),
    type: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    status: z.object({ id: z.string() }).nullish(),
  }),
);

export interface ReportInteractionHistory {
  timestamps: number[];
  oldest: number | null;
  observedAt: number;
}

/**
 * The API's end of pagination is not evidence that older notifications never
 * existed. Only the dates actually reached establish coverage.
 */
export async function loadReportInteractions(
  origin: string,
  token: string | undefined,
  year: number,
  signal: AbortSignal,
  onRequest?: (count: number) => void,
  options?: { cacheKey: string; refresh?: boolean },
): Promise<ReportInteractionHistory> {
  signal.throwIfAborted();
  const history: ReportInteractionHistory = {
    timestamps: [],
    oldest: null,
    observedAt: Date.now(),
  };
  if (!token || new URL(origin).protocol !== 'https:') return history;
  const yearStart = Date.UTC(year - 1, 11, 31, 23); // January 1, 00:00 in Berlin
  const key = options ? `${origin}|${options.cacheKey}` : '';
  if (options && (options.refresh || cache?.key !== key)) cache = { key };
  const activeCache = options ? cache : null;
  const cached = activeCache?.value;
  if (
    options &&
    cached &&
    history.observedAt - cached.history.observedAt < CACHE_MS &&
    (cached.exhausted || (cached.history.oldest !== null && cached.history.oldest < yearStart))
  )
    return cached.history;

  let exhausted = false;
  const params = new URLSearchParams({ limit: '80', include_filtered: 'true' });
  for (const type of TYPES) params.append('types[]', type);
  let url: string | null = `${origin}${PATH}?${params}`;
  const pages = new Set<string>();
  const seen = new Set<string>();
  const seenPosts = new Set<string>();
  for (let i = 0; url && i < 40 && !pages.has(url); i += 1) {
    signal.throwIfAborted();
    pages.add(url);
    try {
      onRequest?.(i + 1);
      const { response } = await fetchWithTimeout(
        url,
        {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          redirect: 'error',
        },
        signal,
        12_000,
      );
      if (!response.ok) break;
      const items = pageSchema.safeParse(await response.json());
      if (!items.success) break;
      for (const item of items.data) {
        const date = Date.parse(item.created_at);
        if (!Number.isFinite(date) || date > history.observedAt || seen.has(item.id)) continue;
        seen.add(item.id);
        history.oldest = Math.min(history.oldest ?? date, date);
        if (!TYPES.some((type) => type === item.type)) continue;
        // A single post may both quote and mention the recipient.
        if (item.status?.id && (item.type === 'mention' || item.type === 'quote')) {
          if (seenPosts.has(item.status.id)) continue;
          seenPosts.add(item.status.id);
        }
        history.timestamps.push(date);
      }
      const link = nextLink(response.headers.get('Link'), origin);
      const next = link ? new URL(link) : null;
      const cursor = next?.pathname === PATH ? next.searchParams.get('max_id') : null;
      if (!cursor) {
        exhausted = !response.headers.has('Link') || items.data.length === 0;
        break;
      }
      if (history.oldest !== null && history.oldest < yearStart) break;
      // Retain the same filters even if a compatible server omits them in links.
      params.set('max_id', cursor);
      url = `${origin}${PATH}?${params}`;
    } catch {
      signal.throwIfAborted();
      break;
    }
  }
  signal.throwIfAborted();
  if (activeCache && (exhausted || (history.oldest !== null && history.oldest < yearStart))) {
    activeCache.value = { history, exhausted };
  }
  return history;
}
