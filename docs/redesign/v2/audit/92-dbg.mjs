import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 160)));
await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
await p.goto(B + '/cliente/mapa'); await p.waitForTimeout(7000);
console.log(await p.evaluate(() => ({ pins: document.querySelectorAll('.map-pin').length, canvas: (() => { const c = document.querySelector('canvas'); const r = c?.getBoundingClientRect(); return r && [Math.round(r.width), Math.round(r.height)]; })(), container: (() => { const r = document.querySelector('[aria-label="Mapa de tus terrenos"]').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() })));
await b.close();
