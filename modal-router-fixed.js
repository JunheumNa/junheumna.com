/* modal-router-fixed.js
   - 모바일 안정화(메모리 폭주 방지)
   - 히스토리 루프 가드
   - [Final Fix] PC Chrome 이미지 로딩 실패 해결 (Clone Node Replacement 기법 적용)
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

  // ===== 초기 미디어 지연 설정 (Lazy Setup) =====
  function primeModalMediaLazy() {
    modalsMap.forEach((modal) => {
      // 이미지: src -> data-src로 이동, loading="lazy" 설정
      $$('img', modal).forEach(img => {
        if (img.dataset._primed === '1') return;
        
        if (img.hasAttribute('src')) {
          img.dataset.src = img.getAttribute('src');
          img.removeAttribute('src');
        }
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        img.dataset._primed = '1';
      });

      // iframe: src 제거
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
  // 로드 시 즉시 실행
  primeModalMediaLazy();

  // ===== [핵심] 모달 미디어 복원 (Restore Media) =====
  function restoreModalMedia(modal) {
    // 1. 이미지 복원 (Clone & Replace 방식)
    // 기존 태그를 수정하는 대신, 복제본을 만들어 교체함으로써 브라우저 렌더링을 강제 리셋함
    $$('img', modal).forEach(oldImg => {
      const src = oldImg.dataset.src;
      // 이미 src가 있거나 data-src가 없으면 스킵
      if (!src || oldImg.getAttribute('src')) return;

      const newImg = oldImg.cloneNode(true); // 속성 복사
      
      // Chrome 버그 방지: 속성 순서 중요
      newImg.removeAttribute('loading');   // 기존 lazy 제거
      newImg.removeAttribute('decoding');
      
      newImg.setAttribute('loading', 'eager'); // 즉시 로딩 강제
      newImg.setAttribute('src', src);         // 소스 주입
      
      // DOM 교체 (이 순간 브라우저는 새 이미지로 인식하여 즉시 그림)
      oldImg.parentNode.replaceChild(newImg, oldImg);
    });

    // 2. iframe 복원
    $$('iframe', modal).forEach(ifr => {
      const prev = ifr.dataset._prevSrc;
      if (prev && !ifr.getAttribute('src')) ifr.setAttribute('src', prev);
    });
  }

  // ===== 모달 미디어 해제 (Release Media) =====
  function releaseModalMedia(modal) {
    $$('iframe', modal).forEach(ifr => {
      if (ifr.hasAttribute('src')) {
        ifr.dataset._prevSrc = ifr.getAttribute('src');
        ifr.removeAttribute('src');
      }
    });
    // 이미지는 닫을 때 굳이 제거하지 않아도 됨 (깜빡임 방지)
  }

  // ===== 모달 제어 로직 =====
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

    // 1. 모달을 먼저 보이게 함 (display:flex)
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // 2. [강제 리플로우] 브라우저가 화면 크기를 계산하도록 강제
    void modal.offsetWidth;

    // 3. 미디어 복원 실행
    // requestAnimationFrame을 사용하여 페인트 프레임 보장
    requestAnimationFrame(() => {
      restoreModalMedia(modal);
    });

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

  // ===== 이벤트 리스너 =====
  anchors.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-photo-id');
      openById(id, false);
    });
  });

  $$('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(false);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(false);
  });

  window.addEventListener('popstate', () => {
    if (PROGRAMMATIC) return;
    IN_POPSTATE = true;
    const pid = parsePhotoIdFromURL();
    if (pid) openById(pid, true);
    else closeModal(true);
    IN_POPSTATE = false;
  });

  // 초기 로드
  (function initFromURL() {
    const initial = parsePhotoIdFromURL();
    if (initial) openById(initial, true);
  })();

  // 모달 내부 필터 클릭
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