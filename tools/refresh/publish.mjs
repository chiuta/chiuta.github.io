#!/usr/bin/env node
/* tools/refresh/publish.mjs — din rezultatul alergătorului (.refresh-out) la PR-uri, issue-uri și comiterea sănătății surselor (Etapa 8.3–8.5).
 *
 *   node tools/refresh/publish.mjs [--out .refresh-out] [--dry-run] [--skip-gate] [--gate-tests] [--no-health]
 *   Mediu: GH_TOKEN (sau gh autentificat), GITHUB_REPOSITORY=owner/depozit, opțional GITHUB_RUN_ID/GITHUB_SERVER_URL pentru linkul din issue.
 *
 *   • sursă „data” cu date noi, valide → ramura data-refresh/<id> (de la origin/main), poarta gate.mjs, commit, push, PR (creat sau actualizat).
 *       Auto-fuziune (REST, squash) NUMAI dacă alergătorul a marcat diferența ca mică (autoMerge) ȘI poarta a trecut; altfel PR-ul așteaptă aprobare umană.
 *   • sursă respinsă / deriva / eroare → issue (un singur issue deschis per sursă; comentariu doar când mesajul se schimbă). Erorile de rețea/HTTP
 *     deschid issue abia la al doilea eșec consecutiv. La refacere, issue-ul se comentează și se închide.
 *   • sănătatea surselor (data/source-health.json) + meta derivată (catalog-meta, #source-health, transparenta) → un commit direct pe main.
 * Folosește doar API-ul REST (`gh api`), nu GraphQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {HUB, readJson, loadSources} from './lib.mjs';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(val('--out', '.refresh-out')), DRY = argv.includes('--dry-run'), NOGATE = argv.includes('--skip-gate'), GATE_TESTS = argv.includes('--gate-tests'), NOHEALTH = argv.includes('--no-health');
const REPO = process.env.GITHUB_REPOSITORY || val('--repo', 'chiuta/chiuta.github.io'), BASE = val('--base', 'main');
const WORK = path.resolve(val('--work', HUB));
const RUN_URL = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
const NAME = process.env.REFRESH_GIT_NAME || 'Alexio', EMAIL = process.env.REFRESH_GIT_EMAIL || 'alexio@trom.tf';
const log = (...a) => console.log(...a);

const run = (cmd, args, o = {}) => { const r = spawnSync(cmd, args, {cwd: WORK, encoding: 'utf8', input: o.input, maxBuffer: 64 << 20}); if (r.status !== 0 && !o.soft) throw new Error(`${cmd} ${args.join(' ').slice(0, 80)} → ${r.status}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`); return r; };
const git = (...a) => run('git', ['-c', `user.name=${NAME}`, '-c', `user.email=${EMAIL}`, ...a]);
function gh(method, route, body, soft) {
  if (DRY && method !== 'GET') { log(`[dry-run] gh api -X ${method} ${route} ${body ? JSON.stringify(body).slice(0, 160) : ''}`); return {number: 0, html_url: '(dry-run)', _dry: true}; }
  const r = run('gh', ['api', '-X', method, route, ...(body ? ['--input', '-'] : [])], {input: body ? JSON.stringify(body) : undefined, soft});
  if (r.status !== 0) return null;
  try { return r.stdout.trim() ? JSON.parse(r.stdout) : {}; } catch { return {}; }
}
const labelsDone = new Set();
function ensureLabel(name, color, description) { if (labelsDone.has(name)) return; labelsDone.add(name); gh('POST', `repos/${REPO}/labels`, {name, color, description}, true); }

const RES = readJson(path.join(OUT, 'result.json'));
const S = loadSources(), srcById = Object.fromEntries(S.sources.map((s) => [s.id, s]));
const health = readJson(path.join(OUT, 'data', 'source-health.json'), readJson(path.join(WORK, 'data', 'source-health.json'), {sources: {}}));
const done = [];

/* ---------- PR-uri pentru date noi ---------- */
const bodyPR = (o, src, gateInfo) => [
  `Reîmprospătare automată a sursei **${o.id}** (aplicația ${o.app}; cadență: ${o.cadence}; ${src.url || src.urls[0]}).`, '',
  `- înregistrări: **${o.count}**${o.diff ? ` · diferență: +${o.diff.added} −${o.diff.removed} ~${o.diff.changed}` : ' · prima captură (nimic de comparat)'}`,
  `- acțiune: \`${o.action}\`${o.autoMerge ? ' · diferență mică validată → fuziune automată' : ' · **necesită aprobare umană**'}`,
  `- arhivă (revenire): ${o.archive ? '`' + o.archive + '`' : 'nu e cazul (prima captură)'}`,
  ...(o.diff ? ['', ...['addedSample', 'removedSample', 'changedSample'].flatMap((k) => (o.diff[k] && o.diff[k].length ? [`**${{addedSample: 'Adăugate', removedSample: 'Șterse', changedSample: 'Modificate'}[k]}** (primele ${o.diff[k].length}):`, ...o.diff[k].map((x) => '- ' + x), ''] : []))] : []),
  ...(o.summary && o.summary.deviationsFromApp && o.summary.deviationsFromApp.length ? ['**Diferențe față de valorile din aplicație** (modificarea aplicației rămâne manuală):', ...o.summary.deviationsFromApp.map((x) => '- ' + x), ''] : []),
  ...(o.summary && o.summary.warning ? [`Atenție: ${o.summary.warning}`, ''] : []),
  `Porți: ${gateInfo}`, ...(RUN_URL ? ['', `Rulare: ${RUN_URL}`] : []),
  '', 'Instantaneul păstrează doar datele validate de schemă și praguri; nu modifică aplicațiile (acolo, actualizarea rămâne o decizie a autorului).'].join('\n');

