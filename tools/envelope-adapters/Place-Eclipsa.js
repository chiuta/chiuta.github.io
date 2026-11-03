/* Locația comună FFF (fff-place) · Eclipsa-2027: locația comună ↔ calculatorul local de eclipsă. Calculatorul (ECL27.mount) se creează la prima deschidere; adaptorul îl înfășoară:
 * la creare primește locația comună, la schimbări o primește prin e27.setLocation, iar locul ales în calculator (onResult) devine locația comună. Fără a atinge codul aplicației. */
(function () {
  var P = window.FFF && FFF.place; if (!P || !window.ECL27 || typeof ECL27.mount !== 'function') return;
  var api = null, busy = false, same = function (a, b) { return a && b && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4; };
  function push(c) {
    if (!c || !api || busy) return; busy = true;
    try { var s = api.state(); if (!(s.lat != null && same({ lat: s.lat, lon: s.lon }, c))) api.setLocation(c.lat, c.lon, { name: c.name || '', zone: c.tz, source: 'list' }); } catch (e) { /* aplicația rămâne neschimbată */ }
    busy = false;
  }
  var mount0 = ECL27.mount;
  ECL27.mount = function (host, o) {
    o = o || {}; var res0 = o.onResult;
    o.onResult = function (l, r) {
      try { if (l && !busy && isFinite(l.lat) && isFinite(l.lon) && !same(P.get(), l)) { busy = true; P.set({ lat: l.lat, lon: l.lon, name: l.name || '', tz: l.zone || '', alt: l.elev || 0 }, 'manual'); busy = false; } } catch (e) { busy = false; }
      if (res0) return res0.apply(this, arguments);
    };
    api = mount0.call(this, host, o); window.__fffE27 = api; push(P.get()); return api;
  };
  P.onChange(push, false);
})();
