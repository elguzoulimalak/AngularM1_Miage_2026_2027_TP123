/**
 * À partir de Node 25, Node définit son propre `localStorage` global. Sans
 * l'option `--localstorage-file`, il vaut `undefined` (ou lève une erreur),
 * et masque celui de jsdom pendant les tests. On remet celui de jsdom.
 */
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;

if (jsdomWindow) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      value: jsdomWindow[name],
      configurable: true,
      writable: true,
    });
  }
}
