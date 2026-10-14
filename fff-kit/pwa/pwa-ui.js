/* fff-kit / pwa-ui.js — buton „Instalează” pentru eticheta de transparență (FFF.label) sau orice container.
 * Modul opțional; îl injectează nucleul (build.mjs), NU pwa.mjs. IIFE, fără rețea, fără handlere inline.
 *
 * API (FFF.pwa):
 *   FFF.pwa.supported()   → true dacă pagina e într-un context în care instalarea e posibilă (https/localhost + service worker)
 *   FFF.pwa.installed()   → true dacă rulează deja ca aplicație instalată (display-mode: standalone / navigator.standalone)
 *   FFF.pwa.canInstall()  → true dacă browserul a emis `beforeinstallprompt` și solicitarea nu a fost folosită încă
 *   FFF.pwa.install()     → Promise<'accepted'|'dismissed'|'unavailable'> (declanșează dialogul nativ; doar la gest al utilizatorului)
 *   FFF.pwa.mount(el)     → adaugă în `el` un buton „Instalează” (ascuns când nu e posibil) + indiciu iOS; returnează funcția de demontare
 *   FFF.bus 'pwa:state'   → emis la orice schimbare (disponibil / instalat); detaliu: {canInstall, installed}
 *
 * Limite reale: `beforeinstallprompt` există doar în Chromium (Chrome, Edge, Opera, Android). Safari/iOS nu îl au:
 * acolo butonul arată doar instrucțiunea „Partajează → Adaugă pe ecranul principal”. Firefox desktop nu instalează PWA.
 * Din file:// nimic nu e disponibil și butonul rămâne ascuns.
 * Textele vin din FFF.t('pwa', cheie) (vezi pwa-ui.i18n.json, 8 limbi; fr/it/es/pt/hu/de neverificate nativ); fallback în engleză.
 */
(function () {
  'use strict';
  var FFF = window.FFF = window.FFF || {};
  var deferred = null, installedFlag = false, mounts = [];
  var FALLBACK = {
    install: 'Install', installed: 'Installed as an app', iosHint: 'On iPhone/iPad: Share → Add to Home Screen.',
    unavailable: 'Installation is available when served over https (not from a local file).'
  };
  function t(k) {
    try { if (FFF.t) { var v = FFF.t('pwa', k); if (v && v !== k && v.indexOf('pwa.') !== 0) return v; } } catch (e) {}
    return FALLBACK[k];
  }
  function supported() { return !!(window.isSecureContext && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)); }
  function installed() {
    try { return installedFlag || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
    catch (e) { return installedFlag; }
  }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function state() { return {canInstall: !!deferred, installed: installed()}; }
  function notify() {
    mounts.forEach(function (m) { m.render(); });
    try { FFF.bus && FFF.bus.emit('pwa:state', state()); } catch (e) {}
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', function () { installedFlag = true; deferred = null; notify(); });
  try { matchMedia('(display-mode: standalone)').addEventListener('change', notify); } catch (e) {}
  if (FFF.onLang) try { FFF.onLang(function () { mounts.forEach(function (m) { m.render(); }); }); } catch (e) {}

  function install() {
    if (!deferred) return Promise.resolve('unavailable');
    var d = deferred; deferred = null;
    return d.prompt().then(function () { return d.userChoice; }).then(function (c) {
      notify(); return c && c.outcome === 'accepted' ? 'accepted' : 'dismissed';
    }, function () { notify(); return 'dismissed'; });
  }

  function mount(el) {
    if (!el) return function () {};
    var wrap = document.createElement('div'); wrap.className = 'fff-pwa';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fff-pwa-btn';
    var note = document.createElement('p'); note.className = 'fff-pwa-note'; note.setAttribute('role', 'status');
    wrap.appendChild(btn); wrap.appendChild(note); el.appendChild(wrap);
    var m = {
      render: function () {
        btn.textContent = t('install');
        var st = state();
        if (!supported()) { wrap.hidden = true; return; }
        wrap.hidden = false;
        if (st.installed) { btn.hidden = true; note.textContent = t('installed'); }
        else if (st.canInstall) { btn.hidden = false; note.textContent = ''; }
        else { btn.hidden = true; note.textContent = isIOS() ? t('iosHint') : ''; if (!note.textContent) wrap.hidden = true; }
      }
    };
    btn.addEventListener('click', function () { install(); });
    mounts.push(m); m.render();
    return function () { mounts = mounts.filter(function (x) { return x !== m; }); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
  }

  FFF.pwa = {supported: supported, installed: installed, canInstall: function () { return !!deferred; }, install: install, mount: mount};
  if (FFF.registerI18n) try { FFF.registerI18n('pwa', FALLBACK); } catch (e) {}
})();
