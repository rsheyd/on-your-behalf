import { readFileSync } from 'node:fs';
const section = readFileSync('CHANGELOG.md', 'utf8').split(/^## /m)[1];
if (!section) throw new Error('Missing release section.');
console.log(section.slice(section.indexOf('\n')).trim());
