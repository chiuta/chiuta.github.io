#!/usr/bin/env node
// Documentația multilingvă (8 limbi) a unei aplicații alpha: README, CHANGELOG, ISSUES_GOOD_FIRST, CONTRIBUTING, good-first-issues.txt.
// Pornește de la fișierele existente (titluri, comutator de limbi, licență, sprijin rămân neschimbate) și rescrie doar ce depinde de aplicație.
// Idempotent: o a doua rulare nu schimbă nimic. Utilizare: node tools/alpha/docs.mjs <slug> [--root DIR] [--check]
//   specificația: tools/alpha/docs/<slug>.mjs (export default async (root) => spec)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {PWA} from './docs/_pwa.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const CL = {
  en: {added: 'Added', changed: 'Changed', fixed: 'Fixed'}, ro: {added: 'Adăugat', changed: 'Modificat', fixed: 'Corectat'},
  fr: {added: 'Ajouté', changed: 'Modifié', fixed: 'Corrigé'}, it: {added: 'Aggiunto', changed: 'Modificato', fixed: 'Corretto'},
  es: {added: 'Añadido', changed: 'Cambiado', fixed: 'Corregido'}, pt: {added: 'Adicionado', changed: 'Alterado', fixed: 'Corrigido'},
  de: {added: 'Hinzugefügt', changed: 'Geändert', fixed: 'Behoben'}, hu: {added: 'Hozzáadva', changed: 'Módosítva', fixed: 'Javítva'}
};
const fileOf = (base, l) => base + (l === 'en' ? '' : '.' + l) + '.md';

/** Împarte un fișier markdown în antet (înainte de primul «## ») și secțiuni {title, body}. */
export function splitSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const head = [], sections = [];
  let cur = null;
  for (const line of lines) {
    const m = /^## (.*)$/.exec(line);
    if (m) { cur = {title: m[1].trim(), lines: []}; sections.push(cur); } else if (cur) cur.lines.push(line); else head.push(line);
  }
  return {head: head.join('\n').replace(/\s+$/, ''), sections: sections.map((s) => ({title: s.title, body: s.lines.join('\n').replace(/^\n+|\s+$/g, '')}))};
}
export function joinSections(head, sections) {
  return head + '\n\n' + sections.map((s) => '## ' + s.title + '\n\n' + s.body).join('\n\n') + '\n';
}
const bumpLine = (head, version, updated) => head.replace(/^(.+?: )\d+\.\d+\.\d+( · .+?: )\d{4}-\d{2}-\d{2}$/m, '$1' + version + '$2' + updated);
const bullets = (arr) => arr.map((x) => '- ' + x).join('\n');
function req(spec, key, l) {
  const v = spec[key] && spec[key][l];
  if (v === undefined || (Array.isArray(v) && !v.length) || v === '') throw new Error(`specificație: «${key}» lipsește pentru limba ${l}`);
  return v;
}

/** Înlocuiește primul bloc de rânduri numerotate («1. …», «2. …», …) dintr-un text cu `steps` (rânduri numerotate, unul pe pas). */
export function swapSteps(text, steps) {
  const lines = text.split('\n');
  const a = lines.findIndex((x) => /^1\. /.test(x));
  if (a < 0) throw new Error('nu găsesc lista numerotată de pași');
  let b = a;
  while (b < lines.length && /^[0-9]+\. /.test(lines[b])) b++;
  return [...lines.slice(0, a), ...steps.replace(/\s+$/, '').split('\n'), ...lines.slice(b)].join('\n');
}

export function renderReadme(old, spec, l) {
  const {head, sections} = splitSections(old);
  // secțiunea de contribuție: lista numerotată care cere `scripts/validate.py` (nu o secțiune care doar pomenește «validator»)
  let iContrib = sections.findIndex((s) => /scripts\/validate\.py/.test(s.body) && /^1\./m.test(s.body));
  if (iContrib < 0) iContrib = sections.findIndex((s) => /validate/.test(s.body) && /^1\./m.test(s.body));
  if (iContrib < 2) throw new Error('README: nu găsesc secțiunea de contribuție (' + l + ')');
  const status = sections[0];
  const h = spec.headings;
  const news = [
    {title: status.title, body: req(spec, 'status', l)},
    {title: req(h, 'does', l), body: bullets(req(spec, 'does', l))},
    {title: req(h, 'how', l), body: bullets(req(spec, 'how', l))},
    {title: req(h, 'limits', l), body: bullets(req(spec, 'limits', l))}
  ];
  const contrib = sections[iContrib];
  let body = contrib.body;
  if (spec.steps) body = swapSteps(body, req(spec, 'steps', l));   // lista întreagă a pașilor vine din specificație
  else {
    const extra = req(spec, 'extraSteps', l);
    const first = extra.split('`')[0] + '`' + (extra.split('`')[1] || '');   // început stabil pentru detectare
    if (!body.includes(first)) body = body.replace(/\s+$/, '') + '\n' + extra;
  }
  const rest = sections.slice(iContrib + 1);
  // secțiunea de licență (singura de după contribuție care pomenește «MIT»): se rescrie doar dacă specificația dă `license`
  if (spec.license) {
    const j = rest.findIndex((s) => /\bMIT\b/.test(s.body));
    if (j < 0) throw new Error('README: nu găsesc secțiunea de licență (' + l + ')');
    rest[j] = {title: rest[j].title, body: req(spec, 'license', l)};
  }
  return joinSections(bumpLine(head, spec.version, spec.updated), [...news, {title: contrib.title, body}, ...rest]);
}

