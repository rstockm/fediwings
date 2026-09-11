<script lang="ts">
  import { _, date as _date, number as _number } from 'svelte-i18n';
  import type { PostingInsightMetric, PostingInsights } from '../lib/insights';

  let { insights }: { insights: PostingInsights } = $props();

  const chart = { left: 48, right: 392, top: 22, bottom: 122 };
  let activePoint = $state<{ key: PostingInsightMetric['key']; index: number } | null>(null);
  const visibleMetrics = $derived(
    insights.metrics.filter(
      (metric) =>
        metric.key === 'reach' ||
        metric.currentTotal > 0 ||
        (metric.comparisonComplete && metric.previousTotal > 0),
    ),
  );

  const x = (index: number) => chart.left + (index / 29) * (chart.right - chart.left);
  const y = (value: number, max: number) =>
    chart.bottom - (value / max) * (chart.bottom - chart.top);
  const linePath = (values: number[], max: number) =>
    values
      .map(
        (value, index) =>
          `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value, max).toFixed(1)}`,
      )
      .join(' ');
  const areaPath = (metric: PostingInsightMetric, max: number) =>
    `${linePath(metric.currentSeries, max)} L${chart.right},${chart.bottom} L${chart.left},${chart.bottom} Z`;
  const changeClass = (change: number) =>
    change > 0 ? 'insight-change-up' : change < 0 ? 'insight-change-down' : 'insight-change-flat';
  const niceCeil = (value: number) => {
    if (value <= 1) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    for (const step of [1, 2, 4, 5, 10]) {
      if (step * magnitude >= value) return step * magnitude;
    }
    return 10 * magnitude;
  };
  const axisMax = (metric: PostingInsightMetric) => niceCeil(metric.maxDailyValue);
  const yTicks = (metric: PostingInsightMetric) => {
    const max = axisMax(metric);
    return [...new Set([max, max / 2, 0])];
  };
  const pointerIndex = (event: PointerEvent): number => {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * 400;
    const fraction = Math.min(1, Math.max(0, (viewX - chart.left) / (chart.right - chart.left)));
    return Math.round(fraction * 29);
  };
  const pointDate = (start: string, index: number) =>
    new Date(new Date(`${start}T12:00:00Z`).getTime() + index * 24 * 60 * 60 * 1_000);

  function moveActivePoint(event: KeyboardEvent, metric: PostingInsightMetric): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = activePoint?.key === metric.key ? activePoint.index : 29;
    activePoint = {
      key: metric.key,
      index: Math.min(29, Math.max(0, current + (event.key === 'ArrowLeft' ? -1 : 1))),
    };
  }
</script>

