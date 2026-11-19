import { z } from 'zod';

const value = z.number().finite().nullable();
const period = z.object({
  threads: value,
  interactions: value,
  reach: value,
  engagement: value,
  counterComplete: z.boolean(),
  reachComplete: z.boolean(),
  interactionsComplete: z.boolean().optional(),
});
export const pdfSnapshotSchema = z.object({
  version: z.literal(1),
  model: z.literal('net-reach-v1'),
  handle: z.string().max(512),
  displayName: z.string().max(200),
  avatarUrl: z.string().max(4096).nullable().optional(),
  year: z.number().int().min(2006).max(9999),
  analyzedAt: z.iso.datetime(),
  followerObservation: z
    .object({ count: z.number().int().nonnegative(), observedAt: z.iso.datetime() })
    .nullable()
    .optional(),
  annualComparison: z
    .object({
      year: z.number().int(),
      analyzedAt: z.iso.datetime(),
      currentEnd: z.iso.datetime(),
      previousEnd: z.iso.datetime(),
      total: period,
    })
    .nullable()
    .optional(),
  origin: z.enum(['live', 'stored', 'legacy']),
  report: z.object({
    year: z.number().int(),
    months: z.array(period).length(12),
    total: period,
    interactionBasis: z.literal('notification-time').optional(),
    reusedInteractionMonths: z.array(z.number().int().min(0).max(11)).max(12).optional(),
  }),
  months: z.array(z.enum(['closed', 'current', 'future'])).length(12),
  community: z
    .array(
      z.object({
        followers: value,
        source: z.enum(['observed', 'reconstructed', 'missing']),
        observedAt: z.string().nullable(),
        netChange: value,
        netChangeSource: z.enum(['observed', 'reconstructed']).nullable().optional(),
        follows: value,
        partial: z.boolean(),
      }),
    )
    .length(12),
  topPosts: z
    .array(
      z.object({
        id: z.string().max(512),
        createdAt: z.iso.datetime(),
        url: z.string().max(4096).nullable(),
        imageUrl: z.string().max(4096).nullable().optional(),
        excerpt: z.string().max(1000),
        contentWarning: z.boolean(),
        sensitive: z.boolean(),
        reach: z.number().finite().nonnegative(),
        interactions: z.number().finite().nonnegative(),
        interactionDetail: z
          .object({
            replies: z.number().finite().nonnegative(),
            boosts: z.number().finite().nonnegative(),
            likes: z.number().finite().nonnegative(),
            quotes: z.number().finite().nonnegative(),
          })
          .optional(),
        complete: z.boolean(),
      }),
    )
    .max(5),
  topAvailable: z.boolean(),
  rankingComplete: z.boolean(),
});

export type ReportPdfSnapshot = z.infer<typeof pdfSnapshotSchema>;
export type PdfCommunityMonth = ReportPdfSnapshot['community'][number];
export type PdfTopPost = ReportPdfSnapshot['topPosts'][number];
export interface PdfOptions {
  title: string;
  organization: string;
  locale: 'de' | 'en';
  createdAt: string;
}

export function safePdfUrl(input: string | null): string | null {
  if (!input || input.length > 4096) return null;
  try {
    const url = new URL(input);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function cleanText(input: string, limit = 240): string {
  // Plain text only. Unsupported control characters must never reach the PDF parser.
  const text = input
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const chars = Array.from(text);
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : text;
}
