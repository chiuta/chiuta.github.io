/* Adaptor FFF · VaultCrypt: fila „Chei API” = seiful comun de chei (PBKDF2 + AES-GCM, protejat cu parolă). Cheile se trimit către Nexus / AI Liber / ARENA
 * ca plic keys/vault (fișier, clipboard, cod QR, altă filă), nu prin link. Cheile în clar nu se scriu niciodată în localStorage. */
(function () {
  if (!(window.FFF && window.FFF.envelope && window.FFFSeif && FFF.store)) return;
  var nav = document.querySelector('nav.tabs'), last = document.getElementById('view-tools');
  if (!nav || !last || document.getElementById('view-keys')) return;
  var lang = (document.documentElement.lang || 'en').slice(0, 2), TAB = { ro: 'Chei API', en: 'API keys', fr: 'Clés API', it: 'Chiavi API', es: 'Claves API', pt: 'Chaves API', de: 'API-Schlüssel', hu: 'API-kulcsok' };
  var tab = document.createElement('button'); tab.className = 'tab'; tab.setAttribute('data-tab', 'keys'); tab.setAttribute('data-act', 'showTab'); tab.setAttribute('data-arg', 'keys');
  var ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = '🔑'; var lb = document.createElement('span'); lb.textContent = TAB[lang] || TAB.en;
  tab.appendChild(ic); tab.appendChild(lb); nav.appendChild(tab);
  var sec = document.createElement('section'); sec.className = 'view'; sec.id = 'view-keys'; last.parentNode.insertBefore(sec, last.nextSibling);
  FFFSeif.panel({ host: sec, store: FFF.store, app: 'VaultCrypt' });
})();
