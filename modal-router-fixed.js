/* modal-router-fixed.js
   - 모바일 안정화(메모리 폭주 방지): 모달 내부 미디어 지연 복원/해제
   - 히스토리 루프 가드(초기/프로그램틱/팝스테이트 플래그)
   - 모바일(<800px)에서 모달 내 data-type 클릭 시 mobile-filter-line 즉시 갱신
   - [Fix] PC Chrome 이미지 로딩 지연 문제 해결 (loading="eager" 적용)
*/

(() => {
  // ===== 유틸 =====
  const $  = (sel, ctx=document) => (ctx||document).querySelector(sel);
  const $$ = (sel, ctx=document) => Array.prototype.slice.call((ctx||document).querySelectorAll(sel));
  const esc = (v) => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v);
  const isDesktop = () => window.matchMedia && window.matchMedia('(min-width: 800px)').matches;

  const DEFAULT_LANG = 'ko';
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

  // ===== mobile-filter-line 제어 =====
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
  const anchors = $$('.grid-item a[data-photo-id]');
  const modalsMap = new Map();
  anchors.forEach(a => {
    const id = a.getAttribute('data-photo-id');
    const m = document.getElementById('modal-' + id);
    if (m) modalsMap.set(String(id), m);
  });

  // ===== 초기 미디어 지연 설정 =====
  function primeModalMediaLazy() {
    modalsMap.forEach((modal) => {
      // 이미지: src -> data-src로 옮겨 초기 로딩 차단
      $$('img', modal).forEach(img => {
        if (img.dataset._primed === '1') return;
        if (img.hasAttribute('src')) {
          img.dataset.src = img.getAttribute('src');
          img.removeAttribute('src');
        }
        // 초기에는 lazy로 설정하여 메모리 절약
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
  primeModalMediaLazy();

  // ===== 모달 열기/닫기 시 미디어 복원/해제 =====
  function restoreModalMedia(modal) {
    $$('img', modal).forEach(img => {
      const src = img.dataset.src;
      if (src && !img.getAttribute('src')) {
        // [수정] 모달이 열릴 때는 즉시 로딩(eager)으로 변경하여 크롬 이슈 해결
        img.loading = 'eager'; 
        img.setAttribute('src', src);
      }
    });
    $$('iframe', modal).forEach(ifr => {
      const prev = ifr.dataset._prevSrc;
      if (prev && !ifr.getAttribute('src')) ifr.setAttribute('src', prev);
    });
  }
  function releaseModalMedia(modal) {
    $$('iframe', modal).forEach(ifr => {
      if (ifr.hasAttribute('src')) {
        ifr.dataset._prevSrc = ifr.getAttribute('src');
        ifr.removeAttribute('src');
      }
    });
    // 이미지는 닫을 때 다시 lazy로 돌리거나 src를 제거할 수 있음 (선택사항)
    // $$('img', modal).forEach(img => { if (img.getAttribute('src')) img.removeAttribute('src'); });
  }

  // ===== 히스토리 가드 =====
  let INITIALIZED = false;
  let PROGRAMMATIC = false;
  let IN_POPSTATE = false;

  function closeAllModals() {
    modalsMap.forEach((m) => {
      if (m.classList.contains('is-open')) {
        releaseModalMedia(m);
      }
      m.classList.remove('is-open');
      m.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }

  function openById(id, fromPopstate=false) {
    closeAllModals();
    const modal = modalsMap.get(String(id));
    if (!modal) return;

    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    
    // [중요] display:flex(is-open)가 먼저 적용되어야 이미지가 로딩됨
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // 이미지 소스 복원
    restoreModalMedia(modal);

    if (!fromPopstate) {
      PROGRAMMATIC = true;
      history.pushState({ photoId: id }, '', '/gallery/' + id);
      PROGRAMMATIC = false;
    }
  }

  function closeModal(fromPopstate=false) {
    let wasOpen = false;
    modalsMap.forEach(m => { if (m.classList.contains('is-open')) wasOpen = true; });
    closeAllModals();

    if (!fromPopstate && wasOpen) {
      PROGRAMMATIC = true;
      history.replaceState({}, '', '/');
      PROGRAMMATIC = false;
    }
  }

  function parsePhotoIdFromURL() {
    const pathMatch = location.pathname.match(/\/gallery\/([^/]+)$/);
    if (pathMatch) return pathMatch[1];
    const sp = new URLSearchParams(location.search);
    return sp.get('photoId');
  }

  // ===== 앵커 클릭 → 모달 열기 =====
  anchors.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-photo-id');
      openById(id, false);
    });
  });

  // ===== 모달 닫기 버튼 =====
  $$('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(false);
    });
  });

  // ===== ESC 닫기 =====
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(false);
  });

  // ===== popstate =====
  window.addEventListener('popstate', () => {
    if (PROGRAMMATIC) return;
    IN_POPSTATE = true;
    const pid = parsePhotoIdFromURL();
    if (pid) openById(pid, true);
    else closeModal(true);
    IN_POPSTATE = false;
  });

  // ===== 초기 URL 상태 반영 =====
  (function initFromURL() {
    const initial = parsePhotoIdFromURL();
    if (initial) openById(initial, true);
    INITIALIZED = true;
  })();

  // ===== 모달 내부 data-type 클릭 핸들러 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.modal .data-type[data-filter]');
    if (!btn) return;

    const label = getLocalizedLabelFromButton(btn, (btn.textContent||'').trim());
    if (!isDesktop()) updateMobileLine(label);

    const closeBtn = $('.modal.is-open [data-modal-close]');
    if (closeBtn) {
      e.preventDefault();
      closeBtn.click();
    }
  });

})();