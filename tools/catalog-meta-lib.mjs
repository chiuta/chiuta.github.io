// Funcții comune pentru metadatele de catalog (data/catalog-meta.json): folosite de tools/sync-catalog.mjs și de teste.
// Fără dependențe externe.
import fs from 'node:fs';
import path from 'node:path';

export const STATUSES = ['stable', 'experimental', 'alpha'];

export function loadMeta(hub) {
  const meta = JSON.parse(fs.readFileSync(path.join(hub, 'data', 'catalog-meta.json'), 'utf8'));
  meta.apps ||= {}; meta.kinds ||= {}; meta.variants ||= {}; meta.related ||= [];
  return meta;
}

/** Stare: suprascrierea din meta (dacă există), altfel regula: 0.x sau sufix -alpha/-beta/-rc → alpha; restul → stable. */
export function deriveStatus(version, override) {
  if (override && STATUSES.includes(override)) return override;
  if (/^0\./.test(version || '') || /-(alpha|beta|rc|pre)/i.test(version || '')) return 'alpha';
  return 'stable';
}

/** Textul de pe card: versiunea + (ultima schimbare de fond, dacă e cunoscută). Data de sincronizare rămâne doar în data-upd. */
export function verText(version, substantive) {
  return `v${version}${substantive ? ' · ' + substantive : ''}`;
}

/** Variantele (carduri ascunse în fișa hub-ului): cheie variantă → cheia hub-ului. */
export function variantOf(meta) {
  const out = {};
  for (const [hub, list] of Object.entries(meta.variants)) for (const v of list) out[v] = hub;
  return out;
}

/** Contoare derivate din lista reală de carduri (chei). */
export function counts(meta, keys, sections) {
  const vo = variantOf(meta);
  const engines = keys.filter((k) => meta.kinds[k] === 'engine').length;
  const variants = keys.filter((k) => vo[k]).length;
  return {singleFile: keys.length - engines, listed: keys.length - variants - engines, variants, engines, sections};
}

/** Verificări de coerență ale metadatelor față de lista de carduri. Returnează mesaje de problemă. */
export function validateMeta(meta, keys) {
  const set = new Set(keys), out = [];
  for (const k of Object.keys(meta.apps)) if (!set.has(k)) out.push(`catalog-meta: aplicația „${k}” nu are card`);
  for (const [h, list] of Object.entries(meta.variants)) for (const k of [h, ...list]) if (!set.has(k)) out.push(`catalog-meta: varianta/hub-ul „${k}” nu are card`);
  for (const g of meta.related) for (const k of g) if (!set.has(k)) out.push(`catalog-meta: aplicația înrudită „${k}” nu are card`);
  for (const [k, v] of Object.entries(meta.apps)) {
    if (v.status && !STATUSES.includes(v.status)) out.push(`catalog-meta: ${k}: stare necunoscută „${v.status}”`);
    if (v.substantive && !/^\d{4}-\d\d-\d\d$/.test(v.substantive)) out.push(`catalog-meta: ${k}: „substantive” trebuie să fie AAAA-LL-ZZ`);
    if (v.screenshot && !/^[\w./-]+\.(png|jpe?g|webp|gif|svg)$/i.test(v.screenshot)) out.push(`catalog-meta: ${k}: „screenshot” trebuie să fie o cale relativă către o imagine din hub`);
  }
  return out;
}
