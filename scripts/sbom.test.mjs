import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = fileURLToPath(new URL('../', import.meta.url));

test('SBOM is reproducible, complete, validated and rejects stale inputs', () => {
  mkdirSync('/tmp/opencode', { recursive: true });
  const dir = mkdtempSync('/tmp/opencode/fediwings-sbom-test-');
  try {
    for (const path of ['scripts', 'compliance', 'public']) mkdirSync(`${dir}/${path}`);
    for (const path of [
      'package.json',
      'package-lock.json',
      'scripts/sbom.mjs',
      'scripts/pdf-vendors.mjs',
      'compliance/schemas',
      'public/fonts',
    ]) {
      cpSync(`${source}/${path}`, `${dir}/${path}`, { recursive: true });
    }
    symlinkSync(`${source}/node_modules`, `${dir}/node_modules`, 'dir');
    const run = (...args) =>
      spawnSync(process.execPath, [`${dir}/scripts/sbom.mjs`, ...args], { encoding: 'utf8' });
    const generate = run();
    assert.equal(generate.status, 0, generate.stderr);
    const output = `${dir}/compliance/sbom.cdx.json`;
    const snapshot = readFileSync(output, 'utf8');
    const bom = JSON.parse(snapshot);
    const refs = bom.components.map((component) => component['bom-ref']);
    assert.ok(refs.includes('asset:public/fonts/inter-tight-pdf-regular.ttf'));
    assert.ok(refs.includes('asset:public/fonts/inter-tight-pdf-bold.ttf'));
    assert.ok(refs.includes('asset:pdfmake-bundle/core-js'));
    assert.ok(refs.includes('asset:pdfmake-bundle/svg-to-pdfkit'));
    assert.equal(
      bom.components.find((component) => component.name === 'png-js').licenses[0].license.id,
      'MIT',
    );
    assert.equal(new Set(refs).size, refs.length, 'component references must be unique');
    assert.equal(
      bom.metadata.component.name,
      'fediwings',
      'directory name must not affect inventory',
    );
    const checked = run('--check');
    assert.equal(checked.status, 0, checked.stderr);

    writeFileSync(output, `${snapshot}\n`);
    assert.match(run('--check').stderr, /SBOM is stale/);
    writeFileSync(output, snapshot);

    const font = `${dir}/public/fonts/inter-tight-latin.woff2`;
    const original = readFileSync(font);
    writeFileSync(font, Buffer.concat([original, Buffer.from('changed')]));
    assert.match(run('--check').stderr, /SBOM is stale/);
    writeFileSync(font, original);

    const pdfFont = `${dir}/public/fonts/inter-tight-pdf-regular.ttf`;
    const originalPdfFont = readFileSync(pdfFont);
    writeFileSync(pdfFont, Buffer.concat([originalPdfFont, Buffer.from('changed')]));
    assert.match(run('--check').stderr, /SBOM is stale/);
    writeFileSync(pdfFont, originalPdfFont);

    const lockPath = `${dir}/package-lock.json`;
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    delete lock.packages['node_modules/zod'].license;
    writeFileSync(lockPath, JSON.stringify(lock));
    assert.match(run('--check').stderr, /Unresolved licenses/);

    // Invalid official schema must fail rather than skip validation.
    cpSync(`${source}/package-lock.json`, lockPath);
    const schemaPath = `${dir}/compliance/schemas/bom-1.5.schema.json`;
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    schema.properties.bomFormat.enum = ['NotCycloneDX'];
    writeFileSync(schemaPath, JSON.stringify(schema));
    assert.match(run('--check').stderr, /Invalid SBOM/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
