// Apply before styles load to avoid flashing the wrong theme.
(() => {
  let saved;
  try { saved = localStorage.getItem('dwall-e-landing-theme'); } catch {}
  const hour = new Date().getHours();
  const theme = ['light', 'dark'].includes(saved) ? saved : hour >= 7 && hour < 19 ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f8f9fc' : '#0b0b10';
})();
