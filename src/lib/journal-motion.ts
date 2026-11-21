export function enableJournalMotion() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  const entries = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(changes => {
      for (const change of changes) {
        if (!change.isIntersecting) continue;
        change.target.classList.add('is-visible');
        observer.unobserve(change.target);
      }
    }, { threshold: .08 });
    for (const entry of entries) {
      entry.classList.add('reveal-on-scroll');
      observer.observe(entry);
    }
    reduced.addEventListener('change', () => {
      if (!reduced.matches) return;
      observer.disconnect();
      for (const entry of entries) entry.classList.remove('reveal-on-scroll');
    }, { once: true });
  }

  const art = document.querySelector<HTMLElement>('.journal-art');
  if (!art || !window.matchMedia('(pointer: fine)').matches) return;
  let frame = 0;
  art.addEventListener('pointermove', event => {
    if (reduced.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const bounds = art.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      art.style.setProperty('--art-x', `${x * 16}px`);
      art.style.setProperty('--art-y', `${y * 14}px`);
    });
  }, { passive: true });
  art.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    art.style.removeProperty('--art-x');
    art.style.removeProperty('--art-y');
  });
}
