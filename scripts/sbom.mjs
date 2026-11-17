import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const output = 'compliance/sbom.cdx.json';
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
if (manifest.packageManager !== `npm@${npmVersion}`) {
  throw new Error(`SBOM requires ${manifest.packageManager}; found npm@${npmVersion}.`);
}
const bom = JSON.parse(
  execFileSync(
    'npm',
    [
      'sbom',
      '--package-lock-only',
      '--sbom-format=cyclonedx',
      '--sbom-type=application',
      '--include=dev',
      '--include=optional',
      '--include=peer',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        npm_config_offline: 'true',
        npm_config_update_notifier: 'false',
      },
      maxBuffer: 20 * 1024 * 1024,
    },
  ),
);
// npm adds random/time-dependent metadata and derives the root name from cwd.
delete bom.serialNumber;
delete bom.metadata.timestamp;
bom.metadata.component.name = manifest.name;
// npm may emit repeated name/version components. Merge their installation paths
// and dependency edges, keeping references unique without losing lockfile coverage.
const components = new Map();
for (const component of bom.components) {
  const existing = components.get(component['bom-ref']);
  if (existing) {
    existing.properties = [
      ...new Map(
        [...existing.properties, ...component.properties].map((property) => [
          JSON.stringify(property),
          property,
        ]),
      ).values(),
    ];
    if (component.scope === 'required') existing.scope = 'required';
  } else {
    components.set(component['bom-ref'], component);
  }
}
bom.components = [...components.values()];
const dependencies = new Map();
for (const { ref, dependsOn } of bom.dependencies) {
  dependencies.set(ref, [...new Set([...(dependencies.get(ref) ?? []), ...dependsOn])].sort());
}
bom.dependencies = [...dependencies].map(([ref, dependsOn]) => ({ ref, dependsOn }));
const npmComponents = bom.components;
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const coveredPaths = new Set(
  npmComponents.flatMap((component) =>
    (component.properties ?? [])
      .filter((property) => property.name === 'cdx:npm:package:path')
      .map((property) => property.value),
  ),
);
const missingPaths = Object.keys(lock.packages).filter((path) => path && !coveredPaths.has(path));
if (missingPaths.length) throw new Error(`Incomplete SBOM: ${missingPaths.join(', ')}`);
const unlicensed = npmComponents.filter((component) => !component.licenses?.length);
if (unlicensed.length) {
  throw new Error(
    `Unresolved licenses: ${unlicensed.map((component) => component.name).join(', ')}`,
  );
}

const fontRefs = [];
for (const name of readdirSync('public/fonts')
  .filter((name) => name.endsWith('.woff2'))
  .sort()) {
  const path = `public/fonts/${name}`;
  const ref = `asset:${path}`;
  fontRefs.push(ref);
  bom.components.push({
    type: 'file',
    'bom-ref': ref,
    name: path,
    description:
      'Inter Tight webfont subset; upstream version not recorded, identified by SHA-256.',
    hashes: [
      { alg: 'SHA-256', content: createHash('sha256').update(readFileSync(path)).digest('hex') },
    ],
    licenses: [
      {
        license: {
          id: 'OFL-1.1',
          text: {
            contentType: 'text/plain',
            content: readFileSync('public/fonts/OFL.txt', 'utf8'),
          },
        },
      },
    ],
    copyright: 'Copyright 2022 The Inter Project Authors (https://github.com/rsms/inter-tight)',
  });
  bom.dependencies.push({ ref, dependsOn: [] });
}
const root = bom.dependencies.find(
  (dependency) => dependency.ref === bom.metadata.component['bom-ref'],
);
root.dependsOn.push(...fontRefs);
// Inventory the vendored validation schemas too; they are tooling, not app assets.
for (const name of readdirSync('compliance/schemas')
  .filter((name) => name.endsWith('.json'))
  .sort()) {
  const path = `compliance/schemas/${name}`;
  const ref = `asset:${path}`;
  bom.components.push({
    type: 'file',
    'bom-ref': ref,
    name: path,
    hashes: [
      { alg: 'SHA-256', content: createHash('sha256').update(readFileSync(path)).digest('hex') },
    ],
    licenses: [{ license: { id: 'Apache-2.0' } }],
    properties: [{ name: 'cdx:npm:package:development', value: 'true' }],
  });
  root.dependsOn.push(ref);
  bom.dependencies.push({ ref, dependsOn: [] });
}
bom.components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'], 'en'));
for (const component of bom.components) {
  component.properties?.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
}
bom.dependencies.sort((a, b) => a.ref.localeCompare(b.ref, 'en'));
root.dependsOn.sort();
const serialized = `${JSON.stringify(bom, null, 2)}\n`;
// Schemas are vendored, so validation needs no downloads. Draft-07 format
// annotations for international IRIs/emails are not checked by Ajv 6.
const ajv = new Ajv({
  allErrors: true,
  unknownFormats: ['iri-reference', 'idn-email'],
  logger: false,
});
for (const name of ['spdx.schema.json', 'jsf-0.82.schema.json']) {
  ajv.addSchema(JSON.parse(readFileSync(`compliance/schemas/${name}`, 'utf8')));
}
const validate = ajv.compile(
  JSON.parse(readFileSync('compliance/schemas/bom-1.5.schema.json', 'utf8')),
);
if (!validate(bom)) throw new Error(`Invalid SBOM: ${ajv.errorsText(validate.errors)}`);
const refs = new Set([
  bom.metadata.component['bom-ref'],
  ...bom.components.map((component) => component['bom-ref']),
]);
for (const { ref, dependsOn } of bom.dependencies) {
  if (![ref, ...dependsOn].every((target) => refs.has(target)))
    throw new Error(`Unresolved SBOM reference: ${ref}`);
}

if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== serialized) {
    throw new Error('SBOM is stale. Run npm run sbom and include the updated snapshot.');
  }
  console.log('SBOM is valid and up to date.');
} else {
  writeFileSync(output, serialized);
  console.log(
    `Wrote ${output} (${Object.keys(lock.packages).length - 1} npm package instances; ${bom.components.length} distinct components including assets).`,
  );
}
