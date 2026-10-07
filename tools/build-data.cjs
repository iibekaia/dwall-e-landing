/**
 * Builds data/topics.json from the dwall-e sources: every topic of the catalog with its category,
 * its "important" flag and its title and summary in Georgian and English.
 *
 *   npm run data            (DWALLE = path of the dwall-e project, default ../dwall-e)
 *
 * Run it again when topics are added to the app; the page itself never reads the app sources.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(path.resolve(ROOT, process.env.DWALLE ?? path.join('..', 'dwall-e')), 'src', 'app');
const catalog = fs.readFileSync(path.join(APP, 'simulations', 'simulation-catalog.ts'), 'utf8');
const categories = fs.readFileSync(path.join(APP, 'models', 'category.ts'), 'utf8');
const core = {
  en: JSON.parse(fs.readFileSync(path.join(APP, 'core', 'i18n', 'translations', 'en.json'), 'utf8')),
  ka: JSON.parse(fs.readFileSync(path.join(APP, 'core', 'i18n', 'translations', 'ka.json'), 'utf8')),
};

// Catalog entries: "{ id: 'x', category: 'y', ... }" in teaching order.
const entries = [...catalog.matchAll(/\{\s*id:\s*'([^']+)',\s*category:\s*'([^']+)'([^}]*?)(?=\n\s*\},|\},)/gs)].map((m) => ({
  id: m[1],
  category: m[2],
  ready: /load:/.test(m[3]),
  important: /important:\s*true/.test(m[3]),
}));
const order = [...categories.matchAll(/category\('([a-z]+)'\)/g)].map((m) => m[1]);

const topics = entries.map((e) => ({
  ...e,
  title: { ka: core.ka.catalog[e.id]?.title ?? e.id, en: core.en.catalog[e.id]?.title ?? e.id },
  summary: { ka: core.ka.catalog[e.id]?.summary ?? '', en: core.en.catalog[e.id]?.summary ?? '' },
}));
const data = {
  generated: new Date().toISOString().slice(0, 10),
  count: topics.length,
  ready: topics.filter((t) => t.ready).length,
  categories: order.map((id) => ({
    id,
    name: { ka: core.ka.category[id].name, en: core.en.category[id].name },
    topics: topics.filter((t) => t.category === id).map(({ category, ...t }) => t),
  })),
};

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'topics.json'), JSON.stringify(data, null, 1) + '\n');
// The same data as a script, so the page also works when opened straight from the disk (file://).
fs.writeFileSync(path.join(ROOT, 'data', 'topics.js'), `window.TOPICS = ${JSON.stringify(data)};\n`);
console.log(`data/topics: ${data.ready}/${data.count} topics in ${data.categories.length} categories`);
