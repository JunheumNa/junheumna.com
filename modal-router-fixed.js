/* modal-router-fixed.js
   - [Final Fix] PC Chrome 이미지 깨짐(Relative Path) 문제 해결
   - [기능 유지] 클릭 시점에만 이미지 로딩 시작
   - [추가 기능] 모달 열림 시 배경 스크롤 차단 (Scroll Lock)
*/

(() => {
  const $  = (sel, ctx=document) => (ctx||document).querySelector(sel);
  const $$ = (sel, ctx=document) => Array.prototype.slice.call((ctx||document).querySelectorAll(sel));
  const isDesktop = () => window.matchMedia && window.matchMedia('(min-width: 800px)').matches;

  // ===== [핵심] 상대 경로 문제 해결사 =====
  // 주소가 /gallery/id 로 바뀌어도 이미지가 깨지지 않도록 절대 경로로 변환합니다.
  function getAbsolutePath(relPath) {
    if (!relPath || relPath.startsWith('http') || relPath.startsWith('/') || relPath.startsWith('data:')) {
      return relPath;
    }
    return new URL(relPath, window.location.origin + window.location.pathname).href;
  }

  // ===== 모달 레지스트리 =====
  const anchors = $$('.grid-item a[data-photo-id]');
  const modalsMap = new Map();
  anchors.forEach(a => {
    const id = a.getAttribute('data-photo-id');
    const m = document.getElementById('modal-' + id);
    if (m) modalsMap.set(String(id), m);
  });

  // ===== 미디어 지연 설정 (지연 로딩 기능 유지) =====
  function primeModalMediaLazy() {
    modalsMap.forEach((modal) => {
      $$('img', modal).forEach(img => {
        if (img.dataset._primed === '1') return;
        
        let src = img.getAttribute('src');
        if (src && src.trim() !== '') {
          // 주소 변경에 대비해 미리 절대 경로로 변환하여 data-src에 저장
          img.dataset.src = getAbsolutePath(src);
          img.removeAttribute('src'); // 실제 로딩 차단
        }
        img.removeAttribute('loading'); 
        img.dataset._primed = '1';
      });

      $$('iframe', modal).forEach(ifr => {
        if (ifr.dataset._primed === '1') return;
        if (ifr.hasAttribute('src')) {
          ifr.dataset._prevSrc = getAbsolutePath(ifr.getAttribute('src'));
          ifr.removeAttribute('src');
        }
        ifr.dataset._primed = '1';
      });
    });

    // [중요] 그리드 아이템의 이미지들도 주소 변경 시 깨지지 않도록 절대 경로로 고정
    $$('.grid-item img[src]').forEach(img => {
      const currentSrc = img.getAttribute('src');
      img.setAttribute('src', getAbsolutePath(currentSrc));
    });
  }
  primeModalMediaLazy();

  // ===== 미디어 복원 (클릭 시 실행) =====
  function restoreModalMedia(modal) {
    $$('img', modal).forEach(oldImg => {
      const src = oldImg.dataset.src;
      if (!src || oldImg.getAttribute('src')) return;

      const newImg = document.createElement('img');
      Array.from(oldImg.attributes).forEach(attr => {
        if (!['src', 'data-src', 'loading'].includes(attr.name)) {
          newImg.setAttribute(attr.name, attr.value);
        }
      });
      newImg.setAttribute('loading', 'eager'); 
      newImg.setAttribute('src', src); // 여기서 로딩 시작
      
      oldImg.parentNode.replaceChild(newImg, oldImg);
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
  }

  // ===== 모달 제어 및 스크롤 차단 =====
  let PROGRAMMATIC = false;

  function closeAllModals() {
    modalsMap.forEach((m) => {
      if (m.classList.contains('is-open')) releaseModalMedia(m);
      m.classList.remove('is-open');
    });
    // 스크롤 차단 해제
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }

  function openById(id, fromPopstate=false) {
    closeAllModals();
    const modal = modalsMap.get(String(id));
    if (!modal) return;

    if (modal.parentElement !== document.body) document.body.appendChild(modal);

    modal.classList.add('is-open');
    
    // [기능 추가] 배경 스크롤 차단
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; // 모바일 대응

    restoreModalMedia(modal);

    if (!fromPopstate) {
      PROGRAMMATIC = true;
      history.pushState({ photoId: id }, '', '/gallery/' + id);
      PROGRAMMATIC = false;
    }
  }

  // (이하 closeModal, parsePhotoIdFromURL, 이벤트 리스너 등 기존 로직 유지)
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

  anchors.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openById(a.getAttribute('data-photo-id'), false);
    });
  });

  $$('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(false);
    });
  });

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(false); });
  window.addEventListener('popstate', () => {
    if (PROGRAMMATIC) return;
    const pid = parsePhotoIdFromURL();
    if (pid) openById(pid, true); else closeModal(true);
  });

  (function initFromURL() {
    const initial = parsePhotoIdFromURL();
    if (initial) openById(initial, true);
  })();

  // 모달 내부 필터 클릭 시 처리 (기존 로직 유지)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.modal .data-type[data-filter]');
    if (!btn) return;
    const closeBtn = $('.modal.is-open [data-modal-close]');
    if (closeBtn) { e.preventDefault(); closeBtn.click(); }
  });
})();