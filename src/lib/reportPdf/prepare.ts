import DOMPurify from 'dompurify';
import type { PostReach } from '../types';
import type { AggregatedReport } from '../reports';
import { monthEndFollowers, type FollowerObservation } from '../reportStorage';
import { reportFollowerHistory, type ReportFollowerHistory } from '../reportFollowers';
import { cleanText, safePdfUrl, type PdfTopPost, type ReportPdfSnapshot } from './model';

export function plainText(html: string, limit = 240): string {
  const safe = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br'], ALLOWED_ATTR: [] });
  const doc = new DOMParser().parseFromString(
    safe.replace(/<\/p>|<br\s*\/?>/giu, ' '),
    'text/html',
  );
  return cleanText(doc.body.textContent ?? '', limit);
}

export function selectTopPosts(posts: PostReach[], year: number): PdfTopPost[] {
  const seen = new Set<string>();
  const selected: PdfTopPost[] = [];
  for (const post of posts) {
    const status = post.status;
    if (seen.has(status.id)) continue;
    seen.add(status.id);
    const date = new Date(status.created_at);
    if (!Number.isFinite(date.getTime()) || status.visibility !== 'public') continue;
    if (
      Number(
        new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(date),
      ) !== year
    )
      continue;
    const detail = { replies: 0, boosts: 0, likes: 0, quotes: 0 };
    for (const item of post.threadStatuses) {
      detail.replies += item.replies_count;
      detail.boosts += item.reblogs_count;
      detail.likes += item.favourites_count;
      detail.quotes += item.quotes_count ?? 0;
    }
    const rootImage =
      status.media_attachments.find((attachment) => attachment.type.startsWith('image')) ??
      post.thumbnail;
    selected.push({
      id: cleanText(status.id, 512),
      createdAt: date.toISOString(),
      url: safePdfUrl(status.url),
      imageUrl:
        status.sensitive || status.spoiler_text
          ? null
          : safePdfUrl(rootImage?.preview_url ?? rootImage?.url ?? null),
      excerpt: status.spoiler_text
        ? plainText(status.spoiler_text)
        : status.sensitive
          ? ''
          : plainText(status.content),
      contentWarning: Boolean(status.spoiler_text),
      sensitive: Boolean(status.sensitive),
      reach: post.netReach,
      interactions: detail.replies + detail.boosts + detail.likes + detail.quotes,
      interactionDetail: detail,
      complete: post.state === 'complete' && !post.threadTruncated,
    });
  }
  return selected
    .sort(
      (a, b) =>
        b.reach - a.reach ||
        b.interactions - a.interactions ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, 5);
}

export function preparePdfSnapshot(input: {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  report: AggregatedReport;
  analyzedAt: string;
  posts?: PostReach[];
  observations?: FollowerObservation[];
  history?: ReportFollowerHistory | null;
  legacy?: boolean;
  followerObservation?: ReportPdfSnapshot['followerObservation'];
  annualComparison?: ReportPdfSnapshot['annualComparison'];
}): ReportPdfSnapshot {
  const { report, analyzedAt } = input;
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Berlin',
  }).formatToParts(new Date(analyzedAt));
  const currentYear = Number(parts.find((p) => p.type === 'year')!.value);
  const currentMonth = Number(parts.find((p) => p.type === 'month')!.value);
  const months: ReportPdfSnapshot['months'] = Array.from({ length: 12 }, (_, i) =>
    report.year > currentYear || (report.year === currentYear && i + 1 > currentMonth)
      ? 'future'
      : report.year === currentYear && i + 1 === currentMonth
        ? 'current'
        : 'closed',
  );
  const observations = input.legacy ? [] : (input.observations ?? []);
  const observed = monthEndFollowers(observations, report.year);
  const history =
    !input.legacy && input.history ? reportFollowerHistory(input.history, report.year) : null;
  const points = months.map((state, i) => {
    if (state === 'future') return null;
    const point = observed[i];
    if (point) return { value: point.count, source: 'observed' as const };
    const value = history?.followers[i] ?? null;
    return value === null ? null : { value, source: 'reconstructed' as const };
  });
  const previousDecember = input.legacy
    ? null
    : monthEndFollowers(observations, report.year - 1)[11];
  let previous: { value: number; source: 'observed' | 'reconstructed' } | null = previousDecember
    ? { value: previousDecember.count, source: 'observed' }
    : null;
  const community = months.map((state, i) => {
    const point = points[i];
    const netChange = point && previous ? point.value - previous.value : null;
    const netChangeSource =
      point && previous
        ? point.source === 'observed' && previous.source === 'observed'
          ? ('observed' as const)
          : ('reconstructed' as const)
        : null;
    const entry = {
      followers: point?.value ?? null,
      source: point?.source ?? ('missing' as const),
      observedAt: state === 'future' ? null : (observed[i]?.observedAt ?? null),
      netChange,
      netChangeSource,
      follows: state === 'future' ? null : (history?.follows[i] ?? null),
      partial: Boolean(input.history?.partial) && !input.legacy,
    };
    previous = point;
    return entry;
  });
  return {
    version: 1,
    model: 'net-reach-v1',
    handle: cleanText(input.handle, 512),
    displayName: plainText(input.displayName, 200),
    avatarUrl: input.legacy ? null : safePdfUrl(input.avatarUrl ?? null),
    year: report.year,
    analyzedAt,
    followerObservation: input.legacy ? null : (input.followerObservation ?? null),
    annualComparison: input.legacy ? null : (input.annualComparison ?? null),
    origin: input.legacy ? 'legacy' : 'live',
    report: structuredClone(report),
    months,
    community,
    topPosts: selectTopPosts(input.posts ?? [], report.year),
    topAvailable: !input.legacy && input.posts !== undefined,
    rankingComplete: report.total.counterComplete && report.total.reachComplete,
  };
}
