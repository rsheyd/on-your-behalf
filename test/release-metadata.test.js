import test from 'node:test';
import assert from 'node:assert/strict';
import { dateRelease, releaseSection } from '../scripts/release-metadata.js';
const source = '# Changelog\n\n## 0.6.0 — Unreleased\n\n- One change.\n\n## 0.5.0\n\n- Historical change.\n';
test('release notes exclude older versions', () => {
  assert.equal(releaseSection(source, '0.6.0').notes, '- One change.');
});
test('dating changes only the newest release heading and is idempotent', () => {
  const dated = dateRelease(source, '0.6.0', '2026-09-27');
  assert.equal(dated, source.replace('0.6.0 — Unreleased', '0.6.0 — 2026-09-27'));
  assert.equal(dateRelease(dated, '0.6.0', '2026-09-28'), dated);
});
test('reject mismatched versions, empty notes, generic headings, and invalid dates', () => {
  assert.throws(() => dateRelease(source, '0.6.1', '2026-09-27'));
  assert.throws(() => releaseSection(source.replace('- One change.', ''), '0.6.0'));
  assert.throws(() => releaseSection(source.replace('0.6.0 — Unreleased', 'Unreleased'), '0.6.0'));
  assert.throws(() => dateRelease(source, '0.6.0', '2026-02-30'));
});

test('preparation CLI dates an isolated checkout and safely accepts a retry', async () => {
  const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'oyb-release-metadata-'));
  try {
    mkdirSync(join(root, 'scripts'));
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, 'manifest.json'), '{"version":"0.6.0"}');
    writeFileSync(join(root, 'CHANGELOG.md'), source);
    for (const file of ['prepare-release.js', 'release-metadata.js']) copyFileSync(new URL(`../scripts/${file}`, import.meta.url), join(root, 'scripts', file));
    execFileSync(process.execPath, [join(root, 'scripts/prepare-release.js')]);
    const dated = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.match(dated, /## 0\.6\.0 — \d{4}-\d{2}-\d{2}/);
    execFileSync(process.execPath, [join(root, 'scripts/prepare-release.js')]);
    assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), dated);
    writeFileSync(join(root, 'manifest.json'), '{"version":"0.6.1"}');
    assert.throws(() => execFileSync(process.execPath, [join(root, 'scripts/prepare-release.js')], { stdio: 'pipe' }));
    assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), dated);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
