import { z } from 'zod';
import { fetchWithTimeout } from './http';
import { nextLink } from './pagination';

const TYPES = ['favourite', 'reblog', 'mention', 'quote'] as const;
const PATH = '/api/v1/notifications';
const CACHE_MS = 5 * 60_000;
let cache: {
  key: string;
  value?: { history: ReportInteractionHistory; exhausted: boolean; year: number };
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
  stop?: 'year' | 'budget' | 'end' | 'http' | 'error';
  status?: number;
  cursor?: string;
  ids?: Set<string>;
  postIds?: Set<string>;
}

const PAGE_BUDGET = 40;

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
  options?: { cacheKey?: string; refresh?: boolean; resume?: ReportInteractionHistory },
): Promise<ReportInteractionHistory> {
  signal.throwIfAborted();
  const history: ReportInteractionHistory = {
    timestamps: [...(options?.resume?.timestamps ?? [])],
    oldest: options?.resume?.oldest ?? null,
    observedAt: options?.resume?.observedAt ?? Date.now(),
    stop: 'error',
  };
  if (!token || new URL(origin).protocol !== 'https:') return history;
  const yearStart = Date.UTC(year - 1, 11, 31, 23); // January 1, 00:00 in Berlin
  const key = options?.cacheKey ? `${origin}|${options.cacheKey}` : '';
  if (key && (options?.refresh || cache?.key !== key)) cache = { key };
  const activeCache = key ? cache : null;
  const cached = activeCache?.value;
  if (
    !options?.resume &&
    cached &&
    history.observedAt - cached.history.observedAt < CACHE_MS &&
    (cached.exhausted ||
      (cached.history.oldest !== null && cached.history.oldest < yearStart) ||
      (cached.history.stop === 'budget' && cached.year === year))
  )
    return cached.history;

  let exhausted = false;
  const params = new URLSearchParams({ limit: '80', include_filtered: 'true' });
  for (const type of TYPES) params.append('types[]', type);
  if (options?.resume?.cursor) params.set('max_id', options.resume.cursor);
  let url = `${origin}${PATH}?${params}`;
  const pages = new Set<string>();
  const seen = new Set(options?.resume?.ids);
  const seenPosts = new Set(options?.resume?.postIds);
  for (let i = 0; i < PAGE_BUDGET && !pages.has(url); i += 1) {
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
      if (!response.ok) {
        history.stop = 'http';
        history.status = response.status;
        break;
      }
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
        history.stop = exhausted ? 'end' : 'error';
        break;
      }
      if (history.oldest !== null && history.oldest < yearStart) {
        history.stop = 'year';
        break;
      }
      // Retain the same filters even if a compatible server omits them in links.
      params.set('max_id', cursor);
      url = `${origin}${PATH}?${params}`;
      if (i === PAGE_BUDGET - 1 && !pages.has(url)) {
        history.stop = 'budget';
      }
    } catch {
      signal.throwIfAborted();
      break;
    }
  }
  signal.throwIfAborted();
  const cursor = params.get('max_id');
  if (
    cursor &&
    (history.stop === 'budget' || history.stop === 'http' || history.stop === 'error')
  ) {
    history.cursor = cursor;
    history.ids = seen;
    history.postIds = seenPosts;
  }
  if (activeCache && (history.stop === 'budget' || history.stop === 'year' || exhausted)) {
    activeCache.value = { history, exhausted, year };
  }
  return history;
}
