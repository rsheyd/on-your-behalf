import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseSection } from './release-metadata.js';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json')));
console.log(releaseSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version).notes);
