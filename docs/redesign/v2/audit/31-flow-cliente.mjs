// Mide tareas del productor en `main` contando acciones (clicks y selecciones).
import { open, shot, chromium, BASE, USERS } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const res = {};
for (const vp of ['desktop', 'mobile']) {
  const { browser, page, log } = await open('cliente', vp);
  const r = {};
  const tab = (name) => page.getByRole('link', { name, exact: true }).first();
  // P1: ver todas las áreas y su frescura
  await tab('Predios').click(); await page.waitForLoadState('networkidle').catch(() => {});
  r.P1 = { acciones: 1, ruta: new URL(page.url()).pathname, texto_frescura: (await page.locator('main').innerText()).match(/Último dato|Sin reporte|Sin comunicaci/gi)?.length, areas_visibles: await page.getByRole('button', { name: /ha .*Humedad actual/ }).count() };
  await shot(page, `flow-cliente-${vp}-P1`);
  // P2: ir a otra área desde la lista y desde los selectores
  await page.getByRole('button', { name: /DEMO - Alfalfa Este/ }).click(); await page.waitForLoadState('networkidle').catch(() => {});
  r.P2_desde_lista = { acciones: 1, ruta_tras_click: new URL(page.url()).pathname + new URL(page.url()).search, area_mostrada: await page.locator('select').nth(1).inputValue().catch(() => null), h: await page.locator('main').innerText().then((t) => t.slice(0, 80).replace(/\s+/g, ' ')) };
  await page.goto(BASE + '/cliente'); await page.waitForLoadState('networkidle').catch(() => {});
  const selects = page.locator('select');
  const area = await selects.nth(1).inputValue();
  await selects.nth(1).selectOption({ label: 'Area Campus Reforestado' }).catch(() => {});
  r.P2_selectores = { acciones: 1, nota: 'cambiar de área dentro del mismo predio; otro predio = 2 selecciones', area_antes: area, area_despues: await selects.nth(1).inputValue(), ruta: new URL(page.url()).pathname + new URL(page.url()).search };
  // P5: ¿hay dirección propia del área? abrir esa URL en sesión nueva
  const url = page.url();
  const b2 = await chromium.launch(); const c2 = await b2.newContext({ viewport: page.viewportSize() }); const p2 = await c2.newPage();
  await p2.goto(BASE + '/'); await p2.getByLabel('Correo Electrónico').fill(USERS.cliente.email); await p2.getByLabel('Contraseña', { exact: true }).fill(USERS.cliente.password); await p2.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p2.waitForURL('**/cliente');
  await p2.goto(url); await p2.waitForLoadState('networkidle').catch(() => {});
  r.P5_enlace_directo = { url, area_en_sesion_nueva: await p2.locator('select').nth(1).inputValue(), conserva_area: (await p2.locator('select').nth(1).inputValue()) === (await selects.nth(1).inputValue()) };
  await b2.close();
  // P3: histórico → preset → CSV
  await tab('Histórico').click(); await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByRole('button', { name: 'Últimos 30 días' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.getByRole('button', { name: 'CSV' }).click()]);
  r.P3_historico_csv = { acciones: 3, descarga: dl ? dl.suggestedFilename() : 'SIN DESCARGA', nota: '1 ir a Histórico + 1 preset + 1 CSV, con el área ya elegida' };
  await shot(page, `flow-cliente-${vp}-P3`);
  // P3b: exportar
  await tab('Exportar').click(); await page.waitForLoadState('networkidle').catch(() => {});
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.getByRole('button', { name: /Descargar CSV/ }).click()]);
  r.P3_exportar_csv = { acciones: 2, descarga: dl2 ? dl2.suggestedFilename() : 'SIN DESCARGA' };
  await shot(page, `flow-cliente-${vp}-P3b`);
  // P6: botones que no hacen nada en Perfil
  await tab('Perfil').click(); await page.waitForLoadState('networkidle').catch(() => {});
  const before = log.requests.length; const url0 = page.url();
  const dead = {};
  for (const n of ['Ver Planes', 'Cambiar Contraseña']) { await page.getByRole('button', { name: n }).click(); await page.waitForTimeout(600); dead[n] = { dialogo: await page.locator('[role=dialog]').count(), ruta_igual: page.url() === url0, peticiones_nuevas: log.requests.length - before }; }
  await page.getByRole('button', { name: 'Editar Perfil' }).click(); await page.waitForTimeout(500);
  dead['Editar Perfil'] = { inputs_habilitados: await page.locator('main input:not([disabled])').count(), botones: await page.locator('main button').allInnerTexts() };
  r.P6_perfil = dead; await shot(page, `flow-cliente-${vp}-P6`);
  // Predio huérfano
  await page.goto(BASE + '/cliente/predio/2'); await page.waitForLoadState('networkidle').catch(() => {});
  r.predio_huerfano = { texto: (await page.locator('main').innerText()).slice(0, 300).replace(/\s+/g, ' '), enlaces_entrantes_en_areas: 'ver crawl: no hay enlace' };
  await shot(page, `flow-cliente-${vp}-predio`);
  res[vp] = r; await browser.close();
}
writeFileSync(new URL('./results/flow-cliente.json', import.meta.url), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
