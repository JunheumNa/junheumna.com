/* modal-router-fixed.js
 * Fix deep-link modal routing and history so closing a modal always returns to '/' cleanly.
 * - Opening a grid item pushes '/gallery/{id}'.
 * - On hard-refresh of '/gallery/{id}', 404.html should redirect to '/?photoId={id}' via replaceState.
 *   This script reads that param and opens the modal.
 * - Closing via the 'X' button (or Escape) cleans URL to '/' using history.replaceState, avoiding
 *   getting stuck on '/?photoId=...'. See: MDN History.replaceState.
 */
(function () {
  // Utility
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // Collect anchors and matching modals
  var anchors = qsa('.grid-item a[data-photo-id]');
  var modals = new Map();
  anchors.forEach(function (a) {
    var id = a.getAttribute('data-photo-id');
    var m = document.getElementById('modal-' + id);
    if (m) modals.set(String(id), m);
  });

  function anyOpen() {
    var open = null;
    modals.forEach(function (m, id) { if (m.classList.contains('is-open')) open = id; });
    return open;
  }

  function closeAllModals() {
    modals.forEach(function (m) {
      m.classList.remove('is-open');
      m.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }

  function openById(id, fromPopstate) {
    closeAllModals();
    var target = modals.get(String(id));
    if (!target) return;

    if (target.parentElement !== document.body) {
      document.body.appendChild(target);
    }
    target.classList.add('is-open');
    target.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // When user opens by clicking, reflect deep link
    if (!fromPopstate) {
      // Use pushState so Back key goes to the previous page (or '/')
      window.history.pushState({ photoId: id }, '', '/gallery/' + id);
    }
  }

  function cleanToRoot() {
    // Always replace the current entry with '/' so that we don't resurrect '?photoId=..' entries.
    // This avoids getting stuck on previously redirected states.
    window.history.replaceState({}, '', '/');
  }

  function closeCurrentModal(fromPopstate) {
    var hadOpen = !!anyOpen();
    closeAllModals();

    // If user pressed Back (we're in a popstate unwind), do nothing else with history.
    if (fromPopstate) return;

    // If user clicked 'X' or pressed Escape, normalize URL to '/'
    // instead of history.back() to prevent returning to '?photoId=..' states.
    if (hadOpen) {
      cleanToRoot();
    }
  }

  function parsePhotoIdFromURL() {
    // Support '/gallery/{id}' (if served directly with a static fallback) or '?photoId={id}' (after 404 redirect)
    var pathMatch = window.location.pathname.match(/\/gallery\/([^/]+)$/);
    if (pathMatch) return pathMatch[1];
    var sp = new URLSearchParams(window.location.search);
    return sp.get('photoId');
  }

  // Wire up grid anchors
  anchors.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var id = a.getAttribute('data-photo-id');
      openById(id, false);
    });
  });

  // Close buttons
  qsa('[data-modal-close]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      closeCurrentModal(false);
    });
  });

  // Esc key to close
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCurrentModal(false);
  });

  // Handle back/forward
  window.addEventListener('popstate', function () {
    var pid = parsePhotoIdFromURL();
    if (pid) openById(pid, true);
    else closeCurrentModal(true);
  });

  // Initial deep link
  var initial = parsePhotoIdFromURL();
  if (initial) {
    // Open without pushing; URL already represents deep-link
    openById(initial, true);
  }
})();