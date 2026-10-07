/**
 * Records the landing page media from the dwall-e app's production build.
 *
 *   npm run record          (see package.json; needs the dwall-e project next to this one, built with "npm run build")
 *
 * For every clip in clips.json and every language it opens the simulation in a hidden, off-screen Electron
 * window (full-screen view, dark theme), films the scene with the browser's own MediaRecorder and writes
 *   media/<lang>/<id>.mp4 and <id>.jpg (poster).
 * It also takes screenshots of the app: media/<lang>/screen-*.jpg. Nothing is downloaded: Electron already
 * contains the video encoders.
 *
 * Environment (optional): DWALLE = path of the dwall-e project (default ../dwall-e),
 * ONLY = comma-separated clip ids, LANGS = ka,en, SCREENS = 0 to skip the screenshots.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..');
const DWALLE = path.resolve(ROOT, process.env.DWALLE ?? path.join('..', 'dwall-e'));
const DIST = path.join(DWALLE, 'dist', 'dwall-e', 'browser');
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'clips.json'), 'utf8'));
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const LANGS = (process.env.LANGS ?? 'ka,en').split(',');
const SCREENS = process.env.SCREENS !== '0';
const LOG = path.join(HERE, 'record.log');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const TEXT = {
  ka: { fullscreen: 'სრულ ეკრანზე', start: 'დაწყება' },
  en: { fullscreen: 'Full screen', start: 'Play' },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n');

// A tiny static server for the app build (single-page app: unknown paths serve index.html).
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(DIST, url);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/** Page-side helpers. __find prefers a button whose text is exactly the given text. */
const HELPERS = `
  window.__find = (text) => {
    const all = [...document.querySelectorAll('button, [role=button], label')];
    const names = (b) => [(b.textContent || '').trim(), b.getAttribute('title') || '', b.getAttribute('aria-label') || ''];
    return all.find((b) => names(b).some((x) => x === text)) ?? all.find((b) => names(b).some((x) => x.includes(text)));
  };
  window.__select = (value) => {
    const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === value));
    if (!s) return false;
    s.value = value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  window.__scene = () => {
    const c = [...document.querySelectorAll('canvas')].map((x) => x.parentElement.getBoundingClientRect()).filter((r) => r.width > 100).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return c ? { x: Math.round(c.x) + 3, y: Math.round(c.y) + 3, width: Math.round(c.width) - 6, height: Math.round(c.height) - 6 } : null;
  };
  true;
`;

async function openApp(win, base, lang, route) {
  await win.loadURL(base + '/');
  await win.webContents.executeJavaScript(
    `localStorage.setItem('dwall-e:settings', JSON.stringify({ version: 1, theme: '${CONFIG.theme}', language: '${lang}', level: '${CONFIG.level}', levelChosen: true, fontScale: 1, reducedMotion: false, volume: 0 })); true`,
  );
  await win.loadURL(base + route);
  await wait(2500);
  await win.webContents.executeJavaScript(HELPERS);
}

async function recordClip(win, recorder, base, lang, clip, outDir) {
  const t = TEXT[lang];
  await openApp(win, base, lang, '/sim/' + clip.id);
  for (const action of clip.actions ?? []) {
    if (action.select) await win.webContents.executeJavaScript(`window.__select(${JSON.stringify(action.select)})`);
    if (action.clickText) await win.webContents.executeJavaScript(`(window.__find(${JSON.stringify(action.clickText)}) || {}).click?.(); true`);
    await wait(600);
  }
  // Toasts (e.g. a challenge completed by an action) and the full-screen button are hidden from the film.
  await win.webContents.insertCSS('.animate-toast-in { display: none !important; }');
  await win.webContents.executeJavaScript(
    `(() => { const b = window.__find(${JSON.stringify(t.fullscreen)}); if (b) { b.click(); setTimeout(() => (b.style.visibility = 'hidden'), 50); } return true; })()`,
  );
  await wait(1200);
  if ((clip.actions ?? []).some((a) => a.start)) {
    await win.webContents.executeJavaScript(`(window.__find(${JSON.stringify(t.start)}) || {}).click?.(); true`);
  }
  await wait(400);
  const rect = await win.webContents.executeJavaScript('window.__scene()');
  if (!rect) throw new Error('no scene canvas for ' + clip.id);

  const scale = Math.min(1, CONFIG.width / rect.width);
  const width = Math.round((rect.width * scale) / 2) * 2;
  const height = Math.round((rect.height * scale) / 2) * 2;
  let recording = false;
  let poster = null;
  let frames = 0;
  const onPaint = (_e, _dirty, image) => {
    if (!recording) return;
    const crop = image.crop(rect);
    frames++;
    if (frames === Math.round(CONFIG.fps * 1.5) || !poster) poster = crop.resize({ width, height, quality: 'best' }).toJPEG(85);
    recorder.webContents.send('frame', crop.toJPEG(92));
  };
  win.webContents.on('paint', onPaint);
  const done = new Promise((resolve) => ipcMain.once('recorded', (_e, data) => resolve(data)));
  recorder.webContents.send('start', { width, height, fps: CONFIG.fps, bitrate: CONFIG.bitrate });
  await wait(300);
  recording = true;
  win.webContents.invalidate();
  await wait(clip.seconds * 1000);
  recording = false;
  recorder.webContents.send('stop');
  const data = await done;
  win.webContents.off('paint', onPaint);
  fs.writeFileSync(path.join(outDir, clip.id + '.mp4'), Buffer.from(data.mp4));
  if (poster) fs.writeFileSync(path.join(outDir, clip.id + '.jpg'), poster);
  log(lang, clip.id, `${width}x${height}`, 'frames', frames, frames < clip.seconds * 5 ? 'WARNING: almost no motion' : 'ok', 'mp4', data.mp4.byteLength);
}

async function screenshots(base, lang, outDir) {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false } });
  for (const [name, route] of [['home', '/'], ['simulation', '/sim/prism'], ['formulas', '/formulas'], ['category', '/topics/mechanics']]) {
    await openApp(win, base, lang, route);
    await wait(1500);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `screen-${name}.jpg`), image.resize({ width: 1440, quality: 'best' }).toJPEG(84));
    log(lang, 'screen', name);
  }
  win.destroy();
}

app.whenReady().then(async () => {
  fs.writeFileSync(LOG, '');
  try {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`dwall-e build not found at ${DIST}: run "npm run build" in ${DWALLE}`);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const recorder = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, backgroundThrottling: false },
    });
    await recorder.loadFile(path.join(HERE, 'recorder.html'));
    for (const lang of LANGS) {
      const outDir = path.join(ROOT, 'media', lang);
      fs.mkdirSync(outDir, { recursive: true });
      const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false } });
      win.webContents.setFrameRate(CONFIG.fps);
      for (const clip of CONFIG.clips.filter((c) => !ONLY || ONLY.includes(c.id))) {
        try {
          await recordClip(win, recorder, base, lang, clip, outDir);
        } catch (e) {
          log('FAILED', lang, clip.id, e.stack);
        }
      }
      win.destroy();
      if (SCREENS && !ONLY) await screenshots(base, lang, outDir);
    }
    log('DONE');
  } catch (e) {
    log('ERROR', e.stack);
  }
  server.close();
  app.exit(0);
});
