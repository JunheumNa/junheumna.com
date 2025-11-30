/* modal-router-fixed.js
   - 모달 안정화: 내부 미디어 지연 로딩/복원 + 절대경로 주입으로 경로 깨짐 방지
   - 히스토리 루프 가드
   - 모바일(<800px)에서 모달 내 data-type 클릭 시 mobile-filter-line 즉시 갱신
*/
(() => {
  // ===== 유틸 =====
  const $  = (sel, ctx=document) => (ctx||document).querySelector(sel);
  const $$ = (sel, ctx=document) => Array.prototype.slice.call((ctx||document).querySelectorAll(sel));
  const isDesktop = () => window.matchMedia && window.matchMedia('(min-width: 800px)').matches;

  const getCurrentLang = () => {
    const lang = (document.documentElement.getAttribute('lang')||'').toLowerCase();
    return lang.startsWith('en') ? 'en' : 'ko';
  };
  const getLocalizedLabelFromButton = (btn, fallback='') => {
    const lang = getCurrentLang();
    const en = (btn?.dataset?.en || '').trim();
    const ko = (btn?.dataset?.ko || '').trim();
    const txt = (btn?.textContent || '').trim();
    return (lang==='en') ? (en || txt || fallback) : (ko || txt || fallback);
  };

  // 상대 경로를 항상 루트 기준 절대 경로로 바꿔줌 (img/…, ./img/… → /img/…)
  const absolutize = (p) => {
    if (!p) return p;
    const s = String(p);
    if (/^(?:https?:)?\/\//i.test(s) || s.startsWith('data:')) return s; // 절대/데이터 URL 그대로
    if (s.startsWith('/')) return s;                                    // 이미 루트 기준
    return '/' + s.replace(/^(\.\/)+/, '');                             // 그 외는 루트 기준으로
  };

  // ===== mobile-filter-line =====
  function ensureMobileLine() {
    let host = $('.category_pannel');
    if (!host) {
      host = document.createElement('div');
      host.className = 'category_pannel';
      const anchor = $('.nav-menu-wrapper') || $('nav') || document.body.firstElementChild || document.body;
      if (anchor.insertAdjacentElement) anchor.insertAdjacentElement('afterend', host);
      else anchor.parentNode.insertBefore(host, anchor.nextSibling);
    }
    let line = $('#mobile-filter-line', host);
    if (!line) {
      line = document.createElement('div');
      line.id = 'mobile-filter-line';
      line.className = 'filter-selected-line';
      line.setAttribute('role','status');
      line.setAttribute('aria-live','polite');
      host.insertAdjacentElement('afterbegin', line);
    }
    return line;
  }
  function updateMobileLine(label) {
    if (isDesktop()) return;
    const line = ensureMobileLine();
    line.textContent = label || '';
    line.style.display = label ? '' : 'none';
  }

  // ===== 모달 레지스트리 =====
  const anchorEls = $$('.grid-item a[data-photo-id]');
  const MODALS = new Map();
  anchorEls.forEach(a => {
    const id = a.getAttribute('data-photo-id');
    const m = document.getElementById('modal-' + id);
    if (m) MODALS.set(String(id), m);
  });

  // ===== 초기 미디어 지연 설정 =====
  function primeModalMediaLazy() {
    MODALS.forEach((modal) => {
      // 이미지: src -> data-src 로 옮겨 초기 로딩 차단
      $$('img', modal).forEach(img => {
        if (img.dataset._primed === '1') return;
        if (img.hasAttribute('src')) {
          img.dataset.src = img.getAttribute('src');
          img.removeAttribute('src');
        }
        img.loading = 'lazy';
        img.decoding = 'async';
        img.dataset._primed = '1';
      });
      // iframe: src 제거 후 data-_prevSrc에 보관
      $$('iframe', modal).forEach(ifr => {
        if (ifr.dataset._primed === '1') return;
        if (ifr.hasAttribute('src')) {
          ifr.dataset._prevSrc = ifr.getAttribute('src');
          ifr.removeAttribute('src');
        }
        ifr.setAttribute('playsinline','');
        ifr.dataset._primed = '1';
      });
    });
  }
  primeModalMediaLazy(); // 초기 1회 프라임 (:contentReference[oaicite:4]{index=4})

  function ensureLazyImages(scope) {
    $$('img', scope).forEach(img => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.dataset.src && img.getAttribute('src')) {
        img.dataset.src = img.getAttribute('src');
        img.removeAttribute('src');
      }
    });
  }

  function hydrateVisibleImages(scope) {
    $$('img[data-src]', scope).forEach(img => {
      if (!img.getAttribute('src')) {
        // ★ 핵심: 절대경로로 주입 (크롬에서 /gallery 경로일 때 상대경로 깨짐 방지)
        img.setAttribute('src', absolutize(img.dataset.src));
      }
    });
  }

  function resumeIframes(scope) {
    $$('iframe', scope).forEach(ifr => {
      if (ifr.dataset._prevSrc && !ifr.getAttribute('src')) {
        ifr.setAttribute('src', ifr.dataset._prevSrc);
      }
    });
  }
  function stopIframes(scope) {
    $$('iframe', scope).forEach(ifr => {
      if (ifr.getAttribute('src')) {
        ifr.dataset._prevSrc = ifr.getAttribute('src');
        ifr.removeAttribute('src');
      }
    });
  }

  const baseURL = () => '/';

  let IN_POPSTATE   = false;
  let PROGRAMMATIC  = false;
  let CURRENT_ID    = null;

  const anyOpen = () => $('.modal.is-open');

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
    hydrateVisibleImages(target); // ★ 이 시점에 이미지 절대경로로 주입
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
        history.pushState({ photoId: String(id) }, '', nextPath); // 경로 전환 (:contentReference[oaicite:5]{index=5})
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

  // 앵커(그리드) 클릭 → 모달 오픈
  anchorEls.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-photo-id');
      if (!id) return;
      openById(id, false);
    }, { passive: false });
  });

  // 모달 닫기 버튼
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modal-close]');
    if (!btn) return;
    e.preventDefault();
    closeModal(false);
  }, { passive: false });

  // ESC 닫기
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(false);
    }
  });

  // popstate 복원
  window.addEventListener('popstate', () => {
    if (PROGRAMMATIC || IN_POPSTATE) return;
    IN_POPSTATE = true;
    try {
      const st = history.state;
      const pid = st && st.photoId ? String(st.photoId) : null;
      if (pid) {
        openById(pid, true);
      } else {
        closeModal(true);
      }
    } finally {
      IN_POPSTATE = false;
    }
  });

  // 초기 URL 반영
  (function initFromURL() {
    const m = window.location.pathname.match(/\/gallery\/([^/]+)/);
    const initial = m && m[1] ? decodeURIComponent(m[1]) : null;
    if (initial) openById(initial, true);
  })();

  // 모달 내 data-type 클릭 시: 모바일 라인 갱신 (필터 적용은 기존 코드가 담당)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.modal .data-type[data-filter]');
    if (!btn) return;
    const label = getLocalizedLabelFromButton(btn, (btn.textContent||'').trim());
    if (!isDesktop()) updateMobileLine(label);
    const closeBtn = $('.modal.is-open [data-modal-close]');
    if (closeBtn) { e.preventDefault(); closeBtn.click(); }
  });
})();
