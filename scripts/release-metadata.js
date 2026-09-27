export function releaseSection(changelog, version) {
  const section = changelog.split(/^## /m)[1];
  const heading = section?.split('\n')[0].trim();
  const match = heading?.match(/^(\d+\.\d+\.\d+) — (Unreleased|\d{4}-\d{2}-\d{2})$/);
  if (!match || match[1] !== version) throw new Error('Newest changelog heading must be VERSION — Unreleased or VERSION — YYYY-MM-DD and match manifest.json.');
  const marker = match[2];
  if (marker !== 'Unreleased' && (Number.isNaN(Date.parse(marker)) || new Date(marker).toISOString().slice(0, 10) !== marker)) throw new Error('Invalid changelog release date.');
  const notes = section.slice(section.indexOf('\n')).trim();
  if (!notes) throw new Error('Release notes are empty.');
  return { heading: `## ${heading}`, marker, notes };
}

export function dateRelease(changelog, version, date) {
  const section = releaseSection(changelog, version);
  if (section.marker !== 'Unreleased') return changelog;
  const dated = changelog.replace(/^## [^\n]+/m, `## ${version} — ${date}`);
  releaseSection(dated, version);
  return dated;
}
