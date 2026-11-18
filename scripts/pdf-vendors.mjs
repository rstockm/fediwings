import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

// The browser distribution embeds build dependencies absent from our npm lockfile.
// Inventory the actual bundled sources, not presumed installed package versions.
const licenses = {
  '@noble/ciphers': 'MIT',
  '@noble/hashes': 'MIT',
  '@swc/helpers': 'Apache-2.0',
  'base64-js': 'MIT',
  brotli: 'MIT',
  buffer: 'MIT',
  clone: 'MIT',
  'core-js': 'MIT',
  dfa: 'MIT',
  events: 'MIT',
  'expose-loader': 'MIT',
  'fast-deep-equal': 'MIT',
  fflate: 'MIT',
  'file-saver': 'MIT',
  fontkit: 'MIT',
  ieee754: 'BSD-3-Clause',
  linebreak: 'MIT',
  pdfkit: 'MIT',
  'png-js': 'MIT',
  process: 'MIT',
  restructure: 'MIT',
  sax: 'BlueOak-1.0.0',
  'tiny-inflate': 'MIT',
  'unicode-properties': 'MIT',
  'unicode-trie': 'MIT',
  'svg-to-pdfkit': 'MIT',
};
const noticeSources = {
  buffer: '6.0.3',
  'core-js': '3.51.0',
  events: '3.3.0',
  'expose-loader': '5.0.1',
  'file-saver': '2.0.5',
  ieee754: '1.2.1',
  process: '0.11.10',
};
export function pdfVendorSources() {
  const map = JSON.parse(readFileSync('node_modules/pdfmake/build/pdfmake.js.map', 'utf8'));
  const groups = new Map();
  for (const [i, path] of map.sources.entries()) {
    const name =
      path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1] ??
      (path.includes('3rd-party/svg-to-pdfkit/') ? 'svg-to-pdfkit' : null);
    if (!name) continue;
    if (!licenses[name]) throw new Error(`Unreviewed pdfmake vendor: ${name}`);
    const entries = groups.get(name) ?? [];
    entries.push({ path, source: map.sourcesContent[i] ?? '' });
    groups.set(name, entries);
  }
  return groups;
}
export function pdfVendorComponents() {
  return [...pdfVendorSources()].map(([name, sources]) => ({
    type: 'library',
    'bom-ref': `asset:pdfmake-bundle/${name}`,
    name: `pdfmake-bundle/${name}`,
    description:
      'Embedded browser-bundle sources; individual upstream version not recorded by publisher. Identified by source-content SHA-256, not the separately installed npm package.',
    hashes: [
      {
        alg: 'SHA-256',
        content: createHash('sha256').update(JSON.stringify(sources)).digest('hex'),
      },
    ],
    licenses: [{ license: { id: licenses[name] } }],
    properties: [{ name: 'fediwings:bundled-in', value: 'pdfmake/build/pdfmake.js' }],
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync('public/licenses', { recursive: true });
  mkdirSync('/tmp/opencode', { recursive: true });
  const temporary = mkdtempSync('/tmp/opencode/pdf-notices-');
  try {
    const sections = [
      `FediWings PDF browser engine — third-party notices

pdfmake 0.3.14 and its embedded browser dependencies.
Source hashes and individual license identifiers: compliance/sbom.cdx.json.
Embedded upstream versions are not inferred from the project lockfile.
License texts below retain original upstream copyright notices.
For build-only embedded modules absent locally, notice sources are explicitly
listed; their versions identify the notice source, not an inferred bundle version.

PDFMAKE
${readFileSync('node_modules/pdfmake/LICENSE', 'utf8')}`,
    ];
    for (const [name, sources] of pdfVendorSources()) {
      let texts = [];
      const local = `node_modules/${name}`;
      if (existsSync(local)) {
        for (const file of readdirSync(local).filter((file) =>
          /^(licen[sc]e|copying)([.-]|$)/i.test(file),
        )) {
          texts.push(readFileSync(`${local}/${file}`, 'utf8'));
        }
      }
      if (name === 'svg-to-pdfkit')
        texts.push(
          readFileSync('node_modules/pdfmake/src/3rd-party/svg-to-pdfkit/LICENSE', 'utf8'),
        );
      if (!texts.length && existsSync(`${local}/package.json`)) {
        const metadata = JSON.parse(readFileSync(`${local}/package.json`, 'utf8'));
        if (metadata.license === 'MIT') {
          const template = readFileSync('node_modules/png-js/LICENSE', 'utf8').replace(
            /^Copyright.*\n/m,
            '',
          );
          texts.push(
            `Upstream supplies MIT metadata but no separate license file.\nAuthor metadata (no copyright year invented): ${JSON.stringify(metadata.author)}\n\n${template}`,
          );
        }
      }
      if (!texts.length && noticeSources[name]) {
        const [file] = JSON.parse(
          execFileSync(
            'npm',
            ['pack', `${name}@${noticeSources[name]}`, '--pack-destination', temporary, '--json'],
            { encoding: 'utf8' },
          ),
        );
        const archive = `${temporary}/${file.filename}`;
        const list = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n');
        for (const path of list.filter((path) =>
          /^package\/(licen[sc]e|copying)([.-]|$)/i.test(path),
        )) {
          texts.push(
            `Notice source: ${name}@${noticeSources[name]}\n${execFileSync('tar', ['-xOzf', archive, path], { encoding: 'utf8' })}`,
          );
        }
      }
      // Retain legal comments from the actual distributed source map as well.
      const comments = sources.flatMap(({ source }) =>
        (source.match(/\/\*[\s\S]*?\*\//g) ?? []).filter((comment) =>
          /copyright|permission is hereby|licensed under|@license/i.test(comment),
        ),
      );
      texts.push(...new Set(comments));
      if (!texts.length) throw new Error(`Missing vendor notices: ${name}`);
      sections.push(`${name} — ${licenses[name]}\n${texts.join('\n\n')}`);
    }
    writeFileSync(
      'public/licenses/pdfmake-vendors.txt',
      sections.join('\n\n----------------------------------------\n\n') + '\n',
    );
    console.log('Wrote PDF engine vendor notices.');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
