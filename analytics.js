// Public PostHog project token; this is not a personal API key.
(() => {
  // Keep local previews out of production visitor counts.
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  const pending = [];
  let ready = false;
  const capture = (event, properties) => {
    if (ready) window.posthog.capture(event, properties);
    else pending.push([event, properties]);
  };
  const script = document.createElement('script');
  script.src = 'https://eu-assets.i.posthog.com/static/array.js';
  script.async = true;
  script.onload = () => {
    if (!window.posthog?.init) return;
    window.posthog.init('phc_vq5DQuaSKqMbzoNFhTKeKatsfDWDBCY5tPJPDCti7w9E', {
      api_host: 'https://eu.i.posthog.com',
      defaults: '2026-05-30',
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: true,
      disable_session_recording: true,
      loaded: () => {
        ready = true;
        pending.splice(0).forEach(([event, properties]) => capture(event, properties));
      },
    });
  };
  document.head.append(script);
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.hostname !== 'github.com' || !url.pathname.includes('/releases/latest/download/')) return;
    const file = url.pathname.split('/').pop();
    capture('download_clicked', {
      file,
      platform: file.endsWith('.exe') ? 'Windows' : file.endsWith('.dmg') ? 'macOS' : 'Linux',
      source: link.closest('.hero') ? 'hero' : 'download_section',
      language: document.documentElement.lang,
    });
  });
})();
