// tools/compat/legacy-env.mjs — „motor vechi" simulat într-un Chromium modern: șterge API-urile apărute după pragul din compat.config.json
// ÎNAINTE de scripturile paginii (addInitScript) și face ca RegExp-urile construite la rulare să respingă sintaxa nouă (lookbehind, \p{…},
// grupuri cu nume, steagurile d/s/v). Nu poate simula sintaxa JS (aceea o păzește auditul acorn) și nici randarea CSS.
// BigInt rămâne (Playwright îl folosește la evaluate); folosirea lui o păzește FFF.compat.need('BigInt') + auditul. Folosit de smoke.mjs; același mecanism îl folosesc și testele kitului (fff-kit/test/legacy.test.mjs).
//
//   import {legacyInit} from './legacy-env.mjs';   await context.addInitScript({content: legacyInit({keep: ['AbortController']})});
export const REMOVED = {
  window: ['ResizeObserver', 'IntersectionObserver', 'BroadcastChannel', 'CompressionStream', 'DecompressionStream', 'OffscreenCanvas', 'structuredClone',
    'AbortController', 'AbortSignal', 'queueMicrotask', 'requestIdleCallback', 'cancelIdleCallback', 'WeakRef',
    'FinalizationRegistry', 'ReadableStream', 'TextDecoderStream', 'TextEncoderStream', 'showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker',
    'visualViewport', 'launchQueue', 'EyeDropper', 'ViewTransition', 'PressureObserver'],
  navigator: ['clipboard', 'share', 'canShare', 'gpu', 'locks', 'wakeLock', 'userAgentData', 'storage', 'serial', 'usb', 'bluetooth', 'hid', 'virtualKeyboard'],
  intl: ['Segmenter', 'ListFormat', 'RelativeTimeFormat', 'DisplayNames', 'Locale'],
  protos: {
    Array: ['at', 'flat', 'flatMap', 'findLast', 'findLastIndex', 'toSorted', 'toReversed', 'toSpliced', 'with'],
    String: ['at', 'replaceAll', 'matchAll', 'trimStart', 'trimEnd', 'padStart', 'padEnd', 'isWellFormed', 'toWellFormed'],
    Promise: [], Blob: ['arrayBuffer', 'text', 'stream'], Element: ['replaceChildren', 'toggleAttribute', 'animate', 'getAnimations'],
    CanvasRenderingContext2D: ['roundRect'], MediaQueryList: ['addEventListener', 'removeEventListener'],
  },
  statics: {Object: ['fromEntries', 'hasOwn', 'groupBy'], Promise: ['allSettled', 'any', 'withResolvers'], Array: ['fromAsync'], crypto: ['randomUUID']},
  dialog: true,
  regexp: true,
};

export function legacyInit(opts = {}) {
  const keep = JSON.stringify(opts.keep || []);
  const R = JSON.stringify(REMOVED);
  return `(() => {
  'use strict';
  const R = ${R}, KEEP = ${keep};
  const gone = (o, k) => {
    if (!o || KEEP.indexOf(k) >= 0) return;
    try { delete o[k]; } catch (e) { /* ignorat */ }
    try { if (o[k] !== undefined) Object.defineProperty(o, k, {value: undefined, configurable: true, writable: true}); } catch (e) { /* ignorat */ }
  };
  const nav = Object.getPrototypeOf(navigator);
  R.window.forEach((k) => gone(window, k));
  R.navigator.forEach((k) => { gone(navigator, k); gone(nav, k); });
  R.intl.forEach((k) => gone(Intl, k));
  Object.keys(R.protos).forEach((c) => { const C = window[c]; if (C && C.prototype) R.protos[c].forEach((k) => gone(C.prototype, k)); });
  Object.keys(R.statics).forEach((c) => { const C = c === 'crypto' ? window.crypto : window[c]; R.statics[c].forEach((k) => gone(C, k)); });
  try { gone(Object.getPrototypeOf(Int8Array).prototype, 'at'); } catch (e) { /* ignorat */ }
  if (R.dialog && window.HTMLDialogElement) {
    // fără <dialog> nativ: metodele/proprietățile dispar, iar prototipul se leagă de HTMLUnknownElement (ca la un motor care nu-l știe)
    ['show', 'showModal', 'close', 'open', 'returnValue', 'requestClose'].forEach((k) => { try { delete HTMLDialogElement.prototype[k]; } catch (e) { /* ignorat */ } });
    try { Object.setPrototypeOf(HTMLDialogElement.prototype, HTMLUnknownElement.prototype); } catch (e) { /* ignorat */ }
  }
  if (R.regexp) {
    const Native = RegExp;
    const bad = (src, flags) => /\\(\\?<[=!]/.test(src) || /\\\\[pP]\\{/.test(src) || /\\(\\?<[A-Za-z_$]/.test(src) || /[dsv]/.test(flags || '');
    const Wrapped = new Proxy(Native, {
      construct(t, args, nt) { const s = args[0] instanceof Native ? args[0].source : String(args[0] === undefined ? '' : args[0]); if (bad(s, args[1] === undefined && args[0] instanceof Native ? args[0].flags : args[1])) throw new SyntaxError('Invalid regular expression: simulat motor vechi'); return Reflect.construct(t, args, nt === Wrapped ? t : nt); },
      apply(t, self, args) { const s = args[0] instanceof Native ? args[0].source : String(args[0] === undefined ? '' : args[0]); if (bad(s, args[1])) throw new SyntaxError('Invalid regular expression: simulat motor vechi'); return t(...args); },
    });
    window.RegExp = Wrapped;
  }
  // browserele automatizate nu montează interfața kitului (view/a11y); vrem să o exercităm
  try { Object.defineProperty(navigator, 'webdriver', {get: () => false}); } catch (e) { /* ignorat */ }
})();`;
}
