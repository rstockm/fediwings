import type { MastodonStatus, ThreadCard } from './types';

/**
 * Groups the fetched statuses into thread cards.
 *
 * A thread exists when a status replies to another status of the same account
 * (self-reply). The API layer requests originals plus self-replies where the
 * server supports that filter and explicitly removes remaining foreign replies.
 *
 * - The root of a thread is the oldest status whose parent is not in the
 *   fetched window. If that root itself replies to an older status of the same
 *   account that lies outside the window, the card is marked as truncated.
 */
export function groupStatusesIntoThreads(
  statuses: MastodonStatus[],
  accountId: string,
): ThreadCard[] {
  const byId = new Map(statuses.map((status) => [status.id, status]));

  const resolveRootId = (status: MastodonStatus): string => {
    let current = status;
    const chain = new Set<string>([status.id]);
    while (current.in_reply_to_id && byId.has(current.in_reply_to_id)) {
      const parent = byId.get(current.in_reply_to_id)!;
      if (chain.has(parent.id)) break;
      chain.add(parent.id);
      current = parent;
    }
    return current.id;
  };

  const rootIsTruncated = (status: MastodonStatus): boolean =>
    Boolean(
      status.in_reply_to_id &&
      !byId.has(status.in_reply_to_id) &&
      status.in_reply_to_account_id === accountId,
    );

  const groups = new Map<string, ThreadCard>();
  for (const status of statuses) {
    const rootId = resolveRootId(status);
    let card = groups.get(rootId);
    if (!card) {
      const root = byId.get(rootId)!;
      card = {
        status: root,
        threadStatuses: [],
        threadTruncated: rootIsTruncated(root),
        threadSize: 0,
      };
      groups.set(rootId, card);
    }
    card.threadStatuses.push(status);
  }

  return [...groups.values()]
    .map((card) => {
      card.threadStatuses.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      card.threadSize = card.threadStatuses.length;
      return card;
    })
    .sort(
      (a, b) => new Date(b.status.created_at).getTime() - new Date(a.status.created_at).getTime(),
    );
}
