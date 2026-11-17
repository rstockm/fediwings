<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import { reportBars, reportChanges, reportMean, reportScaleTicks } from '../lib/reportCharts';

  let {
    labels,
    rows,
  }: {
    labels: string[];
    rows: Array<{ label: string; values: Array<number | null> }>;
  } = $props();

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
          label: row.label,
          hasValues,
          values: values.map((value, index) =>
            index < periodLength ? (hasValues ? (value ?? 0) : null) : null,
          ),
        };
      })
      .map((row) => ({
        ...row,
        maximum: Math.max(...row.values.filter((value): value is number => value !== null)),
        ticks: reportScaleTicks(row.values),
        changes: reportChanges(row.values.slice(0, periodLength)),
        ...reportBars(row.values),
        mean: reportMean(row.values),
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
        <h4>{chart.label}</h4>
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
            {#if chart.mean}
              · {$_('reports.chartMean')}: {formatValue(chart.mean.value)}
            {/if}
          </p>
          <div class="chart-plot-row" aria-hidden="true">
            <div class="chart-scale">
              {#each chart.ticks as tick (tick.top)}
                <span style:top={`${tick.top}%`}>
                  {formatValue(tick.value, 4)}
                </span>
              {/each}
            </div>
            <div class="chart-plot">
              {#each chart.ticks as tick (tick.top)}
                <div class="chart-gridline" style:top={`${tick.top}%`}></div>
              {/each}
              <div class="chart-zero" style:top={`${chart.baseline}%`}></div>
              {#if chart.mean}
                <div class="chart-mean" style:top={`${chart.mean.top}%`}>
                  <span>Ø {formatValue(chart.mean.value)}</span>
                </div>
              {/if}
              {#each chart.bars as bar, index (index)}
                <div
                  class="chart-column"
                  title={`${labels[index]}: ${bar.value === null ? '—' : formatValue(bar.value)}`}
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
  .chart-card h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
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
  .chart-mean span {
    position: absolute;
    top: 0;
    right: 0.25rem;
    padding: 0 0.25rem;
    color: var(--violet);
    background: var(--ink);
    font: 0.6rem var(--mono);
    transform: translateY(-50%);
    white-space: nowrap;
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
