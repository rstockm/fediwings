import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  buildReportDocument,
  seriesTableRows,
  type PdfSeries,
  type ReportDocument,
} from './document';
import { pdfLayout, readPdfPalette, type PdfPalette } from './layout';
import { cleanText, safePdfUrl, type PdfOptions, type ReportPdfSnapshot } from './model';
import { pdfText } from './glyphs';
import { pdfBarColors } from './colors';
import { titleChange, titleFollowers, type TitleMetric, type TitleChange } from './comparisons';
import { axisLabels, chartAxis } from './axis';
import { emptyPdfImages, loadReportPdfImages, type PdfImages } from './images';

const methodUrl = 'https://rstockm.github.io/fediwings/?view=methodik';
const escapeXml = (s: string) =>
  s.replace(/[<>&"]/gu, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

export function pdfDefinition(
  doc: ReportDocument,
  colors: PdfPalette,
  images: PdfImages = emptyPdfImages,
): TDocumentDefinitions {
  const { snapshot: s, copy: c, options: o } = doc;
  const compact = o.title.length > 65 || o.organization.length > 60 || s.handle.length > 100;
  const shownTitle = cleanText(pdfText(o.title), 120);
  const shownOrganization = cleanText(pdfText(o.organization || s.displayName || s.handle), 100);
  const nf = (v: number | null, percent = false) =>
    v === null
      ? '—'
      : new Intl.NumberFormat(o.locale, {
          maximumFractionDigits: percent ? 1 : 0,
        }).format(v);
  const date = (value: string) =>
    new Intl.DateTimeFormat(o.locale, { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(
      new Date(value),
    );
  const shortDate = (value: string) =>
    new Intl.DateTimeFormat(o.locale, {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Berlin',
    }).format(new Date(value));
  const datetime = (value: string) =>
    new Intl.DateTimeFormat(o.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    }).format(new Date(value)) + ' · Europe/Berlin';
  const month = (i: number) =>
    new Intl.DateTimeFormat(o.locale, { month: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(s.year, i, 1)),
    );
  const monthLabel = (i: number) =>
    `${month(i)}${s.months[i] === 'current' ? '*' : s.months[i] === 'future' ? ` (${c.future})` : ''}`;
  const stateValue = (series: PdfSeries, i: number) =>
    series.status[i] === 'future' ? '' : `${nf(series.values[i])}${series.partial[i] ? ' !' : ''}`;
  const heading = (title: string, id: string, before = true): Content => ({
    text: title,
    id,
    style: 'heading',
    ...(before ? { pageBreak: 'before' as const } : {}),
  });
  const small = (text: string): Content => ({ text, style: 'meta', margin: [0, 3, 0, 6] });
  const initial =
    Array.from(s.displayName.trim() || s.handle.replace(/^@/u, ''))[0]?.toUpperCase() ?? '@';
  const monogram = (): Content => ({
    table: {
      widths: [44],
      heights: [44],
      body: [
        [
          {
            text: cleanText(pdfText(initial), 12) || '@',
            fillColor: colors.violet,
            color: '#ffffff',
            bold: true,
            fontSize: 18,
            alignment: 'center',
            margin: [0, 13, 0, 0],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  });
  const reference = (label: string, id: string, title: string): Content => ({
    text: [`${label}: ${title} · ${c.page} `, { pageReference: id }],
    style: 'meta',
    margin: [0, 4, 0, 6],
  });
  const table = (
    headers: Array<string | { text: string; right: true }>,
    rows: Content[][],
    widths: Array<number | '*' | 'auto'>,
    id?: string,
    fontSize: number = pdfLayout.table,
  ): ContentTable => ({
    ...(id ? { id } : {}),
    fontSize,
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths,
      body: [
        headers.map((header) => {
          const text = typeof header === 'string' ? header : header.text;
          return {
            text,
            bold: true,
            color: colors.violet,
            fillColor: colors.paper,
            ...(typeof header === 'string' ? {} : { alignment: 'right' as const }),
          };
        }),
        ...rows,
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 1 ? 0.8 : 0.25),
      vLineWidth: () => 0,
      hLineColor: () => colors.muted,
      paddingTop: () => 1,
      paddingBottom: () => 1,
      paddingLeft: () => 4,
      paddingRight: () => 4,
    },
    margin: [0, 4, 0, 8],
  });
  const graph = (series: PdfSeries, height = 124, zoomed = false): Content => {
    const axis = chartAxis(series.values, zoomed);
    const labels = axisLabels(axis, o.locale);
    const { min, max } = axis;
    const gutter = Math.min(92, Math.max(36, Math.max(...labels.map((l) => l.length)) * 3.8 + 8));
    const plotWidth = 487 - gutter - 6;
    const slot = plotWidth / 12;
    const barWidth = Math.min(24, slot * 0.62);
    const chartHeight = height - 38;
    const bottom = 10 + chartHeight;
    const y = (v: number) => 10 + (chartHeight * (max - v)) / (max - min);
    const barColors = pdfBarColors(series, colors);
    const gradients = barColors
      .map((bar, index) =>
        !bar
          ? ''
          : `<linearGradient id="${series.id}-${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bar.color}"/><stop offset="100%" stop-color="${bar.shade}"/></linearGradient>`,
      )
      .join('');
    const grid = axis.ticks
      .map(
        (tick, index) =>
          `<line x1="${gutter}" y1="${y(tick)}" x2="${487 - 4}" y2="${y(tick)}" stroke="${colors.muted}" stroke-width="${index === 0 ? 0.55 : 0.3}" stroke-opacity="${index === 0 ? 1 : 0.4}"/><text x="${gutter - 5}" y="${y(tick) + 2.4}" text-anchor="end" font-size="7" fill="${colors.muted}">${escapeXml(labels[index])}</text>`,
      )
      .join('');
    const bars = seriesTableRows(series)
      .map((row, i) => {
        const center = gutter + slot * (i + 0.5);
        const x = center - barWidth / 2;
        const label = escapeXml(pdfText(month(i) + (row.status === 'current' ? '*' : '')));
        const bar =
          row.value === null || row.status === 'future'
            ? ''
            : `<rect x="${x}" y="${y(row.value)}" width="${barWidth}" height="${Math.max(0.6, bottom - y(row.value))}" fill="url(#${series.id}-${i})"/>`;
        return `${bar}<text x="${center}" y="${height - 7}" text-anchor="middle" font-size="9" fill="${colors.muted}">${label}</text>`;
      })
      .join('');
    return {
      stack: [
        { text: series.label, id: series.id, bold: true, fontSize: 13, margin: [0, 10, 0, 4] },
        small(
          `${c.unit}: ${series.unit}${series.id === 'chart-reach' ? ` · ${c.sum}` : ''}${zoomed && min > 0 ? ` · ${c.axisZoomed}` : ''}`,
        ),
        {
          svg: `<svg xmlns="http://www.w3.org/2000/svg" width="487" height="${height}"><defs>${gradients}</defs>${grid}${bars}</svg>`,
          width: pdfLayout.width,
        },
        reference(
          `${c.table} · ${c.see}`,
          series.tableId,
          series.id === 'chart-followers' ? c.tableAll : c.development,
        ),
      ],
      unbreakable: true,
    };
  };
  const total = s.report.total;
  const followers = titleFollowers(s);
  const metricKeys: TitleMetric[] = ['followers', 'threads', 'interactions', 'reach', 'engagement'];
  const growthText = (change: TitleChange | null) => {
    if (!change) return '—';
    const value = Math.abs(change.percent);
    const number = value > 0 && value < 0.05 ? `<${nf(0.1, true)}` : nf(value, true);
    return change.percent === 0 ? '±0 %' : `${change.percent > 0 ? '↑ +' : '↓ −'}${number} %`;
  };
  const growthPeriod = (change: TitleChange | null) => {
    if (!change) return c.noComparison;
    if (change.basis === 'months') return `${month(0)}–${month(change.endMonth)}`;
    const end = new Date(change.currentEnd!);
    const isFull = comparisonDateParts(end).month === 12 && comparisonDateParts(end).day === 31;
    return `${s.year} / ${s.year - 1}${isFull ? '' : ' · YTD'}`;
  };
  function comparisonDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en', {
      month: 'numeric',
      day: 'numeric',
      timeZone: 'Europe/Berlin',
    }).formatToParts(date);
    return {
      month: Number(parts.find((p) => p.type === 'month')!.value),
      day: Number(parts.find((p) => p.type === 'day')!.value),
    };
  }
  const lastDay =
    s.year ===
    Number(
      new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(
        new Date(s.analyzedAt),
      ),
    )
      ? date(s.analyzedAt)
      : date(`${s.year}-12-31T12:00:00Z`);
  const metadata: Content = {
    stack: [
      { text: `${c.period}: ${date(`${s.year}-01-01T12:00:00Z`)} – ${lastDay}` },
      { text: `${c.asOf}: ${datetime(s.analyzedAt)}` },
      { text: `${c.created}: ${datetime(o.createdAt)}` },
    ],
    style: 'meta',
    margin: [0, 10, 0, 14],
  };
  const metrics: Content[] = (
    [
      [
        c.followers,
        followers.value,
        followers.observedAt
          ? `${c.asOf}: ${date(followers.observedAt)}`
          : followers.month >= 0
            ? `${month(followers.month)} ${s.year}${followers.reconstructed ? ` · ${c.reconstructed}` : ''}`
            : c.noCommunity,
        false,
      ],
      [c.threads, total.threads, c.sum, !total.counterComplete],
      [c.interactions, total.interactions, c.sum, !total.counterComplete],
      [c.reach, total.reach, c.sum, !total.reachComplete],
      [c.engagement, total.engagement, c.rate, !total.reachComplete || !total.counterComplete],
    ] as const
  ).map(([label, value, subtitle, partial], i) => {
    const change = titleChange(s, metricKeys[i]);
    const length = nf(value, i === 4).length;
    const fill = change ? (change.percent < 0 ? colors.decline : colors.lime) : colors.paper;
    return {
      stack: [
        { text: label, style: 'meta' },
        {
          text: `${nf(value, i === 4)}${i === 4 && value !== null ? ' %' : ''}${partial ? ' !' : ''}`,
          fontSize: length > 16 ? (i < 3 ? 14 : 20) : length > 12 ? 18 : 28,
          bold: true,
          margin: [0, 7, 0, 4],
        },
        { text: subtitle, style: 'meta' },
        {
          table: {
            widths: ['auto'],
            body: [
              [
                {
                  text: growthText(change),
                  fontSize: 11,
                  bold: true,
                  color: colors.ink,
                  fillColor: fill,
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingTop: () => 4,
            paddingBottom: () => 4,
            paddingLeft: () => 7,
            paddingRight: () => 7,
          },
          margin: [0, 8, 0, 3],
        },
        { text: growthPeriod(change), style: 'meta' },
      ],
      margin: [0, 6, 12, 8],
    };
  });
  const content: Content[] = [
    {
      columns: [
        {
          width: 44,
          stack: [images.avatar ? { image: images.avatar, width: 44, height: 44 } : monogram()],
        },
        {
          width: '*',
          stack: [
            {
              text: 'FEDIWINGS / EXECUTIVE REPORT',
              color: colors.violet,
              bold: true,
              fontSize: 10,
              characterSpacing: 1.2,
            },
          ],
          margin: [12, 15, 0, 0],
        },
      ],
      margin: [0, 8, 0, compact ? 14 : 22],
    },
    {
      text: `${shownTitle}\n${s.year}`,
      fontSize: shownTitle.length > 65 ? 22 : shownTitle.length > 40 ? 28 : 34,
      bold: true,
      lineHeight: 1.08,
      margin: [0, 0, 0, 16],
    },
    { text: shownOrganization, fontSize: shownOrganization.length > 60 ? 14 : 17, bold: true },
    {
      text: cleanText(pdfText(s.handle), 512),
      color: colors.muted,
      fontSize: s.handle.length > 100 ? 9 : 11,
      margin: [0, 5, 0, 0],
    },
    metadata,
    { columns: [metrics[0], metrics[1], metrics[2]], columnGap: 12 },
    { columns: [metrics[3], metrics[4]], columnGap: 18 },
    { text: c.summary, fontSize: 16, bold: true, margin: [0, 10, 0, 8] },
    { text: c.intro, lineHeight: 1.25, margin: [0, 0, 0, 12] },
    ...doc.insights.map((text): Content => ({
      text,
      margin: [0, 0, 0, compact ? 5 : 10],
      lineHeight: 1.2,
    })),
    ...(!total.counterComplete || !total.reachComplete ? [small(c.partialNote)] : []),
  ];
  const hasPosts = (total.threads ?? 0) > 0;
  const metricSeries = doc.series.filter((item) => item.id !== 'chart-followers');
  if (hasPosts) {
    content.push(heading(c.development, 'section-development'));
    content.push(small(c.colorLegend));
    for (const series of metricSeries) content.push(graph(series));
  }
  content.push(heading(c.community, 'section-community'));
  if (hasPosts)
    content.push(reference(`${c.chart} · ${c.see}`, 'section-development', c.development));
  const followerSeries = doc.series.find((item) => item.id === 'chart-followers');
  if (followerSeries && !hasPosts) content.push(small(c.colorLegend));
  if (followerSeries) content.push(graph(followerSeries, 84, true));
  const showFollows = Boolean(
    followerSeries &&
    s.community.some((p, i) => s.months[i] !== 'future' && p.follows !== p.netChange),
  );
  content.push({
    text: `${c.table}: ${followerSeries ? c.tableAll : c.development}`,
    id: 'table-months',
    bold: true,
    margin: [0, 6, 0, 4],
  });
  const headers: Array<string | { text: string; right: true }> = [c.month];
  if (followerSeries) {
    headers.push(
      { text: c.followers, right: true },
      { text: showFollows ? `${c.netChange}\n${c.follows}` : c.netChange, right: true },
    );
  }
  for (const series of metricSeries)
    headers.push({ text: `${series.label}\n(${c.count})`, right: true });
  headers.push({ text: `${c.engagement}\n(%)`, right: true });
  type DataCell = { value: string; note?: string };
  const dataRows: DataCell[][] = s.report.months.map((p, i) => {
    const point = s.community[i];
    const observedAt =
      followerSeries && point.source === 'observed' && point.observedAt ? point.observedAt : null;
    const row: DataCell[] = [{ value: monthLabel(i) }];
    if (followerSeries) {
      row.push({
        value: stateValue(followerSeries, i),
        ...(observedAt && s.months[i] !== 'future' ? { note: shortDate(observedAt) } : {}),
      });
      row.push({
        value:
          s.months[i] === 'future'
            ? ''
            : `${nf(point.netChange)}${point.netChangeSource === 'reconstructed' ? ' ~' : ''}`,
        ...(showFollows && s.months[i] !== 'future'
          ? { note: `${nf(point.follows)}${point.partial ? ' !' : ''}` }
          : {}),
      });
    }
    for (const series of metricSeries) row.push({ value: stateValue(series, i) });
    row.push({
      value:
        s.months[i] === 'future'
          ? ''
          : `${nf(p.engagement, true)}${!p.counterComplete || !p.reachComplete ? ' !' : ''}`,
    });
    return row;
  });
  // Column widths scale with the widest value or label. Scaling the whole table by one
  // factor keeps every figure inside the page while staying as large as possible.
  const headerLabels = headers.map((header) =>
    (typeof header === 'string' ? header : header.text).replace(/-(?=\S)/gu, '-\n'),
  );
  const headerLengths = headerLabels.map((label) =>
    label
      .split('\n')
      .flatMap((line) => line.split(' '))
      .reduce((longest, token) => Math.max(longest, token.length), 0),
  );
  const valueLengths = dataRows[0].map((_, col) =>
    Math.max(0, ...dataRows.map((row) => row[col]?.value.length ?? 0)),
  );
  const baseFont = followerSeries ? 8.5 : pdfLayout.table;
  const required = valueLengths.map((length, col) =>
    col === 0 ? 48 : Math.max(length * baseFont * 0.55, headerLengths[col] * baseFont * 0.56) + 3,
  );
  const available = pdfLayout.width - 48 - headers.length * 8;
  const requiredSum = required.slice(1).reduce((sum, width) => sum + width, 0);
  const scale = Math.min(1, available / requiredSum);
  const tableFont = baseFont * scale;
  const widths = required.map((width, col) => (col === 0 ? 48 : width * scale));
  const displayHeaders = headers.map((header, col) =>
    typeof header === 'string' ? headerLabels[col] : { ...header, text: headerLabels[col] },
  );
  content.push(
    table(
      displayHeaders,
      dataRows.map((row) =>
        row.map((cell, col) =>
          col === 0
            ? { text: cell.value }
            : {
                text: cell.note
                  ? [
                      { text: cell.value },
                      {
                        text: `\n${cell.note}`,
                        fontSize: Math.max(5.5, Math.min(7, tableFont * 0.82)),
                        color: colors.muted,
                      },
                    ]
                  : cell.value,
                alignment: 'right' as const,
              },
        ),
      ),
      widths,
      undefined,
      tableFont,
    ),
  );
  content.push(small(c.missing));
  if (followerSeries) content.push(small(showFollows ? c.communityNote : c.communityNoteNoFollows));
  else content.push(small(s.origin === 'legacy' ? c.legacy : c.noCommunity));
  if (s.topPosts.length) {
    content.push(
      heading(s.rankingComplete ? c.top : c.topPartial, 'section-top'),
      small(c.topNote),
    );
    for (const [i, post] of s.topPosts.entries()) {
      const detail: Content[] = [
        {
          text: post.contentWarning
            ? `${c.warning}: ${cleanText(pdfText(post.excerpt), 240)}`
            : cleanText(pdfText(post.excerpt), 240) || (post.sensitive ? c.sensitive : '—'),
          fontSize: 11,
          lineHeight: 1.15,
        },
        {
          text: `${c.reach}: ${nf(post.reach)}${post.complete ? '' : ' !'}    ·    ${c.interactions}: ${nf(post.interactions)}`,
          bold: true,
          fontSize: 10,
          margin: [0, 7, 0, post.interactionDetail ? 2 : 4],
        },
        ...(post.interactionDetail
          ? [
              {
                text: `${c.replies}: ${nf(post.interactionDetail.replies)}  ·  ${c.boosts}: ${nf(post.interactionDetail.boosts)}  ·  ${c.likes}: ${nf(post.interactionDetail.likes)}  ·  ${c.quotes}: ${nf(post.interactionDetail.quotes)}`,
                fontSize: 9,
                color: colors.muted,
                margin: [0, 0, 0, 4],
              } as Content,
            ]
          : []),
        ...(safePdfUrl(post.url)
          ? [
              {
                text: c.original,
                link: safePdfUrl(post.url)!,
                color: colors.violet,
                fontSize: 9,
                margin: [0, 0, 0, 8],
              } as Content,
            ]
          : []),
      ];
      const thumbnail = images.posts[post.id];
      content.push({
        unbreakable: true,
        stack: [
          {
            text: `${String(i + 1).padStart(2, '0')}  /  ${date(post.createdAt)}`,
            color: colors.violet,
            bold: true,
            margin: [0, 14, 0, 7],
          },
          ...(thumbnail
            ? [
                {
                  columns: [
                    {
                      width: 96,
                      stack: [{ image: thumbnail, width: 84, height: 63 }],
                    },
                    { width: '*', stack: detail },
                  ],
                  columnGap: 10,
                } as Content,
              ]
            : detail),
        ],
      });
    }
  } else {
    content.push(small(s.topAvailable ? c.noPosts : c.legacy));
  }
  content.push(heading(c.methodology, 'section-methodology'));
  content.push({ text: c.yearChange, bold: true, fontSize: 13, margin: [0, 4, 0, 5] });
  content.push(
    table(
      [c.metric, { text: c.yearChange, right: true }, c.period],
      metricKeys.map((key) => {
        const change = titleChange(s, key);
        return [
          { text: c[key] },
          { text: growthText(change), bold: true, alignment: 'right' as const },
          {
            text:
              change?.basis === 'years'
                ? `${date(`${s.year}-01-01T12:00:00Z`)}–${date(change.currentEnd!)} / ${date(`${s.year - 1}-01-01T12:00:00Z`)}–${date(change.previousEnd!)}`
                : growthPeriod(change),
          },
        ];
      }),
      ['*', 90, 180],
    ),
  );
  content.push(small(c.comparisonNote));
  for (const [title, text] of [
    [c.reach, c.reachDefinition],
    [c.interactions, c.interactionDefinition],
    [c.engagement, c.engagementDefinition],
    [c.period, c.timeDefinition],
    [c.source, c.dataDefinition],
  ])
    content.push({
      stack: [
        { text: title, bold: true, fontSize: 13, margin: [0, 14, 0, 6] },
        { text, lineHeight: 1.25 },
      ],
      unbreakable: true,
    });
  content.push(small(`${c.model}: ${s.model}`), {
    text: c.methodLink,
    link: methodUrl,
    color: colors.violet,
    margin: [0, 8, 0, 0],
  });
  function normalize(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) normalize(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'text' && typeof value === 'string')
        (node as Record<string, unknown>)[key] = pdfText(value);
      else if (key === 'text' && Array.isArray(value)) {
        (node as Record<string, unknown>)[key] = value.map((part) =>
          typeof part === 'string' ? pdfText(part) : part,
        );
        normalize(value);
      } else if (typeof value === 'object') normalize(value);
    }
  }
  normalize(content);
  return {
    pageSize: 'A4',
    pageMargins: [54, 54, 54, 48],
    defaultStyle: { font: 'Inter', fontSize: pdfLayout.body, color: colors.ink },
    info: {
      title: `${o.title} ${s.year}`,
      author: o.organization || s.handle,
      subject: 'FediWings Executive Report',
      creator: 'FediWings',
      creationDate: new Date(o.createdAt),
      modDate: new Date(o.createdAt),
    },
    language: o.locale === 'de' ? 'de-DE' : 'en-GB',
    tagged: true,
    header: (page) =>
      page === 1
        ? []
        : {
            columns: [
              { text: 'FEDIWINGS', bold: true, color: colors.violet },
              { text: pdfText(cleanText(s.handle, 80)), alignment: 'right' },
            ],
            fontSize: 8.5,
            margin: [54, 24, 54, 0],
            color: colors.muted,
          },
    footer: (page, count) => ({
      columns: [
        { text: `${s.year} · ${c.asOf}: ${date(s.analyzedAt)}` },
        { text: `${c.page} ${page} ${c.of} ${count}`, alignment: 'right' },
      ],
      fontSize: 8.5,
      color: colors.muted,
      margin: [54, 16, 54, 0],
    }),
    styles: {
      heading: { fontSize: 25, bold: true, margin: [0, 8, 0, 16] },
      meta: { fontSize: pdfLayout.meta, color: colors.muted, lineHeight: 1.15 },
    },
    content,
  };
}

let enginePromise: Promise<typeof import('pdfmake/build/pdfmake')> | null = null;
async function loadEngine() {
  if (!enginePromise)
    enginePromise = (async () => {
      const module = await import('pdfmake/build/pdfmake');
      // Vite normalizes the CommonJS browser build as its default export.
      const engine = (
        'default' in module ? module.default : module
      ) as typeof import('pdfmake/build/pdfmake');
      const files: Record<string, string> = {};
      await Promise.all(
        ['regular', 'bold'].map(async (weight) => {
          const response = await fetch(
            `${import.meta.env.BASE_URL}fonts/inter-tight-pdf-${weight}.ttf`,
          );
          if (!response.ok) throw new Error('PDF font unavailable');
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          files[`${weight}.ttf`] = btoa(binary);
        }),
      );
      engine.addVirtualFileSystem(files);
      engine.addFonts({
        Inter: {
          normal: 'regular.ttf',
          bold: 'bold.ttf',
          italics: 'regular.ttf',
          bolditalics: 'bold.ttf',
        },
      });
      engine.setUrlAccessPolicy(() => false);
      return engine;
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  return enginePromise;
}

export async function renderReportPdf(
  snapshot: ReportPdfSnapshot,
  options: PdfOptions,
): Promise<Blob> {
  const palette = readPdfPalette();
  const [engine, images] = await Promise.all([loadEngine(), loadReportPdfImages(snapshot)]);
  const definition = pdfDefinition(buildReportDocument(snapshot, options), palette, images);
  return engine.createPdf(definition).getBlob();
}
