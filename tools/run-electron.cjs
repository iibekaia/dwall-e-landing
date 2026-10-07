/**
 * Runs a script with the Electron that the dwall-e project already has installed, so this project needs no
 * dependencies of its own.   node tools/run-electron.cjs tools/record.cjs
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DWALLE = path.resolve(ROOT, process.env.DWALLE ?? path.join('..', 'dwall-e'));
let electron;
try {
  electron = require(require.resolve('electron', { paths: [DWALLE] }));
} catch {
  console.error(`Electron not found. Run "npm install" in ${DWALLE} (or set DWALLE to the dwall-e folder).`);
  process.exit(1);
}
const result = spawnSync(electron, [path.resolve(process.argv[2])], { stdio: 'inherit', env: { ...process.env, DWALLE } });
process.exit(result.status ?? 0);
