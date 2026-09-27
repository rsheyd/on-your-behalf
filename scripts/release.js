import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseSection } from './release-metadata.js';

process.chdir(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run') || args.length > 1) throw new Error('Usage: npm run release -- [--dry-run]');
const { version } = JSON.parse(readFileSync('manifest.json'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid manifest version.');
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const { notes, marker } = releaseSection(changelog, version);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (!['https://github.com/rsheyd/on-your-behalf.git', 'https://github.com/rsheyd/on-your-behalf', 'git@github.com:rsheyd/on-your-behalf.git'].includes(git('remote', 'get-url', 'origin'))) throw new Error('Unexpected origin.');
if (git('branch', '--show-current') !== 'main') throw new Error('Release from main.');
if (args.includes('--dry-run')) {
  console.log(`Offline release plan: v${version}\nTests and syntax checks → verified ZIP and checksum → date changelog → commit/tag/push → GitHub release with assets.\nWeb Store upload is manual.\nChangelog date: ${marker === 'Unreleased' ? 'would record today (UTC)' : marker}.\n${git('status', '--porcelain') ? 'Commit working-tree changes before publishing.\n' : ''}\n${notes}`);
} else {
  if (git('status', '--porcelain')) throw new Error('Commit working-tree changes before publishing.');
  const existingTags = git('tag', '--list', `v${version}`);
  if (existingTags) throw new Error(`v${version} already exists. See DEVELOPMENT.md for interrupted-release recovery.`);
  process.env.GITHUB_TOKEN ||= execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
  const { default: release } = await import('release-it');
  await release({ increment: version, ci: true });
}