function publishData(o) {
  const src = srcById[o.id], branch = `data-refresh/${o.id}`;
  const files = [`data/refresh/${o.id}.json`, ...(o.archive ? [o.archive] : [])];
  log(`\n== ${o.id}: PR pe ${branch} (${o.action}, ${o.count} înregistrări)`);
  if (DRY) { log('[dry-run] fișiere:', files.join(', ')); gh('POST', `repos/${REPO}/pulls`, {title: `Date reîmprospătate: ${o.id}`, head: branch, base: BASE}); return; }
  git('fetch', '-q', 'origin', BASE); git('checkout', '-q', '-B', branch, `origin/${BASE}`);
  try {
    for (const f of files) { fs.mkdirSync(path.dirname(path.join(WORK, f)), {recursive: true}); fs.copyFileSync(path.join(OUT, f), path.join(WORK, f)); }
    let gateInfo = 'ocolite (--skip-gate)', gateOk = true;
    if (!NOGATE) {
      const g = run('node', [path.join(HUB, 'tools', 'refresh', 'gate.mjs'), ...(GATE_TESTS ? ['--tests'] : []), '--base', `origin/${BASE}`], {soft: true});
      gateOk = g.status === 0; gateInfo = (gateOk ? 'toate trec' : 'PICĂ') + ' (schemă, sync-catalog --check, fixcsp, transparenta --check' + (GATE_TESTS ? ', teste' : '') + ')';
      if (!gateOk) { log(g.stdout); alert({id: o.id, errorType: 'validation', reasons: [{type: 'validation', msg: 'porțile dinaintea comiterii pică: ' + g.stdout.split('\n').filter((l) => /^FAIL/.test(l)).join(' | ').slice(0, 300)}]}); return; }
    }
    git('add', ...files);
    if (run('git', ['diff', '--cached', '--quiet'], {soft: true}).status === 0) { log('nimic de comis (instantaneul coincide cu main)'); return; }
    git('commit', '-q', '-m', `Date reîmprospătate: ${o.id} (${o.action}, ${o.count} înregistrări${o.diff ? `, +${o.diff.added} −${o.diff.removed} ~${o.diff.changed}` : ''})`);
    git('push', '-q', '--force-with-lease', 'origin', branch);
    ensureLabel('data-refresh', '0e8a16', 'Reîmprospătare automată a datelor externe'); ensureLabel('needs-human', 'd93f0b', 'Necesită aprobare umană');
    const open = gh('GET', `repos/${REPO}/pulls?state=open&head=${REPO.split('/')[0]}:${encodeURIComponent(branch)}`) || [];
    const title = `Date reîmprospătate: ${o.id}`, body = bodyPR(o, src, gateInfo);
    let pr = open[0];
    if (pr) gh('PATCH', `repos/${REPO}/pulls/${pr.number}`, {title, body}); else {
      try { pr = gh('POST', `repos/${REPO}/pulls`, {title, head: branch, base: BASE, body}); }
      catch (e) {
        if (!/not permitted to create|pull request/i.test(String(e.message))) throw e;
        // Setarea depozitului „Allow GitHub Actions to create and approve pull requests” e oprită: ramura e împinsă, deschidem un issue cu legătura de comparare.
        ensureLabel('data-refresh', '0e8a16', 'Reîmprospătare automată a datelor externe');
        const marker = `<!-- refresh-pr:${o.id} -->`, cmp = `https://github.com/${REPO}/compare/${BASE}...${encodeURIComponent(branch)}?expand=1`;
        const ib = [marker, `Ramura \`${branch}\` conține datele reîmprospătate pentru \`${o.id}\` (${o.action}, ${o.count} înregistrări). Actions nu are voie să creeze pull request-uri în acest depozit (Settings → Actions → General → „Allow GitHub Actions to create and approve pull requests”).`, '', `Deschide PR-ul manual: ${cmp}`, '', body, ...(RUN_URL ? ['', `Rulare: ${RUN_URL}`] : [])].join('\n');
        const ex = (gh('GET', `repos/${REPO}/issues?state=open&labels=data-refresh&per_page=100`) || []).find((i) => (i.body || '').includes(marker));
        if (ex) gh('PATCH', `repos/${REPO}/issues/${ex.number}`, {body: ib}); else gh('POST', `repos/${REPO}/issues`, {title: `[refresh] Ramură gata de PR: ${o.id}`, body: ib, labels: ['data-refresh', 'needs-human']});
        log(`${o.id}: PR imposibil din Actions; issue cu legătura de comparare`); done.push({id: o.id, branch, pr: null}); return;
      }
    }
    gh('POST', `repos/${REPO}/issues/${pr.number}/labels`, {labels: o.autoMerge ? ['data-refresh'] : ['data-refresh', 'needs-human']}, true);
    if (o.autoMerge && gateOk) {
      const m = gh('PUT', `repos/${REPO}/pulls/${pr.number}/merge`, {merge_method: 'squash', commit_title: title + ' (fuziune automată)'}, true);
      log(m && !m._dry && m.merged ? `PR #${pr.number} fuzionat automat` : m && m._dry ? '' : `PR #${pr.number}: fuziunea automată a eșuat — rămâne deschis`);
    } else log(`PR #${pr.number} deschis; așteaptă aprobare umană${o.autoMerge ? '' : ` (${o.action === 'initial' ? 'prima captură' : 'diferență peste pragul de auto-fuziune'} sau sursă fără auto-fuziune)`}`);
    done.push({id: o.id, pr: pr.number});
  } finally { git('checkout', '-q', '--force', BASE); }
}

