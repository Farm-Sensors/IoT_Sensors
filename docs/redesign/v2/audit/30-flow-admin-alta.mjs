// Mide el alta completa Cliente → Predio → Área → Ciclo → Nodo en `main`, contando cada acción real.
import { open, shot } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const res = {};
for (const vp of ['desktop', 'mobile']) {
  const { browser, page, log } = await open('admin', vp);
  const c = { click: 0, fill: 0, select: 0, goto_url: 0, screens: new Set(), notes: [] };
  const sfx = `${vp}-${Date.now() % 100000}`;
  const screen = () => c.screens.add(new URL(page.url()).pathname);
  const click = async (loc, why) => { await loc.click(); c.click++; screen(); };
  const fill = async (loc, v) => { await loc.fill(v); c.fill++; };
  const sel = async (loc, v) => { if (v.label instanceof RegExp) { const t = await loc.locator('option').allInnerTexts(); const m = t.find((x) => v.label.test(x)); await loc.selectOption({ label: m }); } else await loc.selectOption(v); c.select++; };
  const nav = async (name) => { await click(page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).first()); await page.waitForLoadState('networkidle').catch(() => {}); };
  const dlg = () => page.locator('[role=dialog]');
  screen();
  // Cliente
  await nav('Clientes');
  await click(page.getByRole('button', { name: 'Nuevo Cliente' }));
  await fill(dlg().getByLabel('Nombre de la Empresa'), `Empresa Auditoria ${sfx}`);
  await fill(dlg().getByLabel('Nombre de Contacto'), `Contacto Audit ${sfx}`);
  await fill(dlg().getByLabel('Email'), `audit-${sfx}@example.test`);
  await fill(dlg().getByLabel('Contraseña (Temporal)'), 'Audit-12345');
  await fill(dlg().getByLabel('Teléfono'), '6140000000');
  await click(dlg().getByRole('button', { name: 'Guardar' })); await page.waitForTimeout(1200);
  await shot(page, `flow-alta-${vp}-1-cliente`);
  // Predio (en la fila del cliente nuevo)
  // el cliente nuevo es el último de la lista
  await click(page.getByRole('link', { name: /Predios/ }).or(page.getByRole('button', { name: /^Predios/ })).last()); await page.waitForLoadState('networkidle').catch(() => {});
  await click(page.getByRole('button', { name: 'Nuevo Predio' }));
  await fill(dlg().getByLabel('Nombre del Predio'), `Predio Audit ${sfx}`);
  await click(dlg().getByRole('button', { name: 'Guardar' })); await page.waitForTimeout(1200);
  await shot(page, `flow-alta-${vp}-2-predio`);
  // Área
  await click(page.getByRole('link', { name: /Áreas de Riego/ }).or(page.getByRole('button', { name: /Áreas de Riego/ })).first()); await page.waitForLoadState('networkidle').catch(() => {});
  await click(page.getByRole('button', { name: 'Nueva Área' }));
  await fill(dlg().getByLabel('Nombre del Área'), `Area Audit ${sfx}`);
  await sel(dlg().getByLabel('Tipo de Cultivo'), { label: 'Nogal' });
  await fill(dlg().getByLabel(/Tamaño/), '3');
  await click(dlg().getByRole('button', { name: 'Guardar' })); await page.waitForTimeout(1200);
  await shot(page, `flow-alta-${vp}-3-area`);
  // Ciclo: la ruta no tiene enlace en el menú
  const vis = await page.getByRole('link', { name: 'Ciclos' }).count();
  c.notes.push(`enlaces "Ciclos" visibles tras crear el área: ${vis}`);
  await page.goto('http://localhost:5174/admin/ciclos'); c.goto_url++; screen(); await page.waitForLoadState('networkidle').catch(() => {});
  await click(page.getByRole('button', { name: 'Nuevo Ciclo' }));
  await sel(dlg().getByLabel('Área de Riego'), { label: new RegExp(`Area Audit ${sfx}`) });
  await fill(dlg().getByLabel('Fecha de Inicio'), '2026-10-01');
  await click(dlg().getByRole('button', { name: 'Guardar Ciclo' })); await page.waitForTimeout(1200);
  await shot(page, `flow-alta-${vp}-4-ciclo`);
  // Nodo
  await nav('Nodos');
  await click(page.getByRole('button', { name: 'Nuevo Nodo' }));
  await sel(dlg().getByLabel(/Área de Riego/), { label: new RegExp(`Area Audit ${sfx}`) });
  await fill(dlg().getByLabel('Nombre del Nodo'), `Nodo Audit ${sfx}`);
  await fill(dlg().getByLabel('Número de Serie'), `AUD-${sfx}`);
  await fill(dlg().getByLabel(/Latitud/), '28.7'); await fill(dlg().getByLabel(/Longitud/), '-106.1');
  await click(dlg().getByRole('button', { name: 'Crear Nodo' })); await page.waitForTimeout(1200);
  await shot(page, `flow-alta-${vp}-5-nodo`);
  res[vp] = { acciones: c.click + c.fill + c.select + c.goto_url, click: c.click, fill: c.fill, select: c.select, goto_url: c.goto_url, pantallas: [...c.screens], notas: c.notes, http_errors: log.http };
  await browser.close();
}
writeFileSync(new URL('./results/flow-admin-alta.json', import.meta.url), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
