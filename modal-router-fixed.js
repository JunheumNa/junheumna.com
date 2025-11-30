/* js/modal-router-fixed.js
   - 모달 열기/닫기 라우팅 안정화 (모바일 Safari/Chrome 새로고침 루프 방지)
   - 모달 내부 <img> 지연 로드 시 WebP 경로 자동 매핑(.jpg/.png/.gif → .webp)
   - 모달 내부 data-type 버튼 클릭 시 mobile-filter-line 즉시 갱신
   - 중복 이벤트/이중 내비게이션 가드
*/

(function () {
  'use strict';

  // ====== 유틸 ======
  const $$  = (sel, ctx=document) => Array.prototype.slice.call((ctx||document).querySelectorAll(sel));
  const qs  = (sel, ctx=document) => (ctx||document).querySelector(sel);
  const on  = (el, type, fn, opts) => el && el.addEventListener(type, fn, opts || false);

  const esc = (v) => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v);

  const supportsWebP = (() => {
    // 대부분 브라우저가 지원하지만, feature detect 한 번만 해둠. (MDN: 브라우저/포맷 가이드) 
    // 참고: WebP는 현대 브라우저에서 폭넓게 지원됩니다. :contentReference[oaicite:0]{index=0}
    const c = document.createElement('canvas');
    if (!c.getContext) return false;
    return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  })();

  // jpg/png/gif → webp 경로 치환
  const toWebP = (src) => {
    if (!src) return src;
    if (/\.(webp)(\?.*)?$/i.test(src)) return src;
    return src.replace(/\.(jpg|jpeg|png|gif)(\?.*)?$/i, '.webp$2' || '.webp');
  };

  // ====== 모달 셀렉션 ======
  const anchors = $$('.grid-item a[data-photo-id]');
  const modalMap = new Map();
  $$('.modal[id^="modal-"]').forEach(m => {
    const id = m.id.replace(/^modal-/, '');
    modalMap.set(id, m);
  });

  // ====== 모달 미디어 지연 로드 (초기엔 비워두고 열릴 때 채움) ======
  function primeModalMediaLazy(modal) {
    if (!modal || modal.__primed) return;
    modal.__primed = true;

    // <img> : src → data-src 로 옮기고 src 제거. webp 치환 적용.
    $$('img', modal).forEach(img => {
      const orig = img.getAttribute('src') || '';
      if (!orig) return;
      // 현재 웹은 모든 원본이 webp 로 대체된 상태 → 안전하게 webp로 맵핑
      const candidate = toWebP(orig);
      img.setAttribute('data-src', candidate);
      img.removeAttribute('src');
      img.setAttribute('loading', 'lazy'); // 지연 로드 (브라우저 속성) :contentReference[oaicite:1]{index=1}
    });

    // <iframe> : src → data-src 로 옮기고 src 제거.
    $$('iframe', modal).forEach(fr => {
      const orig = fr.getAttribute('src') || '';
      if (!orig) return;
      fr.setAttribute('data-src', orig);
      fr.removeAttribute('src');
      // autoplay 등은 실제로 열릴 때만 동작하도록 유지
    });
  }

  function restoreModalMedia(modal) {
    if (!modal) return;
    // 이미 로드했으면 재설정 없이 그대로 둠 (중복 네트워크 방지)
    $$('img[data-src]', modal).forEach(img => {
      if (!img.getAttribute('src')) {
        img.setAttribute('src', img.getAttribute('data-src'));
      }
    });
    $$('iframe[data-src]', modal).forEach(fr => {
      if (!fr.getAttribute('src')) {
        fr.setAttribute('src', fr.getAttribute('data-src'));
      }
    });
  }

  function clearModalMedia(modal) {
    if (!modal) return;
    // YouTube 등 동영상 새고침 루프 방지: 닫을 때 src 비워서 재생 중지
    $$('iframe', modal).forEach(fr => {
      const src = fr.getAttribute('src');
      if (src && !fr.getAttribute('data-src')) {
        fr.setAttribute('data-src', src);
      }
      fr.removeAttribute('src');
    });
    // 이미지도 다시 비워 메모리/디코드 비용 줄임 (필요 시만)
    $$('img', modal).forEach(img => {
      const src = img.getAttribute('src');
      if (src && !img.getAttribute('data-src')) {
        img.setAttribute('data-src', src);
      }
      img.removeAttribute('src');
    });
  }

  // 최초 한 번 모든 모달에 prime 적용
  modalMap.forEach(m => primeModalMediaLazy(m));

  // ====== 히스토리/라우팅 ======
  const PATH_RE = /^\/gallery\/([^/]+)$/;
  let isNavigating = false;

  function openModalById(id, fromPopstate) {
    const modal = modalMap.get(String(id));
    if (!modal) return;

    // 이미 열려있는 다른 모달 닫기
    closeAll(true);

    // body 스크롤 잠금
    document.body.style.overflow = 'hidden';

    // 미디어 주입
    restoreModalMedia(modal);

    // 표시
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    // URL 반영
    if (!fromPopstate) {
      isNavigating = true;
      history.pushState({ photoId: id }, '', '/gallery/' + id);
      // pushState는 렌더 재실행이 없으므로 안전 (MDN: History API 가이드). 
      isNavigating = false;
    }
  }

  function closeAll(silent) {
    modalMap.forEach(m => {
      if (m.classList.contains('is-open')) {
        m.classList.remove('is-open');
        m.setAttribute('aria-hidden', 'true');
        clearModalMedia(m);
      }
    });
    document.body.style.overflow = '';

    // URL 되돌리기: replaceState 사용 → 뒤로가기로 이전 상세로 튕기지 않게
    if (!silent) {
      isNavigating = true;
      // 쿼리스트링/해시 모두 제거한 루트 경로로 치환
      const clean = location.origin + '/';
      history.replaceState({}, '', clean);
      isNavigating = false;
    }
  }

  function parsePhotoIdFromURL() {
    const m = location.pathname.match(PATH_RE);
    if (m) return m[1];
    const sp = new URLSearchParams(location.search);
    return sp.get('photoId'); // 구버전 호환
  }

  // 그리드 썸네일 클릭 → 모달 열기
  anchors.forEach(a => {
    on(a, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = a.getAttribute('data-photo-id');
      if (!id) return;
      openModalById(id, false);
    }, { passive: false });
  });

  // 모달 닫기 버튼
  $$('.modal [data-modal-close]').forEach(btn => {
    on(btn, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAll(false);
    }, { passive: false });
  });

  // ESC 키 닫기
  on(window, 'keydown', (e) => {
    if (e.key === 'Escape') {
      closeAll(false);
    }
  });

  // 브라우저 뒤/앞으로
  on(window, 'popstate', () => {
    if (isNavigating) return;
    const pid = parsePhotoIdFromURL();
    if (pid) openModalById(pid, true);
    else closeAll(true);
  });

  // 최초 진입 시 URL에 상세가 있으면 열기
  (function bootstrapFromURL() {
    const pid = parsePhotoIdFromURL();
    if (pid) openModalById(pid, true);
  })();

  // ====== 모바일: 모달 안의 data-type 버튼 클릭 시, 선택 라벨을 상단 mobile-filter-line에 반영 ======
  on(document, 'click', (e) => {
    const btn = e.target && e.target.closest('.modal .data-type[data-filter]');
    if (!btn) return;

    // 카테고리 라벨 추출(다국어 지원)
    const lang = (document.documentElement.getAttribute('lang')||'').toLowerCase().startsWith('en') ? 'en' : 'ko';
    const label = (btn.dataset[lang] || btn.textContent || '').trim();

    const line = qs('#mobile-filter-line');
    if (line) {
      line.textContent = label;
      line.style.display = label ? '' : 'none';
    }

    // 모달 닫고 URL을 루트로 replace (뒤로가기로 상세 재등장 방지)
    requestAnimationFrame(() => closeAll(false));
  }, { passive: true });

  // ====== Chrome/Safari 모바일 주소창 크기 변화로 인한 레이아웃 점프 최소화 ======
  // dvh 지원 시 CSS가 우선 처리. (web.dev: dynamic viewport units) :contentReference[oaicite:2]{index=2}
  // 추가로 일부 브라우저에서의 간헐적 점프를 줄이기 위한 리사이즈 no-op 처리
  let resizeTimer = null;
  on(window, 'resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // 레이아웃 강제 재계산만 유도 (측정값 사용 X)
      document.documentElement.style.setProperty('--noop', String(Date.now()));
    }, 120);
  });

})();
