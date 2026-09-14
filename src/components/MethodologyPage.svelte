<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { calculateNetReach } from '../lib/reach';

  const chart = { left: 38, right: 348, top: 14, bottom: 208 };
  const boostTicks = [0, 10, 20, 30, 40, 50];
  const reachTicks = [0, 25, 50, 75, 100];
  const curveSeries = [
    { interactions: 0, label: 'methodology.curve0', className: 'reach-curve-low' },
    { interactions: 10, label: 'methodology.curve10', className: 'reach-curve-mid' },
    { interactions: 50, label: 'methodology.curve50', className: 'reach-curve-high' },
  ];

  const chartX = (boosts: number) => chart.left + (boosts / 50) * (chart.right - chart.left);
  const chartY = (percentage: number) =>
    chart.bottom - (percentage / 100) * (chart.bottom - chart.top);
  const reachPercentage = (boosts: number, interactions: number) =>
    calculateNetReach(100_000, boosts, interactions, boosts + interactions) / 1_000;
  const curvePath = (interactions: number) =>
    Array.from({ length: 51 }, (_, boosts) => {
      const command = boosts === 0 ? 'M' : 'L';
      return `${command}${chartX(boosts).toFixed(1)},${chartY(reachPercentage(boosts, interactions)).toFixed(1)}`;
    }).join(' ');
  const areaPath = `${curvePath(50)} L${chart.right},${chart.bottom} L${chart.left},${chart.bottom} Z`;

  // Endpunkte kommen aus dem Sprachkatalog, damit es nur eine Quelle dafuer gibt.
  const apiSteps = [1, 2, 3, 4].map((step) => ({
    number: String(step).padStart(2, '0'),
    title: `methodology.step${step}Title`,
    endpoint: `methodology.step${step}Endpoint`,
    text: `methodology.step${step}Text`,
  }));

  const citizenRules = [
    ['2', 'methodology.ruleParallel'],
    ['120', 'methodology.ruleBudget'],
    ['10', 'methodology.rulePages'],
    ['0', 'methodology.ruleBackground'],
  ];
</script>

