import { followerNotificationListSchema, followerNotificationSchema } from './schemas';
import type { z } from 'zod';
import { fetchWithTimeout } from './http';
import { msg } from './i18n';

export const FOLLOW_NOTIFICATION_TYPES = ['follow', 'follow_request'] as const;
const NOTIFICATIONS_PER_PAGE = 80;
const NOTIFICATIONS_TIMEOUT_MS = 12_000;
export const DEFAULT_MAX_PAGES = 40;

export interface FollowerEvent {
  id: string;
  type: string;
  date: string;
}

export interface FollowerPageResult {
  events: FollowerEvent[];
  requests: number;
  truncated: boolean;
}

export interface FollowerProgress {
  requests: number;
  events: number;
  oldest: string | null;
}

type Notification = z.output<typeof followerNotificationSchema>;

export async function fetchFollowerEvents(
  origin: string,
  token: string,
  signal: AbortSignal,
  onProgress?: (progress: FollowerProgress) => void,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<FollowerPageResult> {
  const events: FollowerEvent[] = [];
  const seen = new Set<string>();
  let requests = 0;
  let truncated = false;
  let maxId: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams();
    for (const type of FOLLOW_NOTIFICATION_TYPES) params.append('types[]', type);
    params.set('limit', String(NOTIFICATIONS_PER_PAGE));
    if (maxId) params.set('max_id', maxId);

    if (signal.aborted) {
      throw new DOMException('Abgebrochen', 'AbortError');
    }

    const response = await fetchWithTimeout(
      `${origin}/api/v1/notifications?${params}`,
      { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
      signal,
      NOTIFICATIONS_TIMEOUT_MS,
    );
    requests += 1;

    if (!response.response.ok) {
      if (response.response.status === 401) {
        throw new Error(msg('error.followersExpired'));
      }
      if (response.response.status === 403) {
        throw new Error(msg('error.followers403'));
      }
      throw new Error(msg('error.followersHttp', { status: response.response.status }));
    }

    let json: unknown;
    try {
      json = await response.response.json();
    } catch {
      throw new Error(msg('error.followersInvalidResponse'));
    }

    const parsed = followerNotificationListSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(msg('error.followersInvalidData'));
    }

    const items = parsed.data.filter((item: Notification) =>
      (FOLLOW_NOTIFICATION_TYPES as readonly string[]).includes(item.type),
    );

    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      events.push({ id: item.id, type: item.type, date: item.created_at });
    }

    onProgress?.({
      requests,
      events: events.length,
      oldest: events.length > 0 ? events[events.length - 1].date : null,
    });

    truncated = items.length >= NOTIFICATIONS_PER_PAGE;
    if (!truncated) break;

    const smallestId = items.reduce(
      (min: string, item: Notification) => (BigInt(item.id) < BigInt(min) ? item.id : min),
      items[0].id,
    );
    if (smallestId === maxId) break;
    maxId = smallestId;
  }

  if (events.length === 0) truncated = false;
  return { events, requests, truncated };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export interface MonthlyPoint {
  month: string;
  count: number;
}

export function buildMonthlySeries(events: FollowerEvent[]): MonthlyPoint[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = monthKey(event.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface AnchoredSeries {
  points: number[];
  months: string[];
  start: number;
  current: number;
  totalFollows: number;
  historyIncomplete: boolean;
}

export function buildAnchoredSeries(
  events: FollowerEvent[],
  currentFollowers: number,
): AnchoredSeries {
  const monthly = buildMonthlySeries(events);
  const totalFollows = events.length;
  const start = currentFollowers - totalFollows;
  const points: number[] = [start];
  const months: string[] = [];
  let cumulative = 0;
  for (const point of monthly) {
    cumulative += point.count;
    points.push(currentFollowers - (totalFollows - cumulative));
    months.push(point.month);
  }
  return {
    points,
    months,
    start,
    current: currentFollowers,
    totalFollows,
    historyIncomplete: start < 0,
  };
}
