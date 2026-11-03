// Parsere „watch” fără instantaneu de date: pagina încă menționează valorile așteptate (page-mentions), modelele HF există (hf-models),
// fișierele fixate au încă hash-ul declarat (sha256-pinned).
import {createHash} from 'node:crypto';
import {fetchOk, htmlToLines, parseJson, err} from './common.mjs';

export const pageMentions = {
  version: 1, kind: 'watch',
  async run(src, http) {
    const exp = src.expect || {}, r = await fetchOk(http, src, src.url), raw = http.text(r), txt = htmlToLines(raw).join('\n').toLowerCase(), low = raw.toLowerCase();
    if (raw.length < (exp.minBytes ?? 500)) throw err('validation', `pagina e prea scurtă (${raw.length} B): probabil blocată sau randată din JavaScript`);
    const checks = (exp.contains || []).map((t) => ({k: t, ok: txt.includes(t.toLowerCase()) || low.includes(t.toLowerCase()), detail: ''}));
    checks.forEach((c) => { c.detail = c.ok ? 'găsit' : 'nu mai apare în pagină'; });
    return {checks, summary: {bytes: raw.length}};
  },
};

export const hfModels = {
  version: 1, kind: 'watch',
  async run(src, http) {
    const checks = [];
    for (const id of src.expect.models) {
      const url = `https://huggingface.co/api/models/${id}`;
      const a = await http.allowed(url); if (!a.ok) throw err('robots', a.why);
      const r = await http.get(url);
      if (r.status === 404) { checks.push({k: id, ok: false, detail: 'nu mai există (404)'}); continue; }
      if (r.status < 200 || r.status >= 300) throw err('http', `HTTP ${r.status} la ${url}`);
      const j = parseJson(http.text(r), 'Hugging Face');
      const moved = typeof j.id === 'string' && j.id.toLowerCase() !== id.toLowerCase();
      checks.push({k: id, ok: !moved && !j.disabled, detail: moved ? `redenumit în ${j.id}` : j.disabled ? 'dezactivat' : 'ok' + (j.lastModified ? ` (modificat ${String(j.lastModified).slice(0, 10)})` : '')});
    }
    return {checks, summary: {models: checks.length}};
  },
};

export const sha256Pinned = {
  version: 1, kind: 'watch',
  async run(src, http) {
    const checks = [];
    for (const f of src.expect.files) {
      const r = await fetchOk(http, src, f.url), got = createHash('sha256').update(r.body).digest('hex');
      checks.push({k: f.name, ok: got === f.sha256, detail: got === f.sha256 ? `hash identic (${r.body.length} B)` : `hash diferit: ${got.slice(0, 16)}… ≠ ${f.sha256.slice(0, 16)}…`});
    }
    return {checks, summary: {files: checks.length}};
  },
};
