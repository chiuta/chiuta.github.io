// QSO 2.0 — mod de concurs: scor în timp real (puncte + multiplicatori + duplicate + ritm), schimb și Cabrillo cu CLAIMED-SCORE.
import {createRequire} from "module";
import path from "path"; import {fileURLToPath} from "url"; import fs from "fs";
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require("playwright");
const __dir = path.dirname(fileURLToPath(import.meta.url));
const URL_ = "file://" + path.resolve(__dir, "..", "index.html");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + " (obținut " + JSON.stringify(a) + ", așteptat " + JSON.stringify(b) + ")");
const sect = s => console.log("\n## " + s);
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
async function newPage() {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, acceptDownloads: true});
  const reqs = []; await ctx.route(/^https?:/, r => { reqs.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  p.__errs = errs; p.__reqs = reqs; p.__ctx = ctx;
  await p.goto(URL_); await p.waitForFunction(() => window.__qso); return p;
}
/* referință independentă pentru distanță (haversine pe centrul pătratului) */
function refGrid(g) { g = g.toUpperCase(); let lon = -180, lat = -90, dl = 20, dp = 10; const f = [[20, 10, "A"], [2, 1, "0"], [2 / 24, 1 / 24, "A"]];
  for (let i = 0; i < g.length / 2; i++) { lon += (g.charCodeAt(2 * i) - f[i][2].charCodeAt(0)) * f[i][0]; lat += (g.charCodeAt(2 * i + 1) - f[i][2].charCodeAt(0)) * f[i][1]; dl = f[i][0]; dp = f[i][1]; } return [lat + dp / 2, lon + dl / 2]; }
function refKm(a, b) { const [p1, l1] = refGrid(a).map(x => x * Math.PI / 180), [p2, l2] = refGrid(b).map(x => x * Math.PI / 180);
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.sqrt(h)); }

sect("Scor: funcția pură");
let p = await newPage();
const rec = (call, band, mode, extra) => Object.assign({CALL: call, BAND: band, MODE: mode, CONTEST_ID: "X", QSO_DATE: "20260101", TIME_ON: "1200", _id: Math.random()}, extra || {});
const recs = [rec("DL1ABC", "20m", "CW", {TIME_ON: "1200"}), rec("OK1XYZ", "20m", "CW", {TIME_ON: "1201"}), rec("DL1ABC", "20m", "CW", {TIME_ON: "1202"}), rec("DL1ABC", "40m", "CW", {TIME_ON: "1203"}), rec("W1AW", "20m", "SSB", {TIME_ON: "1204"}), rec("F5ABC", "20m", "CW", {CONTEST_ID: "ALTUL"})];
const sc = cfg => p.evaluate(([r, c]) => window.__qso.APP.contestScore(r, c, "X", Date.UTC(2026, 0, 1, 13, 0, 0)), [recs, cfg]);
let r = await sc({mode: "fix", pph: 1, mult: "none"});
eq([r.valid, r.dup, r.pts, r.mults, r.score], [4, 1, 4, null, 4], "fix, fără multiplicatori: duplicat neluat în calcul, alt concurs ignorat");
r = await sc({mode: "fix", pph: 1, mult: "entity"});
eq([r.mults, r.score], [3, 12], "entități: Germania, Cehia, SUA = 3 → 4×3");
r = await sc({mode: "fix", pph: 1, mult: "entity", perBand: true});
eq([r.mults, r.score], [4, 16], "entități separat pe bandă: DE20, CZ20, DE40, US20 = 4 → 16");
r = await sc({mode: "mode", pph: 1, pcw: 2, pdg: 3, mult: "none"});
eq(r.score, 2 + 2 + 2 + 1, "puncte după mod: 3 CW×2 + 1 fonie");
r = await sc({mode: "fix", pph: 1, mult: "wpx"});
eq(r.mults, 3, "prefixe WPX: DL1, OK1, W1");
r = await sc({mode: "fix", pph: 5, mult: "none"});
eq(r.score, 20, "puncte fixe 5 × 4 QSO");
r = await sc({mode: "fix", mult: "none"});
eq(r.valid, 4, "rata: toate cele 4 QSO valide (12:00–12:04) sunt în ultima oră la 13:00 → 4 sau mai puțin");
ok(r.rate60 === 4 && r.rate10 === 0, "ritm 60 min = 4, 10 min = 0 (" + r.rate60 + "," + r.rate10 + ")");
const r2 = await p.evaluate(([rr]) => window.__qso.APP.contestScore(rr, {mode: "fix"}, "X", Date.UTC(2026, 0, 1, 12, 8, 0)), [recs]);
ok(r2.rate10 === 24 && r2.rate60 === 4, "la 12:08: 4 QSO valide în 10 min → ritm extrapolat 24/h " + JSON.stringify([r2.rate60, r2.rate10]));
// grile
const gr = [rec("DL1ABC", "20m", "CW", {GRIDSQUARE: "JN58", MY_GRIDSQUARE: "KN34"}), rec("OK1XYZ", "20m", "CW", {GRIDSQUARE: "JN69", MY_GRIDSQUARE: "KN34"}), rec("SP9ABC", "20m", "CW", {GRIDSQUARE: "JO90", MY_GRIDSQUARE: "KN34", SRX_STRING: "05"}), rec("YO3AAA", "20m", "CW", {})];
const km = await p.evaluate(([g]) => window.__qso.APP.contestScore(g, {mode: "km", km: 100, mult: "grid4"}, "X", Date.now()), [gr]);
const expPts = ["JN58", "JN69", "JO90"].map(g => Math.max(1, Math.floor(refKm("KN34", g) / 100))).reduce((a, b) => a + b, 0) + 1; // YO3AAA fără locator = 1
eq(km.pts, expPts, "puncte din distanță (referință independentă) + 1 fără locator");
eq(km.mults, 3, "multiplicatori pătrate locator (4): 3 distincte");
const fld = await p.evaluate(([g]) => window.__qso.APP.contestScore(g, {mode: "fix", mult: "field"}, "X", Date.now()), [gr]);
eq(fld.mults, 2, "câmpuri locator: JN, JO");
const ex = await p.evaluate(([g]) => window.__qso.APP.contestScore(g, {mode: "fix", mult: "exch"}, "X", Date.now()), [gr]);
eq(ex.mults, 1, "schimb primit: un singur '05'");
const bad = await p.evaluate(() => window.__qso.APP.normScore({mode: "<x>", pph: -5, pcw: 1e9, km: "abc", mult: "evil", perBand: "yes"}));
eq(bad, {mode: "fix", pph: 0, pcw: 100, pdg: 1, km: 100, mult: "none", perBand: false}, "configurare coruptă normalizată");
await p.__ctx.close();

