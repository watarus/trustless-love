// Node.js global polyfill for browser compatibility
if (typeof global === 'undefined') {
  window.global = globalThis;
}
