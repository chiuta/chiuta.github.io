/* Locația comună FFF (fff-place) · Bolta: locația comună ↔ locul planetariului (applyPlace). */
(function () {
  var P = window.FFF && FFF.place; if (!P) return;
  var busy = false, same = function (a, b) { return a && b && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4; };
  function push(c) {
    if (!c || busy || typeof window.applyPlace !== 'function') return; busy = true;
    try { if (!(typeof S !== 'undefined' && S.place && same(S.place, c))) window.applyPlace({ name: c.name || (c.lat.toFixed(2) + ', ' + c.lon.toFixed(2)), lat: c.lat, lon: c.lon, elev: c.alt || 0, tz: c.tz }, null); } catch (e) { /* aplicația rămâne neschimbată */ }
    busy = false;
  }
  if (typeof window.applyPlace === 'function') {
    var ap0 = window.applyPlace;
    window.applyPlace = function (p, note, transient) {
      var r = ap0.apply(this, arguments);
      try { var np = typeof S !== 'undefined' && S.place; if (!busy && !transient && np && !same(np, P.get())) { busy = true; P.set({ lat: np.lat, lon: np.lon, name: np.name, tz: np.tz, alt: np.elev || 0 }, 'manual'); busy = false; } } catch (e) { busy = false; }
      return r;
    };
  }
  function go() { setTimeout(function () { P.onChange(push); }, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
