<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import { reportBars, reportChanges, reportMean, reportScaleTicks } from '../lib/reportCharts';

  let {
    labels,
    rows,
  }: {
    labels: string[];
    rows: Array<{ key: string; label: string; values: Array<number | null>; partial?: boolean[] }>;
  } = $props();

  /** Charts whose scale makes a mean line misleading or unreadable. */
  const MEANLESS_KEYS = new Set(['followers']);
  /** Counts that should be reported as whole numbers. */
  const WHOLE_MEAN_KEYS = new Set(['growth', 'reach', 'interactions']);

  const periodLength = $derived(
    labels.some((label) => label.endsWith('*'))
      ? labels.findIndex((label) => label.endsWith('*')) + 1
      : 12,
  );
  const charts = $derived(
    rows
      .map((row) => {
        const values = row.values.slice(0, 12);
        const period = values.slice(0, periodLength);
        const hasValues = period.some((value) => value !== null);
        return {
          key: row.key,
          label: row.label,
          partial: row.partial,
          hasValues,
          values: values.map((value, index) =>
            index < periodLength ? (hasValues && !row.partial ? (value ?? 0) : value) : null,
          ),
        };
      })
      .map((row) => ({
        ...row,
        maximum: Math.max(...row.values.filter((value): value is number => value !== null)),
        ticks: reportScaleTicks(row.values),
        changes: reportChanges(row.values.slice(0, periodLength), row.partial),
        ...reportBars(row.values),
        mean: MEANLESS_KEYS.has(row.key) ? null : reportMean(row.values, row.partial),
        meanFractionDigits: WHOLE_MEAN_KEYS.has(row.key) ? 0 : 1,
      }))
      .sort(
        (a, b) =>
          Number(b.bars.some((bar) => bar.value !== null)) -
          Number(a.bars.some((bar) => bar.value !== null)),
      ),
  );

  function formatValue(value: number, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat($locale === 'en' ? 'en' : 'de', {
      maximumFractionDigits,
    }).format(value);
  }

  const plotColumns = 12;

  let hoveredKey = $state<string | null>(null);
  let hoveredIndex = $state<number | null>(null);

  function trackPointer(
    event: PointerEvent,
    chart: { key: string; values: Array<number | null> },
  ): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.min(plotColumns - 1, Math.floor(fraction * plotColumns));
    if (index >= periodLength || chart.values[index] === null) {
      clearPointer();
      return;
    }
    hoveredKey = chart.key;
    hoveredIndex = index;
  }

  function clearPointer(): void {
    hoveredKey = null;
    hoveredIndex = null;
  }

  function tooltipOffset(index: number): string {
    return `clamp(3.4rem, ${((index + 0.5) * 100) / plotColumns}%, calc(100% - 3.4rem))`;
  }
</script>