sect("Scor în interfață");
p = await newPage();
await p.evaluate(() => { const {APP} = window.__qso; const pr = APP.curProfile(); pr.call = "YO3XYZ"; pr.grid = "KN34ln"; APP.persistNow(); APP.stationBadge(); });
await p.click("#contestBox summary"); await p.check("#c_on"); await p.fill("#c_id", "cq-ww-cw");
ok(await p.isVisible("#scorePanel"), "panou de scor vizibil când concursul e pornit");
ok((await p.textContent("#scorePanel")).includes("Niciun QSO"), "inițial: niciun QSO");
await p.selectOption("#f_mode", "CW"); await p.selectOption("#f_band", "20m");
await p.selectOption("#sc_mult", "entity");
await p.fill("#f_stxs", "05");
for (const c of ["DL1ABC", "OK1XYZ", "DL1ABC"]) { await p.fill("#f_call", c); await p.fill("#f_srx", "5"); await p.fill("#f_srxs", "14"); await p.click("#saveBtn"); }
eq([await p.textContent("#scoreQ"), await p.textContent("#scoreM"), await p.textContent("#scoreVal")], ["2", "2", "4"], "după 3 QSO (1 duplicat): 2 valide × 2 entități = 4");
ok(/1 duplicate/.test(await p.textContent("#scorePanel")), "duplicatul apare în panou");
await p.selectOption("#sc_mult", "none");
eq(await p.textContent("#scoreVal"), "2", "fără multiplicatori: 2 puncte");
await p.selectOption("#sc_mode", "mode"); await p.fill("#sc_pcw", "3");
eq(await p.textContent("#scoreVal"), "6", "CW = 3 puncte → 2×3");
// Cabrillo
await p.click("#tb-io"); await p.fill("#cb_contest", "CQ-WW-CW");
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#exCab")]);
const cab = fs.readFileSync(await dl.path(), "utf8");
ok(/CLAIMED-SCORE: 6\r?\n/.test(cab), "CLAIMED-SCORE = scorul din panou (6)");
const q = cab.split(/\r?\n/).filter(l => l.startsWith("QSO:"));
eq(q.length, 3, "3 linii QSO");
ok(/YO3XYZ +599 +001 +05 +DL1ABC +599 +005 +14/.test(q[0]), "linia QSO conține schimbul trimis (nr+șir) și primit: " + q[0]);
ok(/QSO 2\.0\.0/.test(cab), "CREATED-BY actualizat");
// persistență + reîncărcare
await p.waitForTimeout(400);
await p.reload(); await p.waitForFunction(() => window.__qso);
await p.evaluate(() => { document.getElementById("contestBox").open = true; });
const kept = await p.evaluate(() => window.__qso.APP.S.contest.score);
eq(kept.mode, "mode", "configurarea de scor persistă după reîncărcare"); eq(kept.pcw, 3, "pcw persistă");
eq(await p.inputValue("#sc_mode"), "mode", "controalele reflectă configurarea salvată");
ok(p.__errs.length === 0, "fără erori de pagină: " + p.__errs.join("|")); ok(p.__reqs.length === 0, "fără cereri de rețea");
// concursul oprit -> panou ascuns
await p.evaluate(() => { document.getElementById("contestBox").open = true; });
await p.uncheck("#c_on");
ok(!(await p.isVisible("#scorePanel")), "panou ascuns când concursul e oprit");
await p.__ctx.close();
await browser.close();
console.log(`\n==== ${pass} verificări reușite, ${fail} eșuate ====`);
process.exit(fail ? 1 : 0);
