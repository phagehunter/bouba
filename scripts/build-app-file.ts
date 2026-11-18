// Turns the built app (dist/) into a single html file that opens with a double-click and works offline.
// Usage: npm run build:app-file
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const OUT = '2026-11-16-name-check-app.html';
let html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
const js = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.js'))!, 'utf8').replace(/<\/script/g, '<\\/script');
const css = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.css'))!, 'utf8');
html = html.replace(/<script type="module"[^>]*><\/script>/, '').replace(/<link rel="stylesheet"[^>]*>/, '');
// The double-click file has no folder beside it, so the links to the icon and web-app files are removed.
html = html.replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '');
// The loading visual names its font file by address. This file has no folder beside it, so that rule is removed
// and the two fonts are written into the stylesheet itself.
html = html.replace(/\s*@font-face\s*\{[^}]*\}/g, '');
const withFonts = css.replace(/url\((["']?)[^)"']*\/fonts\/([\w-]+\.ttf)\1\)/g, (_m, _q, file) =>
  `url(data:font/ttf;base64,${readFileSync('public/fonts/' + file).toString('base64')})`);
if (withFonts === css) throw new Error('The font addresses were not found in the built stylesheet, so the fonts were not written into the file.');
html = html.replace('</head>', () => `<style>${withFonts}</style>\n</head>`);
html = html.replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1e6).toFixed(1)} MB)`);
