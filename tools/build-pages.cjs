/**
 * Fills the page with real text for search engines and writes one page per language:
 *
 *   index.html     Georgian (also the template: edit this file, then run the script again)
 *   en/index.html  English (generated, do not edit)
 *   sitemap.xml
 *
 *   npm run pages
 *
 * Every [data-i18n] element, caption, count, screenshot and the topic map get their text from i18n.js and
 * data/topics.js, and the <!-- seo --> block in <head> gets the title, description, canonical and hreflang links,
 * Open Graph tags and JSON-LD. main.js still switches the language in place; it only needs the text to be
 * there before it runs so crawlers and link previews see it. Running the script twice gives the same result.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://dwall-e.ge/';
const RELEASES = 'https://github.com/iibekaia/dwall-e-releases/releases/latest/download/';
const PAGES = { ka: { dir: '', locale: 'ka_GE' }, en: { dir: 'en/', locale: 'en_US' } };

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'topics.js'), 'utf8'), sandbox);
const TEXT = sandbox.window.I18N;
const DATA = sandbox.window.TOPICS;
const topicById = new Map(DATA.categories.flatMap((c) => c.topics.map((t) => [t.id, t])));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Width and height of a baseline or progressive JPEG. */
function jpegSize(file) {
  const b = fs.readFileSync(file);
  for (let i = 2; i < b.length; ) {
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function seoBlock(lang) {
  const t = TEXT[lang];
  const url = SITE + PAGES[lang].dir;
  const description = t['meta.description'].replace('{count}', DATA.ready);
  const image = `media/${lang}/solar-system.jpg`;
  const [width, height] = jpegSize(path.join(ROOT, image));
  const other = Object.keys(PAGES).filter((l) => l !== lang);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': SITE + '#website',
        url: SITE,
        name: 'dwall-e',
        inLanguage: Object.keys(PAGES),
        publisher: { '@id': SITE + '#organization' },
      },
      {
        '@type': 'Organization',
        '@id': SITE + '#organization',
        name: 'dwall-e',
        url: SITE,
        logo: SITE + 'assets/icon-512.png',
        email: 'info@dwall-e.ge',
        sameAs: ['https://github.com/iibekaia/dwall-e-releases'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': SITE + '#app',
        name: 'dwall-e',
        alternateName: t.docTitle.split(' — ')[1],
        description,
        url,
        image: SITE + image,
        screenshot: ['simulation', 'laboratory', 'formulas'].map((s) => SITE + `media/${lang}/screen-${s}.jpg`),
        applicationCategory: 'EducationalApplication',
        applicationSubCategory: 'Physics simulation',
        operatingSystem: 'Windows, macOS, Linux',
        downloadUrl: RELEASES + 'dwall-e-Setup.exe',
        inLanguage: Object.keys(PAGES),
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'GEL' },
        audience: { '@type': 'EducationalAudience', educationalRole: ['student', 'teacher'] },
        typicalAgeRange: '10-18',
        about: { '@type': 'Thing', name: lang === 'ka' ? 'ფიზიკა' : 'Physics' },
        teaches: DATA.categories.map((c) => c.name[lang]),
        featureList: DATA.categories.flatMap((c) => c.topics.filter((x) => x.ready).map((x) => x.title[lang])),
        publisher: { '@id': SITE + '#organization' },
      },
    ],
  };
  return [
    `<title>${esc(t.docTitle)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...Object.keys(PAGES).map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE + PAGES[l].dir}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="dwall-e" />`,
    `<meta property="og:locale" content="${PAGES[lang].locale}" />`,
    ...other.map((l) => `<meta property="og:locale:alternate" content="${PAGES[l].locale}" />`),
    `<meta property="og:title" content="${esc(t.docTitle)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE + image}" />`,
    `<meta property="og:image:width" content="${width}" />`,
    `<meta property="og:image:height" content="${height}" />`,
    `<meta property="og:image:alt" content="${esc(topicById.get('solar-system').title[lang])}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
    .map((line) => '    ' + line)
    .join('\n');
}

function topicMap(lang) {
  return DATA.categories
    .map((c) => {
      const items = c.topics.map((t) => {
        const important = t.important ? ` class="important" aria-label="${esc(`${t.title[lang]} (${TEXT[lang]['topics.important']})`)}"` : '';
        return `<li title="${esc(t.summary[lang])}"${important}>${esc(t.title[lang])}</li>`;
      });
      return `<article class="area"><h3>${esc(c.name[lang])}<small>${c.topics.length}</small></h3><ul>${items.join('')}</ul></article>`;
    })
    .join('');
}

function render(template, lang) {
  const t = TEXT[lang];
  const media = (name) => `media/${lang}/${name}`;
  let html = template
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/(<!-- seo[^>]*-->\n)[\s\S]*?(\s*<!-- \/seo -->)/, (_, open, close) => `${open}${seoBlock(lang)}${close}`)
    .replace(/(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)[^<]*(<\/\2>)/g, (m, open, _tag, key, close) => (key in t ? open + esc(t[key]) + close : m))
    .replace(/<[^>]*\bdata-i18n-title="([^"]+)"[^>]*>/g, (tag, key) => tag.replace(/ title="[^"]*"/, ` title="${esc(t[key])}"`))
    .replace(/(<figcaption data-topic="([^"]+)">)[^<]*(<\/figcaption>)/g, (_, open, id, close) => open + esc(topicById.get(id)?.title[lang] ?? '') + close)
    .replace(/(<(\w+) data-count="ready">)[^<]*(<\/\2>)/g, (_, open, _tag, close) => open + DATA.ready + close)
    .replace(/<img data-shot="([^"]+)"[^>]*>/g, (tag, shot) => {
      const id = template.slice(0, template.indexOf(tag)).match(/<section [^>]*id="([^"]+)"/g).pop().match(/id="([^"]+)"/)[1];
      return `<img data-shot="${shot}" src="${media(`screen-${shot}.jpg`)}" alt="${esc(t[`${id}.title`] ?? t[`slide.${id}`] ?? '')}" loading="lazy" />`;
    })
    .replace(/<img data-still="([^"]+)"[^>]*>/g, (_, id) => `<img data-still="${id}" src="${media(`${id}.jpg`)}" alt="${esc(topicById.get(id)?.title[lang] ?? '')}" loading="lazy" />`)
    .replace(/<video ([^>]*)data-clip="([^"]+)"([^>]*)>/g, (_, before, clip, after) =>
      `<video ${before}data-clip="${clip}"${after.replace(/ poster="[^"]*"/, '')} poster="${media(clip + '.jpg')}">`)
    .replace(/(<button type="button" data-lang="(\w+)" aria-pressed=")[^"]*"/g, (_, open, l) => `${open}${l === lang}"`)
    .replace(/(<div class="topic-map" id="topic-map">)[\s\S]*?(<\/div>)/, (_, open, close) => open + topicMap(lang) + close);
  if (PAGES[lang].dir) {
    // Pages in a subfolder reach the shared files one level up.
    html = html
      .replace(/<html lang="en">/, '<!-- Generated by tools/build-pages.cjs from index.html. Do not edit. -->\n<html lang="en">')
      .replace(/\b(src|href|poster)="(?!https?:|mailto:|#|\.\/|\/)([^"]+)"/g, '$1="../$2"');
  }
  return html;
}

const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const lang of Object.keys(PAGES)) {
  const file = path.join(ROOT, PAGES[lang].dir, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, render(template, lang));
}

const today = new Date().toISOString().slice(0, 10);
const alternates = Object.keys(PAGES)
  .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + PAGES[l].dir}" />`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}" />`)
  .join('\n');
fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${Object.keys(PAGES)
  .map((l) => `  <url>\n    <loc>${SITE + PAGES[l].dir}</loc>\n    <lastmod>${today}</lastmod>\n${alternates}\n  </url>`)
  .join('\n')}
</urlset>
`,
);
console.log(`Pages written: ${Object.keys(PAGES).map((l) => PAGES[l].dir + 'index.html').join(', ')}, sitemap.xml (${DATA.ready} topics)`);
