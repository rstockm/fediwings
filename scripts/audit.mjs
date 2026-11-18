import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const blocking = (severity) => severity === 'high' || severity === 'critical';

// Resolve npm's transitive "via" references; a dependency cycle is not an advisory.
function advisories(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return [];
  const entry = vulnerabilities[name];
  if (!entry || !Array.isArray(entry.via) || entry.via.length === 0) {
    throw new Error(`Unresolved audit entry: ${name}`);
  }
  const next = new Set([...seen, name]);
  return entry.via.flatMap((via) => {
    if (typeof via === 'string') return advisories(via, vulnerabilities, next);
    if (!via || typeof via.url !== 'string' || typeof via.severity !== 'string') {
      throw new Error(`Invalid advisory: ${name}`);
    }
    return [via];
  });
}

export function evaluateAudit(
  report,
  exceptions,
  packages,
  today = new Date().toISOString().slice(0, 10),
) {
  if (
    report.error ||
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    !report.metadata?.vulnerabilities ||
    !Array.isArray(exceptions) ||
    !['high', 'critical'].every(
      (key) =>
        Number.isInteger(report.metadata.vulnerabilities[key]) &&
        report.metadata.vulnerabilities[key] >= 0,
    )
  ) {
    throw new Error('Invalid or incomplete npm audit response.');
  }
  const blocked = [];
  const waived = new Set();
  const entries = Object.entries(report.vulnerabilities).filter(([, entry]) =>
    blocking(entry.severity),
  );
  if (
    (report.metadata.vulnerabilities.high > 0 || report.metadata.vulnerabilities.critical > 0) &&
    entries.length === 0
  )
    throw new Error('Missing high/critical audit entries.');
  for (const [name, entry] of entries) {
    const findings = advisories(name, report.vulnerabilities).filter((via) =>
      blocking(via.severity),
    );
    if (findings.length === 0) throw new Error(`Missing advisory details: ${name}`);
    for (const finding of findings) {
      const exception = exceptions.find(
        (item) =>
          entry.severity === 'high' &&
          item.package === finding.name &&
          item.advisory === finding.url &&
          item.severity === finding.severity &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.approvedOn) &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.expiresOn) &&
          item.approvedOn <= today &&
          today < item.expiresOn &&
          typeof item.reason === 'string' &&
          item.reason.trim().length > 0,
      );
      // A newly introduced production dependency must not inherit this build-only waiver.
      const devOnly =
        Array.isArray(entry.nodes) &&
        entry.nodes.length > 0 &&
        entry.nodes.every((path) => packages[path]?.dev === true);
      if (!exception || !devOnly) {
        blocked.push(`${name}: ${finding.url} (${finding.severity})`);
      } else {
        waived.add(`${finding.url} (dev only, expires ${exception.expiresOn})`);
      }
    }
  }
  return { blocked: [...new Set(blocked)], waived: [...waived] };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const result = spawnSync('npm', ['audit', '--json'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.error || ![0, 1].includes(result.status)) {
      throw result.error ?? new Error(result.stderr || 'npm audit failed.');
    }
    const report = JSON.parse(result.stdout);
    const exceptions = JSON.parse(
      readFileSync(new URL('../compliance/audit-exceptions.json', import.meta.url), 'utf8'),
    );
    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
    const { blocked, waived } = evaluateAudit(report, exceptions, lock.packages);
    console.log('npm audit totals:', JSON.stringify(report.metadata.vulnerabilities));
    for (const waiver of waived) console.warn(`Approved audit exception: ${waiver}`);
    for (const finding of blocked) console.error(`BLOCKED: ${finding}`);
    if (blocked.length) process.exitCode = 1;
    else console.log('Audit gate passed: no unapproved high/critical findings.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
