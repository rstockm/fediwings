import { NO_RATE_LIMIT, type BoosterSource } from '../boosters';
import { getAtprotoFollowerCounts, getAtprotoReposts, PROFILE_BATCH_SIZE } from './api';

/**
 * `app.bsky.feed.getRepostedBy` liefert Profile ohne `followersCount`. Die Zahlen werden
 * deshalb je Seite in Blöcken von 25 DIDs über `app.bsky.actor.getProfiles` nachgeladen.
 */
export function atprotoBoosterSource(appview: string): BoosterSource {
  return {
    async page(cursor, signal) {
      const reposts = await getAtprotoReposts(appview, cursor.statusId, cursor.token, signal);
      let requests = 1;

      const counts = new Map<string, number>();
      for (let index = 0; index < reposts.dids.length; index += PROFILE_BATCH_SIZE) {
        const batch = reposts.dids.slice(index, index + PROFILE_BATCH_SIZE);
        const followers = await getAtprotoFollowerCounts(appview, batch, signal);
        requests += 1;
        for (const [did, count] of followers) counts.set(did, count);
      }

      return {
        accounts: reposts.dids.map((did) => ({ key: did, followers: counts.get(did) ?? 0 })),
        next: reposts.cursor ? { statusId: cursor.statusId, token: reposts.cursor } : null,
        rateLimit: NO_RATE_LIMIT,
        requests,
      };
    },
  };
}
