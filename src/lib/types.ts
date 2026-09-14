export interface ParsedHandle {
  username: string;
  domain: string;
  acct: string;
}

export interface InstanceTarget extends ParsedHandle {
  origin: string;
}

/** Identität eines AT-Protocol-Accounts: Handle, DID und der daraus aufgelöste PDS. */
export interface AtprotoTarget {
  did: string;
  handle: string;
  /** Origin des Personal Data Servers aus dem DID-Dokument, nur für Identität und Anzeige. */
  pdsOrigin: string;
  /** Origin der öffentlichen AppView, aus der alle Analysedaten stammen. */
  appview: string;
}

/**
 * Ergebnis der Handle-Auflösung. `acct` und `origin` sind backend-übergreifend gesetzt,
 * damit die Oberfläche beide Protokolle gleich behandeln kann.
 */
export type ResolvedTarget =
  | ({ backend: 'mastodon' } & InstanceTarget)
  | {
      backend: 'atproto';
      username: string;
      domain: string;
      acct: string;
      origin: string;
      target: AtprotoTarget;
    };

export type ServerProtocol = 'mastodon' | 'atproto';

export interface ServerPlatform {
  id: string;
  name: string;
  protocol: ServerProtocol;
}

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
  uri?: string;
  avatar_static: string;
  followers_count: number;
  hide_collections?: boolean | null;
  /** Nur gesetzt, wenn der Account nicht aus einer Mastodon-API stammt. */
  protocol?: ServerProtocol;
}

export interface MastodonMediaAttachment {
  type: string;
  url: string;
  preview_url: string | null;
  description?: string | null;
}

export interface MastodonStatus {
  id: string;
  created_at: string;
  url: string | null;
  content: string;
  spoiler_text: string;
  sensitive?: boolean;
  visibility: string;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
  quotes_count?: number;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  media_attachments: MastodonMediaAttachment[];
}

export interface MastodonStatusWithAccount extends MastodonStatus {
  account: MastodonAccount;
}

export interface MastodonStatusContext {
  ancestors: MastodonStatusWithAccount[];
  descendants: MastodonStatusWithAccount[];
}

export interface RateLimit {
  limit: number | null;
  remaining: number | null;
  resetAt: number | null;
}

export interface ApiPage<T> {
  data: T;
  link: string | null;
  rateLimit: RateLimit;
}

export interface ThreadCard {
  status: MastodonStatus;
  threadStatuses: MastodonStatus[];
  threadTruncated: boolean;
  threadSize: number;
}

export type AnalysisState = 'pending' | 'loading' | 'complete' | 'partial' | 'error';

export interface PostReach {
  status: MastodonStatus;
  threadStatuses: MastodonStatus[];
  threadTruncated: boolean;
  threadSize: number;
  thumbnail: MastodonMediaAttachment | null;
  state: AnalysisState;
  authorFollowers: number;
  likes: number;
  interactions: number;
  boosts: number;
  visibleBoosters: number;
  boosterFollowers: number;
  grossReach: number;
  netReach: number;
  unattributedBoosts: number;
  pagesLoaded: number;
  error?: string;
}

export interface AnalysisProgress {
  completedPosts: number;
  totalPosts: number;
  requests: number;
  waitingUntil?: number;
}

export interface CardSnapshot {
  version: 1;
  sourceUrl: string;
  account: {
    url: string;
    displayName: string;
    handle: string;
    avatarUrl: string;
  };
  content: {
    excerpt: string;
    thumbnailUrl: string | null;
    contentWarning: string;
    sensitive: boolean;
  };
  metrics: {
    netReach: number;
    grossReach: number;
    likes: number;
    boosts: number;
  };
  analysisState: 'complete' | 'partial';
  analyzedAt: string;
  algorithmVersion: 'net-reach-v1';
}

export interface CardServiceResponse {
  id: string;
  url: string;
  imageUrl: string;
  createdAt: string;
}