<main class="methodology-page">
  <section class="methodology-hero" aria-labelledby="methodology-title">
    <div class="methodology-hero-copy">
      <p class="kicker">{$_('methodology.kicker')}</p>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
      <h1 id="methodology-title">{@html $_('methodology.titleHtml')}</h1>
      <p>{$_('methodology.intro')}</p>
    </div>

    <aside class="curve-card" aria-label="Visualisierung der Netto-Reichweite">
      <div class="curve-card-head">
        <span>{$_('methodology.modelBadge')}</span>
        <span>{$_('methodology.modelRatio')}</span>
      </div>
      <p class="curve-name">{$_('methodology.curveName')}</p>
      <p class="curve-subtitle">{$_('methodology.curveSubtitle')}</p>

      <svg
        class="reach-curve-chart"
        viewBox="0 0 360 246"
        role="img"
        aria-label={$_('methodology.chartAria')}
      >
        <defs>
          <linearGradient id="reach-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#c7f36b" stop-opacity="0.2"></stop>
            <stop offset="1" stop-color="#c7f36b" stop-opacity="0"></stop>
          </linearGradient>
        </defs>

        {#each reachTicks as tick (tick)}
          <line
            class="curve-grid-line"
            x1={chart.left}
            x2={chart.right}
            y1={chartY(tick)}
            y2={chartY(tick)}
          ></line>
          <text class="curve-axis-label" x={chart.left - 9} y={chartY(tick) + 3} text-anchor="end"
            >{tick}%</text
          >
        {/each}

        {#each boostTicks as tick (tick)}
          <line
            class="curve-tick-line"
            x1={chartX(tick)}
            x2={chartX(tick)}
            y1={chart.bottom}
            y2={chart.bottom + 5}
          ></line>
          <text class="curve-axis-label" x={chartX(tick)} y={chart.bottom + 18} text-anchor="middle"
            >{tick}</text
          >
        {/each}

        <path class="reach-curve-area" d={areaPath}></path>
        {#each curveSeries as curve (curve.interactions)}
          <path class={`reach-curve ${curve.className}`} d={curvePath(curve.interactions)}></path>
        {/each}
        <text class="curve-axis-title" x={chart.right} y="244" text-anchor="end"
          >{$_('methodology.axisTitle')}</text
        >
      </svg>

      <ul class="curve-legend" aria-label={$_('methodology.legendAria')}>
        {#each curveSeries as curve (curve.interactions)}
          <li class={curve.className}><span></span>{$_(curve.label)}</li>
        {/each}
      </ul>

      <p class="curve-note">{$_('methodology.curveNote')}</p>

      <details class="formula-details">
        <summary>{$_('methodology.formulaSummary')}</summary>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
        <code>{@html $_('methodology.formulaCodeHtml')}</code>
        <p>{$_('methodology.formulaLegend')}</p>
      </details>
    </aside>
  </section>

  <nav class="methodology-index" aria-label={$_('methodology.indexAria')}>
    <a href="#modell"><span>01</span> {$_('methodology.indexModel')}</a>
    <a href="#api"><span>02</span> {$_('methodology.indexApi')}</a>
    <a href="#citizen"><span>03</span> {$_('methodology.indexCitizen')}</a>
    <a href="#privacy"><span>04</span> {$_('methodology.indexPrivacy')}</a>
    <a href="#limits"><span>05</span> {$_('methodology.indexLimits')}</a>
  </nav>

  <section class="methodology-section methodology-model" id="modell" aria-labelledby="model-title">
    <header class="methodology-section-head">
      <span>{$_('methodology.modelSection')}</span>
      <h2 id="model-title">{$_('methodology.modelTitle')}</h2>
    </header>

    <div class="model-columns">
      <article class="model-card model-card-net">
        <p class="eyebrow">{$_('methodology.netEyebrow')}</p>
        <h3>{$_('methodology.netTitle')}</h3>
        <div class="model-flow" aria-label={$_('methodology.flowAria')}>
          <span
            ><b>{$_('methodology.flowNetwork')}</b><small
              >{$_('methodology.flowNetworkDetail')}</small
            ></span
          >
          <i aria-hidden="true">→</i>
          <span
            ><b>{$_('methodology.flowSignals')}</b><small
              >{$_('methodology.flowSignalsDetail')}</small
            ></span
          >
          <i aria-hidden="true">→</i>
          <span
            ><b>{$_('methodology.flowNet')}</b><small>{$_('methodology.flowNetDetail')}</small
            ></span
          >
        </div>
        <p>{$_('methodology.netText')}</p>
        <strong>{$_('methodology.netStrong')}</strong>
      </article>

      <article class="model-card model-card-gross">
        <p class="eyebrow">{$_('methodology.grossEyebrow')}</p>
        <h3>{$_('methodology.grossTitle')}</h3>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
        <code>{@html $_('methodology.grossCodeHtml')}</code>
        <p>{$_('methodology.grossText')}</p>
        <strong>{$_('methodology.grossStrong')}</strong>
      </article>
    </div>

    <div class="assumption-strip">
      <div>
        <span class="assumption-number">×2</span>
        <p><strong>{$_('methodology.boostWeight')}</strong>{$_('methodology.boostWeightText')}</p>
      </div>
      <p>{$_('methodology.boostWeightNote')}</p>
    </div>
  </section>

  <section class="methodology-section methodology-api" id="api" aria-labelledby="api-title">
    <header class="methodology-section-head">
      <span>{$_('methodology.apiSection')}</span>
      <h2 id="api-title">{$_('methodology.apiTitle')}</h2>
      <p>{$_('methodology.apiIntro')}</p>
    </header>

    <ol class="api-flow">
      {#each apiSteps as step (step.number)}
        <li>
          <span class="api-step-number">{step.number}</span>
          <div>
            <h3>{$_(step.title)}</h3>
            <code>{$_(step.endpoint)}</code>
            <p>{$_(step.text)}</p>
          </div>
        </li>
      {/each}
    </ol>

    <div class="api-budget">
      <div>
        <p class="eyebrow">{$_('methodology.budgetEyebrow')}</p>
        <strong>{$_('methodology.budgetValue')}</strong>
        <span>{$_('methodology.budgetNote')}</span>
      </div>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
      <code>{@html $_('methodology.budgetCode')}</code>
    </div>
  </section>

  <section
    class="methodology-section methodology-citizen"
    id="citizen"
    aria-labelledby="citizen-title"
  >
    <header class="methodology-section-head">
      <span>{$_('methodology.citizenSection')}</span>
      <h2 id="citizen-title">{$_('methodology.citizenTitle')}</h2>
    </header>

    <div class="citizen-metrics">
      {#each citizenRules as rule (rule[1])}
        <div><strong>{rule[0]}</strong><span>{$_(rule[1])}</span></div>
      {/each}
    </div>

    <div class="principle-grid">
      <article>
        <h3>{$_('methodology.principle1Title')}</h3>
        <p>{$_('methodology.principle1Text')}</p>
      </article>
      <article>
        <h3>{$_('methodology.principle2Title')}</h3>
        <p>{$_('methodology.principle2Text')}</p>
      </article>
      <article>
        <h3>{$_('methodology.principle3Title')}</h3>
        <p>{$_('methodology.principle3Text')}</p>
      </article>
      <article>
        <h3>{$_('methodology.principle4Title')}</h3>
        <p>{$_('methodology.principle4Text')}</p>
      </article>
    </div>
  </section>

  <section
    class="methodology-section methodology-privacy"
    id="privacy"
    aria-labelledby="privacy-title"
  >
    <header class="methodology-section-head">
      <span>{$_('methodology.privacySection')}</span>
      <h2 id="privacy-title">{$_('methodology.privacyTitle')}</h2>
    </header>

    <div class="privacy-ledger">
      <div class="privacy-ledger-yes">
        <p>{$_('methodology.ledgerYes')}</p>
        <ul>
          <li>{$_('methodology.ledgerYes1')}</li>
          <li>{$_('methodology.ledgerYes2')}</li>
          <li>{$_('methodology.ledgerYes3')}</li>
        </ul>
      </div>
      <div class="privacy-ledger-no">
        <p>{$_('methodology.ledgerNo')}</p>
        <ul>
          <li>{$_('methodology.ledgerNo1')}</li>
          <li>{$_('methodology.ledgerNo2')}</li>
          <li>{$_('methodology.ledgerNo3')}</li>
        </ul>
      </div>
    </div>

    <div class="security-line">
      <span>{$_('methodology.secZod')}</span>
      <span>{$_('methodology.secDompurify')}</span>
      <span>{$_('methodology.secCsp')}</span>
      <span>{$_('methodology.secHttps')}</span>
    </div>
  </section>

  <section
    class="methodology-section methodology-limits"
    id="limits"
    aria-labelledby="limits-title"
  >
    <header class="methodology-section-head">
      <span>{$_('methodology.limitsSection')}</span>
      <h2 id="limits-title">{$_('methodology.limitsTitle')}</h2>
    </header>

    <div class="limits-layout">
      <p class="limits-lead">{$_('methodology.limitsLead')}</p>
      <ul>
        <li>{$_('methodology.limit1')}</li>
        <li>{$_('methodology.limit2')}</li>
        <li>{$_('methodology.limit3')}</li>
        <li>{$_('methodology.limit4')}</li>
        <li>{$_('methodology.limit5')}</li>
        <li>{$_('methodology.limit6')}</li>
        <li>{$_('methodology.limit7')}</li>
        <li>{$_('methodology.limit8')}</li>
      </ul>
    </div>

    <div class="interpretation-card">
      <span>{$_('methodology.interpretationLabel')}</span>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
      <p>{@html $_('methodology.interpretationHtml')}</p>
      <a href="./">{$_('methodology.startAnalysis')} <span aria-hidden="true">→</span></a>
    </div>
  </section>
</main>
