# dwall-e landing

dwall-e-ს სარეკლამო/საპრეზენტაციო გვერდი: სტატიკური საიტი სიმულაციების ნამდვილი ვიდეოჩანაწერებით,
ქართულად და ინგლისურად. ცალკე პროექტია და აპზე არ არის დამოკიდებული — მხოლოდ მედიის ხელახლა ჩასაწერად სჭირდება
გვერდით მდებარე `dwall-e` პროექტი.

A static, bilingual (Georgian / English) presentation page for the dwall-e physics lab, with real recordings of
the simulations. No build step and no runtime dependencies.

## Structure

| Path | What |
|---|---|
| `index.html`, `styles.css`, `main.js` | The page: full-screen slides, language switch, videos, topic map |
| `i18n.js` | All page texts in Georgian and English |
| `data/topics.json`, `data/topics.js` | The 65 topics (titles, summaries, categories) — generated |
| `media/ka`, `media/en` | Videos (`.mp4`, H.264), posters (`.jpg`) and app screenshots, per language — generated |
| `assets/` | Logo, favicon and the Noto Sans Georgian font (SIL OFL, see `assets/fonts/OFL.txt`) |
| `tools/` | Scripts that regenerate the data and the media from the dwall-e project |

## Presenting

Open the page and press **F** (or the frame button) for full screen. **→ / ↓ / Space / PageDown** go to the next
slide, **← / ↑ / PageUp** back, **Home / End** to the first / last. Click a video to watch it large. The language
switch is in the top bar; `?lang=en` opens the English version directly.

## Local preview

```bash
npm run serve
```

Then open http://localhost:5173. Opening `index.html` straight from the disk also works.

## Regenerating data and media

Both need the dwall-e project next to this folder (`../dwall-e`, or set `DWALLE=path`).

```bash
npm run data      # data/topics.json and topics.js from the dwall-e catalog and translations
npm run record    # all videos, posters and screenshots (needs "npm run build" in dwall-e first; ~10 min)
```

`npm run record` uses the Electron that dwall-e already has installed and the browser's own MediaRecorder, so
nothing extra is downloaded. Which simulations are filmed, for how long and with which actions is set in
`tools/clips.json`; `ONLY=prism,induction npm run record` re-records just those clips, `LANGS=ka` only one language.
Each run writes `tools/record.log`; a clip marked "almost no motion" usually needs a `start` action.

## Publishing

The site is plain static files, so any static host works:

- **GitHub Pages:** push this folder to its own repository → Settings → Pages → "Deploy from a branch" → `main` / root.
- **Netlify / Cloudflare Pages:** drag the folder into the dashboard, or connect the repository with no build command and `/` as the output folder.

The download buttons point to `https://github.com/iibekaia/dwall-e/releases/latest/download/…`, so they always
serve the newest release.
