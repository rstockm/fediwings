import type { MastodonMediaAttachment, PostReach, ThreadCard } from './types';

const INSTAGRAM_BASE_RATE = 0.0165;
const BOOST_EXPONENT = 0.7314;
const INTERACTION_EXPONENT = 0.2214;
const MASTODON_BOOST_WEIGHT = 2;

function firstThreadImage(card: ThreadCard): MastodonMediaAttachment | null {
  for (const status of card.threadStatuses) {
    const image = status.media_attachments.find((attachment) =>
      attachment.type.startsWith('image'),
    );
    if (image) return image;
  }
  return null;
}

export function initialReach(card: ThreadCard, authorFollowers: number): PostReach {
  const likes = card.threadStatuses.reduce((sum, status) => sum + status.favourites_count, 0);
  const replies = card.threadStatuses.reduce((sum, status) => sum + status.replies_count, 0);
  const boosts = card.threadStatuses.reduce((sum, status) => sum + status.reblogs_count, 0);
  const interactions = likes + replies;
  const grossReach = authorFollowers;

  return {
    status: card.status,
    threadStatuses: card.threadStatuses,
    threadTruncated: card.threadTruncated,
    threadSize: card.threadSize,
    thumbnail: firstThreadImage(card),
    state: boosts > 0 ? 'pending' : 'complete',
    authorFollowers,
    likes,
    interactions,
    boosts,
    visibleBoosters: 0,
    boosterFollowers: 0,
    grossReach,
    netReach: calculateNetReach(grossReach, boosts, interactions, likes + boosts),
    unattributedBoosts: boosts,
    pagesLoaded: 0,
  };
}

export function calculateNetReach(
  grossReach: number,
  boosts: number,
  interactions: number,
  engagementFloor = 0,
): number {
  const potential = Math.max(0, grossReach);
  const estimate = Math.round(
    INSTAGRAM_BASE_RATE *
      potential *
      Math.pow(1 + MASTODON_BOOST_WEIGHT * Math.max(0, boosts), BOOST_EXPONENT) *
      Math.pow(1 + Math.max(0, interactions), INTERACTION_EXPONENT),
  );
  const floor = Math.max(0, engagementFloor);
  return Math.min(potential, Math.max(estimate, floor));
}

export function updateReach(
  current: PostReach,
  visibleBoosters: number,
  boosterFollowers: number,
  pagesLoaded: number,
): PostReach {
  const grossReach = current.authorFollowers + boosterFollowers;
  return {
    ...current,
    state: 'loading',
    visibleBoosters,
    boosterFollowers,
    grossReach,
    netReach: calculateNetReach(
      grossReach,
      current.boosts,
      current.interactions,
      current.likes + current.boosts,
    ),
    unattributedBoosts: Math.max(0, current.boosts - visibleBoosters),
    pagesLoaded,
  };
}
