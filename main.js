// dwall-e landing: language switch, videos, topic map and presentation controls. No dependencies.
(() => {
  const TEXT = window.I18N;
  const DATA = window.TOPICS;
  const LANGS = ['ka', 'en'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slides = [...document.querySelectorAll('.slide')];
  const topicById = new Map(DATA.categories.flatMap((c) => c.topics.map((t) => [t.id, t])));

  const stored = (() => {
    try {
      return localStorage.getItem('dwall-e-landing-lang');
    } catch {
      return null;
    }
  })();
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let lang = LANGS.includes(fromUrl) ? fromUrl : LANGS.includes(stored) ? stored : 'ka';

  /* ---------- Videos ---------- */
  const media = (name) => `media/${lang}/${name}`;
  function setVideo(video, clip) {
    video.poster = media(clip + '.jpg');
    video.replaceChildren(Object.assign(document.createElement('source'), { src: media(clip + '.mp4'), type: 'video/mp4' }));
    video.load();
  }
  const visible = new Set();
  const videoObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
        if (reducedMotion) continue;
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }
    },
    { threshold: 0.35 },
  );
  const videos = [...document.querySelectorAll('video[data-clip]')];
  videos.forEach((v) => videoObserver.observe(v));

  /* ---------- Lightbox ---------- */
  const lightbox = document.getElementById('lightbox');
  const lbVideo = lightbox.querySelector('video');
  const lbTitle = lightbox.querySelector('.lightbox-title');
  document.querySelectorAll('.tile, .frame').forEach((fig) => {
    const video = fig.querySelector('video[data-clip]');
    if (!video) return;
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    const open = () => {
      setVideo(lbVideo, video.dataset.clip);
      lbTitle.textContent = topicById.get(video.dataset.clip)?.title[lang] ?? '';
      lightbox.showModal();
      lbVideo.play().catch(() => {});
    };
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
  lightbox.querySelector('.close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (e) => e.target === lightbox && lightbox.close());
  lightbox.addEventListener('close', () => lbVideo.pause());

  /* ---------- Topic map ---------- */
  function renderTopics() {
    const map = document.getElementById('topic-map');
    map.replaceChildren(
      ...DATA.categories.map((c) => {
        const area = document.createElement('article');
        area.className = 'area';
        const h = document.createElement('h3');
        h.append(c.name[lang], Object.assign(document.createElement('small'), { textContent: String(c.topics.length) }));
        const list = document.createElement('ul');
        for (const t of c.topics) {
          const li = document.createElement('li');
          li.textContent = t.title[lang];
          li.title = t.summary[lang];
          if (t.important) {
            li.className = 'important';
            li.setAttribute('aria-label', `${t.title[lang]} (${TEXT[lang]['topics.important']})`);
          }
          list.append(li);
        }
        area.append(h, list);
        return area;
      }),
    );
  }

  /* ---------- Language ---------- */
  function applyLanguage(next) {
    lang = next;
    try {
      localStorage.setItem('dwall-e-landing-lang', lang);
    } catch {}
    const t = TEXT[lang];
    document.documentElement.lang = lang;
    document.title = t.docTitle;
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t[el.dataset.i18n] ?? el.textContent));
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t[el.dataset.i18nTitle];
      el.setAttribute('aria-label', t[el.dataset.i18nTitle]);
    });
    document.querySelectorAll('[data-topic]').forEach((el) => (el.textContent = topicById.get(el.dataset.topic)?.title[lang] ?? ''));
    document.querySelectorAll('[data-count="ready"]').forEach((el) => (el.textContent = DATA.ready));
    document.querySelectorAll('img[data-shot]').forEach((img) => {
      img.src = media(`screen-${img.dataset.shot}.jpg`);
      img.alt = t[`slide.${img.closest('.slide').id}`] ?? '';
    });
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    videos.forEach((v) => {
      setVideo(v, v.dataset.clip);
      if (!reducedMotion && visible.has(v)) v.play().catch(() => {});
    });
    renderTopics();
    renderDots();
  }
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => applyLanguage(b.dataset.lang)));

  /* ---------- Slides: dots, progress, keyboard, presentation mode ---------- */
  const dots = document.querySelector('.dots');
  const bar = document.querySelector('.progress span');
  let current = 0;
  function renderDots() {
    dots.replaceChildren(
      ...slides.map((s, i) => {
        const a = document.createElement('a');
        a.href = '#' + s.id;
        const label = TEXT[lang][`slide.${s.id}`] ?? s.id;
        a.setAttribute('aria-label', label);
        a.append(Object.assign(document.createElement('span'), { textContent: label }));
        if (i === current) a.setAttribute('aria-current', 'true');
        return a;
      }),
    );
  }
  function setCurrent(i) {
    current = i;
    dots.querySelectorAll('a').forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    bar.style.width = `${(i / (slides.length - 1)) * 100}%`;
  }
  const slideObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(slides.indexOf(e.target));
    },
    { threshold: 0.55 },
  );
  slides.forEach((s) => slideObserver.observe(s));
  const go = (i) => slides[Math.max(0, Math.min(slides.length - 1, i))].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });

  function togglePresentation() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }
  document.addEventListener('fullscreenchange', () => document.body.classList.toggle('presenting', !!document.fullscreenElement));
  document.getElementById('present').addEventListener('click', togglePresentation);

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || lightbox.open) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], summary, .tile, .frame')) return;
    if (['ArrowDown', 'PageDown', 'ArrowRight'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) go(current + 1);
    else if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key) || (e.key === ' ' && e.shiftKey)) go(current - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') togglePresentation();
    else return;
    e.preventDefault();
  });

  /* ---------- Entrance animation ---------- */
  if (!reducedMotion) {
    const items = document.querySelectorAll('.slide h2, .slide .sub, .steps li, .gallery .tile, .levels article, .cards article, .checks li, .area, .dl, .split > figure');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('shown');
          revealObserver.unobserve(e.target);
        }
      },
      // Any part in view counts, so tall blocks (the topic map) and headings near the top bar always appear.
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(i % 6) * 60}ms`;
      revealObserver.observe(el);
    });
  }

  applyLanguage(lang);

  // Open the slide named in the address (#download, #topics …) once the page is laid out.
  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'auto' }));
  }
})();