/* ---------- issue-uri ---------- */
const HINT = {
  structure: 'Structura sursei s-a schimbat. Deschide pagina/API-ul, compară cu `tools/refresh/fixtures/<id>/ok` și actualizează parserul (sau confirmă schimbarea).',
  threshold: 'Numărul de înregistrări a ieșit din praguri (scădere >20% sau creștere >40%). Nimic nu s-a aplicat. Verifică dacă sursa și-a schimbat conținutul sau doar paginarea.',
  validation: 'Conținutul nu trece validarea (schemă / acoperire față de aplicație). Nimic nu s-a aplicat.',
  drift: 'Valoarea așteptată nu mai apare / API-ul și-a schimbat forma. Aplicația poate depinde de ea: verifică și actualizează aplicația sau lista așteptată din `data/sources.json`.',
  robots: 'robots.txt interzice (sau nu poate fi citit). Sursa NU s-a descărcat. Dacă interdicția e permanentă, treci sursa pe `stare: "oprit"` cu `motivOprire`.',
  parse: 'Răspunsul nu a putut fi interpretat (format neașteptat). Nimic nu s-a aplicat; descarcă artefactul `refresh-recordings` al rulării pentru a vedea răspunsul real.',
  network: 'Eroare de rețea. Dacă persistă, sursa e căzută sau a blocat cererile.', http: 'Răspuns HTTP neașteptat. Dacă persistă, sursa s-a mutat sau a căzut.', unconfirmed: 'Sursa are elemente „de confirmat” în data/sources.json.',
};
const issuesOpen = () => gh('GET', `repos/${REPO}/issues?state=open&labels=refresh-alert&per_page=100`) || [];
function alert(o) {
  const type = o.errorType || (o.reasons[0] && o.reasons[0].type) || 'parse', src = srcById[o.id] || {}, h = (health.sources || {})[o.id] || {};
  const tech = type === 'network' || type === 'http';
  if (tech && (h.consecutiveFails || 1) < 2) { log(`${o.id}: eroare ${type} (prima) — fără issue încă`); return; }
  const msg = o.reasons.map((r) => `- **${r.type}**: ${r.msg}`).join('\n'), marker = `<!-- refresh:${o.id} -->`;
  const body = [marker, `**Sursa:** \`${o.id}\` (aplicația ${o.app || src.app}) · cadență ${o.cadence || src.cadenta} · ${src.url || (src.urls || [])[0] || ''}`, '', `**Tip:** \`${type}\``, '', msg, '', `**Ce înseamnă:** ${HINT[type] || ''}`, '', 'Datele din depozit au rămas neschimbate.', ...(RUN_URL ? ['', `Rulare: ${RUN_URL}`] : []), `<!-- sig:${type}:${o.reasons.map((r) => r.msg).join('|').slice(0, 200)} -->`].join('\n');
  const sig = `<!-- sig:${type}:${o.reasons.map((r) => r.msg).join('|').slice(0, 200)} -->`;
  const ex = issuesOpen().find((i) => (i.body || '').includes(marker));
  ensureLabel('refresh-alert', 'fbca04', 'Alertă a reîmprospătării surselor externe');
  if (ex) { if ((ex.body || '').includes(sig)) { log(`${o.id}: issue #${ex.number} deja deschis, același mesaj`); return; } gh('PATCH', `repos/${REPO}/issues/${ex.number}`, {body}); gh('POST', `repos/${REPO}/issues/${ex.number}/comments`, {body: `Mesaj nou la rularea următoare:\n${msg}`}); log(`${o.id}: issue #${ex.number} actualizat`); }
  else { const i = gh('POST', `repos/${REPO}/issues`, {title: `[refresh] ${o.id}: ${type}`, body, labels: ['refresh-alert']}); log(`${o.id}: issue deschis ${i && i.html_url}`); }
}
function recover(ids) {
  const open = issuesOpen();
  for (const id of ids) { const ex = open.find((i) => (i.body || '').includes(`<!-- refresh:${id} -->`)); if (!ex) continue;
    gh('POST', `repos/${REPO}/issues/${ex.number}/comments`, {body: `Sursa \`${id}\` a trecut din nou validarea${RUN_URL ? ` (${RUN_URL})` : ''}. Închid issue-ul.`}); gh('PATCH', `repos/${REPO}/issues/${ex.number}`, {state: 'closed', state_reason: 'completed'}); log(`${id}: issue #${ex.number} închis (refăcut)`); }
}

