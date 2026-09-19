import { z } from 'zod';
import { accountSchema, mediaAttachmentSchema, statusSchema } from './schemas';
import type {
  AnalysisProgress,
  MastodonAccount,
  MastodonStatus,
  PostReach,
  ServerPlatform,
} from './types';

const RETURN_KEY = 'fediscope:oauth-return-v1';
const RETURN_MAX_AGE_MS = 15 * 60 * 1000;

const platformSchema = z.object({
  id: z.string(),
  name: z.string(),
  mastodonApi: z.boolean(),
});

const postReachSchema = z.object({
  status: statusSchema,
  threadStatuses: z.array(statusSchema),
  threadTruncated: z.boolean(),
  threadSize: z.number().int().nonnegative(),
  thumbnail: mediaAttachmentSchema.nullable(),
  state: z.enum(['pending', 'loading', 'complete', 'partial', 'error']),
  authorFollowers: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  interactions: z.number().int().nonnegative(),
  boosts: z.number().int().nonnegative(),
  quotes: z.number().int().nonnegative().default(0),
  visibleBoosters: z.number().int().nonnegative(),
  boosterFollowers: z.number().int().nonnegative(),
  grossReach: z.number().int().nonnegative(),
  netReach: z.number().int().nonnegative(),
  unattributedBoosts: z.number().int().nonnegative(),
  pagesLoaded: z.number().int().nonnegative(),
  error: z.string().optional(),
});

const progressSchema = z.object({
  completedPosts: z.number().int().nonnegative(),
  totalPosts: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
  waitingUntil: z.number().optional(),
});

const returnSnapshotSchema = z.object({
  version: z.literal(1),
  state: z.string().min(1),
  savedAt: z.string(),
  view: z.enum(['analyse', 'follower']),
  analysis: z
    .object({
      handle: z.string(),
      postLimit: z.number().int().positive(),
      rememberHandles: z.boolean(),
      phase: z.enum(['complete', 'partial', 'cancelled']),
      message: z.string(),
      origin: z.string().url(),
      account: accountSchema,
      platform: platformSchema.nullable(),
      posts: z.array(postReachSchema),
      insightStatuses: z.array(statusSchema),
      insightReferenceTime: z.number(),
      analyzedAt: z.string(),
      insightHistoryComplete: z.boolean(),
      insightOldestFetchedAt: z.string().nullable(),
      insightReachSelectionComplete: z.boolean(),
      progress: progressSchema,
      sort: z.enum(['date', 'reach', 'likes', 'boosts']),
      expandedStatusIds: z.array(z.string()),
      scrollY: z.number().nonnegative(),
    })
    .nullable(),
});

export interface OAuthReturnAnalysis {
  handle: string;
  postLimit: number;
  rememberHandles: boolean;
  phase: 'complete' | 'partial' | 'cancelled';
  message: string;
  origin: string;
  account: MastodonAccount;
  platform: ServerPlatform | null;
  posts: PostReach[];
  insightStatuses: MastodonStatus[];
  insightReferenceTime: number;
  analyzedAt: string;
  insightHistoryComplete: boolean;
  insightOldestFetchedAt: string | null;
  insightReachSelectionComplete: boolean;
  progress: AnalysisProgress;
  sort: 'date' | 'reach' | 'likes' | 'boosts';
  expandedStatusIds: string[];
  scrollY: number;
}

export interface OAuthReturnSnapshot {
  version: 1;
  state: string;
  savedAt: string;
  view: 'analyse' | 'follower';
  analysis: OAuthReturnAnalysis | null;
}

export function saveOAuthReturn(snapshot: OAuthReturnSnapshot): void {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(snapshot));
  } catch {
    throw new Error('oauth-return-storage');
  }
}

export function consumeOAuthReturn(expectedState: string): OAuthReturnSnapshot | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = returnSnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.state !== expectedState) return null;
    const savedAt = Date.parse(parsed.data.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > RETURN_MAX_AGE_MS) return null;
    return parsed.data as OAuthReturnSnapshot;
  } catch {
    return null;
  }
}

export function clearOAuthReturn(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Sitzungsspeicher nicht verfuegbar: nichts zu bereinigen.
  }
}