export function renderChangelog(old, spec, l) {
  const t = old.replace(/\r\n/g, '\n');
  const i = t.indexOf('\n## [');
  const head = t.slice(0, i).replace(/\s+$/, '');
  const blocks = t.slice(i + 1).split(/\n(?=## \[)/).map((b) => b.replace(/\s+$/, ''));
  const unreleased = blocks[0];
  const others = blocks.slice(1).filter((b) => !b.startsWith('## [' + spec.version + ']'));
  const w = CL[l];
  const own = req(spec.changelog, 'added', l);
  const stray = (unreleased.match(/^- .*$/gm) || []).map((x) => x.replace(/^- /, '')).filter((x) => !own.includes(x));
  if (stray.length) throw new Error('CHANGELOG (' + l + '): în [Unreleased] există rânduri care nu sunt în specificație: ' + stray[0]);
  const added = own;
  let block = '## [' + spec.version + '] - ' + spec.updated + '\n\n### ' + w.added + '\n' + bullets(added);
  const changed = (spec.changelog.changed && spec.changelog.changed[l]) || [];
  if (changed.length) block += '\n\n### ' + w.changed + '\n' + bullets(changed);
  const fixed = (spec.changelog.fixed && spec.changelog.fixed[l]) || [];
  if (fixed.length) block += '\n\n### ' + w.fixed + '\n' + bullets(fixed);
  const unreleasedHeading = unreleased.split('\n')[0];
  return head + '\n\n' + [unreleasedHeading, block, ...others].join('\n\n') + '\n';
}

export function renderIssues(old, spec, l) {
  const lines = old.replace(/\r\n/g, '\n').split('\n');
  const firstItem = lines.findIndex((x) => x.startsWith('- ['));
  const lastItem = lines.length - 1 - [...lines].reverse().findIndex((x) => x.startsWith('- ['));
  const head = lines.slice(0, firstItem).join('\n').replace(/\s+$/, '');
  const foot = lines.slice(lastItem + 1).join('\n').replace(/^\s+|\s+$/g, '');
  return head + '\n\n' + req(spec, 'issues', l).map((x) => '- [ ] ' + x).join('\n') + '\n\n' + foot + '\n';
}

export function renderContributing(old, spec, l) {
  const parts = splitSections(old);
  const sections = parts.sections;
  const head = spec.steps ? swapSteps(parts.head, req(spec, 'steps', l)) : parts.head;
  // regula de pe primul rând din «Rules» (prima secțiune): se schimbă doar dacă specificația o cere
  if (spec.firstRule && sections.length) sections[0].body = sections[0].body.replace(/^- .*$/m, () => '- ' + req(spec, 'firstRule', l));
  const title = req(spec.contrib, 'heading', l), body = req(spec.contrib, 'body', l).replace(/\s+$/, '');
  const i = sections.findIndex((s) => s.title === title);
  if (i >= 0) sections[i].body = body; else sections.push({title, body});
  return joinSections(bumpLine(head, spec.version, spec.updated), sections);
}

/** Aplicațiile cu «pwa» în src/app.json primesc, în toate cele 8 limbi, rândurile comune despre instalare/offline (tools/alpha/docs/_pwa.mjs). */
export function withPwa(spec, dir) {
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'app.json'), 'utf8')); } catch { /* fără src/app.json */ }
  if (!cfg || !cfg.pwa) return spec;
  for (const l of LANGS) {
    spec.does[l] = [...spec.does[l], cfg.connect && cfg.connect.length ? PWA.doesNet[l] : PWA.does[l]];   // cu «connect»: nu se afirmă că nu se trimite nimic
    spec.how[l] = [...spec.how[l], PWA.how[l]];
    spec.changelog.added[l] = [...spec.changelog.added[l], PWA.added[l]];
  }
  return spec;
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const ri = args.indexOf('--root');
  const root = path.resolve(ri >= 0 ? args.splice(ri, 2)[1] : path.join(HERE, '..', '..', '..'));
  const slug = args.filter((a) => !a.startsWith('--'))[0];
  if (!slug) { console.error('utilizare: node tools/alpha/docs.mjs <slug> [--root DIR] [--check]'); process.exit(2); }
  const spec = await (await import(pathToFileURL(path.join(HERE, 'docs', slug + '.mjs')).href)).default(root);
  const dir = path.join(root, slug);
  withPwa(spec, dir);
  const outs = [];
  for (const l of LANGS) {
    const jobs = [['README', renderReadme], ['CHANGELOG', renderChangelog], ['ISSUES_GOOD_FIRST', renderIssues], ['CONTRIBUTING', renderContributing]];
    for (const [base, fn] of jobs) {
      const f = path.join(dir, fileOf(base, l));
      outs.push([f, fn(fs.readFileSync(f, 'utf8'), spec, l)]);
    }
  }
  outs.push([path.join(dir, 'good-first-issues.txt'), spec.issues.en.join('\n') + '\n']);
  let changed = 0;
  for (const [f, text] of outs) {
    const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    if (cur === text) continue;
    changed++;
    if (check) console.log('diferă: ' + path.relative(root, f)); else fs.writeFileSync(f, text);
  }
  console.log(check ? (changed ? changed + ' fișiere diferă de specificație' : 'documentația corespunde specificației') : changed + ' fișiere scrise');
  process.exit(check && changed ? 1 : 0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
