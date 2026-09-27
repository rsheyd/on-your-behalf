import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json')));
if (manifest.manifest_version !== 3 || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Expected MV3 and a three-part manifest version.');
if (!manifest.icons?.['128'] || !manifest.description || manifest.description.length > 132) throw new Error('Missing store icon or invalid description.');
const files = ['manifest.json'];
function collect(path) {
  const stat = lstatSync(join(root, path));
  if (stat.isSymbolicLink()) throw new Error(`Symlink prohibited: ${path}`);
  if (stat.isDirectory()) for (const name of readdirSync(join(root, path)).sort()) collect(`${path}/${name}`);
  else if (path.startsWith('src/') && /\.(js|mjs|html|css)$/.test(path) || path === 'src/vendor/pdfjs/LICENSE' || /^icons\/icon-(16|32|48|128)\.png$/.test(path)) files.push(path);
  else throw new Error(`Unexpected runtime file: ${path}`);
}
collect('src');
for (const size of [16, 32, 48, 128]) collect(`icons/icon-${size}.png`);
const output = join(root, 'dist', `on-your-behalf-${manifest.version}.zip`);
mkdirSync(dirname(output), { recursive: true });
rmSync(output, { force: true });
execFileSync('zip', ['-q', '-X', output, ...files], { cwd: root });
execFileSync('unzip', ['-tq', output]);
const entries = execFileSync('unzip', ['-Z1', output], { encoding: 'utf8' }).trim().split('\n');
if (JSON.stringify(entries.slice().sort()) !== JSON.stringify(files.slice().sort())) throw new Error('Archive allowlist mismatch.');
for (const path of files) {
  const archived = execFileSync('unzip', ['-p', output, path], { maxBuffer: 20 * 1024 * 1024 });
  if (!archived.equals(readFileSync(join(root, path)))) throw new Error(`Archive content mismatch: ${path}`);
}
const hash = createHash('sha256').update(readFileSync(output)).digest('hex');
writeFileSync(`${output}.sha256`, `${hash}  on-your-behalf-${manifest.version}.zip\n`);
console.log(`Verified ${files.length} runtime files: ${output}\nSHA256: ${hash}`);
