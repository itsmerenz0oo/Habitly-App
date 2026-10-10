/* Registers the service worker so the app can be installed and used offline.
   Service workers only run on http://localhost or https:// (not file://). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* unsupported context */ });
  });
}