let FAILED = 0;
for (const o of RES.results.filter((r) => r.status === 'changed' && r.kind === 'data')) { try { publishData(o); } catch (e) { FAILED++; console.error(`${o.id}: publicare eșuată: ${e.message}`); } }
for (const o of RES.results.filter((r) => r.status === 'alert' || r.status === 'error')) alert(o);
recover(RES.results.filter((r) => r.status === 'ok' || r.status === 'changed').map((r) => r.id));

/* ---------- sănătatea surselor + meta, direct pe main ---------- */
if (!NOHEALTH && !DRY) {
  // Fișierele derivate (index.html, sw.js, transparenta.html) se regenerează de la zero pe vârful curent al lui main la fiecare încercare: fără rebase, deci fără conflicte.
  const f = 'data/source-health.json'; let pushed = false, any = false;
  for (let i = 0; i < 4 && !pushed; i++) {
    git('fetch', '-q', 'origin', BASE); git('checkout', '-q', '--force', BASE); git('reset', '-q', '--hard', `origin/${BASE}`); git('clean', '-fdq');
    fs.copyFileSync(path.join(OUT, f), path.join(WORK, f));
    run('node', [path.join(HUB, 'tools', 'refresh', 'meta.mjs'), 'sync']);
    if (!run('git', ['status', '--porcelain', '--', 'data', 'index.html', 'sw.js', 'transparenta.html'], {soft: true}).stdout.trim()) { log('sănătatea surselor: nicio schimbare de comis'); break; }
    any = true;
    if (!NOGATE && i === 0) { const g = run('node', [path.join(HUB, 'tools', 'refresh', 'gate.mjs'), ...(GATE_TESTS ? ['--tests'] : []), '--base', `origin/${BASE}`], {soft: true}); log(g.stdout); if (g.status !== 0) { git('checkout', '-q', '--force', BASE); git('clean', '-fdq'); throw new Error('porțile pică pentru commitul de sănătate; nu se comite'); } }
    git('add', '-A', 'data', 'index.html', 'sw.js', 'transparenta.html');
    git('commit', '-q', '-m', `Sănătatea surselor externe: ${RES.date}`);
    if (run('git', ['push', '-q', 'origin', `HEAD:${BASE}`], {soft: true}).status === 0) { pushed = true; log('sănătatea surselor comisă pe ' + BASE); }
  }
  if (any && !pushed) throw new Error('commitul de sănătate nu a putut fi împins după 4 încercări');
} else if (DRY) log('\n[dry-run] sănătatea surselor: ar rula meta.mjs sync și un commit direct pe ' + BASE);
log('\nPublicare terminată:', JSON.stringify(done));
if (FAILED) process.exit(1);
