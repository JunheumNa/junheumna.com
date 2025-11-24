(function () {
  'use strict';

  const $$ = (sel, ctx = document) => Array.prototype.slice.call(ctx.querySelectorAll(sel));
  const qs = (sel, ctx = document) => (ctx || document).querySelector(sel);

  const isString = (v) => typeof v === 'string';
  const escId = (v) => String(v).replace(/[^\w\-\.:]/g, '');

  function baseURL() {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.delete('photoId');
    return url.pathname + (url.search ? url.search : '');
  }

  const anchorEls = $$('.grid-item a[data-photo-id]');
  const MODALS = new Map(); 

  anchorEls.forEach(a => {
    const id = a.getAttribute('data-photo-id');
    const m = qs('#modal-' + escId(id));
    if (m) MODALS.set(String(id), m);
  });

  function anyOpen() {
    let open = null;
    MODALS.forEach(m => { if (m.classList.contains('is-open')) open = m; });
    return open;
  }

  function stopIframes(scope) {
    $$('iframe', scope).forEach((f) => {
      try {
        f.contentWindow?.postMessage?.(
          JSON.stringify({ event: 'command', func: 'stopVideo', args: [] }),
          '*'
        );
      } catch (_) { /* noop */ }

      const src = f.getAttribute('src');
      if (src) {
        f.dataset._prevSrc = src;
        f.removeAttribute('src');
      }
    });
  }

  function resumeIframes(scope) {
    $$('iframe', scope).forEach((f) => {
      const prev = f.dataset._prevSrc;
      if (prev && !f.getAttribute('src')) {
        f.setAttribute('src', prev);
        delete f.dataset._prevSrc;
      }
    });
  }

  function ensureLazyImages(scope) {
    $$('img', scope).forEach(img => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

      if (!img.dataset.src && img.src) {
        img.dataset.src = img.src;
        img.removeAttribute('src');
      }
    });
  }

  function hydrateVisibleImages(scope) {
    $$('img[data-src]', scope).forEach(img => {
      if (!img.getAttribute('src')) {
        img.setAttribute('src', img.dataset.src);
      }
    });
  }

  let IN_POPSTATE = false;      
  let PROGRAMMATIC = false;     
  let CURRENT_ID = null;      

  function closeAll() {
    const opened = anyOpen();
    if (!opened) return;

    stopIframes(opened);        
    opened.classList.remove('is-open');
    opened.setAttribute('aria-hidden', 'true');

    document.body.style.overflow = '';
    CURRENT_ID = null;
  }

  function openById(id, fromPopstate = false) {
    const target = MODALS.get(String(id));
    if (!target) return;

    const opened = anyOpen();
    if (opened === target) return; 

    if (opened) closeAll();

    ensureLazyImages(target);
    hydrateVisibleImages(target);
    resumeIframes(target);

    if (target.parentElement !== document.body) {
      document.body.appendChild(target);
    }
    target.classList.add('is-open');
    target.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    CURRENT_ID = String(id);

    if (!fromPopstate) {
      const url = new URL(window.location.href);
      const nextPath = `/gallery/${encodeURIComponent(String(id))}`;
      if (url.pathname !== nextPath) {
        PROGRAMMATIC = true;
        history.pushState({ photoId: String(id) }, '', nextPath);
        PROGRAMMATIC = false;
      }
    }
  }

  function closeModal(fromPopstate = false) {
    if (!anyOpen()) return;

    closeAll();

    if (!fromPopstate) {
      const base = baseURL();
      if ((window.location.pathname + window.location.search) !== base) {
        PROGRAMMATIC = true;
        history.replaceState(null, '', base);
        PROGRAMMATIC = false;
      }
    }
  }

  anchorEls.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-photo-id');
      if (!id) return;
      openById(id, /*fromPopstate*/ false);
    }, { passive: false });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modal-close]');
    if (!btn) return;
    e.preventDefault();
    closeModal(false);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(false);
    }
  });

  window.addEventListener('popstate', () => {
    if (PROGRAMMATIC || IN_POPSTATE) return;
    IN_POPSTATE = true;

    try {
      const st = history.state;
      const pid = st && st.photoId ? String(st.photoId) : null;
      if (pid) {
        openById(pid, /*fromPopstate*/ true);
      } else {
        closeModal(true);
      }
    } finally {
      IN_POPSTATE = false;
    }
  });

  function parseInitialPhotoId() {
    const m = window.location.pathname.match(/\/gallery\/([^/]+)$/);
    if (m) return decodeURIComponent(m[1]);

    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('photoId');
    return q ? String(q) : null;
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const initial = parseInitialPhotoId();
  if (initial && MODALS.has(String(initial))) {
    openById(initial, /*fromPopstate*/ true);
  } else {
    history.replaceState(null, '', baseURL());
  }
})();
