/* fff-kit · FFF.p2p — multiplayer fără server (WebRTC cu semnalizare manuală).
 * Oferta/răspunsul = SDP comprimat (deflate, dacă există CompressionStream) + base64url, afișat ca text și ca QR
 * (un singur cod sau coduri QR succesive „i/n”). Fără rețea externă: implicit nu se folosește niciun server ICE;
 * un server STUN poate fi introdus de utilizator (opt-in). Depinde de FFF.core (FFF.t) și FFF.qr (pentru QR/scanare).
 * Limite: NAT simetric fără STUN/TURN nu se conectează; adresa IP (și cea locală) se vede celuilalt jucător.
 * Protocolul de joc: vezi docs/p2p.md. */
(function () {
  'use strict';
  const F = (window.FFF = window.FFF || {});
  const T = (k, v) => F.t('p2p', k, v);
  const MAX_MSG = 64 * 1024;
  const PREFIX = 'FFF1';
  const SINGLE_MAX = 600;      // cod de până la atâtea caractere → un singur QR
  const FRAME_LEN = 330;       // altfel: cadre QR succesive de cel mult atâtea caractere de sarcină

  const coded = (code, key, vars) => { const e = new Error(T(key || code, vars)); e.code = code; return e; };
  const supported = () => typeof RTCPeerConnection === 'function';

  /* ---------- cod de semnalizare ---------- */
  function toB64u(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64u(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '=';
    const bin = atob(str), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  async function through(bytes, stream) {
    const rs = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(rs).arrayBuffer());
  }
  /** Cod: FFF1.<o|a>.<z|r>.<b64url>;  z = deflate (zlib), r = brut (UTF-8). */
  async function encodeSignal(kind, sdp) {
    const raw = new TextEncoder().encode(String(sdp).replace(/\r\n/g, '\n').replace(/\n+$/, ''));
    let method = 'r', body = raw;
    if (typeof CompressionStream === 'function') {
      try { const z = await through(raw, new CompressionStream('deflate')); if (z.length < raw.length) { method = 'z'; body = z; } } catch (e) { /* brut */ }
    }
    return PREFIX + '.' + (kind === 'offer' ? 'o' : 'a') + '.' + method + '.' + toB64u(body);
  }
  /** Candidate ICE: format RFC 8839 strict, doar typ host/srflx/relay, adresă IP sau nume mDNS (*.local), port 1..65535, cel mult MAX_CAND. */
  const MAX_CAND = 32;
  const CAND_RE = /^a=candidate:[A-Za-z0-9+\/]{1,32} [12] (?:udp|tcp|UDP|TCP) \d{1,10} (\S{2,255}) (\d{1,5}) typ (host|srflx|relay)(?: raddr (\S{2,255}) rport (\d{1,5}))?(?: (?:tcptype (?:active|passive|so)|generation \d{1,3}|ufrag [A-Za-z0-9+\/]{1,256}|network-id \d{1,5}|network-cost \d{1,5}))*$/;
  function okAddr(a) {
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(a)) return a.split('.').every(x => +x <= 255);
    if (/^[0-9A-Fa-f:.]{2,45}$/.test(a) && a.includes(':')) return /^[0-9A-Fa-f:.]+$/.test(a) && (a.match(/::/g) || []).length <= 1;
    return /^[A-Za-z0-9-]{1,63}\.local$/.test(a);        // mDNS (Chrome ascunde IP-urile locale)
  }
  function validCandidates(lines) {
    let n = 0;
    for (const l of lines) {
      if (!l.startsWith('a=candidate:')) continue;
      if (++n > MAX_CAND) return false;
      const m = CAND_RE.exec(l);
      if (!m) return false;
      if (!okAddr(m[1]) || +m[2] < 1 || +m[2] > 65535) return false;
      if (m[4] !== undefined && (!okAddr(m[4]) || +m[5] > 65535)) return false;
    }
    return true;
  }
  async function decodeSignal(code) {
    code = String(code == null ? '' : code).replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
    if (code.length > 40000) throw coded('bad-code', 'badCode');
    const m = /^FFF1\.([oa])\.([zr])\.([A-Za-z0-9_-]+)$/.exec(code);
    if (!m) throw coded('bad-code', 'badCode');
    let bytes;
    try { bytes = fromB64u(m[3]); } catch (e) { throw coded('bad-code', 'badCode'); }
    if (m[2] === 'z') {
      if (typeof DecompressionStream !== 'function') throw coded('no-decompress', 'noDecompress');
      try { bytes = await through(bytes, new DecompressionStream('deflate')); } catch (e) { throw coded('bad-code', 'badCode'); }
    }
    let sdp;
    try { sdp = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch (e) { throw coded('bad-code', 'badCode'); }
    const lines = sdp.split('\n');
    if (lines[0] !== 'v=0' || lines.length > 400 || lines.some(l => !/^[a-z]=/.test(l))) throw coded('bad-code', 'badCode');
    if (!validCandidates(lines)) throw coded('bad-code', 'badCode');
    return {kind: m[1] === 'o' ? 'offer' : 'answer', sdp: lines.join('\r\n') + '\r\n'};
  }

  /* ---------- cadre QR succesive ---------- */
  function hash4(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(-4).padStart(4, '0'); }
  /** Împarte un cod în texte pentru QR: unul singur sau „FQ1.<id>.<i>.<n>.<parte>”. */
  function frames(code, o) {
    o = o || {};
    if (code.length <= (o.single || SINGLE_MAX)) return [code];
    const per = o.per || FRAME_LEN, n = Math.ceil(code.length / per), id = hash4(code), out = [];
    for (let i = 0; i < n; i++) out.push('FQ1.' + id + '.' + (i + 1) + '.' + n + '.' + code.slice(i * per, (i + 1) * per));
    return out;
  }
  function assembler() {
    let id = null, n = 0, parts = [];
    const have = () => parts.filter(Boolean).length;
    return {
      add(text) {
        text = String(text == null ? '' : text).trim();
        if (text.indexOf(PREFIX + '.') === 0) return {done: true, code: text, have: 1, total: 1};
        const m = /^FQ1\.([0-9a-z]{4})\.(\d{1,2})\.(\d{1,2})\.([\w.-]+)$/.exec(text);
        if (!m || +m[3] < 2 || +m[2] < 1 || +m[2] > +m[3]) return {done: false, ignored: true, have: have(), total: n};
        if (id !== m[1] || n !== +m[3]) { id = m[1]; n = +m[3]; parts = new Array(n); }
        parts[+m[2] - 1] = m[4];
        const h = have();
        if (h === n) { const code = parts.join(''); if (hash4(code) === id) return {done: true, code, have: h, total: n}; parts = new Array(n); return {done: false, ignored: true, have: 0, total: n, corrupt: true}; }
        return {done: false, have: h, total: n};
      },
      reset() { id = null; n = 0; parts = []; }
    };
  }

  /* ---------- configurare ICE ---------- */
  function parseStun(text) {
    const out = [];
    for (let tok of String(text == null ? '' : text).split(/[\s,;]+/)) {
      if (!tok) continue;
      if (!/^stuns?:/i.test(tok)) tok = 'stun:' + tok;
      if (!/^stuns?:(\[[0-9a-f:]+\]|[A-Za-z0-9._-]+)(:\d{1,5})?$/i.test(tok)) throw coded('stun-invalid', 'stunInvalid');
      out.push(tok);
    }
    if (out.length > 3) throw coded('stun-invalid', 'stunInvalid');
    return out;
  }
  function rtcConfig(opts) {
    const stun = Array.isArray(opts.stun) ? opts.stun.join(' ') : opts.stun;
    const urls = parseStun(stun);
    return {iceServers: urls.length ? [{urls}] : [], iceCandidatePoolSize: 0};
  }
  /** Așteaptă colectarea candidatelor ICE: „complete”, ori ≥ 1 candidat + o scurtă liniște (cu STUN: așteaptă mai mult un srflx). */
  function watchGathering(pc, opts) {
    const ms = opts.gatherTimeout || 4000, useStun = rtcConfig(opts).iceServers.length > 0;
    return new Promise(res => {
      let seen = 0, srflx = false, quiet = 0, tm = 0, done = false;
      const finish = () => {
        if (done) return; done = true; clearTimeout(quiet); clearTimeout(tm);
        pc.removeEventListener('icecandidate', onc); pc.removeEventListener('icegatheringstatechange', ong); res();
      };
      const onc = e => {
        if (!e.candidate) return finish();
        seen++; if (/ typ srflx/.test(e.candidate.candidate)) srflx = true;
        clearTimeout(quiet); quiet = setTimeout(finish, useStun && !srflx ? 2500 : 500);
      };
      const ong = () => { if (pc.iceGatheringState === 'complete') finish(); };
      pc.addEventListener('icecandidate', onc); pc.addEventListener('icegatheringstatechange', ong);
      tm = setTimeout(finish, ms);
      if (pc.iceGatheringState === 'complete') finish();
    });
  }

  /* ---------- sesiune ---------- */
  function createSession(role, pc, opts) {
    const hs = {}, hb = Object.assign({interval: 2000, timeout: 9000, giveUp: 30000, connect: 30000}, opts.heartbeat || {});
    let dc = null, state = 'new', closed = false, hbTimer = 0, connTimer = 0, lastSeen = 0, lostSince = 0, rtt = null, sent = 0, received = 0;
    const emit = (ev, a, b) => (hs[ev] || []).slice().forEach(f => { try { f(a, b); } catch (e) { console.error(e); } });
    const s = {
      role, offer: null, answer: null,
      get state() { return state; },
      get channel() { return dc; },
      get rtt() { return rtt; },
      get stats() { return {rtt, sent, received, lastSeen}; },
      get open() { return !!dc && dc.readyState === 'open' && !closed; },
      get iceServers() { try { return pc.getConfiguration().iceServers || []; } catch (e) { return []; } },
      on(ev, fn) { (hs[ev] = hs[ev] || []).push(fn); return () => s.off(ev, fn); },
      off(ev, fn) { hs[ev] = (hs[ev] || []).filter(f => f !== fn); },
      send(obj) {
        if (!s.open || obj == null || typeof obj !== 'object') return false;
        let str; try { str = JSON.stringify(obj); } catch (e) { return false; }
        if (str.length > MAX_MSG) { emit('error', coded('too-large', 'tooLarge')); return false; }
        try { dc.send(str); sent++; return true; } catch (e) { return false; }
      },
      close(reason) {
        if (closed) return;
        try { if (s.open) dc.send(JSON.stringify({_fff: 'bye'})); } catch (e) { /* ignorat */ }
        finish(reason || 'local', 50);
      },
      /** Reconectare manuală: gazda primește o sesiune nouă (cu ofertă nouă); oaspetele trebuie să dea oferta nouă. */
      reconnect(offerCode) {
        const o = Object.assign({}, opts); s.close('reconnect');
        return role === 'host' ? host(o) : join(offerCode, o);
      },
      _setState: set
    };
    function set(st) { if (state === st || closed && st !== 'closed') return; state = st; emit('state', st); }
    function finish(reason, delay) {
      if (closed) return; closed = true;
      clearInterval(hbTimer); clearTimeout(connTimer);
      const d = dc, p = pc;
      const shut = () => { try { d && d.close(); } catch (e) { /* ignorat */ } try { p.close(); } catch (e) { /* ignorat */ } };
      if (delay) setTimeout(shut, delay); else shut();
      state = reason === 'failed' || reason === 'timeout' ? 'failed' : 'closed';
      emit('state', state); emit('close', reason);
    }
    function internal(o) {
      if (o._fff === 'ping') { try { dc.send(JSON.stringify({_fff: 'pong', ts: o.ts})); } catch (e) { /* ignorat */ } }
      else if (o._fff === 'pong' && typeof o.ts === 'number') { rtt = Date.now() - o.ts; emit('latency', rtt); }
      else if (o._fff === 'bye') finish('remote');
    }
    function startHb() {
      clearInterval(hbTimer); lastSeen = Date.now();
      hbTimer = setInterval(() => {
        if (closed) return;
        try { if (s.open) dc.send(JSON.stringify({_fff: 'ping', ts: Date.now()})); } catch (e) { /* ignorat */ }
        const idle = Date.now() - lastSeen;
        if (idle > hb.timeout && state === 'open') { lostSince = Date.now(); set('lost'); emit('lost'); }
        else if (state === 'lost' && Date.now() - lostSince > hb.giveUp) finish('timeout');
      }, hb.interval);
    }
    s._bind = function (ch) {
      dc = ch;
      ch.onopen = () => { clearTimeout(connTimer); set('open'); startHb(); emit('open', s); };
      ch.onmessage = e => {
        if (typeof e.data !== 'string' || e.data.length > MAX_MSG) return;
        let o; try { o = JSON.parse(e.data); } catch (er) { return; }
        if (!o || typeof o !== 'object' || Array.isArray(o)) return;
        lastSeen = Date.now(); received++;
        if (state === 'lost') { set('open'); emit('recovered'); }
        if (o._fff) return internal(o);
        emit('message', o);
      };
      ch.onclose = () => { if (!closed) finish('channel-closed'); };
      ch.onerror = () => { /* detaliile vin prin starea conexiunii */ };
      if (ch.readyState === 'open') ch.onopen();
    };
    s._armConnect = function () {
      clearTimeout(connTimer);
      connTimer = setTimeout(() => { if (!closed && state !== 'open') { emit('error', coded('timeout', 'failed')); finish('timeout'); } }, hb.connect);
    };
    pc.onconnectionstatechange = () => {
      const c = pc.connectionState;
      if (c === 'failed') { emit('error', coded('ice-failed', 'failed')); finish('failed'); }
      else if (c === 'disconnected' && state === 'open') { lostSince = Date.now(); set('lost'); emit('lost'); }
      else if (c === 'connected' && state === 'lost') { set('open'); emit('recovered'); }
    };
    if (role === 'guest') pc.ondatachannel = e => { if (!dc && e.channel.label === 'fff') s._bind(e.channel); };
    return s;
  }

  async function prepare(opts) {
    if (!supported()) throw coded('unsupported', 'unsupported');
    return new RTCPeerConnection(rtcConfig(opts));
  }
  async function gather(pc, opts, gp) {
    await gp;
    const sdp = pc.localDescription && pc.localDescription.sdp;
    if (!sdp || !/^a=candidate:/m.test(sdp)) throw coded('no-candidates', 'noCandidates');
    return sdp;
  }

  /** Gazdă: returnează o sesiune cu .offer (cod text); apoi accept(răspuns). */
  async function host(opts) {
    opts = opts || {};
    const pc = await prepare(opts), s = createSession('host', pc, opts);
    try {
      s._bind(pc.createDataChannel('fff', {ordered: true}));
      s._setState('gathering');
      const gp = watchGathering(pc, opts);
      await pc.setLocalDescription(await pc.createOffer());
      s.offer = await encodeSignal('offer', await gather(pc, opts, gp));
    } catch (e) { try { pc.close(); } catch (er) { /* ignorat */ } throw e; }
    s._setState('waiting-answer');
    s.accept = async function (code) {
      const r = await decodeSignal(code);
      if (r.kind !== 'answer') throw coded('wrong-kind', 'wrongKind', {want: T('kindAnswer'), got: T('kindOffer')});
      await pc.setRemoteDescription({type: 'answer', sdp: r.sdp});
      s._setState('connecting'); s._armConnect();
    };
    return s;
  }
  /** Oaspete: primește oferta (cod) și returnează o sesiune cu .answer (cod text). */
  async function join(offerCode, opts) {
    opts = opts || {};
    if (!supported()) throw coded('unsupported', 'unsupported');
    const r = await decodeSignal(offerCode);
    if (r.kind !== 'offer') throw coded('wrong-kind', 'wrongKind', {want: T('kindOffer'), got: T('kindAnswer')});
    const pc = await prepare(opts), s = createSession('guest', pc, opts);
    try {
      s._setState('gathering');
      await pc.setRemoteDescription({type: 'offer', sdp: r.sdp});
      const gp = watchGathering(pc, opts);
      await pc.setLocalDescription(await pc.createAnswer());
      s.answer = await encodeSignal('answer', await gather(pc, opts, gp));
    } catch (e) { try { pc.close(); } catch (er) { /* ignorat */ } throw e; }
    s._setState('connecting'); s._armConnect();
    return s;
  }

  /* ======================= sesiune de joc: lockstep cu gazdă autoritară ======================= */
  function mulberry(seed) {
    let a = seed >>> 0;
    const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.getState = () => a; f.setState = v => { a = v >>> 0; };
    return f;
  }
  function randSeed() { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; } }

  /**
   * lockstep(session, {seed, onMove(move,info), onState(state,info), validate(move,ctx), snapshot(), hash(), onChat(text,from), onError(err), timeout, history})
   * Gazda atribuie seq, validează și difuzează; oaspetele aplică mutările doar în ordinea seq (resincronizare la lipsuri/divergență).
   */
  function lockstep(session, o) {
    o = o || {};
    let sess = session, seq = 0, seed = o.seed != null ? o.seed >>> 0 : randSeed(), rng = mulberry(seed), started = false, stopped = false, cid = 0, helloTries = 0, helloTimer = 0;
    const isHost = () => sess.role === 'host', log = [], ahead = new Map(), pending = new Map(), offs = [];
    const AHEAD_MAX = 256;
    const keep = o.history || 500, stats = {resyncs: 0, rejected: 0, dupes: 0, applied: 0};
    const fail = (reason, extra) => { const e = Object.assign(new Error(reason), {code: reason}, extra || {}); if (o.onError) o.onError(e); return e; };
    const send = m => sess.send(m);
    const tryApply = (move, info) => {
      let r;
      try { r = o.onMove ? o.onMove(move, info) : undefined; } catch (e) { return {ok: false, reason: String(e && e.message || e)}; }
      if (r === false) return {ok: false, reason: 'rejected'};
      if (typeof r === 'string') return {ok: false, reason: r};
      return {ok: true};
    };
    function snapshotMsg() {
      const m = {t: 'sync', seq, seed, rng: rng.getState()};
      if (o.snapshot) m.state = o.snapshot();
      return m;
    }
    function begin(reason, st) {
      if (!started) { started = true; clearTimeout(helloTimer); }
      if (o.onState) o.onState(st, {reason, seq, seed, rng: rng.getState()});
    }
    function applyRemote(m) {                                  // oaspete: o mutare numerotată de la gazdă
      if (m.seq <= seq) { stats.dupes++; return; }
      if (m.seq > seq + 1) {
        if (m.seq - seq > AHEAD_MAX || ahead.size >= AHEAD_MAX) { send({t: 'need', from: seq}); return; }   // plafon: un partener rău nu umple memoria
        ahead.set(m.seq, m); send({t: 'need', from: seq}); return;
      }
      const mine = m.from === 'guest' && pending.has(m.cid);
      const r = tryApply(m.move, {seq: m.seq, from: m.from, mine, rng});
      if (!r.ok) { fail('diverged', {detail: r.reason}); stats.resyncs++; send({t: 'need', from: seq, force: true}); return; }
      seq = m.seq; stats.applied++;
      if (mine) { const p = pending.get(m.cid); pending.delete(m.cid); clearTimeout(p.timer); p.resolve({seq, ok: true}); }
      if (o.hash && m.h != null && String(o.hash()) !== String(m.h)) { stats.resyncs++; send({t: 'need', from: seq, force: true}); return; }
      const nx = ahead.get(seq + 1); if (nx) { ahead.delete(seq + 1); applyRemote(nx); }
    }
    function hostApply(move, from, cidv) {                     // gazdă: validează, aplică, numerotează, difuzează
      if (move == null || typeof move !== 'object') return {ok: false, reason: 'bad-move'};
      if (o.validate) { const v = o.validate(move, {from, seq: seq + 1}); if (v !== true && v !== undefined) return {ok: false, reason: typeof v === 'string' ? v : 'invalid'}; }
      const r = tryApply(move, {seq: seq + 1, from, mine: from === 'host', rng});
      if (!r.ok) return r;
      seq++; stats.applied++;
      log.push({seq, move, from}); if (log.length > keep) log.shift();
      const m = {t: 'move', seq, move, from}; if (cidv != null) m.cid = cidv; if (o.hash) m.h = o.hash();
      send(m);
      return {ok: true, seq};
    }
    function onMsg(m) {
      if (stopped || !m || typeof m.t !== 'string') return;
      if (isHost()) {
        if (m.t === 'hello') { send(snapshotMsg()); }
        else if (m.t === 'move') {
          const r = hostApply(m.move, 'guest', m.cid);
          if (!r.ok) { stats.rejected++; send({t: 'reject', cid: m.cid, reason: r.reason}); }
        } else if (m.t === 'need') {
          const from = Number.isInteger(m.from) ? m.from : -1;
          if (!m.force && log.length && log[0].seq <= from + 1 && from <= seq) send({t: 'moves', list: log.filter(e => e.seq > from)});
          else if (o.snapshot) { stats.resyncs++; send(Object.assign(snapshotMsg(), {resync: true})); }
          else send({t: 'fatal', reason: 'no-history'});
        } else if (m.t === 'chat' && o.onChat && typeof m.text === 'string') o.onChat(m.text.slice(0, 2000), 'guest');
        return;
      }
      if (m.t === 'sync') {                                    // oaspete
        if (!Number.isInteger(m.seq) || !Number.isInteger(m.seed) || m.seq < 0) return;
        if (!m.resync && started && m.seq === seq && m.seed === seed) return;     // idempotent
        if (m.state !== undefined || m.seq === 0) {            // stare completă sau început de joc
          const first = !started;
          seq = m.seq; seed = m.seed >>> 0; rng = mulberry(seed);
          if (Number.isInteger(m.rng)) rng.setState(m.rng);
          ahead.clear(); begin(first ? 'start' : 'resync', m.state);
        } else if (m.seq > seq) {                              // gazda e înainte, fără instantaneu: cere mutările
          if (!started) { seed = m.seed >>> 0; rng = mulberry(seed); started = true; clearTimeout(helloTimer); }
          send({t: 'need', from: seq});
        } else fail('diverged');
      } else if (m.t === 'move') { if (started && Number.isInteger(m.seq) && m.move && typeof m.move === 'object') applyRemote(m); }
      else if (m.t === 'moves' && Array.isArray(m.list)) { m.list.slice(0, keep).forEach(e => { if (e && Number.isInteger(e.seq) && e.move && typeof e.move === 'object') applyRemote({t: 'move', seq: e.seq, move: e.move, from: e.from === 'host' ? 'host' : 'guest'}); }); }
      else if (m.t === 'reject') { const p = pending.get(m.cid); if (p) { pending.delete(m.cid); clearTimeout(p.timer); p.reject(Object.assign(new Error(String(m.reason || 'rejected')), {code: 'rejected'})); } }
      else if (m.t === 'fatal') fail(String(m.reason || 'fatal'));
      else if (m.t === 'chat' && o.onChat && typeof m.text === 'string') o.onChat(m.text.slice(0, 2000), 'host');
    }
    function bind() {
      offs.forEach(f => f()); offs.length = 0;
      offs.push(sess.on('message', onMsg));
      offs.push(sess.on('open', start));
      offs.push(sess.on('close', () => { pending.forEach(p => { clearTimeout(p.timer); p.reject(Object.assign(new Error('closed'), {code: 'closed'})); }); pending.clear(); }));
      if (sess.open) start();
    }
    function start() {
      if (isHost()) { if (!started) { started = true; begin('start'); } send(snapshotMsg()); }
      else { helloTries = 0; hello(); }
    }
    function hello() {
      clearTimeout(helloTimer);
      if (stopped) return;
      if (helloTries++ >= 8) { if (!started) fail('no-sync'); return; }
      send({t: 'hello', seq});
      helloTimer = setTimeout(() => { if (!started) hello(); }, 1500);
    }
    const api = {
      get seq() { return seq; }, get seed() { return seed; }, get role() { return sess.role; }, get stats() { return Object.assign({}, stats); },
      rng: () => rng(), get rngState() { return rng.getState(); },
      /** Trimite o mutare. Gazdă: aplică imediat; oaspete: așteaptă ecoul numerotat al gazdei. Returnează Promise<{seq}>. */
      move(move) {
        if (stopped) return Promise.reject(Object.assign(new Error('stopped'), {code: 'stopped'}));
        if (isHost()) {
          const r = hostApply(move, 'host');
          return r.ok ? Promise.resolve({seq: r.seq, ok: true}) : Promise.reject(Object.assign(new Error(r.reason), {code: 'rejected'}));
        }
        if (!sess.open) return Promise.reject(Object.assign(new Error('closed'), {code: 'closed'}));
        const id = ++cid;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { pending.delete(id); reject(Object.assign(new Error('timeout'), {code: 'timeout'})); }, o.timeout || 8000);
          pending.set(id, {resolve, reject, timer});
          if (!send({t: 'move', cid: id, move})) { clearTimeout(timer); pending.delete(id); reject(Object.assign(new Error('closed'), {code: 'closed'})); }
        });
      },
      chat(text) { return send({t: 'chat', text: String(text).slice(0, 2000)}); },
      /** Cere resincronizarea completă (oaspete) sau retrimite starea (gazdă). */
      resync() { if (isHost()) return send(snapshotMsg()); return send({t: 'need', from: seq, force: true}); },
      /** După o reconectare: leagă aceeași stare de joc la o sesiune nouă. */
      rebind(newSession) { sess = newSession; bind(); },
      stop() { stopped = true; clearTimeout(helloTimer); offs.forEach(f => f()); offs.length = 0; }
    };
    bind();
    return api;
  }

  /* ======================= dialog ======================= */
  let uid = 0, cssDone = false;
  const CSS = `
dialog.fff-p2p{box-sizing:border-box;width:min(38rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);overflow:auto;padding:1rem 1.25rem;border:1px solid var(--fff-border,#8a8a94);border-radius:.75rem;background:var(--fff-bg,#fff);color:var(--fff-fg,#16161a);color-scheme:light dark;font:inherit;line-height:1.45}
dialog.fff-p2p::backdrop{background:rgba(0,0,0,.55)}
dialog.fff-p2p *{box-sizing:border-box}
dialog.fff-p2p h2{margin:0 0 .5rem;font-size:1.25rem}
dialog.fff-p2p h3{margin:.75rem 0 .25rem;font-size:1rem}
dialog.fff-p2p p{margin:.4rem 0}
dialog.fff-p2p .fff-p2p-warn{padding:.6rem .75rem;border:1px solid #8a5a00;border-radius:.5rem;background:#fff4d6;color:#3d2b00}
dialog.fff-p2p .fff-p2p-row{display:flex;flex-wrap:wrap;gap:.5rem;margin:.5rem 0;align-items:center}
dialog.fff-p2p button{min-height:2.25rem;min-width:2.25rem;padding:.35rem .9rem;border:1px solid var(--fff-accent,#1d4ed8);border-radius:.4rem;background:var(--fff-accent,#1d4ed8);color:var(--fff-on-accent,#fff);font:inherit;cursor:pointer}
dialog.fff-p2p button.fff-p2p-sec{background:transparent;color:var(--fff-accent,#1d4ed8)}
dialog.fff-p2p button[disabled]{opacity:.55;cursor:not-allowed}
dialog.fff-p2p button[aria-pressed=true]{outline:2px solid var(--fff-fg,#16161a);outline-offset:2px}
dialog.fff-p2p :focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
dialog.fff-p2p textarea,dialog.fff-p2p input[type=text]{width:100%;min-height:2.25rem;padding:.4rem;border:1px solid var(--fff-border,#6b6b75);border-radius:.4rem;background:var(--fff-field,#fff);color:inherit;font:.8rem/1.3 ui-monospace,monospace;word-break:break-all}
dialog.fff-p2p textarea{min-height:5rem;resize:vertical}
dialog.fff-p2p label{display:block;font-weight:600;margin:.5rem 0 .2rem}
dialog.fff-p2p label.fff-p2p-chk{display:flex;gap:.5rem;align-items:flex-start;font-weight:600}
dialog.fff-p2p input[type=checkbox]{width:1.5rem;height:1.5rem;margin-top:0;flex:none}
dialog.fff-p2p .fff-p2p-qr{display:inline-block;max-width:100%;padding:.5rem;background:#fff;border:1px solid #bbb;border-radius:.4rem;line-height:0}
dialog.fff-p2p .fff-p2p-qr svg{max-width:100%;height:auto;display:block}
dialog.fff-p2p video{width:100%;max-height:16rem;background:#000;border-radius:.4rem}
dialog.fff-p2p .fff-p2p-status{min-height:1.5rem;font-weight:600}
dialog.fff-p2p .fff-p2p-small{font-size:.875rem}
dialog.fff-p2p[hidden],dialog.fff-p2p [hidden]{display:none!important}
@media (prefers-color-scheme:dark){dialog.fff-p2p{--fff-bg:#1c1c21;--fff-fg:#ececf1;--fff-border:#8d8d99;--fff-accent:#8ab4ff;--fff-on-accent:#0b0b10;--fff-field:#111116}
dialog.fff-p2p .fff-p2p-warn{background:#3b2f0e;color:#ffe9b0;border-color:#d9a400}}
@media (prefers-reduced-motion:reduce){dialog.fff-p2p *{animation:none!important;transition:none!important}}`;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    try { const sh = new CSSStyleSheet(); sh.replaceSync(CSS); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh]; }
    catch (e) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  }
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v === false || v == null) continue; if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v); }
    kids.forEach(c => c != null && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }

  /** QR (sau cadre QR succesive) pentru un cod; returnează {node, destroy}. */
  function qrView(code, o) {
    o = o || {};
    const list = frames(code, o), root = el('div', {'data-role': 'qr'});
    let idx = 0, timer = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const box = el('div', {class: 'fff-p2p-qr'}), cap = el('p', {class: 'fff-p2p-small', 'data-role': 'qr-caption'});
    const draw = () => {
      let svgStr;
      try { svgStr = F.qr.svg(list[idx], {ecc: 'M', scale: 5, margin: 3, label: list.length > 1 ? T('frame', {i: idx + 1, n: list.length}) : F.t('qr', 'label')}); }
      catch (e) { box.textContent = e.message; return; }
      const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml').documentElement;
      box.replaceChildren(document.importNode(doc, true));
      cap.textContent = list.length > 1 ? T('frame', {i: idx + 1, n: list.length}) : '';
    };
    root.appendChild(box);
    if (list.length > 1) {
      const prev = el('button', {type: 'button', class: 'fff-p2p-sec', text: T('prev')}), next = el('button', {type: 'button', class: 'fff-p2p-sec', text: T('next')});
      const pp = el('button', {type: 'button', class: 'fff-p2p-sec', 'aria-pressed': String(!paused), text: paused ? T('play') : T('pause')});
      const go = d => { idx = (idx + d + list.length) % list.length; draw(); };
      prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1));
      const arm = () => { clearInterval(timer); if (!paused) timer = setInterval(() => go(1), 1600); };
      pp.addEventListener('click', () => { paused = !paused; pp.setAttribute('aria-pressed', String(!paused)); pp.textContent = paused ? T('play') : T('pause'); arm(); });
      root.append(cap, el('p', {class: 'fff-p2p-small', text: T('chunkInfo', {n: list.length})}), el('div', {class: 'fff-p2p-row'}, prev, next, pp));
      arm();
    }
    draw();
    return {node: root, frames: list, destroy() { clearInterval(timer); }};
  }

  function dialog(o) {
    o = o || {};
    injectCss();
    const id = 'fff-p2p-' + (++uid);
    const dlg = el('dialog', {class: 'fff-p2p', 'aria-labelledby': id + '-t', 'data-role': 'p2p-dialog'});
    const status = el('p', {class: 'fff-p2p-status', role: 'status', 'aria-live': 'polite', 'data-role': 'status'});
    const closeBtn = el('button', {type: 'button', class: 'fff-p2p-sec', 'data-role': 'close', text: T('close')});
    let session = null, qrv = [], resolveP, rejectP, delivered = false, camJob = false;
    const promise = new Promise((res, rej) => { resolveP = res; rejectP = rej; });
    promise.catch(() => {});
    const say = (k, v, isErr) => { status.textContent = k ? T(k, v) : ''; status.dataset.key = k || ''; if (isErr) status.setAttribute('role', 'alert'); else status.setAttribute('role', 'status'); };
    const sayRaw = t => { status.textContent = t; status.setAttribute('role', 'alert'); };
    function shutdown() {
      qrv.forEach(q => q.destroy()); qrv = [];
      if (F.qr && F.qr.stopScan) F.qr.stopScan();
      if (dlg.open) dlg.close();
      dlg.remove();
    }
    function api_close() {
      if (session && !delivered) session.close('cancel');
      if (!delivered) rejectP(Object.assign(new Error('cancel'), {code: 'cancel'}));
      shutdown();
    }
    closeBtn.addEventListener('click', api_close);
    dlg.addEventListener('cancel', e => { e.preventDefault(); api_close(); });
    const api = {element: dlg, promise, close: api_close, get session() { return session; }};

    const head = el('h2', {id: id + '-t', text: o.title || T('title')});
    dlg.appendChild(head);

    if (!supported()) {
      dlg.append(el('p', {role: 'alert', 'data-role': 'unsupported', text: T('unsupported')}), el('div', {class: 'fff-p2p-row'}, closeBtn));
      document.body.appendChild(dlg); dlg.showModal();
      return api;
    }

    const warn = el('div', {class: 'fff-p2p-warn', 'data-role': 'warning'}, el('p', {text: T('ipWarn')}), el('p', {text: T('limits')}));
    const chk = el('input', {type: 'checkbox', id: id + '-ok', 'data-role': 'optin'});
    const chkLabel = el('label', {class: 'fff-p2p-chk', for: id + '-ok'}, chk, el('span', {text: T('optin')}));
    const stun = el('input', {type: 'text', id: id + '-stun', placeholder: 'stun:host:3478', autocomplete: 'off', spellcheck: 'false', 'data-role': 'stun', 'aria-describedby': id + '-stunh'});
    const stunBox = el('div', {}, el('label', {for: id + '-stun', text: T('stunLabel')}), stun, el('p', {id: id + '-stunh', class: 'fff-p2p-small', text: T('stunHelp')}));
    const bHost = el('button', {type: 'button', 'data-role': 'mode-host', disabled: true, text: T('host')});
    const bJoin = el('button', {type: 'button', 'data-role': 'mode-join', disabled: true, text: T('join')});
    const modes = el('div', {class: 'fff-p2p-row', role: 'group', 'aria-label': T('title')}, bHost, bJoin);
    const panel = el('div', {'data-role': 'panel'});
    dlg.append(warn, chkLabel, stunBox, modes, panel, status, el('div', {class: 'fff-p2p-row'}, closeBtn));
    chk.addEventListener('change', () => { bHost.disabled = bJoin.disabled = !chk.checked; if (!chk.checked) panel.replaceChildren(); });

    function opts() { return {stun: stun.value, heartbeat: o.heartbeat, gatherTimeout: o.gatherTimeout}; }
    function copyBtn(ta) {
      const b = el('button', {type: 'button', class: 'fff-p2p-sec', 'data-role': 'copy', text: T('copy')});
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (er) { /* manual */ } }
        say('copied');
      });
      return b;
    }
    function showCode(label, code, role) {
      const ta = el('textarea', {id: id + '-' + role, readonly: true, rows: '4', 'data-role': role, spellcheck: 'false'}); ta.value = code;
      const q = qrView(code, o); qrv.push(q);
      return el('div', {}, el('label', {for: id + '-' + role, text: label}), ta, el('div', {class: 'fff-p2p-row'}, copyBtn(ta)), q.node);
    }
    /** Câmp de introducere + scanare QR/imagine. */
    function codeInput(label, role) {
      const ta = el('textarea', {id: id + '-' + role, rows: '4', 'data-role': role, spellcheck: 'false', autocomplete: 'off'});
      const asm = assembler();
      const prog = r => { if (r.total > 1 && !r.done) say('progress', {have: r.have, total: r.total}); };
      const video = el('video', {playsinline: true, muted: true, hidden: true, 'aria-label': T('scanning'), 'data-role': 'video'});
      const bCam = el('button', {type: 'button', class: 'fff-p2p-sec', 'data-role': 'scan-cam', text: T('scanCam')});
      const bStop = el('button', {type: 'button', class: 'fff-p2p-sec', hidden: true, 'data-role': 'scan-stop', text: T('scanStop')});
      const file = el('input', {type: 'file', accept: 'image/*', multiple: true, id: id + '-' + role + '-f', hidden: true, 'data-role': 'scan-file'});
      const bFile = el('button', {type: 'button', class: 'fff-p2p-sec', 'data-role': 'scan-file-btn', text: T('scanFile')});
      const got = code => { ta.value = code; say(null); ta.dispatchEvent(new Event('input', {bubbles: true})); };
      bFile.addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        let found = false;
        for (const f of file.files) {
          try {
            const txt = await F.qr.scan(f);
            if (!txt) continue;
            const r = asm.add(txt); found = found || !r.ignored; prog(r);
            if (r.done) { got(r.code); asm.reset(); break; }
          } catch (e) { sayRaw(e.message); }
        }
        if (!found) say('noQr', null, true);
        file.value = '';
      });
      bCam.addEventListener('click', async () => {
        if (camJob) return; camJob = true; asm.reset();
        video.hidden = false; bStop.hidden = false; bCam.disabled = true; say('scanning');
        let result = null;
        try {
          await F.qr.scan(video, {camera: true, until: txt => { const r = asm.add(txt); prog(r); if (r.done) result = r.code; return r.done; }});
          if (result) got(result);
        } catch (e) { if (e.code !== 'stopped') sayRaw(e.message); }
        camJob = false; video.hidden = true; bStop.hidden = true; bCam.disabled = false;
      });
      bStop.addEventListener('click', () => F.qr.stopScan());
      const box = el('div', {}, el('label', {for: id + '-' + role, text: label}), ta,
        el('div', {class: 'fff-p2p-row'}, bCam, bFile, bStop), el('p', {class: 'fff-p2p-small', text: T('camNote')}), video, file);
      return {node: box, ta};
    }
    function watch(s) {
      session = s;
      s.on('state', st => { if (delivered) return; if (st === 'connecting') say('connecting'); if (st === 'failed') say('failed', null, true); });
      s.on('error', e => { if (delivered) return; if (e.code === 'timeout' || e.code === 'ice-failed') say('failed', null, true); else sayRaw(e.message); });
      s.on('open', () => {
        delivered = true; say('connected');
        resolveP(s);
        setTimeout(() => { shutdown(); }, 0);
        if (o.onOpen) { try { o.onOpen(s); } catch (e) { console.error(e); } }
      });
    }
    const fail = e => sayRaw(e && e.message ? e.message : String(e));

    bHost.addEventListener('click', () => {
      bHost.setAttribute('aria-pressed', 'true'); bJoin.setAttribute('aria-pressed', 'false');
      panel.replaceChildren(el('h3', {text: T('hostHeading')}), el('p', {text: T('hostSteps')}));
      const gen = el('button', {type: 'button', 'data-role': 'gen-offer', text: T('genOffer')});
      const slot = el('div', {});
      panel.append(el('div', {class: 'fff-p2p-row'}, gen), slot);
      gen.addEventListener('click', async () => {
        gen.disabled = true; say('gathering');
        try {
          if (session) session.close('restart');
          const s = await host(opts()); watch(s);
          const ans = codeInput(T('answerIn'), 'answer-in');
          const conn = el('button', {type: 'button', 'data-role': 'connect', text: T('connect')});
          conn.addEventListener('click', async () => {
            if (!ans.ta.value.trim()) { say('emptyField', null, true); ans.ta.focus(); return; }
            try { conn.disabled = true; await s.accept(ans.ta.value); say('connecting'); } catch (e) { fail(e); conn.disabled = false; }
          });
          slot.replaceChildren(showCode(T('offerOut'), s.offer, 'offer-out'), ans.node, el('div', {class: 'fff-p2p-row'}, conn));
          say('waitAnswer');
        } catch (e) { fail(e); gen.disabled = false; }
      });
      gen.focus();
    });
    bJoin.addEventListener('click', () => {
      bJoin.setAttribute('aria-pressed', 'true'); bHost.setAttribute('aria-pressed', 'false');
      panel.replaceChildren(el('h3', {text: T('joinHeading')}), el('p', {text: T('joinSteps')}));
      const off = codeInput(T('offerIn'), 'offer-in');
      const gen = el('button', {type: 'button', 'data-role': 'gen-answer', text: T('genAnswer')});
      const slot = el('div', {});
      panel.append(off.node, el('div', {class: 'fff-p2p-row'}, gen), slot);
      gen.addEventListener('click', async () => {
        if (!off.ta.value.trim()) { say('emptyField', null, true); off.ta.focus(); return; }
        gen.disabled = true; say('gathering');
        try {
          if (session) session.close('restart');
          const s = await join(off.ta.value, opts()); watch(s);
          slot.replaceChildren(showCode(T('answerOut'), s.answer, 'answer-out'));
          say('waitHost');
        } catch (e) { fail(e); gen.disabled = false; }
      });
      off.ta.focus();
    });

    document.body.appendChild(dlg); dlg.showModal();
    return api;
  }

  F.p2p = {supported, host, join, dialog, lockstep, qrView, frames, assembler, encodeSignal, decodeSignal, parseStun, validCandidates, limits: {maxCandidates: MAX_CAND, maxAhead: 256, maxMessage: MAX_MSG, singleQr: SINGLE_MAX, frameLen: FRAME_LEN}};
})();
