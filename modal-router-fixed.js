/*!
 * modal-media-patch.js
 * - 그리드 썸네일은 DOM 로드 시 WebP로 지연 로딩 설정
 * - 모달은 열릴 때 모달 내부 이미지를 WebP로 교체 후 즉시 로딩
 * - WebP가 혹시 404일 경우, 원본 확장자(JPG/PNG/GIF)로 자동 폴백
 * - 기존 커스텀 이벤트(modal:open / modal:close)가 있을 경우 그대로 활용
 * - jQuery 의존 없음
 */

/** 지원 유틸 */
const toWebp = (src) => {
  if (!src) return src;
  try {
    const u = new URL(src, location.href);
    const pathname = u.pathname;
    // 확장자 판단: jpg|jpeg|png|gif → webp (이미 webp면 그대로)
    if (/\.(jpe?g|png|gif)$/i.test(pathname)) {
      u.pathname = pathname.replace(/\.(jpe?g|png|gif)$/i, '.webp');
      return u.toString();
    }
    return src; // 이미 webp 또는 기타 포맷
  } catch {
    // 상대경로 등 URL 생성 실패 시 문자열 치환 시도
    return src.replace(/\.(jpe?g|png|gif)$/i, '.webp');
  }
};

// 원본 확장자 추출(폴백용)
const originalFromWebp = (src, fallbackExt = 'jpg') => {
  if (!src) return src;
  return src.replace(/\.webp(\?.*)?$/i, `.${fallbackExt}$1`);
};

// 이미지 한 장을 webp로 로드(실패 시 폴백)
const loadImageAsWebpWithFallback = (img) => {
  if (!(img instanceof HTMLImageElement)) return;

  // 우선순위: data-src > src
  const original = img.getAttribute('data-src') || img.getAttribute('src') || '';
  if (!original) return;

  // 어떤 원본이었는지 폴백 확장자 추정
  const extMatch = original.match(/\.(jpe?g|png|gif)$/i);
  const fallbackExt = extMatch ? extMatch[0].slice(1) : 'jpg';

  // 성능 힌트
  try {
    img.decoding = 'async';
  } catch {}
  try {
    img.loading = img.closest('.modal') ? 'eager' : 'lazy';
  } catch {}

  // 일단 webp 시도
  const webpURL = toWebp(original);

  // onerror 한 번만 폴백하도록 보호
  const onError = (e) => {
    img.removeEventListener('error', onError);
    // 이미 폴백 상태면 더 진행하지 않음
    if (!/\.webp(\?.*)?$/i.test(img.currentSrc || img.src || '')) return;
    const fb = originalFromWebp(webpURL, fallbackExt);
    img.src = fb;
  };

  img.addEventListener('error', onError, { once: true });
  img.src = webpURL;
};

// 모달 내부의 모든 이미지 로드
const loadModalImagesOnDemand = (modalEl) => {
  if (!modalEl) return;
  const imgs = modalEl.querySelectorAll('.modal_info img');
  imgs.forEach(loadImageAsWebpWithFallback);
};

// 그리드 썸네일 초기 패치(지연 로딩 + webp 교체)
const patchGridThumbnails = () => {
  const thumbs = document.querySelectorAll('.grid .grid-item img');
  thumbs.forEach((img) => {
    // 이미 처리된 경우 스킵
    if (img.dataset._patched === '1') return;

    const raw = img.getAttribute('src') || '';
    if (!raw) return;

    // data-src에 원본 기억(혹시 모를 폴백 대비)
    if (!img.getAttribute('data-src')) {
      img.setAttribute('data-src', raw);
    }

    // 성능: lazy + async
    try { img.loading = 'lazy'; } catch {}
    try { img.decoding = 'async'; } catch {}

    // 썸네일은 최초부터 webp로 대체
    const webpURL = toWebp(raw);
    if (webpURL !== raw) {
      img.addEventListener('error', function onErr() {
        img.removeEventListener('error', onErr);
        // webp가 실패하면 원본 확장자로 복귀
        img.src = img.getAttribute('data-src') || raw;
      }, { once: true });
      img.src = webpURL;
    }

    img.dataset._patched = '1';
  });
};

// 이벤트 연결
const bindModalOpenHandler = () => {
  // 1) 커스텀 이벤트(modal:open)가 있는 경우
  document.addEventListener('modal:open', (ev) => {
    const pid = ev?.detail?.photoId;
    const modal = pid ? document.getElementById(`modal-${pid}`) : document.querySelector('.modal.is-open');
    if (modal) loadModalImagesOnDemand(modal);
  });

  // 2) 혹시 커스텀 이벤트가 없는 환경 대비: 모달 요소에 class가 붙는 변화를 관찰
  const observer = new MutationObserver((mutList) => {
    mutList.forEach((m) => {
      if (!(m.target instanceof HTMLElement)) return;
      if (!m.target.classList) return;
      // 열림 시점 감지
      if (m.attributeName === 'class' && m.target.classList.contains('modal') && m.target.classList.contains('is-open')) {
        loadModalImagesOnDemand(m.target);
      }
    });
  });

  // 모든 모달을 감시
  const modals = document.querySelectorAll('.modal');
  modals.forEach((el) => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
};

// DOM 준비 후 실행
document.addEventListener('DOMContentLoaded', () => {
  // 썸네일 webp + lazy
  patchGridThumbnails();

  // 모달 오픈 시점에 모달 내부 이미지 webp 로드
  bindModalOpenHandler();
});
