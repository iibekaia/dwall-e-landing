// Apply before styles load to avoid flashing the wrong theme.
(() => {
  let saved;
  try { saved = localStorage.getItem('dwall-e-landing-theme'); } catch {}
  const theme = ['light', 'dark'].includes(saved) ? saved : 'dark';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f8f9fc' : '#0b0b10';
})();
