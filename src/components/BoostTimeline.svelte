<script lang="ts">
  import { _, date as _date, number as _number } from 'svelte-i18n';
  import { calculateNetReach } from '../lib/reach';
  import type { BoostHistoryState, PostReach } from '../lib/types';

  let {
    history,
    result,
    onloadmore,
  }: {
    history: BoostHistoryState;
    result: PostReach;
    onloadmore: () => void;
  } = $props();

  const chart = { left: 50, right: 370, top: 16, bottom: 142 };
  let hovered = $state<number | null>(null);

  const points = $derived.by(() => {
    const events = history.events;
    if (events.length === 0) return [];
    const start = Date.parse(events[0]!.createdAt);
    const end = Date.parse(events[events.length - 1]!.createdAt);
    const span = Math.max(1, end - start);
    let previousReach = 0;
    return events.map((event, index) => {
      // Datierte Notifications können nur einen Teil der aktuellen Boosts abdecken.
      // Der Anteil hält den letzten Kurvenwert trotzdem beim heutigen Netto-Wert.
      const boostCount = Math.max(1, Math.round(((index + 1) / events.length) * result.boosts));
      const reach =
        index === events.length - 1
          ? result.netReach
          : calculateNetReach(
              result.grossReach,
              boostCount,
              result.interactions,
              result.likes + boostCount,
            );
      const point = {
        event,
        reach,
        addedReach: Math.max(0, reach - previousReach),
        x: chart.left + ((Date.parse(event.createdAt) - start) / span) * (chart.right - chart.left),
        y: 0,
      };
      previousReach = reach;
      return point;
    });
  });
  const maxReach = $derived(Math.max(1, result.netReach, ...points.map((point) => point.reach)));
  const yTicks = $derived([0, Math.round(maxReach / 2), maxReach]);
  const xTicks = $derived.by(() => {
    if (points.length < 2) return [];
    const start = Date.parse(points[0]!.event.createdAt);
    const end = Date.parse(points[points.length - 1]!.event.createdAt);
    const monthCursor = new Date(start);
    monthCursor.setUTCDate(1);
    monthCursor.setUTCHours(0, 0, 0, 0);
    monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    const months: Date[] = [];
    while (monthCursor.getTime() < end) {
      months.push(new Date(monthCursor));
      monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }
    if (months.length > 1) {
      const step = Math.max(1, Math.ceil(months.length / 4));
      return months
        .filter((_, index) => index % step === 0)
        .map((date) => ({ date, unit: 'month' }));
    }

    const dayCursor = new Date(start);
    dayCursor.setUTCHours(0, 0, 0, 0);
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    const days: Date[] = [];
    while (dayCursor.getTime() < end) {
      days.push(new Date(dayCursor));
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }
    const step = Math.max(1, Math.ceil(days.length / 4));
    return days.filter((_, index) => index % step === 0).map((date) => ({ date, unit: 'day' }));
  });
  const positioned = $derived(
    points.map((point) => ({
      ...point,
      y: chart.bottom - (point.reach / maxReach) * (chart.bottom - chart.top),
    })),
  );
  const linePath = $derived(
    positioned
      .map(
        (point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
      )
      .join(' '),
  );
  const areaPath = $derived(
    positioned.length > 0
      ? `${linePath} L${positioned[positioned.length - 1]!.x.toFixed(1)},${chart.bottom} L${positioned[0]!.x.toFixed(1)},${chart.bottom} Z`
      : '',
  );
  const active = $derived(hovered === null ? null : (positioned[hovered] ?? null));

  function pointerIndex(event: PointerEvent): number | null {
    if (positioned.length === 0) return null;
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 380;
    return positioned.reduce(
      (closest, point, index) =>
        Math.abs(point.x - x) < Math.abs(positioned[closest]!.x - x) ? index : closest,
      0,
    );
  }
</script>

<section class="boost-timeline" aria-labelledby="boost-timeline-title">
  <div class="boost-timeline-heading">
    <h3 id="boost-timeline-title">{$_('boostHistory.title')}</h3>
  </div>

  {#if history.phase === 'loading' && history.events.length === 0}
    <p class="boost-timeline-status" role="status">{$_('boostHistory.loading')}</p>
  {:else if history.phase === 'error'}
    <p class="boost-timeline-error" role="status">
      {history.error ?? $_('boostHistory.unavailable')}
    </p>
  {:else}
    {#if positioned.length > 0}
      <svg
        class="boost-curve"
        viewBox="0 0 380 194"
        role="img"
        aria-label={$_('boostHistory.chart')}
        onpointermove={(event) => (hovered = pointerIndex(event))}
        onpointerleave={() => (hovered = null)}
      >
        {#each yTicks as tick (tick)}
          {@const y = chart.bottom - (tick / maxReach) * (chart.bottom - chart.top)}
          <line class="boost-curve-grid" x1={chart.left} x2={chart.right} y1={y} y2={y}></line>
          <text class="boost-curve-axis-value" x={chart.left - 8} y={y + 3} text-anchor="end"
            >{$_number(tick, { format: 'int' })}</text
          >
        {/each}
        {#each xTicks as tick (tick.date.toISOString())}
          {@const start = Date.parse(positioned[0]!.event.createdAt)}
          {@const end = Date.parse(positioned[positioned.length - 1]!.event.createdAt)}
          {@const x =
            chart.left +
            ((tick.date.getTime() - start) / (end - start)) * (chart.right - chart.left)}
          <line class="boost-curve-grid" x1={x} x2={x} y1={chart.top} y2={chart.bottom}></line>
          <text class="boost-curve-label" {x} y="160" text-anchor="middle"
            >{$_date(tick.date, { format: tick.unit })}</text
          >
        {/each}
        <line
          class="boost-curve-baseline"
          x1={chart.left}
          x2={chart.right}
          y1={chart.bottom}
          y2={chart.bottom}
        ></line>
        <path class="boost-curve-area" fill="rgba(93, 76, 240, 0.12)" d={areaPath}></path>
        <path
          class="boost-curve-line"
          fill="none"
          stroke="#5d4cf0"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.5"
          d={linePath}
        ></path>
        {#if active}
          {@const tooltipX = Math.min(Math.max(active.x, 91), 289)}
          <line
            class="boost-curve-crosshair"
            stroke="rgba(93, 76, 240, 0.42)"
            x1={active.x}
            x2={active.x}
            y1={chart.top}
            y2={chart.bottom}
          ></line>
          <circle
            class="boost-curve-dot"
            fill="#5d4cf0"
            stroke="#f9f7f1"
            stroke-width="2"
            cx={active.x}
            cy={active.y}
            r="4"
          ></circle>
          <g class="boost-curve-tooltip">
            <rect fill="#282434" x={tooltipX - 88} y="2" width="176" height="31" rx="4"></rect>
            <text fill="#f9f7f1" x={tooltipX} y="15" text-anchor="middle">
              {$_date(new Date(active.event.createdAt), { format: 'standard' })}
            </text>
            <text fill="#f9f7f1" x={tooltipX} y="27" text-anchor="middle">
              {$_('boostHistory.tooltip', {
                values: {
                  reach: $_number(active.reach, { format: 'int' }),
                  added: $_number(active.addedReach, { format: 'int' }),
                },
              })}
            </text>
          </g>
        {/if}
        {#if positioned.length === 1}
          <circle
            class="boost-curve-dot"
            fill="#5d4cf0"
            stroke="#f9f7f1"
            stroke-width="2"
            cx={positioned[0]!.x}
            cy={positioned[0]!.y}
            r="4"
          ></circle>
        {/if}
        <text class="boost-curve-label" x={chart.left} y="160">
          {$_date(new Date(positioned[0]!.event.createdAt), { format: 'date' })}
        </text>
        <text class="boost-curve-label" x={chart.right} y="160" text-anchor="end">
          {$_date(new Date(positioned[positioned.length - 1]!.event.createdAt), { format: 'date' })}
        </text>
        <text class="boost-curve-axis-title" x="198" y="184" text-anchor="middle"
          >{$_('boostHistory.xAxis')}</text
        >
      </svg>
    {:else if history.phase !== 'idle'}
      <p class="boost-timeline-status">{$_('boostHistory.empty')}</p>
    {/if}

    {#if history.canLoadMore}
      <div class="boost-timeline-more">
        <p>{$_('boostHistory.partial')}</p>
        <button type="button" disabled={history.phase === 'loading'} onclick={onloadmore}>
          {history.phase === 'loading' ? $_('boostHistory.loading') : $_('boostHistory.loadOlder')}
        </button>
      </div>
    {:else if history.budgetReached}
      <p class="boost-timeline-status">{$_('boostHistory.budget')}</p>
    {/if}
  {/if}
</section>
