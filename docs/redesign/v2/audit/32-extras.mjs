import { open, shot, BASE } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const out = {};
// A. Admin: ¿puede ver lo que ve un cliente? ¿qué muestra el panel de problemas?
{
  const { browser, page } = await open('admin', 'desktop');
  await page.goto(BASE + '/cliente'); await page.waitForLoadState('networkidle').catch(() => {});
  out.admin_en_cliente = { ruta_final: new URL(page.url()).pathname };
  await page.goto(BASE + '/admin'); await page.waitForLoadState('networkidle').catch(() => {});
  out.admin_panel_texto = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  // nuevo cliente desde el panel: ¿abre formulario o solo navega?
  await page.getByRole('link', { name: 'Nuevo Cliente' }).click(); await page.waitForTimeout(800);
  out.nuevo_cliente_panel = { ruta: new URL(page.url()).pathname, dialogo_abierto: await page.locator('[role=dialog]').count() };
  await page.goto(BASE + '/admin'); await page.getByRole('link', { name: 'Nuevo Nodo' }).click(); await page.waitForTimeout(800);
  out.nuevo_nodo_panel = { ruta: new URL(page.url()).pathname, dialogo_abierto: await page.locator('[role=dialog]').count() };
  // asistente de equipo
  await page.goto(BASE + '/admin/gateways'); await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByRole('button', { name: 'Nuevo equipo' }).click(); await page.waitForTimeout(800);
  out.equipo_asistente = { texto: (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500), dialogo: await page.locator('[role=dialog]').count() };
  await shot(page, 'admin-equipo-asistente');
  // lista de equipos: cuántos y de qué clase
  await page.goto(BASE + '/admin/gateways'); await page.waitForLoadState('networkidle').catch(() => {});
  out.equipos_filas = await page.locator('a[href^="/admin/gateways/"]').count();
  await browser.close();
}
// B. Móvil: barra inferior y objetivos táctiles
for (const role of ['cliente', 'admin']) {
  const { browser, page } = await open(role, 'mobile');
  out[`movil_${role}`] = await page.evaluate(() => {
    const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed' || n.getBoundingClientRect().bottom > innerHeight - 5) ?? document.querySelector('nav');
    const items = [...nav.querySelectorAll('a,button')].map((e) => { const b = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label')).trim(), x: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), visible_en_pantalla: b.left >= 0 && b.right <= innerWidth + 1 }; });
    return { scrollW: nav.scrollWidth, clientW: nav.clientWidth, items };
  });
  const small = await page.evaluate(() => [...document.querySelectorAll('main a,main button,main input,main select')].map((e) => { const b = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 25), w: Math.round(b.width), h: Math.round(b.height) }; }).filter((x) => x.w > 0 && (x.h < 44 || x.w < 44)).slice(0, 40));
  out[`movil_${role}_objetivos_menores_44`] = small;
  await browser.close();
}
// C. Tabletas: tabla de clientes a 768
{
  const { browser, page } = await open('admin', 'desktop');
  await page.setViewportSize({ width: 768, height: 900 }); await page.goto(BASE + '/admin/clientes'); await page.waitForLoadState('networkidle').catch(() => {});
  out.clientes_768 = await page.evaluate(() => { const bs = [...document.querySelectorAll('main button')].filter((b) => /Editar|Borrar|Predios|Dashboard/.test(b.innerText)); return { total: bs.length, dentro_del_viewport: bs.filter((b) => b.getBoundingClientRect().right <= innerWidth).length, scrollW: document.documentElement.scrollWidth }; });
  await shot(page, 'admin-clientes-768');
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(BASE + '/admin/clientes'); await page.waitForLoadState('networkidle').catch(() => {});
  out.clientes_390 = await page.evaluate(() => { const bs = [...document.querySelectorAll('main button, main a')].filter((b) => /Editar|Borrar|Predios|Dashboard/.test(b.innerText)); return { total: bs.length, dentro: bs.filter((b) => b.getBoundingClientRect().right <= innerWidth).length }; });
  await browser.close();
}
writeFileSync(new URL('./results/extras.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
