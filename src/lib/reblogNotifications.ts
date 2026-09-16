import { fetchWithTimeout } from './http';
import { nextLink } from './pagination';
import { reblogNotificationListSchema } from './schemas';
import type { BoostEvent } from './types';

const NOTIFICATIONS_PER_PAGE = 80;
const NOTIFICATIONS_TIMEOUT_MS = 12_000;
export const MAX_REBLOG_NOTIFICATION_PAGES = 10;

export class AuthenticatedNotificationError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'AuthenticatedNotificationError';
  }
}

export class ReblogNotificationCache {
  readonly eventsByStatusId = new Map<string, BoostEvent[]>();
  readonly seen = new Set<string>();
  requests = 0;
  oldestFetchedAt: string | null = null;
  exhausted = false;
  private nextUrl: string | null;

  constructor(
    readonly origin: string,
    private readonly token: string,
  ) {
    const params = new URLSearchParams({ limit: String(NOTIFICATIONS_PER_PAGE) });
    params.append('types[]', 'reblog');
    this.nextUrl = `${origin}/api/v1/notifications?${params}`;
  }

  get budgetReached(): boolean {
    return this.requests >= MAX_REBLOG_NOTIFICATION_PAGES && !this.exhausted;
  }

  eventsFor(statusIds: readonly string[]): BoostEvent[] {
    return statusIds
      .flatMap((statusId) => this.eventsByStatusId.get(statusId) ?? [])
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  covers(publishedAt: string): boolean {
    return (
      this.exhausted ||
      (this.oldestFetchedAt !== null && Date.parse(this.oldestFetchedAt) <= Date.parse(publishedAt))
    );
  }

  async loadNext(signal: AbortSignal): Promise<void> {
    if (this.exhausted || this.requests >= MAX_REBLOG_NOTIFICATION_PAGES || !this.nextUrl) return;
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');

    let response: Response;
    try {
      response = (
        await fetchWithTimeout(
          this.nextUrl,
          { headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` } },
          signal,
          NOTIFICATIONS_TIMEOUT_MS,
        )
      ).response;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new AuthenticatedNotificationError('notifications-unreachable');
    }
    this.requests += 1;

    if (!response.ok) {
      throw new AuthenticatedNotificationError('notifications-http', response.status);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AuthenticatedNotificationError('notifications-json');
    }
    const parsed = reblogNotificationListSchema.safeParse(json);
    if (!parsed.success) throw new AuthenticatedNotificationError('notifications-invalid');

    for (const item of parsed.data) {
      if (this.seen.has(item.id)) continue;
      this.seen.add(item.id);
      const event = { id: item.id, statusId: item.status.id, createdAt: item.created_at };
      const current = this.eventsByStatusId.get(event.statusId) ?? [];
      current.push(event);
      this.eventsByStatusId.set(event.statusId, current);
      if (
        this.oldestFetchedAt === null ||
        Date.parse(event.createdAt) < Date.parse(this.oldestFetchedAt)
      ) {
        this.oldestFetchedAt = event.createdAt;
      }
    }

    this.nextUrl = nextLink(response.headers.get('Link'), this.origin);
    this.exhausted = this.nextUrl === null;
  }
}
