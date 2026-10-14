// Shim minimal al lui FFF.core, DOAR pentru testele modulelor independente (kit-ul real: src/core.js).
(function () {
  const F = (window.FFF = window.FFF || {});
  const SUP = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
  F._i18n = F._i18n || {};
  F.registerI18n = F.registerI18n || function (mod, obj) { F._i18n[mod] = obj; };
  F.lang = F.lang || function () {
    const l = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
    return SUP.includes(l) ? l : 'en';
  };
  F.t = F.t || function (mod, key, vars) {
    const d = (F._i18n[mod] || {});
    let s = ((d[F.lang()] || {})[key]) ?? ((d.en || {})[key]) ?? key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  };
  const mem = {};
  F.store = F.store || {
    get(k, d) { try { const v = localStorage.getItem('fff.test.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { try { localStorage.setItem('fff.test.' + k, JSON.stringify(v)); } catch (e) { mem[k] = v; } },
    remove(k) { try { localStorage.removeItem('fff.test.' + k); } catch (e) { delete mem[k]; } },
    keys() { try { return Object.keys(localStorage).filter(x => x.startsWith('fff.test.')).map(x => x.slice(9)); } catch (e) { return Object.keys(mem); } }
  };
  const L = {};
  F.bus = F.bus || { on(e, f) { (L[e] = L[e] || []).push(f); }, emit(e, d) { (L[e] || []).forEach(f => f(d)); } };
  F.download = F.download || function (name, data, mime) { const b = data instanceof Blob ? data : new Blob([data], {type: mime || 'application/octet-stream'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  F.sha256 = F.sha256 || async function (x) { const b = typeof x === 'string' ? new TextEncoder().encode(x) : x; const h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map(v => v.toString(16).padStart(2, '0')).join(''); };
})();
