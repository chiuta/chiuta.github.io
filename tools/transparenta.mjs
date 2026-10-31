#!/usr/bin/env node
/* tools/transparenta.mjs — generează transparenta.html (pagina cu rezultatele auditurilor) din date.
 *
 *   node tools/transparenta.mjs collect   citește /tmp/audit/audit.txt, /tmp/audit2/summary.md, /tmp/audit4/{base,new}
 *                                         și starea curentă a depozitelor → data/transparenta.json
 *   node tools/transparenta.mjs build     data/transparenta.json + tools/transparenta-i18n.mjs → transparenta.html
 *   node tools/transparenta.mjs --check   exit 1 dacă transparenta.html nu corespunde datelor / dicționarului (nu scrie nimic)
 *
 * Fără date personale: nu se citesc și nu se copiază e-mailuri, nume de persoane sau recenziile simulate din auditul 1;
 * se păstrează doar numere agregate și, per aplicație, versiune/limbi/offline/scor/număr de constatări.
 * Pagina nu face nicio cerere în rețea (connect-src 'none'); limba e ținută în localStorage('lang'), ca în hub.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LANGS, LANG_NAMES, UI, CODES, CODE_KIND} from './transparenta-i18n.mjs';
import {recomputeCspHashes} from '../fff-kit/lib/csp.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv.includes('--check') ? 'check' : argv[0];
const ri = argv.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? argv[ri + 1] : path.join(HUB, '..'));
const A1 = process.env.AUDIT1 || '/tmp/audit/audit.txt', A2 = process.env.AUDIT2 || '/tmp/audit2/summary.md', A4 = process.env.AUDIT4 || '/tmp/audit4';
const DATA = path.join(HUB, 'data', 'transparenta.json'), OUT = path.join(HUB, 'transparenta.html');
const EXTERNAL = new Set(['OSATURA']);   // la fel ca în tools/sync-catalog.mjs
const read = (p) => fs.readFileSync(p, 'utf8');
const MONTHS = {ianuarie: 1, februarie: 2, martie: 3, aprilie: 4, mai: 5, iunie: 6, iulie: 7, august: 8, septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12};
const num = (s) => parseFloat(String(s).replace(',', '.'));
const verGe = (v, w) => { const a = String(v).split('.').map(Number), b = w.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };

/* ---------------- collect ---------------- */
function collect() {
  const t1 = read(A1), t2 = read(A2);
  const must = (m, what) => { if (!m) throw new Error('nu găsesc în audit: ' + what); return m; };
  const dm = must(t1.match(/Testat: (\d+) (\w+) (\d{4})/), 'data auditului 1');
  const d1 = `${dm[3]}-${String(MONTHS[dm[2]]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
  const d2 = must(t2.match(/Generat: (\d{4}-\d\d-\d\d)/), 'data auditului 2')[1];
  const inj = must(t1.match(/(\d+) injectări de date ostile în (\d+) câmpuri/), 'injectări');
  const a1 = {
    date: d1, apps: Number(must(t1.match(/toate cele (\d+) aplicații/), 'nr. aplicații 1')[1]),
    mean: num(must(t1.match(/Scor mediu: ([\d,]+)\/10/), 'scor mediu 1')[1]),
    inj: Number(inj[1]), fld: Number(inj[2]),
    uploads: Number(must(t1.match(/(\d+) încărcări de fișiere ostile/), 'încărcări')[1]),
    clicks: Number(must(t1.match(/(\d+) clicuri aleatorii/), 'clicuri')[1]),
    offline: Number(must(t1.match(/Doar (\d+) din (\d+) funcționează offline/), 'offline')[1]),
    verDesync: Number(must(t1.match(/(\d+) din (\d+) versiuni din catalog sunt desincronizate/), 'versiuni')[1]),
    verTotal: Number(t1.match(/(\d+) din (\d+) versiuni din catalog sunt desincronizate/)[2]),
  };
  const mean2 = num(must(t2.match(/Scor mediu: ([\d.,]+); mediană (\d+)/), 'scor mediu 2')[1]);
  const codes = [...t2.matchAll(/^\| (\w+) \| [^|]+ \| (\d+) \|$/gm)].filter((m) => CODES[m[1]]).map((m) => ({c: m[1], n: Number(m[2])}));
  const rows = [...t2.matchAll(/^\| ([^|]+?) \| ([\d.]+) \| ([\d.]+) \| (.*) \|$/gm)].map((m) => {
    const cnt = {C: 0, H: 0, M: 0, L: 0};
    for (const x of m[4].matchAll(/\*\*([CHML])\*\*/g)) cnt[x[1]]++;
    return {key: m[1], ver: m[2], score: num(m[3]), c: cnt.C, h: cnt.H, m: cnt.M, l: cnt.L};
  });
  if (rows.length < 100) throw new Error('tabelul pe aplicație din auditul 2 are doar ' + rows.length + ' rânduri');
  const sc = rows.map((r) => r.score);
  const a2 = {
    date: d2, apps: rows.length, mean: mean2, codes,
    offlineGap: (codes.find((c) => c.c === 'offline') || {n: 0}).n,
    fakeSw: Number(must(t1.match(/(\d+) aplicații declară serviceWorker: true/), 'SW fals')[1]),
    emptyI18n: Number(must(t1.match(/(\d+) aplicații declară i18n: \[\]/), 'i18n gol')[1]),
    badHost: 1,
    bands: {b9: sc.filter((s) => s >= 9).length, b8: sc.filter((s) => s >= 8 && s < 9).length, b7: sc.filter((s) => s >= 7 && s < 8).length, b6: sc.filter((s) => s < 7).length},
  };
  // auditul 4: efectul kitului 1.1.4 asupra țintelor tactile / textului mic (aplicații cu cel puțin o problemă)
  const a4 = {total: 0, touchBase: 0, touchNew: 0, smallBase: 0, smallNew: 0};
  for (const f of fs.readdirSync(path.join(A4, 'base')).filter((x) => x.endsWith('.json'))) {
    let b, w;
    try { b = JSON.parse(read(path.join(A4, 'base', f))); w = JSON.parse(read(path.join(A4, 'new', f))); } catch { continue; }
    const cnt = (o, k) => ['desktop', 'mobile'].reduce((s, v) => s + (o[v] && !o[v].error ? (k === 't' ? (o[v].tiny || []).length : o[v].nSmall || 0) : 0), 0);
    a4.total++;
    if (cnt(b, 't')) a4.touchBase++; if (cnt(w, 't')) a4.touchNew++;
    if (cnt(b, 's')) a4.smallBase++; if (cnt(w, 's')) a4.smallNew++;
  }
  // starea curentă: cardurile hub-ului (verificate de sync-catalog) + app.json din depozite
  const html = read(path.join(HUB, 'index.html'));
  const cards = html.split('<div class="app-card"').slice(1);
  const live = {apps: 0, sw: 0, noSw: 0, fakeSw: 0, emptyI18n: 0, badHost: 0, kitGe114: 0, kitCount: 0, cnames: 0, shared: 0, syncOk: false};
  const apps = [];
  const byName = new Map(rows.map((r) => [r.key.toLowerCase(), r]));
  for (const c of cards) {
    const key = (c.match(/data-c="apps\|([^|"]+)\|title"/) || [])[1];
    if (!key) continue;
    const ver = (c.match(/data-ver="([^"]*)"/) || [])[1] || '';
    const off = (c.match(/data-off="([^"]*)"/) || [])[1] || 'no';
    const langs = ((c.match(/data-langs="([^"]*)"/) || [])[1] || '').split(',').filter(Boolean);
    // Intrări externe (ex. OSATURA, motor Rust): nu fac parte din audituri și nu intră în cifrele agregate; rând marcat `ext`.
    if (EXTERNAL.has(key)) { apps.push({key, ver, off, langs: langs.length, hosts: 0, score: null, hm: null, l: null, ext: true}); continue; }
    let app = null, swFile = false;
    for (const d of [path.join(ROOT, key), path.join(ROOT, key, 'docs'), path.join(HUB, 'apps', key)]) {
      if (!fs.existsSync(path.join(d, 'index.html'))) continue;
      swFile = fs.existsSync(path.join(d, 'sw.js'));
      for (const e of [d, path.dirname(d) === ROOT ? d : d, path.join(ROOT, key)]) { try { app = JSON.parse(read(path.join(e, 'app.json'))); break; } catch { /* fără app.json */ } }
      break;
    }
    if (fs.existsSync(path.join(ROOT, key, 'CNAME'))) live.cnames++;
    else if (fs.existsSync(path.join(HUB, 'apps', key, 'index.html'))) live.shared++;
    const hosts = app ? (app.egress || []).map((e) => (typeof e === 'string' ? e : e.host)).filter((h) => !(app.cspSelfTest && app.cspSelfTest.intentional && app.cspSelfTest.host === h)) : [];
    live.apps++;
    if (swFile) live.sw++; else live.noSw++;
    if (app && app.features && app.features.pwa && app.features.pwa.serviceWorker && !swFile) live.fakeSw++;
    if (app && (!app.features || !Array.isArray(app.features.i18n) || !app.features.i18n.length)) live.emptyI18n++;
    live.badHost += hosts.filter((h) => /[${}<>"'\\\s]/.test(h)).length;
    if (app && app.kit && app.kit.version) { live.kitCount++; if (verGe(app.kit.version, '1.1.4')) live.kitGe114++; }
    const r = byName.get(key.toLowerCase());
    apps.push({key, ver, off, langs: langs.length, hosts: hosts.length, score: r ? r.score : null, hm: r ? r.c + r.h + r.m : null, l: r ? r.l : null});
  }
  try { execFileSync('node', [path.join(HUB, 'tools', 'sync-catalog.mjs'), '--check'], {stdio: 'pipe'}); live.syncOk = true; } catch { live.syncOk = false; }
  apps.sort((x, y) => x.key.toLowerCase().localeCompare(y.key.toLowerCase()));
  const data = {schema: 1, snapshot: new Date().toISOString().slice(0, 10), a1, a2, a4, live, apps};
  fs.mkdirSync(path.dirname(DATA), {recursive: true});
  fs.writeFileSync(DATA, JSON.stringify(data, null, 1) + '\n');
  console.log(`data/transparenta.json: ${apps.length} aplicații · audit 1 ${d1} · audit 2 ${d2} · sincronizare catalog ${live.syncOk ? 'ok' : 'NU'}`);
}

/* ---------------- randare (aceeași funcție rulează în Node pentru HTML-ul static și în pagină, la schimbarea limbii) ---------------- */
function renderSrc(D, UI, CODES, CODE_KIND) {
  var E = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var DOCS = 'https://github.com/chiuta/chiuta.github.io/blob/main/docs/';
  return function render(L) {
    var T = UI[L] || UI.en, en = UI.en;
    var t = function (k) { return T[k] != null ? T[k] : en[k]; };
    var N = function (n) { return L === 'en' ? String(n) : String(n).replace('.', ','); };
    var F = function (k, v) { return E(t(k)).replace(/\{(\w+)\}/g, function (m, x) { return v && v[x] != null ? v[x] : m; }); };
    var a1 = D.a1, a2 = D.a2, a4 = D.a4, lv = D.live;
    var h = [];
    var th = function (k, cls) { return '<th scope="col"' + (cls ? ' class="' + cls + '"' : '') + '>' + E(t(k)) + '</th>'; };
    h.push('<p class="lead">' + E(t('lead')) + '</p>');
    h.push('<p class="snap">' + F('snapshot', {date: D.snapshot, d1: a1.date, d2: a2.date}) + '</p>');
    // pe scurt
    h.push('<section aria-labelledby="s-glance"><h2 id="s-glance">' + E(t('h_glance')) + '</h2><ul class="cards">');
    var card = function (lab, val) { return '<li><span class="cv">' + val + '</span><span class="cl">' + E(lab) + '</span></li>'; };
    h.push(card(t('g_apps'), F('g_apps_v', {a: a1.apps, b: a2.apps})));
    h.push(card(t('g_xss'), E(t('g_xss_v'))));
    h.push(card(t('g_proto'), E(t('g_xss_v'))));
    h.push(card(t('g_off'), F('g_off_v', {n: lv.sw, m: lv.apps})));
    var codes = a2.codes.map(function (c) { return c.c === 'targets' ? {c: c.c, n: a4.touchNew} : c.c === 'small' ? {c: c.c, n: a4.smallNew} : c; });
    var openTotal = codes.reduce(function (s, c) { return s + c.n; }, 0);
    h.push(card(t('g_open'), F('g_open_v', {n: openTotal})));
    h.push('</ul></section>');
    // ce s-a verificat
    h.push('<section aria-labelledby="s-checked"><h2 id="s-checked">' + E(t('h_checked')) + '</h2><ul class="plain">');
    h.push('<li>' + F('c_scope', {d1: a1.date, d2: a2.date, a1: a1.apps, a2: a2.apps}) + '</li>');
    h.push('<li>' + E(t('c_env')) + '</li>');
    h.push('<li>' + F('c_sec', {inj: a1.inj, fld: a1.fld, clk: a1.clicks}) + '</li>');
    ['c_a11y', 'c_off', 'c_label', 'c_store'].forEach(function (k) { h.push('<li>' + E(t(k)) + '</li>'); });
    h.push('</ul><p class="note">' + E(t('c_limits')) + '</p></section>');
    // rezultate
    h.push('<section aria-labelledby="s-res"><h2 id="s-res">' + E(t('h_results')) + '</h2><div class="tw"><table><thead><tr>' + th('th_metric') + th('th_a1') + th('th_a2') + th('th_now') + '</tr></thead><tbody>');
    var row = function (m, x, y, z) { h.push('<tr><th scope="row">' + E(t(m)) + '</th><td>' + x + '</td><td>' + y + '</td><td>' + z + '</td></tr>'); };
    var of = function (n, m) { return F('v_of', {n: n, m: m}); };
    row('m_apps', a1.apps, a2.apps, lv.apps);
    row('m_mean', F('v_mean1', {n: N(a1.mean.toFixed(1))}), F('v_mean2', {n: N(a2.mean.toFixed(2))}), '—');
    row('m_xss', E(t('v_zero')), E(t('v_zero')), '—');
    row('m_proto', E(t('v_zero')), E(t('v_zero')), '—');
    row('m_off', of(a1.offline, a1.apps), of(a2.apps - a2.offlineGap, a2.apps), of(lv.sw, lv.apps));
    h.push('</tbody></table></div><p class="note">' + E(t('meannote')) + '</p>');
    h.push('<h3>' + E(t('h_bands')) + '</h3><div class="tw narrow"><table><thead><tr>' + th('th_band') + th('th_apps', 'n') + '</tr></thead><tbody>');
    ['b9', 'b8', 'b7', 'b6'].forEach(function (k) { h.push('<tr><th scope="row">' + E(t(k)) + '</th><td class="n">' + a2.bands[k] + '</td></tr>'); });
    h.push('</tbody></table></div></section>');
    // reparat
    h.push('<section aria-labelledby="s-fixed"><h2 id="s-fixed">' + E(t('h_fixed')) + '</h2><div class="tw"><table><thead><tr>' + th('th_item') + th('th_before') + th('th_after') + th('th_how') + '</tr></thead><tbody>');
    var fx = function (k, b, a, how) { h.push('<tr><th scope="row">' + E(t(k)) + '</th><td>' + b + '</td><td>' + a + '</td><td>' + E(t(how)) + '</td></tr>'); };
    var ap = function (n) { return F('x_apps', {n: n}); };
    fx('f_sync', F('x_before_n', {n: a1.verDesync, m: a1.verTotal}), F('x_now_n', {n: lv.syncOk ? 0 : '?', m: lv.apps}), 'how_sync');
    fx('f_nosw', F('x_before_n', {n: a1.apps - a1.offline, m: a1.apps}), F('x_now_n', {n: lv.noSw, m: lv.apps}), 'how_label');
    fx('f_fakesw', ap(a2.fakeSw), ap(lv.fakeSw), 'how_label');
    fx('f_i18n', ap(a2.emptyI18n), ap(lv.emptyI18n), 'how_label');
    fx('f_kit', E(t('v_none')), ap(lv.kitGe114), 'how_kit');
    fx('f_touch', ap(a4.touchBase), ap(a4.touchNew), 'how_a4');
    fx('f_small', ap(a4.smallBase), ap(a4.smallNew), 'how_a4');
    fx('f_self', E(t('x_self_b')), E(t('x_self_a')), 'how_cfg');
    h.push('</tbody></table></div></section>');
    // rămâne deschis
    h.push('<section aria-labelledby="s-open"><h2 id="s-open">' + E(t('h_open')) + '</h2><ul class="plain">');
    var kind = function (k) { return ' <span class="kind">' + E(t(k)) + '</span>'; };
    h.push('<li>' + F('o_origin', {n: lv.cnames, s: lv.shared}) + kind('k_infra') + '</li>');
    h.push('<li>' + E(t('o_lic')) + kind('k_author') + '</li>');
    h.push('<li>' + E(t('o_review')) + kind('k_author') + '</li>');
    h.push('<li>' + E(t('o_merge')) + kind('k_author') + '</li>');
    h.push('<li>' + E(t('o_headers')) + kind('k_limit') + '</li>');
    h.push('<li>' + E(t('o_devices')) + kind('k_limit') + '</li>');
    h.push('<li>' + F('o_host', {n: lv.badHost, m: a2.badHost}) + kind('k_tech') + '</li>');
    h.push('<li>' + F('o_docs', {d1: '<a href="' + DOCS + 'DOMENII.md">docs/DOMENII.md</a>', d2: '<a href="' + DOCS + 'DECIZII-AUTOR.md">docs/DECIZII-AUTOR.md</a>'}) + '</li></ul>');
    h.push('<div class="tw"><table><thead><tr>' + th('th_code') + th('th_apps', 'n') + th('th_kind') + '</tr></thead><tbody>');
    codes.forEach(function (c) {
      var lab = (CODES[c.c] && (CODES[c.c][L] || CODES[c.c].en)) || c.c;
      h.push('<tr><th scope="row">' + E(lab) + '</th><td class="n">' + c.n + '</td><td>' + E(t(CODE_KIND[c.c] || 'k_tech')) + '</td></tr>');
    });
    h.push('</tbody></table></div></section>');
    // per aplicație
    h.push('<section aria-labelledby="s-apps"><h2 id="s-apps">' + E(t('h_apps')) + '</h2><div class="tw wide"><table class="apps"><thead><tr>' + th('th_app') + th('th_ver') + th('th_offline') + th('th_langs', 'n') + th('th_hosts', 'n') + th('th_score', 'n') + th('th_hm', 'n') + th('th_l', 'n') + '</tr></thead><tbody>');
    D.apps.forEach(function (a) {
      h.push('<tr><th scope="row">' + E(a.key) + '</th><td>' + E(a.ver) + '</td><td>' + E(t('off_' + a.off)) + '</td><td class="n">' + a.langs + '/8</td><td class="n">' + a.hosts + '</td><td class="n">' + (a.score == null ? '—' : N(a.score.toFixed(1))) + '</td><td class="n">' + (a.hm == null ? '—' : a.hm) + '</td><td class="n">' + (a.l == null ? '—' : a.l) + '</td></tr>');
    });
    h.push('</tbody></table></div><p class="note">' + E(t('tbl_note')) + '</p>' + (D.apps.some(function (a) { return a.ext; }) ? '<p class="note">' + E(t('tbl_ext')) + '</p>' : '') + '</section>');
    h.push('<section aria-labelledby="s-repro"><h2 id="s-repro">' + E(t('h_repro')) + '</h2><pre>' + E(t('repro')) + '</pre></section>');
    h.push('<p class="foot">' + F('foot', {date: D.snapshot}) + '</p>');
    return h.join('\n');
  };
}

const CSS = `:root{--bg:#f4f2fb;--bg2:#fff;--text:#14102a;--muted:#544e6e;--accent:#6d3fd8;--border:#d6d0ea;--chip:#ece8f8}
@media (prefers-color-scheme:dark){:root:not([data-mode="light"]){--bg:#0a0818;--bg2:#13112a;--text:#ece9f8;--muted:#a9a5c6;--accent:#a78bfa;--border:#2b2650;--chip:#1c1936}}
:root[data-mode="dark"]{--bg:#0a0818;--bg2:#13112a;--text:#ece9f8;--muted:#a9a5c6;--accent:#a78bfa;--border:#2b2650;--chip:#1c1936}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:62rem;margin:0 auto;padding:0 16px 3rem}
header.top{display:flex;flex-wrap:wrap;gap:.75rem 1rem;align-items:center;justify-content:space-between;padding:1rem 0;border-bottom:1px solid var(--border)}
a{color:var(--accent);text-underline-offset:2px}a:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.back{display:inline-flex;align-items:center;min-height:44px;font-weight:600}
.lang{display:flex;align-items:center;gap:.5rem;font-size:.9rem;color:var(--muted)}
select{min-height:44px;padding:0 .75rem;font:inherit;color:var(--text);background:var(--bg2);border:1px solid var(--border);border-radius:8px}
h1{font-size:clamp(1.8rem,5vw,2.6rem);line-height:1.15;margin:1.6rem 0 .6rem}
h2{font-size:1.4rem;margin:2.4rem 0 .8rem;padding-top:.4rem;border-top:1px solid var(--border)}h3{font-size:1.1rem;margin:1.4rem 0 .5rem}
.lead{font-size:1.1rem;max-width:46rem}.snap,.note,.foot{color:var(--muted);font-size:.92rem;max-width:50rem}
ul.plain{padding-left:1.2rem;max-width:50rem}ul.plain li{margin:.45rem 0}
ul.cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr));gap:.75rem}
ul.cards li{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;display:flex;flex-direction:column;gap:.2rem}
.cv{font-size:1.35rem;font-weight:700}.cl{font-size:.88rem;color:var(--muted)}
.kind{display:inline-block;font-size:.78rem;padding:.05rem .5rem;border-radius:99px;background:var(--chip);color:var(--muted);white-space:nowrap}
.tw{overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:var(--bg2);margin:.4rem 0}.tw.narrow{max-width:26rem}
table{border-collapse:collapse;width:100%;font-size:.92rem}th,td{padding:.5rem .7rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--border)}
thead th{font-size:.82rem;color:var(--muted);white-space:nowrap}tbody th{font-weight:600}tr:last-child>*{border-bottom:0}.n{text-align:right;font-variant-numeric:tabular-nums}
table.apps{min-width:46rem}pre{overflow-x:auto;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.8rem 1rem;font-size:.85rem}
@media print{.lang,.back{display:none}body{background:#fff;color:#000}}`;

const CLIENT = (D) => `
(function(){
var D=${JSON.stringify(D)};
var UI=${JSON.stringify(UI)};
var CODES=${JSON.stringify(CODES)};
var CODE_KIND=${JSON.stringify(CODE_KIND)};
var LANGS=${JSON.stringify(LANGS)};
var render=(${renderSrc.toString()})(D,UI,CODES,CODE_KIND);
var root=document.documentElement,main=document.getElementById('content'),sel=document.getElementById('lang');
function safeGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function safeSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var mode=safeGet('mode');if(mode==='light'||mode==='dark')root.setAttribute('data-mode',mode);
function setLang(l){
  if(LANGS.indexOf(l)<0)l='en';
  root.lang=l;var T=UI[l];
  main.innerHTML=render(l);
  document.getElementById('ttl').textContent=T.title;
  document.title=T.title+' · chiuta.ro';
  document.getElementById('back').textContent=T.back;
  document.getElementById('lang-l').textContent=T.langLabel;
  sel.value=l;
}
sel.addEventListener('change',function(){safeSet('lang',sel.value);setLang(sel.value)});
var l=safeGet('lang')||(navigator.language||'en').slice(0,2).toLowerCase();
if(LANGS.indexOf(l)<0)l='en';
if(l!=='en')setLang(l);
})();
`;

function build(data) {
  const body = renderSrc(data, UI, CODES, CODE_KIND)('en');
  const script = CLIENT(data);
  const opts = LANGS.map((l) => `<option value="${l}"${l === 'en' ? ' selected' : ''}>${LANG_NAMES[l]}</option>`).join('');
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'sha256-AAAA'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'none'; manifest-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="index,follow">
<title>${UI.en.title} · chiuta.ro</title>
<meta name="description" content="${UI.en.lead.replace(/"/g, '&quot;')}">
<link rel="canonical" href="https://chiuta.ro/transparenta.html">
<link rel="icon" href="icon-192.png">
<!-- GENERAT de tools/transparenta.mjs din data/transparenta.json — nu edita de mână. -->
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top"><a class="back" id="back" href="index.html">${UI.en.back}</a>
<label class="lang"><span id="lang-l">${UI.en.langLabel}</span><select id="lang" aria-labelledby="lang-l">${opts}</select></label></header>
<main>
<h1 id="ttl">${UI.en.title}</h1>
<div id="content">
${body}
</div>
</main>
</div>
<script>${script}</script>
</body>
</html>
`;
  html = recomputeCspHashes(html).html;
  return html;
}

function checkDict() {
  const problems = [];
  const keys = Object.keys(UI.en);
  for (const l of LANGS) {
    if (!UI[l]) { problems.push('lipsește limba ' + l); continue; }
    for (const k of keys) if (!(k in UI[l]) || !String(UI[l][k]).trim()) problems.push(`${l}: lipsește «${k}»`);
    for (const k of Object.keys(UI[l])) if (!(k in UI.en)) problems.push(`${l}: cheie în plus «${k}»`);
    for (const k of keys) { const a = (UI.en[k].match(/\{\w+\}/g) || []).sort().join(), b = ((UI[l][k] || '').match(/\{\w+\}/g) || []).sort().join(); if (a !== b) problems.push(`${l}.${k}: substituenți ${b} ≠ ${a}`); }
  }
  for (const [c, v] of Object.entries(CODES)) for (const l of LANGS) if (!v[l]) problems.push(`cod ${c}: lipsește ${l}`);
  return problems;
}

if (cmd === 'collect') collect();
else if (cmd === 'build' || cmd === 'check') {
  const problems = checkDict();
  const data = JSON.parse(read(DATA));
  const html = build(data);
  if (cmd === 'build') {
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    fs.writeFileSync(OUT, html);
    console.log(`transparenta.html scris (${html.length} octeți, ${LANGS.length} limbi)`);
  } else {
    if (!fs.existsSync(OUT) || read(OUT) !== html) problems.push('transparenta.html nu corespunde datelor / dicționarului (rulează `node tools/transparenta.mjs build`)');
    const live = new Set(data.apps.map((a) => a.key)), idx = read(path.join(HUB, 'index.html'));
    const cards = [...idx.matchAll(/data-c="apps\|([^|"]+)\|title"/g)].map((m) => m[1]);
    for (const k of cards) if (!live.has(k)) problems.push(`aplicația ${k} din catalog lipsește din data/transparenta.json (rulează collect + build)`);
    if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(JSON.stringify(data))) problems.push('date personale (adresă de e-mail) în data/transparenta.json');
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log(`transparenta ok · ${data.apps.length} aplicații · ${LANGS.length} limbi · date din ${data.snapshot}`);
  }
} else { console.error('folosire: transparenta.mjs collect | build | --check'); process.exit(2); }
