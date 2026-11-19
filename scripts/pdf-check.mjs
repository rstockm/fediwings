import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import pdfmake from 'pdfmake';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { pdfDefinition } = await server.ssrLoadModule('/src/lib/reportPdf/render.ts');
  const { buildReportDocument } = await server.ssrLoadModule('/src/lib/reportPdf/document.ts');
  const { pdfFixture, pdfFixtureImages } = await server.ssrLoadModule(
    '/src/lib/reportPdf/fixtures.ts',
  );
  const css = readFileSync('src/styles/tokens.css', 'utf8');
  const color = (name) => css.match(new RegExp(`--${name}:\\s*(#[a-f0-9]+)`, 'i'))[1];
  const palette = {
    ink: color('ink'),
    paper: color('paper-raised'),
    muted: color('text-on-light'),
    violet: color('violet-strong'),
    lime: color('lime'),
    riseSoft: color('chart-rise-soft'),
    decline: color('chart-decline'),
    declineSoft: color('chart-decline-soft'),
  };
  const regular = `${process.cwd()}/public/fonts/inter-tight-pdf-regular.ttf`;
  const bold = `${process.cwd()}/public/fonts/inter-tight-pdf-bold.ttf`;
  pdfmake.setFonts({ Inter: { normal: regular, bold, italics: regular, bolditalics: bold } });
  pdfmake.setLocalAccessPolicy((path) => [regular, bold].includes(path));
  pdfmake.setUrlAccessPolicy(() => false);
  mkdirSync('test-results/pdf', { recursive: true });
  const versions = {};
  for (const cmd of ['pdfinfo', 'pdftoppm'])
    versions[cmd] = spawnSync(cmd, ['-v'], { encoding: 'utf8' }).stderr.split('\n')[0];
  const results = [];
  const visual = {};
  for (const variant of ['complete', 'current', 'partial', 'empty', 'legacy', 'long', 'large']) {
    for (const locale of variant === 'complete' ? ['de', 'en'] : ['de']) {
      const snapshot = pdfFixture(variant);
      if (variant !== 'legacy') {
        snapshot.report.interactionBasis = 'notification-time';
        snapshot.report.total.interactionsComplete = variant !== 'partial';
        for (const [i, period] of snapshot.report.months.entries()) {
          if (snapshot.months[i] !== 'future')
            period.interactionsComplete = variant !== 'partial' || i > 1;
        }
        if (snapshot.annualComparison) snapshot.annualComparison.total.interactionsComplete = true;
        if (variant === 'partial') {
          const january = snapshot.report.months[0];
          snapshot.report.total.interactions -= january.interactions;
          january.interactions = null;
        }
      }
      if (variant === 'long') {
        snapshot.handle = '@' + 'langes-handle-'.repeat(15) + '@example.social';
        snapshot.topPosts[0].excerpt =
          'Zugänglichkeit 😀 中文 und übergreifende Kommunikationsentwicklung '.repeat(4);
      }
      const options = {
        title:
          variant === 'long'
            ? 'Langfristige Kommunikationsentwicklung und strategischer Jahresrückblick '.repeat(2)
            : locale === 'de'
              ? 'Fediverse-Kommunikation'
              : 'Fediverse communication',
        organization:
          variant === 'long'
            ? 'Organisation für wissenschaftliche und gesellschaftliche Zusammenarbeit '.repeat(2)
            : locale === 'de'
              ? 'DEMO · synthetische Beispieldaten'
              : 'DEMO · synthetic example data',
        locale,
        createdAt: '2026-01-15T12:00:00.000Z',
      };
      const doc = buildReportDocument(snapshot, options);
      const definition = pdfDefinition(doc, palette, pdfFixtureImages(snapshot));
      definition.info.creationDate = new Date(options.createdAt);
      definition.info.modDate = new Date(options.createdAt);
      const path = `test-results/pdf/${variant}-${locale}.pdf`;
      writeFileSync(path, await pdfmake.createPdf(definition).getBuffer());
      const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
      const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
      const fonts = execFileSync('pdffonts', [path], { encoding: 'utf8' });
      const links = execFileSync('pdfinfo', ['-url', path], { encoding: 'utf8' });
      assert.ok(links.includes('https://rstockm.github.io/fediwings/?view=methodik'));
      for (const post of snapshot.topPosts) assert.ok(links.includes(post.url));
      assert.ok(
        readFileSync(path).includes(Buffer.from(`/Lang (${locale === 'de' ? 'de-DE' : 'en-GB'})`)),
      );
      assert.match(info, /JavaScript:\s+no/);
      const boxes = execFileSync('pdftotext', ['-bbox', path, '-'], { encoding: 'utf8' });
      for (const word of boxes.matchAll(
        /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
      )) {
        assert.ok(
          Number(word[1]) >= 52 && Number(word[3]) <= 544,
          `${variant}: horizontal overflow`,
        );
        assert.ok(Number(word[2]) >= 20 && Number(word[4]) <= 824, `${variant}: vertical overflow`);
      }
      for (const page of boxes.match(/<page[\s\S]*?<\/page>/g) ?? []) {
        const bodyWords = [
          ...page.matchAll(/<word xMin="[\d.]+" yMin="([\d.]+)"[^>]*>([^<]+)<\/word>/g),
        ].filter((word) => Number(word[1]) >= 54 && Number(word[1]) < 790);
        assert.ok(bodyWords.length > 0, `${variant}: empty page`);
      }
      assert.match(info, /Page size:\s+595.28 x 841.89 pts/);
      assert.match(info, /Tagged:\s+yes/);
      assert.match(fonts, /InterTight-Regular\s+CID TrueType\s+Identity-H\s+yes\s+yes\s+yes/);
      assert.ok(text.includes(doc.copy.methodology));
      assert.ok(text.includes(doc.copy.reach));
      for (const series of doc.series) {
        for (const [i, value] of series.values.entries()) {
          if (value === null || series.status[i] === 'future') continue;
          const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
          assert.ok(
            text.includes(number),
            `${variant}/${series.id}: missing table value ${number}`,
          );
        }
      }
      const pages = Number(info.match(/Pages:\s+(\d+)/)[1]);
      // Complete tables take precedence over the nominal five-page layout.
      if (variant === 'complete')
        assert.ok(pages >= 5 && pages <= 7, 'Unexpected reference pagination');
      // Rasterize all pages, with the installed Poppler version recorded below.
      execFileSync('pdftoppm', [
        '-scale-to',
        '1200',
        '-png',
        path,
        `test-results/pdf/${variant}-${locale}`,
      ]);
      // Ignore old raster files when a fixture now has fewer pages.
      for (let page = 1; page <= pages; page += 1) {
        const file = `${variant}-${locale}-${String(page).padStart(String(pages).length, '0')}.png`;
        visual[file] = createHash('sha256')
          .update(readFileSync(`test-results/pdf/${file}`))
          .digest('hex');
      }
      writeFileSync(path.replace('.pdf', '.txt'), text);
      results.push({ variant, locale, pages, bytes: readFileSync(path).length });
      if (process.argv.includes('--update-demo') && variant === 'complete') {
        mkdirSync('docs/examples', { recursive: true });
        writeFileSync(`docs/examples/report-demo-${locale}.pdf`, readFileSync(path));
      }
    }
  }
  writeFileSync('test-results/pdf/results.json', JSON.stringify({ versions, results }, null, 2));
  const referencePath = 'tests/fixtures/pdf-reference.json';
  const reference = { versions, visual };
  if (process.argv.includes('--semantic-only')) {
    console.log(
      'Semantic PDF checks only; visual reference comparison requires the recorded Poppler version.',
    );
  } else if (process.argv.includes('--update-reference')) {
    mkdirSync('tests/fixtures', { recursive: true });
    writeFileSync(referencePath, JSON.stringify(reference, null, 2) + '\n');
  } else {
    assert.ok(existsSync(referencePath), 'Create and review PDF reference with --update-reference');
    assert.deepEqual(
      reference,
      JSON.parse(readFileSync(referencePath, 'utf8')),
      'PDF layout or rasterizer changed: review before updating reference',
    );
  }
  console.log(results);
} finally {
  await server.close();
}