<section class="posting-insights" aria-labelledby="posting-insights-title">
  <header class="insights-heading">
    <div>
      <p class="kicker">{$_('insights.kicker')}</p>
      <h2 id="posting-insights-title">{$_('insights.title')}</h2>
    </div>
    <div class="insights-periods">
      <p>
        <span class="insight-period-current" aria-hidden="true"></span>
        <strong>{$_('insights.currentPeriod')}</strong>
        {$_date(new Date(`${insights.currentStart}T12:00:00Z`), { format: 'date' })}–{$_date(
          new Date(`${insights.currentEnd}T12:00:00Z`),
          { format: 'date' },
        )}
      </p>
      <p>
        <span class="insight-period-previous" aria-hidden="true"></span>
        <strong>{$_('insights.previousPeriod')}</strong>
        {$_date(new Date(`${insights.previousStart}T12:00:00Z`), { format: 'date' })}–{$_date(
          new Date(`${insights.previousEnd}T12:00:00Z`),
          { format: 'date' },
        )}
      </p>
    </div>
  </header>

  <p class="insights-method-note">{$_('insights.methodNote')}</p>

  {#if !insights.currentComplete}
    <div class="insights-unavailable" role="status">
      <span aria-hidden="true">30</span>
      <div>
        <h3>{$_('insights.incompleteTitle')}</h3>
        <p>{$_('insights.incompleteText')}</p>
      </div>
    </div>
  {:else if visibleMetrics.length === 0}
    <div class="insights-unavailable" role="status">
      <span aria-hidden="true">0</span>
      <div>
        <h3>{$_('insights.emptyTitle')}</h3>
        <p>{$_('insights.emptyText')}</p>
      </div>
    </div>
  {:else}
    <div class="insight-grid">
      {#each visibleMetrics as metric (metric.key)}
        <article class:insight-card-primary={metric.key === 'reach'} class="insight-card">
          <header class="insight-card-head">
            <div>
              <p>{$_(`insights.metric.${metric.key}`)}</p>
              <span>
                {$_(metric.key === 'reach' ? 'insights.modeledReach' : 'insights.reportedByApi')}
              </span>
            </div>
            <span class="insight-card-index" aria-hidden="true">
              {String(insights.metrics.indexOf(metric) + 1).padStart(2, '0')}
            </span>
          </header>

          {#if metric.currentComplete}
            <div class="insight-total-row">
              <strong>{$_number(metric.currentTotal, { format: 'int' })}</strong>
              {#if metric.comparisonComplete && metric.changePercent !== null}
                <span class={`insight-change ${changeClass(metric.changePercent)}`}>
                  {metric.changePercent > 0 ? '↑' : metric.changePercent < 0 ? '↓' : '→'}
                  {metric.changePercent > 0 ? '+' : ''}{$_number(metric.changePercent, {
                    maximumFractionDigits: 1,
                  })}%
                </span>
              {:else if metric.comparisonComplete}
                <span class="insight-change insight-change-flat">
                  {$_('insights.noPercentBase')}
                </span>
              {:else}
                <span class="insight-change insight-change-flat">
                  {$_('insights.comparisonIncomplete')}
                </span>
              {/if}
            </div>

            <figure>
              <div
                class="insight-chart-wrap"
                role="slider"
                tabindex="0"
                aria-label={$_(
                  metric.comparisonComplete ? 'insights.chartAria' : 'insights.chartAriaCurrent',
                  {
                    values: {
                      metric: $_(`insights.metric.${metric.key}`),
                      current: metric.currentTotal,
                      previous: metric.previousTotal,
                    },
                  },
                )}
                aria-valuemin={0}
                aria-valuemax={29}
                aria-valuenow={activePoint?.key === metric.key ? activePoint.index : 29}
                aria-valuetext={$_(
                  metric.comparisonComplete
                    ? 'insights.sliderValue'
                    : 'insights.sliderValueCurrent',
                  {
                    values: {
                      date: $_date(
                        pointDate(
                          insights.currentStart,
                          activePoint?.key === metric.key ? activePoint.index : 29,
                        ),
                        { format: 'date' },
                      ),
                      current:
                        metric.currentSeries[
                          activePoint?.key === metric.key ? activePoint.index : 29
                        ] ?? 0,
                      previous:
                        metric.previousSeries[
                          activePoint?.key === metric.key ? activePoint.index : 29
                        ] ?? 0,
                    },
                  },
                )}
                onpointermove={(event) =>
                  (activePoint = { key: metric.key, index: pointerIndex(event) })}
                onpointerleave={() => (activePoint = null)}
                onfocus={() => (activePoint = { key: metric.key, index: 29 })}
                onblur={() => (activePoint = null)}
                onkeydown={(event) => moveActivePoint(event, metric)}
              >
                <svg class="insight-chart" viewBox="0 0 400 132" aria-hidden="true">
                  <defs>
                    <linearGradient id={`insight-area-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0"
                        stop-color={metric.key === 'reach' ? 'var(--violet-strong)' : 'var(--blue)'}
                        stop-opacity="0.2"
                      ></stop>
                      <stop
                        offset="1"
                        stop-color={metric.key === 'reach' ? 'var(--violet-strong)' : 'var(--blue)'}
                        stop-opacity="0"
                      ></stop>
                    </linearGradient>
                  </defs>

                  {#each yTicks(metric) as tick (tick)}
                    <line
                      class="insight-grid-line"
                      x1={chart.left}
                      x2={chart.right}
                      y1={y(tick, axisMax(metric))}
                      y2={y(tick, axisMax(metric))}
                    ></line>
                    <text
                      class="insight-axis-label"
                      x={chart.left - 7}
                      y={y(tick, axisMax(metric)) + 3}
                      text-anchor="end">{$_number(tick, { maximumFractionDigits: 1 })}</text
                    >
                  {/each}

                  {#if metric.comparisonComplete}
                    <path
                      class="insight-line-previous"
                      d={linePath(metric.previousSeries, axisMax(metric))}
                    ></path>
                  {/if}
                  <path
                    class="insight-area"
                    style={`fill: url(#insight-area-${metric.key})`}
                    d={areaPath(metric, axisMax(metric))}
                  ></path>
                  <path
                    class="insight-line-current"
                    d={linePath(metric.currentSeries, axisMax(metric))}
                  ></path>

                  {#if activePoint?.key === metric.key}
                    {@const index = activePoint.index}
                    {@const pointX = x(index)}
                    {@const currentY = y(metric.currentSeries[index] ?? 0, axisMax(metric))}
                    {@const previousY = y(metric.previousSeries[index] ?? 0, axisMax(metric))}
                    {@const tooltipX = Math.min(Math.max(pointX, 105), 295)}
                    <line
                      class="insight-crosshair"
                      x1={pointX}
                      x2={pointX}
                      y1={chart.top}
                      y2={chart.bottom}
                    ></line>
                    {#if metric.comparisonComplete}
                      <circle
                        class="insight-hover-dot insight-hover-dot-previous"
                        cx={pointX}
                        cy={previousY}
                        r="3.5"
                      ></circle>
                    {/if}
                    <circle class="insight-hover-dot" cx={pointX} cy={currentY} r="4"></circle>
                    <g class="insight-tooltip">
                      <rect x={tooltipX - 98} y="1" width="196" height="17" rx="4"></rect>
                      <text x={tooltipX} y="13" text-anchor="middle">
                        {$_date(pointDate(insights.currentStart, index), { format: 'day' })} ·
                        {$_number(metric.currentSeries[index] ?? 0, {
                          format: 'int',
                        })}{#if metric.comparisonComplete}
                          / {$_number(metric.previousSeries[index] ?? 0, { format: 'int' })}
                        {/if}
                      </text>
                    </g>
                  {/if}
                </svg>
              </div>
              <figcaption>
                <span>{$_('insights.dayOne')}</span>
                <span>{$_('insights.dayThirty')}</span>
              </figcaption>
            </figure>

            <footer>
              <span>{$_('insights.previousTotal')}</span>
              <strong>
                {metric.comparisonComplete
                  ? $_number(metric.previousTotal, { format: 'int' })
                  : '–'}
              </strong>
            </footer>
          {:else}
            <div class="insight-card-unavailable" role="status">
              <strong>{$_('insights.reachIncompleteTitle')}</strong>
              <p>{$_('insights.reachIncompleteText')}</p>
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>
