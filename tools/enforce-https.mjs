#!/usr/bin/env node
// enforce-https — activează „Enforce HTTPS” (GitHub Pages) pe depozitele care nu îl au.
//
//   node tools/enforce-https.mjs [--owner chiuta] [--repos a,b,c | --file lista.txt] [--enable-pages] [--dry-run] [--wait 90]
//
//   fără --repos/--file   toate depozitele publice ale owner-ului (gh api users/<owner>/repos, paginat)
//   --enable-pages        dacă un depozit nu are Pages, îl activează (ramura main, /) înainte de HTTPS
//   --dry-run             doar raportează ce ar face; nu scrie nimic
//   --wait SEC            timp maxim de așteptare a certificatului TLS (implicit 90 s; 0 = nu aștepta)
//
// Necesită GitHub CLI (`gh`) autentificat cu drept de administrare pe depozite (scope `repo`; pentru depozite
// din organizații, rol de admin). Folosește doar REST (/repos/{o}/{r}/pages), nu GraphQL.
//
// Ce face, pe fiecare depozit:
//   1. GET /pages  → 404 = Pages inactiv (omis, sau activat cu --enable-pages); altfel citește https_enforced,
//      cname, https_certificate.state.
//   2. https_enforced deja true → „ok”, nu face nimic.
//   3. Domeniu propriu (cname) și certificatul încă nu e „approved” → așteaptă (poll) până la --wait secunde;
//      GitHub refuză (422) HTTPS înainte de emiterea certificatului. Dacă tot nu e gata: „în așteptare” (rulează din nou mai târziu).
//   4. PUT /pages {https_enforced:true}. Cod de ieșire 0 dacă nu sunt erori; 1 dacă a eșuat vreun depozit; 2 pentru utilizare greșită.
//
// Idempotent: poate fi rulat oricând, de oricâte ori.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const GH = process.env.GH_BIN || 'gh';
const argv = process.argv.slice(2);
const opt = {owner: 'chiuta', repos: null, file: null, enablePages: false, dry: false, wait: 90};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--owner') opt.owner = argv[++i];
  else if (a === '--repos') opt.repos = argv[++i];
  else if (a === '--file') opt.file = argv[++i];
  else if (a === '--enable-pages') opt.enablePages = true;
  else if (a === '--dry-run') opt.dry = true;
  else if (a === '--wait') opt.wait = Number(argv[++i]);
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
  else { console.error(`argument necunoscut: ${a}`); process.exit(2); }
}
if (!opt.owner || !Number.isFinite(opt.wait) || opt.wait < 0) { console.error('parametri invalizi'); process.exit(2); }

function gh(args, input) {
  const r = spawnSync(GH, args, {encoding: 'utf8', input});
  const out = (r.stdout || '').trim();
  let status = 0;
  const m = (r.stderr || '').match(/HTTP (\d{3})/) || out.match(/"status":\s*"?(\d{3})/);
  if (r.status !== 0) status = m ? Number(m[1]) : 1;
  let json = null;
  try { json = out ? JSON.parse(out) : null; } catch { /* nu e JSON */ }
  return {ok: r.status === 0, status, json, err: (r.stderr || out).trim().split('\n')[0] || ''};
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function listRepos() {
  if (opt.repos) return opt.repos.split(',').map((s) => s.trim()).filter(Boolean);
  if (opt.file) return fs.readFileSync(opt.file, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  const names = [];
  for (let p = 1; p < 50; p++) {
    const r = gh(['api', `users/${opt.owner}/repos?per_page=100&type=owner&page=${p}`]);
    if (!r.ok || !Array.isArray(r.json)) { console.error(`nu pot lista depozitele: ${r.err}`); process.exit(1); }
    for (const x of r.json) if (!x.archived && !x.fork && !x.private) names.push(x.name);
    if (r.json.length < 100) break;
  }
  return names;
}

async function one(repo) {
  const base = `repos/${opt.owner}/${repo}/pages`;
  let g = gh(['api', base]);
  if (g.status === 404) {
    if (!opt.enablePages) return ['omis', 'Pages inactiv (folosește --enable-pages ca să-l activezi)'];
    if (opt.dry) return ['de făcut', 'ar activa Pages (main, /) și apoi HTTPS'];
    const c = gh(['api', '-X', 'POST', base, '-F', 'source[branch]=main', '-F', 'source[path]=/']);
    if (!c.ok) return ['EROARE', `activare Pages: ${c.err}`];
    g = gh(['api', base]);
  }
  if (!g.ok || !g.json) return ['EROARE', `citire Pages: ${g.err}`];
  const p = g.json;
  if (p.https_enforced === true) return ['ok', 'HTTPS deja impus'];
  if (opt.dry) return ['de făcut', `ar impune HTTPS${p.cname ? ` (domeniu ${p.cname}, certificat: ${p.https_certificate?.state || 'necunoscut'})` : ''}`];

  // domeniu propriu: certificatul trebuie să fie emis înainte
  let cert = p.https_certificate?.state;
  const t0 = Date.now();
  while (p.cname && cert && cert !== 'approved' && (Date.now() - t0) / 1000 < opt.wait) {
    await sleep(5000);
    const r = gh(['api', base]);
    cert = r.json?.https_certificate?.state;
    if (r.json?.https_enforced) return ['ok', 'HTTPS impus între timp'];
  }
  if (p.cname && cert && cert !== 'approved') return ['în așteptare', `certificatul TLS nu e încă emis (stare: ${cert}); rulează din nou mai târziu`];

  const u = gh(['api', '-X', 'PUT', base, '-F', 'https_enforced=true']);
  if (u.ok) return ['activat', 'HTTPS impus'];
  if (u.status === 422) return ['în așteptare', `GitHub refuză încă (422): ${u.err}`];
  return ['EROARE', `PUT: ${u.err}`];
}

const repos = listRepos();
console.log(`${opt.dry ? '[dry-run] ' : ''}${repos.length} depozite (${opt.owner})`);
const tally = {};
let bad = 0;
for (const r of repos) {
  const [st, msg] = await one(r);
  tally[st] = (tally[st] || 0) + 1;
  if (st === 'EROARE') bad++;
  if (st !== 'ok') console.log(`${st.padEnd(13)} ${r}: ${msg}`);
}
console.log(Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join(' · '));
process.exit(bad ? 1 : 0);