<section class="report-charts" aria-labelledby="report-charts-title">
  <div class="report-charts-heading">
    <div>
      <p class="chart-kicker">{$_('reports.chartsKicker')}</p>
      <h3 id="report-charts-title">{$_('reports.chartsTitle')}</h3>
    </div>
    <p>{$_('reports.chartsNote')}</p>
  </div>
  <p class="chart-legend">{$_('reports.chartColorLegend')}</p>
  <div class="chart-grid">
    {#each charts as chart (chart.label)}
      <article class="chart-card">
        <div class="chart-card-head">
          <h4>{chart.label}</h4>
          {#if chart.mean}
            <p class="chart-mean-value">
              {$_('reports.chartMean')}: {formatValue(chart.mean.value, chart.meanFractionDigits)}
            </p>
          {/if}
        </div>
        {#if !chart.hasValues}
          <p class="chart-empty">
            {chart.label === $_('reports.followers')
              ? $_('reports.followersEmpty')
              : chart.label === $_('reports.growth')
                ? $_('reports.growthEmpty')
                : $_('reports.chartEmpty')}
          </p>
        {:else}
          <p class="chart-meta">
            {$_('reports.chartMaximum')}: {formatValue(chart.maximum)}
          </p>
          <div class="chart-plot-row" aria-hidden="true">
            <div class="chart-scale">
              {#each chart.ticks as tick (tick.top)}
                <span style:top={`${tick.top}%`}>
                  {formatValue(tick.value, 4)}
                </span>
              {/each}
            </div>
            <div
              class="chart-plot"
              role="presentation"
              onpointermove={(event) => trackPointer(event, chart)}
              onpointerleave={clearPointer}
            >
              {#each chart.ticks as tick (tick.top)}
                <div class="chart-gridline" style:top={`${tick.top}%`}></div>
              {/each}
              <div class="chart-zero" style:top={`${chart.baseline}%`}></div>
              {#if chart.mean}
                <div class="chart-mean" style:top={`${chart.mean.top}%`}></div>
              {/if}
              {#each chart.bars as bar, index (index)}
                <div
                  class="chart-column"
                  class:chart-column-active={hoveredKey === chart.key && hoveredIndex === index}
                >
                  {#if bar.value !== null}
                    <span
                      class="chart-bar"
                      class:chart-bar-negative={bar.value < 0}
                      class:chart-bar-zero={bar.value === 0}
                      style:--bar-accent={chart.changes[index].direction === 'up'
                        ? 'var(--lime)'
                        : chart.changes[index].direction === 'down'
                          ? 'var(--chart-decline)'
                          : 'var(--chart-rise-soft)'}
                      style:--bar-base={chart.changes[index].direction === 'down'
                        ? 'var(--chart-decline-soft)'
                        : 'var(--chart-rise-soft)'}
                      style:--bar-intensity={`${Math.round(chart.changes[index].intensity * 100)}%`}
                      style:top={`${bar.top}%`}
                      style:height={`${bar.height}%`}
                    ></span>
                  {/if}
                </div>
              {/each}
              {#if hoveredKey === chart.key && hoveredIndex !== null}
                {@const hoveredBar = chart.bars[hoveredIndex]}
                {#if hoveredBar && hoveredBar.value !== null}
                  <div
                    class="chart-hover-line"
                    style:left={`${((hoveredIndex + 0.5) * 100) / plotColumns}%`}
                  ></div>
                  <div class="chart-hover-tip" style:left={tooltipOffset(hoveredIndex)}>
                    {labels[hoveredIndex]} · {formatValue(
                      hoveredBar.value,
                    )}{#if chart.partial?.[hoveredIndex]}
                      · {$_('reports.partialValue')}{/if}
                  </div>
                {/if}
              {/if}
            </div>
          </div>
          <div class="chart-labels" aria-hidden="true">
            {#each labels as label, index (index)}<span>{label}</span>{/each}
          </div>
        {/if}
      </article>
    {/each}
  </div>
</section>

<style>
  .report-charts {
    margin-top: 2.5rem;
    padding-top: 0.35rem;
  }
  .report-charts-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 0.5rem 1.5rem;
    margin-bottom: 1.1rem;
  }
  .report-charts-heading h3 {
    margin: 0;
    font-size: clamp(1.2rem, 2vw, 1.6rem);
  }
  .report-charts-heading > p {
    max-width: 30rem;
    margin: 0;
    color: var(--text-on-dark);
    font-size: 0.8rem;
  }
  .chart-kicker {
    margin: 0 0 0.4rem;
    color: var(--lime);
    font: 700 0.65rem var(--mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .chart-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 27rem), 1fr));
    gap: 1rem;
  }
  .chart-legend {
    margin: 0 0 1.1rem;
    color: var(--text-on-dark);
    font-size: 0.8rem;
  }
  .chart-card {
    min-width: 0;
    padding: 1.1rem;
    border: 1px solid var(--line-dark);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.025);
  }
  .chart-card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 0.8rem;
    margin-bottom: 0.5rem;
  }
  .chart-card h4 {
    margin: 0;
    font-size: 0.9rem;
  }
  .chart-mean-value {
    margin: 0;
    color: var(--violet);
    font: 0.65rem var(--mono);
    white-space: nowrap;
  }
  .chart-meta {
    margin: 0 0 1rem;
    color: var(--text-on-dark);
    font: 0.65rem var(--mono);
  }
  .chart-plot-row {
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr);
    margin-top: 0.6rem;
  }
  .chart-scale {
    position: relative;
    height: 9rem;
    color: var(--text-on-dark);
    font: 0.6rem var(--mono);
  }
  .chart-scale span {
    position: absolute;
    right: 0.5rem;
    transform: translateY(-50%);
    white-space: nowrap;
  }
  .chart-plot {
    position: relative;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 0.3rem;
    height: 9rem;
  }
  .chart-gridline {
    position: absolute;
    right: 0;
    left: 0;
    border-top: 1px solid var(--line-dark);
    pointer-events: none;
  }
  .chart-zero {
    position: absolute;
    z-index: 1;
    right: 0;
    left: 0;
    border-top: 1px solid var(--text-on-dark);
    pointer-events: none;
  }
  .chart-mean {
    position: absolute;
    z-index: 3;
    right: 0;
    left: 0;
    border-top: 1px dashed var(--violet);
    pointer-events: none;
  }
  .chart-hover-line {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 1px;
    background: color-mix(in srgb, var(--paper) 40%, transparent);
    pointer-events: none;
  }
  .chart-hover-tip {
    position: absolute;
    top: 0;
    z-index: 4;
    padding: 0.1rem 0.4rem;
    border: 1px solid color-mix(in srgb, var(--paper) 28%, transparent);
    border-radius: 4px;
    color: var(--paper);
    background: rgba(23, 24, 27, 0.94);
    font: 0.6rem var(--mono);
    white-space: nowrap;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .chart-column-active .chart-bar {
    filter: brightness(1.2);
  }
  .chart-column {
    position: relative;
    min-width: 0;
  }
  .chart-bar {
    position: absolute;
    right: 8%;
    left: 8%;
    min-height: 1px;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--bar-accent) var(--bar-intensity), var(--bar-base)),
      color-mix(
        in srgb,
        color-mix(in srgb, var(--bar-accent) var(--bar-intensity), var(--bar-base)) 88%,
        var(--ink)
      )
    );
  }
  .chart-bar-negative {
    border-radius: 0 0 4px 4px;
  }
  .chart-bar-zero {
    min-height: 3px;
    transform: translateY(-1px);
  }
  .chart-labels {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 0.3rem;
    margin: 0.6rem 0 0 4.5rem;
    color: var(--text-on-dark);
    font: 0.56rem var(--mono);
    text-align: center;
  }
  .chart-labels span {
    white-space: nowrap;
  }
  @media (max-width: 720px) {
    .chart-card {
      padding: 0.8rem;
    }
  }
  @media (max-width: 480px) {
    .chart-labels span:nth-child(even) {
      visibility: hidden;
    }
  }
  .chart-empty {
    display: grid;
    min-height: 10.2rem;
    place-items: center;
    margin: 0;
    color: var(--text-on-dark);
    text-align: center;
    font-size: 0.8rem;
  }
</style>
