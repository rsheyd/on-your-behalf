import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateRelease } from './release-metadata.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json')));
const path = join(root, 'CHANGELOG.md');
const before = readFileSync(path, 'utf8');
const after = dateRelease(before, version, new Date().toISOString().slice(0, 10));
if (after !== before) writeFileSync(path, after);
console.log(`Prepared release metadata for ${version}.`);
