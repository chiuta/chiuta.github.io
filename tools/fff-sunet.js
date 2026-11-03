/* fff-sunet · Peisaj sonor FFF — mixer unic (Web Audio) pentru aplicațiile de sunet: straturi sintetizate local, profile „dormit / studiu / preparat”, oprire automată cu fade-out, export/import `sound/profile` și randare WAV.
 * Sursa canonică e ACEST fișier (tools/fff-sunet.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Nu face nicio afirmație despre efecte asupra somnului, atenției sau sănătății: profilele sunt presetări de preferință. Plicul poartă evidence nivel 2 („studii mici/preliminare, rezultate mixte”)
 * ca nivel MAXIM susținut, aceeași limită ca în catalog pentru ASMR. Începe încet (volum general 20%), fade-in 3 s, limitator pe ieșire. Fără rețea, fără fișiere audio externe. */
(function (root, factory) {
  var S = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = S;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.soundscape = S; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var LAYERS = ['white', 'pink', 'brown', 'rain', 'waves', 'wind', 'drone', 'tone'];
  var MASTER_MAX = 0.6, FADE_IN = 3, FADE_OUT = 8, TIMERS = [0, 15, 30, 45, 60, 90], TONE_MIN = 20, TONE_MAX = 2000;
  /** Profile = presetări de preferință (nu tratamente). Valori 0–1 pe strat. */
  var PROFILES = {
    dormit: { master: 0.2, timer: 45, layers: { brown: 0.55, waves: 0.35 }, tone: 110 },
    studiu: { master: 0.2, timer: 0, layers: { pink: 0.4, rain: 0.3 }, tone: 110 },
    preparat: { master: 0.22, timer: 0, layers: { pink: 0.25, wind: 0.2, drone: 0.2 }, tone: 110 }
  };
  var I18N = {
    ro: { open: 'Peisaj sonor', title: 'Peisaj sonor', play: 'Pornește', stop: 'Oprește', master: 'Volum general', timer: 'Oprire automată', off: 'fără', min: '{n} min', profiles: 'Profile (presetări)', dormit: 'Dormit', studiu: 'Studiu', preparat: 'Preparat (gătit)', white: 'Zgomot alb', pink: 'Zgomot roz', brown: 'Zgomot brun', rain: 'Ploaie', waves: 'Valuri', wind: 'Vânt', drone: 'Bază gravă', tone: 'Ton pur', hz: 'Frecvența tonului (Hz)', note: 'Profilele sunt preferințe personale, nu tratamente. Dovezile pentru efectul sunetelor de fundal asupra somnului sau concentrării sunt limitate și mixte. Începe încet; nu folosi la volan.', send: 'Peisaj · Trimite', recv: 'Peisaj · Primește', wav: 'Randează 30 s în WAV', wavok: 'WAV de 30 s salvat.', imported: 'Peisaj sonor importat.', bad: 'Plic de peisaj sonor invalid.', close: 'Închide', running: 'Se aude', stopped: 'Oprit', nosupport: 'Acest browser nu are Web Audio.', fade: 'Se oprește în curând…' },
    en: { open: 'Soundscape', title: 'Soundscape', play: 'Start', stop: 'Stop', master: 'Master volume', timer: 'Auto stop', off: 'off', min: '{n} min', profiles: 'Profiles (presets)', dormit: 'Sleep', studiu: 'Study', preparat: 'Cooking', white: 'White noise', pink: 'Pink noise', brown: 'Brown noise', rain: 'Rain', waves: 'Waves', wind: 'Wind', drone: 'Low drone', tone: 'Pure tone', hz: 'Tone frequency (Hz)', note: 'Profiles are personal preferences, not treatments. Evidence that background sound affects sleep or concentration is limited and mixed. Start quietly; do not use while driving.', send: 'Soundscape · Send', recv: 'Soundscape · Receive', wav: 'Render 30 s to WAV', wavok: '30 s WAV saved.', imported: 'Soundscape imported.', bad: 'Invalid soundscape envelope.', close: 'Close', running: 'Playing', stopped: 'Stopped', nosupport: 'This browser has no Web Audio.', fade: 'Stopping soon…' },
    fr: { open: 'Paysage sonore', title: 'Paysage sonore', play: 'Démarrer', stop: 'Arrêter', master: 'Volume général', timer: 'Arrêt automatique', off: 'aucun', min: '{n} min', profiles: 'Profils (préréglages)', dormit: 'Sommeil', studiu: 'Étude', preparat: 'Cuisine', white: 'Bruit blanc', pink: 'Bruit rose', brown: 'Bruit brun', rain: 'Pluie', waves: 'Vagues', wind: 'Vent', drone: 'Bourdon grave', tone: 'Son pur', hz: 'Fréquence du son (Hz)', note: 'Les profils sont des préférences personnelles, pas des traitements. Les preuves d’un effet des sons de fond sur le sommeil ou la concentration sont limitées et mitigées. Commencez doucement ; ne pas utiliser au volant.', send: 'Paysage · Envoyer', recv: 'Paysage · Recevoir', wav: 'Rendre 30 s en WAV', wavok: 'WAV de 30 s enregistré.', imported: 'Paysage sonore importé.', bad: 'Enveloppe de paysage sonore invalide.', close: 'Fermer', running: 'En lecture', stopped: 'Arrêté', nosupport: 'Ce navigateur n’a pas Web Audio.', fade: 'Arrêt imminent…' },
    it: { open: 'Paesaggio sonoro', title: 'Paesaggio sonoro', play: 'Avvia', stop: 'Ferma', master: 'Volume generale', timer: 'Arresto automatico', off: 'no', min: '{n} min', profiles: 'Profili (preset)', dormit: 'Sonno', studiu: 'Studio', preparat: 'Cucina', white: 'Rumore bianco', pink: 'Rumore rosa', brown: 'Rumore marrone', rain: 'Pioggia', waves: 'Onde', wind: 'Vento', drone: 'Bordone grave', tone: 'Tono puro', hz: 'Frequenza del tono (Hz)', note: 'I profili sono preferenze personali, non trattamenti. Le prove dell’effetto dei suoni di fondo su sonno o concentrazione sono limitate e contrastanti. Inizia piano; non usare alla guida.', send: 'Paesaggio · Invia', recv: 'Paesaggio · Ricevi', wav: 'Renderizza 30 s in WAV', wavok: 'WAV da 30 s salvato.', imported: 'Paesaggio sonoro importato.', bad: 'Busta di paesaggio sonoro non valida.', close: 'Chiudi', running: 'In riproduzione', stopped: 'Fermo', nosupport: 'Questo browser non ha Web Audio.', fade: 'Arresto imminente…' },
    es: { open: 'Paisaje sonoro', title: 'Paisaje sonoro', play: 'Iniciar', stop: 'Detener', master: 'Volumen general', timer: 'Parada automática', off: 'no', min: '{n} min', profiles: 'Perfiles (preajustes)', dormit: 'Dormir', studiu: 'Estudio', preparat: 'Cocina', white: 'Ruido blanco', pink: 'Ruido rosa', brown: 'Ruido marrón', rain: 'Lluvia', waves: 'Olas', wind: 'Viento', drone: 'Bordón grave', tone: 'Tono puro', hz: 'Frecuencia del tono (Hz)', note: 'Los perfiles son preferencias personales, no tratamientos. Las pruebas de que el sonido de fondo afecte al sueño o la concentración son limitadas y mixtas. Empieza bajo; no lo uses conduciendo.', send: 'Paisaje · Enviar', recv: 'Paisaje · Recibir', wav: 'Renderizar 30 s a WAV', wavok: 'WAV de 30 s guardado.', imported: 'Paisaje sonoro importado.', bad: 'Sobre de paisaje sonoro no válido.', close: 'Cerrar', running: 'Sonando', stopped: 'Detenido', nosupport: 'Este navegador no tiene Web Audio.', fade: 'Se detendrá pronto…' },
    pt: { open: 'Paisagem sonora', title: 'Paisagem sonora', play: 'Iniciar', stop: 'Parar', master: 'Volume geral', timer: 'Paragem automática', off: 'não', min: '{n} min', profiles: 'Perfis (predefinições)', dormit: 'Dormir', studiu: 'Estudo', preparat: 'Cozinha', white: 'Ruído branco', pink: 'Ruído rosa', brown: 'Ruído castanho', rain: 'Chuva', waves: 'Ondas', wind: 'Vento', drone: 'Bordão grave', tone: 'Tom puro', hz: 'Frequência do tom (Hz)', note: 'Os perfis são preferências pessoais, não tratamentos. As provas de que o som de fundo afeta o sono ou a concentração são limitadas e mistas. Comece baixo; não use ao conduzir.', send: 'Paisagem · Enviar', recv: 'Paisagem · Receber', wav: 'Renderizar 30 s em WAV', wavok: 'WAV de 30 s guardado.', imported: 'Paisagem sonora importada.', bad: 'Envelope de paisagem sonora inválido.', close: 'Fechar', running: 'A tocar', stopped: 'Parado', nosupport: 'Este navegador não tem Web Audio.', fade: 'A parar em breve…' },
    hu: { open: 'Hangtáj', title: 'Hangtáj', play: 'Indítás', stop: 'Leállítás', master: 'Főhangerő', timer: 'Automatikus leállítás', off: 'ki', min: '{n} perc', profiles: 'Profilok (előbeállítások)', dormit: 'Alvás', studiu: 'Tanulás', preparat: 'Főzés', white: 'Fehér zaj', pink: 'Rózsaszín zaj', brown: 'Barna zaj', rain: 'Eső', waves: 'Hullámok', wind: 'Szél', drone: 'Mély zümmögés', tone: 'Tiszta hang', hz: 'A hang frekvenciája (Hz)', note: 'A profilok személyes preferenciák, nem kezelések. A háttérhangok alvásra vagy koncentrációra gyakorolt hatásáról szóló bizonyítékok korlátozottak és vegyesek. Kezdj halkan; vezetés közben ne használd.', send: 'Hangtáj · Küldés', recv: 'Hangtáj · Fogadás', wav: '30 mp renderelése WAV-ba', wavok: '30 mp-es WAV mentve.', imported: 'Hangtáj importálva.', bad: 'Érvénytelen hangtáj-boríték.', close: 'Bezárás', running: 'Szól', stopped: 'Leállítva', nosupport: 'Ez a böngésző nem támogatja a Web Audiót.', fade: 'Hamarosan leáll…' },
    de: { open: 'Klanglandschaft', title: 'Klanglandschaft', play: 'Starten', stop: 'Stoppen', master: 'Gesamtlautstärke', timer: 'Automatisch stoppen', off: 'aus', min: '{n} Min.', profiles: 'Profile (Voreinstellungen)', dormit: 'Schlaf', studiu: 'Lernen', preparat: 'Kochen', white: 'Weißes Rauschen', pink: 'Rosa Rauschen', brown: 'Braunes Rauschen', rain: 'Regen', waves: 'Wellen', wind: 'Wind', drone: 'Tiefer Bordun', tone: 'Reiner Ton', hz: 'Tonfrequenz (Hz)', note: 'Profile sind persönliche Vorlieben, keine Behandlungen. Belege dafür, dass Hintergrundklänge Schlaf oder Konzentration beeinflussen, sind begrenzt und uneinheitlich. Leise beginnen; nicht beim Autofahren verwenden.', send: 'Klang · Senden', recv: 'Klang · Empfangen', wav: '30 s als WAV rendern', wavok: '30-s-WAV gespeichert.', imported: 'Klanglandschaft importiert.', bad: 'Ungültiger Klanglandschafts-Umschlag.', close: 'Schließen', running: 'Spielt', stopped: 'Gestoppt', nosupport: 'Dieser Browser hat kein Web Audio.', fade: 'Stoppt gleich…' }
  };
  function lang() { var l = ''; try { l = (root.document && root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = I18N[lang()][k] || I18N.en[k] || k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var clamp = function (x, a, b) { x = +x; return isFinite(x) ? Math.min(b, Math.max(a, x)) : a; };

  /** Stare: {v:1, master:0..0.6, timer:minute (0 = fără), tone:Hz, layers:{id:0..1}}. Orice altceva e eliminat. */
  function cleanState(x) {
    var s = { v: 1, master: 0.2, timer: 0, tone: 110, layers: {} }; if (!x || typeof x !== 'object') return s;
    s.master = clamp(x.master == null ? 0.2 : x.master, 0, MASTER_MAX); s.timer = TIMERS.indexOf(+x.timer) >= 0 ? +x.timer : 0; s.tone = clamp(x.tone == null ? 110 : x.tone, TONE_MIN, TONE_MAX);
    var l = x.layers && typeof x.layers === 'object' ? x.layers : {}; LAYERS.forEach(function (id) { var g = clamp(l[id], 0, 1); if (g > 0) s.layers[id] = Math.round(g * 100) / 100; }); return s;
  }
  function profile(name) { var p = PROFILES[name]; return p ? cleanState({ master: p.master, timer: p.timer, tone: p.tone, layers: p.layers }) : null; }

  /* ---------- zgomote (buffere buclate) ---------- */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  /** Generează `n` eșantioane de zgomot alb / roz (Kellet) / brun (integrat), normalizate la vârf 0,9. Determinist (seed). */
  function noise(kind, n, seed) {
    var f = Math.min(2048, n >> 2), m = n + f, r = rng(seed || 12345), x = new Float32Array(m), i, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, w;
    for (i = 0; i < m; i++) {
      w = r() * 2 - 1;
      if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; }
      else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; x[i] = last; }
      else x[i] = w;
    }
    // buclă fără salt: începutul se amestecă cu continuarea naturală a finalului (x[n..n+f)), deci y[n-1] → y[0] e continuu
    var a = new Float32Array(n), peak = 1e-9; for (i = 0; i < n; i++) a[i] = x[i];
    for (i = 0; i < f; i++) { var t = i / f; a[i] = x[i] * t + x[n + i] * (1 - t); }
    for (i = 0; i < n; i++) if (Math.abs(a[i]) > peak) peak = Math.abs(a[i]);
    var g = 0.9 / peak; for (i = 0; i < n; i++) a[i] *= g;
    return a;
  }

  /* ---------- motor ---------- */
  function Ctor() { return root.AudioContext || root.webkitAudioContext || null; }
  /** Construiește graful într-un context (online sau offline). Întoarce {master, layers:{id:{gain,stop}}, stop()}. */
  function build(ctx, state, dest) {
    var st = cleanState(state), out = ctx.createGain(), lim = ctx.createDynamicsCompressor(), srcs = [], sr = ctx.sampleRate || 44100;
    out.gain.value = 0; lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25; out.connect(lim); lim.connect(dest || ctx.destination);
    var bufs = {};
    function buf(kind, sec) { var k = kind + sec; if (bufs[k]) return bufs[k]; var n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr); b.getChannelData(0).set(noise(kind, n, kind === 'white' ? 1 : kind === 'pink' ? 2 : 3)); return (bufs[k] = b); }
    function src(kind, sec) { var s = ctx.createBufferSource(); s.buffer = buf(kind, sec || 6); s.loop = true; srcs.push(s); return s; }
    function lfo(freq, depth, target) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); srcs.push(o); return o; }
    var L = {};
    function layer(id, makeSource) { var g = ctx.createGain(); g.gain.value = st.layers[id] || 0; g.connect(out); makeSource(g); L[id] = { gain: g }; }
    layer('white', function (g) { src('white').connect(g); });
    layer('pink', function (g) { src('pink').connect(g); });
    layer('brown', function (g) { src('brown').connect(g); });
    layer('rain', function (g) { var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; var a = ctx.createGain(); a.gain.value = 0.8; lfo(0.23, 0.15, a.gain); src('pink', 5).connect(f); f.connect(a); a.connect(g); });
    layer('waves', function (g) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; var a = ctx.createGain(); a.gain.value = 0.55; lfo(0.09, 0.45, a.gain); src('brown', 7).connect(f); f.connect(a); a.connect(g); });
    layer('wind', function (g) { var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.value = 450; lfo(0.07, 260, f.frequency); var a = ctx.createGain(); a.gain.value = 0.9; src('pink', 8).connect(f); f.connect(a); a.connect(g); });
    layer('drone', function (g) { [55, 55.4, 82.4].forEach(function (fq, i) { var o = ctx.createOscillator(), q = ctx.createGain(); o.type = 'sine'; o.frequency.value = fq; q.gain.value = i === 2 ? 0.18 : 0.3; o.connect(q); q.connect(g); srcs.push(o); }); });
    var tone = ctx.createOscillator(); tone.type = 'sine'; tone.frequency.value = st.tone; srcs.push(tone);
    layer('tone', function (g) { var q = ctx.createGain(); q.gain.value = 0.35; tone.connect(q); q.connect(g); });
    srcs.forEach(function (s) { try { s.start(0); } catch (e) { /* */ } });
    return {
      master: out, layers: L, tone: tone,
      set: function (id, v) { if (L[id]) L[id].gain.gain.value = clamp(v, 0, 1); },
      setMaster: function (v) { try { out.gain.cancelScheduledValues(ctx.currentTime); } catch (e) { /* */ } out.gain.value = clamp(v, 0, MASTER_MAX); },
      setTone: function (f) { tone.frequency.value = clamp(f, TONE_MIN, TONE_MAX); },
      fadeTo: function (v, sec) { var t = ctx.currentTime; try { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(clamp(v, 0, MASTER_MAX), t + sec); } catch (e) { out.gain.value = clamp(v, 0, MASTER_MAX); } },
      stop: function () { srcs.forEach(function (s) { try { s.stop(); } catch (e) { /* */ } try { s.disconnect(); } catch (e) { /* */ } }); try { out.disconnect(); lim.disconnect(); } catch (e) { /* */ } }
    };
  }

  var cur = null, timerId = 0, state = cleanState(profile('studiu')), listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(api.isPlaying(), state); } catch (e) { /* */ } }); }
  function on(f) { listeners.push(f); }
  function apply(s) { state = cleanState(s); if (cur) { LAYERS.forEach(function (id) { cur.graph.set(id, state.layers[id] || 0); }); cur.graph.setMaster(state.master); cur.graph.setTone(state.tone); schedule(); } emit(); return state; }
  function schedule() {
    clearTimeout(timerId); timerId = 0; if (!cur || !state.timer) return;
    var ms = state.timer * 60000; timerId = setTimeout(function () { fadeStop(); }, ms);
  }
  function fadeStop() { if (!cur) return; var c = cur; c.graph.fadeTo(0, FADE_OUT); setTimeout(function () { if (cur === c) stop(); }, FADE_OUT * 1000 + 100); }
  /** Pornește (necesită gest al utilizatorului pentru AudioContext). */
  function start() {
    if (cur) return true; var C = Ctor(); if (!C) return false;
    var ctx = new C(); var g = build(ctx, state); cur = { ctx: ctx, graph: g };
    try { if (ctx.resume) ctx.resume(); } catch (e) { /* */ }
    g.fadeTo(state.master, FADE_IN); schedule(); emit(); return true;
  }
  function stop() { clearTimeout(timerId); timerId = 0; if (!cur) return; var c = cur; cur = null; try { c.graph.stop(); } catch (e) { /* */ } try { c.ctx.close(); } catch (e) { /* */ } emit(); }

  /** Randează `sec` secunde din starea curentă într-un WAV PCM16 mono (OfflineAudioContext). Întoarce Promise<Blob>. */
  function renderWav(sec, s) {
    var OC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OC) return Promise.reject(new Error('fără OfflineAudioContext'));
    var st = cleanState(s || state), sr = 22050, ctx = new OC(1, Math.floor(sr * clamp(sec || 30, 1, 120)), sr), g = build(ctx, st); g.master.gain.value = st.master;
    return ctx.startRendering().then(function (b) { return wavBlob(b.getChannelData(0), sr); });
  }
  function wavBlob(f32, sr) {
    var n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i;
    function w(o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* ---------- plic ---------- */
  function envelope(app) {
    var E = root.FFF && root.FFF.envelope; if (!E) throw new Error('fără FFF.envelope');
    return E.create({ type: 'sound/profile', title: tr('title'), payload: cleanState(state), app: app || 'FFF', source: { label: app || 'FFF' }, evidence: { level: 2, note: 'preferință personală; efecte asupra somnului/concentrării: studii mici, rezultate mixte' }, lang: lang() });
  }
  function fromEnvelope(env) { return env && env.type === 'sound/profile' && env.payload && env.payload.v === 1 ? cleanState(env.payload) : null; }

  /* ---------- interfață ---------- */
  var CSS = '.fffs-fab{position:fixed;right:12px;bottom:12px;z-index:2147483001;min-height:44px;min-width:44px;padding:8px 14px;border:2px solid CanvasText;border-radius:22px;background:Canvas;color:CanvasText;font:600 14px system-ui;cursor:pointer;box-shadow:0 2px 8px #0003}' +
    '.fffs-box{position:fixed;right:12px;bottom:72px;z-index:2147482999;width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 92px);overflow:auto;background:Canvas;color:CanvasText;border:2px solid CanvasText;border-radius:12px;padding:14px;font:14px/1.4 system-ui;box-shadow:0 6px 24px #0005}' +
    '.fffs-box h2{font:700 16px system-ui;margin:0 0 6px}.fffs-box label{display:block;margin:8px 0 2px;font-weight:600}.fffs-box input[type=range],.fffs-box select,.fffs-box input[type=number]{box-sizing:border-box;width:100%;font:inherit;color:CanvasText;background:Canvas;min-height:32px}' +
    '.fffs-box button{min-height:44px;min-width:44px;padding:6px 12px;margin:4px 6px 4px 0;font:inherit;color:CanvasText;background:Canvas;border:1px solid CanvasText;border-radius:8px;cursor:pointer}.fffs-box button.fffs-pri{background:CanvasText;color:Canvas}.fffs-row{display:flex;flex-wrap:wrap}.fffs-box p{margin:8px 0;font-size:13px}';
  function el(tag, attrs, kids) { var d = root.document, n = d.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); } (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); }); return n; }
  function css() { var d = root.document; if (d.getElementById('fffs-css')) return; var s = d.createElement('style'); s.id = 'fffs-css'; s.textContent = CSS; d.head.appendChild(s); }
  function toast(t) { var E = root.FFF && root.FFF.envelope; if (E && E.toast) E.toast(t); }
  function panel(o) {
    var d = root.document, E = root.FFF && root.FFF.envelope; css(); var old = d.getElementById('fffs-panel'); if (old) { old.remove(); return null; }
    var box = el('div', { 'class': 'fffs-box', role: 'dialog', 'aria-label': tr('title'), id: 'fffs-panel' }), live = el('p', { role: 'status', id: 'fffs-status' });
    function sl(id, label, min, max, step, val, fn, vt) {
      var i = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(val) }); i.addEventListener('input', function () { fn(+i.value); i.setAttribute('aria-valuetext', vt ? vt(+i.value) : Math.round(+i.value * 100) + '%'); });
      i.setAttribute('aria-valuetext', vt ? vt(+val) : Math.round(+val * 100) + '%'); return [el('label', { 'for': id, text: label }), i];
    }
    function draw() {
      box.textContent = ''; box.appendChild(el('h2', { text: tr('title') }));
      var Cx = Ctor(); if (!Cx) { box.appendChild(el('p', { text: tr('nosupport') })); return; }
      var play = el('button', { type: 'button', 'class': 'fffs-pri', id: 'fffsPlay', text: api.isPlaying() ? tr('stop') : tr('play') }); play.addEventListener('click', function () { if (api.isPlaying()) stop(); else start(); draw(); });
      var bar = el('div', { 'class': 'fffs-row' }, [play]); box.appendChild(bar);
      live.textContent = api.isPlaying() ? tr('running') : tr('stopped'); box.appendChild(live);
      box.appendChild(el('h3', { text: tr('profiles'), style: 'font:700 14px system-ui;margin:8px 0 0' }));
      var pr = el('div', { 'class': 'fffs-row' }); Object.keys(PROFILES).forEach(function (k) { var b = el('button', { type: 'button', 'data-profile': k, text: tr(k) }); b.addEventListener('click', function () { apply(profile(k)); draw(); }); pr.appendChild(b); }); box.appendChild(pr);
      sl('fffsMaster', tr('master'), 0, MASTER_MAX, 0.01, state.master, function (v) { state.master = v; if (cur) cur.graph.setMaster(v); }).forEach(function (n) { box.appendChild(n); });
      LAYERS.filter(function (id) { return id !== 'tone'; }).forEach(function (id) { sl('fffsL-' + id, tr(id), 0, 1, 0.01, state.layers[id] || 0, function (v) { if (v > 0) state.layers[id] = v; else delete state.layers[id]; if (cur) cur.graph.set(id, v); }).forEach(function (n) { box.appendChild(n); }); });
      sl('fffsL-tone', tr('tone'), 0, 1, 0.01, state.layers.tone || 0, function (v) { if (v > 0) state.layers.tone = v; else delete state.layers.tone; if (cur) cur.graph.set('tone', v); }).forEach(function (n) { box.appendChild(n); });
      sl('fffsHz', tr('hz'), TONE_MIN, TONE_MAX, 1, state.tone, function (v) { state.tone = v; if (cur) cur.graph.setTone(v); }, function (v) { return v + ' Hz'; }).forEach(function (n) { box.appendChild(n); });
      var tm = el('select', { id: 'fffsTimer' }, TIMERS.map(function (m) { return el('option', { value: String(m), text: m ? tr('min', { n: m }) : tr('off') }); })); tm.value = String(state.timer); tm.addEventListener('change', function () { state.timer = +tm.value; schedule(); });
      box.appendChild(el('label', { 'for': 'fffsTimer', text: tr('timer') })); box.appendChild(tm);
      box.appendChild(el('p', { text: tr('note'), id: 'fffsNote' }));
      var row = el('div', { 'class': 'fffs-row' });
      if (E) {
        var sb = E.sendButton({ slug: o.slug, text: tr('send'), getEnv: function () { return envelope(o.app); } }); sb.id = 'fffsSend';
        var rb = E.importButton({ accepts: ['sound/profile'], text: tr('recv'), onReceive: function (env) { var s = fromEnvelope(env); if (!s) { toast(tr('bad')); return; } apply(s); toast(tr('imported')); draw(); } }); rb.id = 'fffsRecv'; row.appendChild(sb); row.appendChild(rb);
      }
      var wv = el('button', { type: 'button', id: 'fffsWav', text: tr('wav') }); wv.addEventListener('click', function () { renderWav(30).then(function (b) { var a = d.createElement('a'); a.href = root.URL.createObjectURL(b); a.download = 'peisaj-sonor.wav'; d.body.appendChild(a); a.click(); a.remove(); toast(tr('wavok')); }, function () { toast(tr('nosupport')); }); }); row.appendChild(wv);
      var cl = el('button', { type: 'button', id: 'fffsClose', text: tr('close') }); cl.addEventListener('click', function () { box.remove(); var f = d.getElementById('fffsFab'); if (f) f.focus(); }); row.appendChild(cl); box.appendChild(row);
    }
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { box.remove(); var f = d.getElementById('fffsFab'); if (f) f.focus(); } });
    on(function () { if (box.isConnected) { var s = d.getElementById('fffs-status'); if (s) s.textContent = api.isPlaying() ? tr('running') : tr('stopped'); var p = d.getElementById('fffsPlay'); if (p) p.textContent = api.isPlaying() ? tr('stop') : tr('play'); } });
    draw(); d.body.appendChild(box); var first = box.querySelector('button'); if (first) first.focus(); return box;
  }
  function mount(o) {
    var d = root.document; if (!d || !d.body || d.getElementById('fffsFab')) return null; css();
    var fab = el('button', { type: 'button', id: 'fffsFab', 'class': 'fffs-fab', text: tr('open'), 'aria-haspopup': 'dialog' }); fab.addEventListener('click', function () { panel(o); });
    d.body.appendChild(fab); return fab;
  }
  var api = { VERSION: 1, I18N: I18N, LAYERS: LAYERS, PROFILES: PROFILES, TIMERS: TIMERS, MASTER_MAX: MASTER_MAX, FADE_IN: FADE_IN, FADE_OUT: FADE_OUT, tr: tr, cleanState: cleanState, profile: profile, noise: noise, build: build,
    start: start, stop: stop, apply: apply, state: function () { return cleanState(state); }, isPlaying: function () { return !!cur; }, renderWav: renderWav, wavBlob: wavBlob, envelope: envelope, fromEnvelope: fromEnvelope, on: on, panel: panel, mount: mount };
  return api;
});
