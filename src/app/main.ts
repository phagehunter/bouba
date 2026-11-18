import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

mount(App, { target: document.getElementById('app')! });
// The loading visual in index.html has done its job once the app is on the page.
document.getElementById('loading')?.remove();

// On a website, save the app for offline use. The desktop and Android apps and the
// double-click file already carry their own copy, and the dev server should stay live.
if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register(`./sw.js?v=${__APP_VERSION__}`).then(async () => {
    await navigator.serviceWorker.ready;
    // Files loaded before the saving started would be missed, so save them now.
    // Only files from the app's own folder are saved. Anything else the hosting page loads is left alone.
    const own = new URL('./', location.href).href;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(own));
    const cache = await caches.open('name-check-2-' + __APP_VERSION__);
    await Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)));
  }).catch(() => undefined);
}
