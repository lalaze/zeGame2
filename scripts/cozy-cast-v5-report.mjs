import fs from 'node:fs';
import crypto from 'node:crypto';

const directory = 'artifacts/art-grid/round-4';
const results = JSON.parse(fs.readFileSync(directory + '/vitest-results.json'));
const baseline = new Set(fs.readFileSync('artifacts/art-grid/foundation-test-failures.txt', 'utf8').trim().split('\n'));
const failures = [], suites = [];
for (const suite of results.testResults) {
  const filename = suite.name.slice(process.cwd().length + 1);
  if (suite.status === 'failed' && !suite.assertionResults?.length) suites.push('[suite] ' + filename);
  for (const assertion of suite.assertionResults ?? []) if (assertion.status === 'failed') failures.push(filename + ' :: ' + assertion.fullName);
}
const newFailures = [...suites, ...failures].filter(name => !baseline.has(name));
const metrics = JSON.parse(fs.readFileSync(directory + '/offline-metrics.json'));
const guests = metrics.rows.filter(row => row.role === 'customer');
const range = values => [Math.min(...values), Math.max(...values)];
const pixelLog = fs.readFileSync(directory + '/pixel-check.log', 'utf8');
const buildLog = fs.readFileSync(directory + '/build.log', 'utf8');
const report = {
  date: '2026-10-16', timezone: 'America/New_York', pack: 'cozy-cast-v5',
  scope: { characters: 30, bodyFamilies: 12, bodyPoses: 144, headPoses: 24, savedIdsAndLooksChanged: false, roomsChanged: false, staffChanged: false, historicalPacksDeleted: false, committed: false, stashed: false },
  production: { generator: 'built-in image_gen', sourceFolder: 'assets/generated/cozy-cast-v5/sources', prompts: 'assets/generated/cozy-cast-v5/prompts.md', hashes: 'assets/generated/cozy-cast-v5/hashes.json', density: 2, bodyFrameArtSize: [64, 88], headComponentArtSize: [48, 48], postprocess: 'connected-component extraction; authored neck/body/eye contacts; explicit canonical material ramps; pixel-conform conform at final dimensions', guest1: 'same identity slot and Look, now resolved through v5 rather than historical sample override', glasses: 'one-art-pixel warm hollow frames around visible highlighted eyes', furniture: 'existing chair painted separately; no legacy furniture pixels in guest textures' },
  verification: {
    typescript: { command: 'npx tsc --noEmit', passed: !/error TS\d/.test(fs.readFileSync(directory + '/tsc.log', 'utf8')), log: directory + '/tsc.log' },
    build: { command: 'npm run build', passed: /built in/.test(buildLog) && !/error TS\d/.test(buildLog), log: directory + '/build.log' },
    tests: { command: 'npx vitest run', passed: results.numPassedTests, failed: results.numFailedTests, baselineFailedTests: 103, baselineSuiteLoadFailures: suites, newFailures, unchangedBaselineFailures: failures.filter(name => baseline.has(name)).length, log: directory + '/vitest.log', results: directory + '/vitest-results.json' },
    palette: { command: 'node scripts/pixel-conform.mjs check public/art/generated/cozy-cast-v5/*.png', pngs: (pixelLog.match(/^PASS /gm) ?? []).length, passed: !/^FAIL /m.test(pixelLog) && (pixelLog.match(/^PASS /gm) ?? []).length === 13, log: directory + '/pixel-check.log' },
    nativeFramesChecked: metrics.nativeFrames, offPaletteGuestPixels: metrics.offPalettePixels,
    guestStandingHeight: range(guests.map(row => row.standingHeight)), staffStandingHeight: range(metrics.rows.filter(row => row.role !== 'customer').map(row => row.standingHeight)),
    guestHeadHeight: range(guests.map(row => row.headHeight)),
    intentionalTestContractChange: 'cozy-team-art.test.ts now asserts that both whole-figure families bypass the retired 1.6x customer leg transform and sample override, instead of requiring that obsolete transform to remain',
  },
  visualReview: {
    before: directory + '/cast-before.png', after: directory + '/cast-after-offline.png', seatingProof: directory + '/seating-after-offline.png', metrics: directory + '/offline-metrics.json',
    renderer: 'actual TypeScript preload/resolver/worldSpriteArt, run through a deterministic offline software canvas; not a browser or Phaser capture',
    scale: 'standing and seated are both four display pixels per room pixel, with no seated-miniature scaling',
    inspectedAgainst: ['cast-before.png', 'cozy-team-v7/hair-0-short-v1.png', 'cafe-style-sample-v1/sample.png'],
    fixesAfterInspection: ['removed generator-grid crop assumptions and isolated overlapping hair islands', 'kept high-resolution keyed input separate from native compiled heads', 'detected real pupil positions before cleaning face pixels', 'anchored bows/headbands inside the hair silhouette', 'kept cream fabric out of skin recolour', 'separated existing chairs from palette-clean native guests', 'shortened seated legs and matched hip contact to the staff/cushion band at y32, without changing seat or floor coordinates', 'checked both seated directions against the real table/foreground pass'],
  },
  remainingGaps: ['Browser/Phaser captures, live seating transitions, pet-contact animation playback and tap/cup interaction checks remain for the requested outside-sandbox browser pass. No browser or server was started here.'],
};
fs.writeFileSync(directory + '/report.json', JSON.stringify(report, null, 2) + '\n');
const root = 'assets/generated/cozy-cast-v5';
const files = [...fs.readdirSync(root + '/sources').map(name => root + '/sources/' + name), ...fs.readdirSync('public/art/generated/cozy-cast-v5').map(name => 'public/art/generated/cozy-cast-v5/' + name), root + '/README.md', root + '/prompts.md', root + '/generation.json', 'scripts/build-cozy-cast-v5.py', 'docs/art-grid/palette.json', 'public/art/generated/cozy-team-v7/hair-0-short-v1.png', 'public/art/generated/cafe-style-sample-v1/sample.png'];
fs.writeFileSync(root + '/hashes.json', JSON.stringify(Object.fromEntries(files.sort().map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), null, 2) + '\n');
if (newFailures.length || metrics.offPalettePixels || !report.verification.palette.passed || !report.verification.typescript.passed || !report.verification.build.passed) throw Error('Cast verification failed; see report.json');
console.log(JSON.stringify({ passed: results.numPassedTests, baselineFailures: results.numFailedTests, newFailures, nativeFrames: metrics.nativeFrames, runtimePngs: report.verification.palette.pngs }));
