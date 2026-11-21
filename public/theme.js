(() => {
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const storageKey = 'kaleidoscope-theme';
  let preference;
  try {
    preference = localStorage.getItem(storageKey);
  } catch {
    // Theme switching still works for the current page if storage is blocked.
  }

  const update = () => {
    const theme = preference === 'light' || preference === 'dark' ? preference : system.matches ? 'dark' : 'light';
    root.dataset.theme = theme;
    const control = document.getElementById('theme-toggle');
    if (!control) return;
    control.setAttribute('aria-pressed', String(theme === 'dark'));
    control.hidden = false;
  };

  update();
  system.addEventListener('change', update);
  document.addEventListener('DOMContentLoaded', () => {
    update();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(storageKey, preference);
      } catch {
        // The preference remains active on this page.
      }
      update();
    });
  });
})();
