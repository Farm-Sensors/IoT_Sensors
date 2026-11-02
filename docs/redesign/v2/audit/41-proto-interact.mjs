// Interacciones reales del prototipo + axe (WCAG A/AA) en claro y oscuro, escritorio y móvil.
import { chromium, createRequireAxe } from './lib-axe.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
const ROOT = new URL(process.argv[2] ?? '../prototype/', import.meta.url).pathname; const V = process.argv[3] ?? 'a'; const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { const p = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'text/plain' }); r.end(readFileSync(p)); }).listen(5199);
const B = 'http://localhost:5199/', results = []; const ok = (n, c, x = '') => { results.push({ n, ok: !!c, x }); if (!c) console.log('FALLA', n, x); };
const browser = await chromium.launch();
for (const vp of [{ n: 'desktop', w: 1366, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.n === 'mobile', hasTouch: vp.n === 'mobile' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const t = (s) => `${vp.n}: ${s}`;
  await page.goto(B + '?variant=' + V + '&role=productor&theme=light#/predios');
  ok(t('resumen 3 de 6'), await page.getByText('3 de 6 áreas reportando').isVisible());
  ok(t('grupo Atención'), await page.getByRole('heading', { name: /Atención/ }).isVisible());
  if (vp.n === 'mobile') { await page.getByRole('button', { name: 'Mapa', exact: true }).click(); await page.waitForTimeout(120); ok(t('vista mapa'), await page.locator('.mapbox').isVisible() && !(await page.locator('.list-col').isVisible())); }
  else { ok(t('lista y mapa a la vez'), await page.locator('.mapbox').isVisible() && await page.locator('.list-col').isVisible()); }
  await page.locator('[data-pin="2"]').click(); await page.waitForTimeout(120); ok(t('pin abre popup'), await page.locator('.popup').getByText('Alfalfa Este').isVisible());
  await page.locator('.popup').getByRole('link', { name: 'Abrir área' }).click(); await page.waitForTimeout(120); ok(t('pin → área'), page.url().endsWith('#/area/2'));
  await page.getByRole('link', { name: 'Historial' }).click(); await page.waitForTimeout(120); ok(t('pestaña Historial'), page.url().endsWith('/historial'));
  await page.getByRole('button', { name: 'Últimos 30 días' }).click(); await page.waitForTimeout(120); ok(t('preset 30 días'), await page.getByText('Rango: 30 días').isVisible());
  await page.getByRole('button', { name: 'Flujo de agua' }).click(); await page.waitForTimeout(120); ok(t('métrica flujo'), (await page.locator('.chart .cap').innerText()).includes('Flujo de agua'));
  await page.getByRole('button', { name: 'Siguiente' }).click(); await page.waitForTimeout(120); ok(t('paginación'), await page.getByText(/Página 2 de/).isVisible());
  await page.getByRole('button', { name: 'Descargar CSV' }).click(); await page.waitForTimeout(120); ok(t('descarga simulada'), await page.getByText(/No se descargó nada/).isVisible());
  await page.goto(B + '?variant=' + V + '&role=productor&theme=light#/area/5'); ok(t('sin datos: aviso y guiones'), await page.getByText('aún no ha enviado lecturas').isVisible() && !(await page.locator('.prio').innerText()).includes('0.0'));
  await page.goto(B + '?variant=' + V + '&role=productor&theme=light#/area/4'); ok(t('sin comunicación: último dato visible'), await page.getByText(/Sin comunicación desde hace 2 días/).isVisible());
  await page.goto(B + '?variant=' + V + '&role=productor&theme=light#/area/3/ahora'); ok(t('null no es 0 (potencial hídrico)'), (await page.locator('dl.dl div', { hasText: 'Potencial hídrico' }).innerText()).includes('—'));
  await page.goto(B + '?variant=' + V + '&role=productor&theme=light#/area/6/detalles'); ok(t('predio sin ubicación no inventa ciudad'), await page.getByText('Sin ubicación registrada').first().isVisible());
  // admin
  await page.goto(B + '?variant=' + V + '&role=productor&theme=light#/predios'); await page.getByRole('button', { name: 'Admin', exact: true }).click(); await page.waitForTimeout(120); ok(t('cambia a admin → Hoy'), page.url().endsWith('#/hoy'));
  ok(t('Hoy lista pendientes'), await page.getByText('5 pendientes').isVisible());
  await page.getByRole('link', { name: 'Crear ciclo' }).click(); await page.waitForTimeout(120); ok(t('Crear ciclo → directorio área › ciclos'), page.url().includes('directorio?area=3&tab=ciclos'));
  ok(t('en móvil el panel reemplaza al árbol'), vp.n === 'mobile' ? !(await page.locator('.tree').isVisible()) && (await page.locator('.panel').isVisible()) : await page.locator('.tree').isVisible());
  await page.getByRole('button', { name: /Nuevo ciclo/ }).first().click(); await page.waitForTimeout(120); ok(t('formulario simulado abre'), await page.getByRole('dialog').getByText('Demostración · no guarda').isVisible());
  await page.keyboard.press('Escape'); await page.waitForTimeout(120); ok(t('Escape cierra'), (await page.getByRole('dialog').count()) === 0);
  await page.getByRole('button', { name: /Nuevo ciclo/ }).first().click(); await page.waitForTimeout(120); await page.getByRole('button', { name: /Guardar/ }).click(); await page.waitForTimeout(120); ok(t('guardar es simulado'), await page.getByText('no se guardó nada').isVisible());
  if (vp.n === 'mobile') { await page.getByRole('button', { name: /Volver al árbol/ }).click(); await page.waitForTimeout(120); ok(t('móvil: volver al árbol'), await page.locator('.tree').isVisible()); }
  await page.getByRole('link', { name: 'Red', exact: true }).first().click(); await page.waitForTimeout(120); ok(t('Red'), await page.getByRole('heading', { name: /red$/i }).isVisible());
  ok(t('sin errores de consola'), errs.length === 0, errs.join('|'));
  await ctx.close();
}
// axe
const violations = [];
for (const vp of [{ n: 'desktop', w: 1366, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } }); const page = await ctx.newPage();
  for (const [role, routes] of [['productor', ['#/predios', '#/area/1', '#/area/1/historial', '#/area/1/detalles', '#/area/4', '#/area/5', '#/cuenta']], ['admin', ['#/hoy', '#/directorio', '#/directorio?area=3&tab=ciclos', '#/red/equipos', '#/red/mapa', '#/ajustes/catalogo', '#/ajustes/auditoria']]]) for (const r of routes) {
    await page.goto(`${B}?variant=${V}&role=${role}&theme=${theme}${r}`); await page.waitForTimeout(200);
    const res = await createRequireAxe(page); for (const v of res.violations) violations.push({ vp: vp.n, theme, role, route: r, id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.html.slice(0, 90) });
  }
  await ctx.close();
}
await browser.close(); srv.close();
const fails = results.filter((r) => !r.ok);
writeFileSync(new URL('./results/proto-interact.json', import.meta.url), JSON.stringify({ checks: results.length, failed: fails, axe: violations }, null, 1));
console.log(`interacciones: ${results.length - fails.length}/${results.length} ok · axe violaciones: ${violations.length}`); violations.slice(0, 12).forEach((v) => console.log(JSON.stringify(v)));
