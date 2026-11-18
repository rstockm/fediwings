import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudit } from './audit.mjs';

const url = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const exceptions = [
  {
    package: 'picomatch',
    advisory: url,
    severity: 'high',
    approvedOn: '2026-11-18',
    expiresOn: '2026-12-18',
    reason: 'Approved build-only risk',
  },
];
const packages = {
  'node_modules/picomatch': { dev: true },
  'node_modules/vite': { dev: true },
};
const fixture = () => ({
  auditReportVersion: 2,
  metadata: { vulnerabilities: { high: 2, critical: 0 } },
  vulnerabilities: {
    picomatch: {
      severity: 'high',
      nodes: ['node_modules/picomatch'],
      via: [{ name: 'picomatch', severity: 'high', url }],
    },
    vite: { severity: 'high', nodes: ['node_modules/vite'], via: ['picomatch'] },
  },
});
const evaluate = (report = fixture(), date = '2026-11-18', lock = packages) =>
  evaluateAudit(report, exceptions, lock, date);

test('allows exactly the approved advisory and its dev-only transitive dependents', () => {
  const result = evaluate();
  assert.equal(result.blocked.length, 0);
  assert.equal(result.waived.length, 1);
});
test('blocks other advisories, including new advisories in the same package', () => {
  const report = fixture();
  report.vulnerabilities.picomatch.via.push({
    name: 'picomatch',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-other',
  });
  assert.equal(evaluate(report).blocked.length, 2);
});
test('does not apply a high-severity waiver to a critical escalation', () => {
  const report = fixture();
  report.vulnerabilities.picomatch.via[0].severity = 'critical';
  assert.equal(evaluate(report).blocked.length, 2);
  const escalatedEntry = fixture();
  escalatedEntry.vulnerabilities.vite.severity = 'critical';
  assert.equal(evaluate(escalatedEntry).blocked.length, 1);
});
test('rejects expired and not-yet-approved exceptions', () => {
  assert.equal(evaluate(fixture(), '2026-12-18').blocked.length, 2);
  assert.equal(evaluate(fixture(), '2026-11-17').blocked.length, 2);
});
test('rejects production and unknown lockfile paths', () => {
  assert.equal(evaluate(fixture(), '2026-11-18', {}).blocked.length, 2);
  assert.equal(
    evaluate(fixture(), '2026-11-18', {
      ...packages,
      'node_modules/picomatch': { dev: false },
    }).blocked.length,
    1,
  );
});
test('resolves dependency cycles without exempting unknown issues', () => {
  const report = fixture();
  report.vulnerabilities.picomatch.via.push('vite');
  assert.equal(evaluate(report).blocked.length, 0);
  report.vulnerabilities.vite.via.push('missing');
  assert.throws(() => evaluate(report), /Unresolved/);
});
test('fails closed on errors, missing details and malformed audit reports', () => {
  assert.throws(() => evaluate({ error: { message: 'network failed' } }), /Invalid/);
  assert.throws(
    () =>
      evaluate({
        auditReportVersion: 2,
        vulnerabilities: {},
        metadata: { vulnerabilities: {} },
      }),
    /Invalid/,
  );
  const report = fixture();
  report.vulnerabilities = {};
  assert.throws(() => evaluate(report), /Missing/);
  report.vulnerabilities = { vite: { severity: 'high', via: ['vite'] } };
  assert.throws(() => evaluate(report), /Missing/);
});
test('keeps the existing high threshold and reports moderate findings without blocking', () => {
  const report = fixture();
  report.vulnerabilities.picomatch.severity = 'moderate';
  delete report.vulnerabilities.vite;
  report.metadata.vulnerabilities.high = 0;
  assert.equal(evaluate(report).blocked.length, 0);
});
