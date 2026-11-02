/* Prototipo v2 — navegable. Sin dependencias. Los formularios son SIMULADOS: nada se guarda ni se envía. */
(() => {
  const D = window.DATA;
  const $app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VARIANTS = { a: 'A · Sala de control', b: 'B · Agua', c: 'C · Cartel' };
  const S = { variant: 'a', role: 'productor', theme: 'light', menu: false, drawer: null, toast: null, view: 'lista', mapSel: null, dir: { type: 'client', id: 1, tab: 'resumen', level: 'tree' }, hist: { days: 7, metric: 'hum', page: 0, cycle: 'all', preset: '7' } };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };

  // ---------- iconos (SVG propios) ----------
  const P = {
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
    stale: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    nodata: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    nonode: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
    chev: '<path d="m9 6 6 6-6 6"/>', leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="m15 6-6 6 6 6"/>', x: '<path d="m6 6 12 12M18 6 6 18"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v10h14V10"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.3 2.3 3.8 5"/>',
    net: '<rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 17h.01M12 14V9M8 9a6 6 0 0 1 8 0M5.5 6.5a10 10 0 0 1 13 0"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    pins: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>', logo: '<path d="M12 3c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10Z"/><path d="M12 20v-8"/>',
  };
  const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

  // ---------- dominio ----------
  const LABEL = { al_dia: 'Al día', sin_comunicacion: 'Sin comunicación', sin_datos: 'Sin datos', sin_nodo: 'Sin nodo' };
  const ICON = { al_dia: 'ok', sin_comunicacion: 'stale', sin_datos: 'nodata', sin_nodo: 'nonode' };
  const badge = (st) => `<span class="state s-${st}">${ic(ICON[st], 16)}${LABEL[st]}</span>`;
  const byId = (id) => D.areas.find((a) => a.id === +id);
  const prop = (id) => D.properties.find((p) => p.id === +id);
  const pad = (n) => String(n).padStart(2, '0');
  const ago = (m) => {
    if (m === null) return 'Sin lecturas';
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return `hace ${h} h${r ? ` ${r} min` : ''}`; }
    const d = Math.floor(m / 1440); return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  };
  const stampShort = (a) => { const t = new Date(D.NOW.getTime() - a.minutesAgo * 60000); return `${pad(t.getDate())}/${pad(t.getMonth() + 1)} ${pad(t.getHours())}:${pad(t.getMinutes())}`; };
  const stamp = (a) => { if (a.minutesAgo === null) return 'Sin lecturas'; const t = new Date(D.NOW.getTime() - a.minutesAgo * 60000); return `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()} ${pad(t.getHours())}:${pad(t.getMinutes())}`; };
  const fmt = (v, d = 1) => (v === null || v === undefined ? null : (+v).toFixed(d)); // null NUNCA es 0
  const val = (v, unit, d = 1, cls = '') => { const f = fmt(v, d); return f === null ? `<span class="val none" title="Sin dato">—<span class="sr"> sin dato</span></span>` : `<span class="val num ${cls}">${f}<small>${unit}</small></span>`; };
  const counts = () => { const c = { al_dia: 0, sin_comunicacion: 0, sin_datos: 0, sin_nodo: 0 }; D.areas.forEach((a) => c[a.state]++); return c; };

  // ---------- gráficas ----------
  const chart = (pts, label, unit) => {
    if (!pts.length) return '';
    const W = 640, H = 190, L = 40, R = 8, T = 10, B = 22;
    const ys = pts.map((p) => p.v), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const x = (i) => L + (i / Math.max(pts.length - 1, 1)) * (W - L - R), y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const ticks = [lo, lo + span / 2, hi].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(1)}</text>`).join('');
    const t0 = pts[0].t, t1 = last.t, f = (t) => `${pad(t.getDate())}/${pad(t.getMonth() + 1)} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: mínimo ${lo.toFixed(1)} ${unit}, máximo ${hi.toFixed(1)} ${unit}, último ${last.v.toFixed(1)} ${unit}">${ticks}<polygon class="fill" points="${L},${H - B} ${line} ${W - R},${H - B}"/><polyline class="line" points="${line}"/><circle cx="${x(pts.length - 1)}" cy="${y(last.v)}" r="4" fill="var(--accent)"/></svg><div class="cap"><span>${f(t0)}</span><span>${esc(label)} (${unit})</span><span>${f(t1)}</span></div></div>`;
  };

  // ---------- mapa ilustrativo ----------
  const mapSvg = (areas) => {
    const withGps = areas.filter((a) => a.node);
    // Proyección ilustrativa por predio: cada predio es un grupo con su propio acercamiento.
    const centers = { 1: [105, 160], 2: [270, 120] }, pos = {};
    D.properties.forEach((p) => {
      const g = withGps.filter((a) => a.propertyId === p.id); if (!g.length) return;
      const la = g.map((a) => a.node.lat), lo = g.map((a) => a.node.lon), la0 = Math.min(...la), la1 = Math.max(...la), lo0 = Math.min(...lo), lo1 = Math.max(...lo);
      g.forEach((a) => { pos[a.id] = [centers[p.id][0] + (((a.node.lon - lo0) / (lo1 - lo0 || 1)) - .5) * 110, centers[p.id][1] - (((a.node.lat - la0) / (la1 - la0 || 1)) - .5) * 100]; });
    });
    const sx = (a) => pos[a.id][0], sy = (a) => pos[a.id][1];
    const pin = (a) => {
      const cx = sx(a).toFixed(0), cy = sy(a).toFixed(0);
      const shape = a.state === 'al_dia' ? `<circle r="9" fill="var(--ok)"/>` : a.state === 'sin_comunicacion' ? `<path d="M0-11 11 9H-11Z" fill="var(--warn)"/>` : `<circle r="8" fill="var(--surface)" stroke="var(--off)" stroke-width="3"/>`;
      return `<g class="pin" tabindex="0" role="button" data-pin="${a.id}" transform="translate(${cx} ${cy})" aria-label="${esc(a.name)}: ${LABEL[a.state]}"><circle class="ring" r="17" fill="transparent" stroke="${S.mapSel === a.id ? 'var(--focus)' : 'transparent'}" stroke-width="3"/>${shape}</g>`;
    };
    return `<svg viewBox="0 0 360 300" role="group" aria-label="Mapa ilustrativo de nodos"><rect width="360" height="300" fill="var(--surface-2)"/><path d="M0 220C60 190 90 240 160 210S280 160 360 190" fill="none" stroke="var(--line)" stroke-width="2"/><path d="M0 120C70 90 130 140 200 100S300 60 360 90" fill="none" stroke="var(--line)" stroke-width="2"/><path d="M40 0C60 80 30 160 70 300" fill="none" stroke="var(--line)" stroke-width="2"/>${withGps.map(pin).join('')}</svg>`;
  };
  const mapBox = (areas) => {
    const sel = S.mapSel ? byId(S.mapSel) : null, noGps = areas.filter((a) => !a.node);
    return `<div class="mapbox">${mapSvg(areas)}${sel ? `<div class="popup"><strong>${esc(sel.name)}</strong><div class="meta" style="color:var(--muted)">${esc(prop(sel.propertyId).name)} · ${esc(sel.crop)}</div><div style="margin:6px 0">${badge(sel.state)} <span class="num">${esc(ago(sel.minutesAgo))}</span></div><a class="btn sm" href="${S.role === 'admin' ? '#/directorio?area=' + sel.id : '#/area/' + sel.id}">Abrir área</a></div>` : ''}<div class="mapnote">Mapa ilustrativo (sin teselas). ${noGps.length ? `Sin ubicación: ${noGps.map((a) => esc(a.name)).join(', ')}.` : ''}</div></div>`;
  };

  // ---------- Mis predios ----------
  const areaRow = (a, showProp) => `<a class="row" href="#/area/${a.id}" data-row="${a.id}">
    <div class="c-name"><div class="name">${esc(a.name)}</div><div class="meta">${esc(a.crop)} · ${a.ha} ha${showProp ? ' · ' + esc(prop(a.propertyId).name) : ''}</div></div>
    <div class="c-hum" style="--pct:${a.hum ?? 0}"><span class="cell-k">Humedad</span>${val(a.hum, '%')}</div>
    <div class="c-flow">${val(a.flow, ' L/min')}</div>
    <div class="c-eto">${val(a.eto, ' mm/d', 1)}</div>
    <div class="c-state">${badge(a.state)}</div>
    <div class="c-fresh num" style="font-size:13px"><div>${esc(ago(a.minutesAgo))}</div><div style="color:var(--muted)">${a.minutesAgo === null ? '' : esc(stampShort(a))}</div></div>
    <span class="chev">${ic('chev')}</span></a>`;
  const head = '<div class="row head" aria-hidden="true"><div>Área</div><div>Humedad</div><div>Flujo</div><div>E.T.O.</div><div>Estado</div><div>Último dato</div><span></span></div>';
  const viewPredios = () => {
    const c = counts(), attn = D.areas.filter((a) => a.state !== 'al_dia');
    const groups = D.properties.map((p) => {
      const all = D.areas.filter((a) => a.propertyId === p.id), ok = all.filter((a) => a.state === 'al_dia');
      return `<section class="group"><h2>${esc(p.name)} <small>${esc(p.location ?? 'Sin ubicación registrada')} · ${all.length} ${all.length === 1 ? 'área' : 'áreas'}</small></h2>${ok.length ? `<div class="rows">${head}${ok.map((a) => areaRow(a, false)).join('')}</div>` : `<div class="rows"><div class="empty">Todas las áreas de este predio están en Atención.</div></div>`}</section>`;
    }).join('');
    return `<h1 class="page-title">Mis predios</h1><p class="sub">${esc(D.client.empresa)}</p>
    <div class="summary" role="status"><span class="big num">${c.al_dia} de ${D.areas.length} áreas reportando</span><span>${c.sin_comunicacion} sin comunicación · ${c.sin_datos} sin datos · ${c.sin_nodo} sin nodo</span></div>
    <div class="toolbar"><div class="view-toggle" role="group" aria-label="Vista"><button type="button" data-view="lista" aria-pressed="${S.view === 'lista'}">Lista</button><button type="button" data-view="mapa" aria-pressed="${S.view === 'mapa'}">Mapa</button></div></div>
    <div class="split" data-view="${S.view}"><div class="list-col">${attn.length ? `<section class="group attn"><h2>${ic('stale', 16)} Atención <small>Problemas con los datos, no recomendaciones de riego</small></h2><div class="rows">${head}${attn.map((a) => areaRow(a, true)).join('')}</div></section>` : ''}${groups}</div>${mapBox(D.areas)}</div>`;
  };

  // ---------- Área ----------
  const tabsFor = (id, cur) => `<nav class="tabs" aria-label="Secciones del área">${[['ahora', 'Ahora', ''], ['historial', 'Historial', '/historial'], ['detalles', 'Detalles', '/detalles']].map(([k, l, p]) => `<a href="#/area/${id}${p}" ${cur === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const areaHead = (a, tab) => {
    const p = prop(a.propertyId);
    return `<nav class="crumbs" aria-label="Ruta"><a href="#/predios">Mis predios</a><span>›</span><span>${esc(p.name)}</span><span>›</span><span aria-current="page">${esc(a.name)}</span></nav>
    <div class="area-head"><div><h1 class="page-title">${esc(a.name)}</h1><div class="chips"><span>${esc(a.crop)} · ${a.ha} ha</span><span>·</span><span>${a.cycle ? `Ciclo desde ${a.cycle.start}` : 'Sin ciclo activo'}</span></div></div>
    <div style="text-align:right">${badge(a.state)}<div class="num" style="color:var(--muted);font-size:13px;margin-top:4px">Último dato: ${esc(stamp(a))}${a.minutesAgo === null ? '' : ' · ' + esc(ago(a.minutesAgo))}</div></div></div>${tabsFor(a.id, tab)}`;
  };
  const viewAhora = (a) => {
    const L = D.latestFull(a), stale = a.state === 'sin_comunicacion', cls = stale ? 'stale-val' : '';
    const banner = stale ? `<div class="banner warn" role="status">${ic('stale', 20)}<div><b>Sin comunicación desde hace ${esc(ago(a.minutesAgo).replace('hace ', ''))}</b>Los valores son los últimos recibidos el ${esc(stamp(a))}. Pasaron más de ${D.FRESH_MINUTES} minutos.</div></div>`
      : a.state === 'sin_datos' ? `<div class="banner off" role="status">${ic('nodata', 20)}<div><b>Este nodo aún no ha enviado lecturas</b>Cuando llegue la primera lectura aparecerá aquí. Si ya debería reportar, avisa al administrador.</div></div>`
      : a.state === 'sin_nodo' ? `<div class="banner off" role="status">${ic('nonode', 20)}<div><b>Esta área no tiene nodo asignado</b>El administrador debe registrar un nodo para que lleguen datos.</div></div>` : '';
    const f = (v, u, d = 1) => `<dd class="num ${cls}">${fmt(v, d) ?? '—<span class="sr"> sin dato</span>'}${fmt(v, d) === null ? '' : ` <small>${u}</small>`}</dd>`;
    const pts = a.minutesAgo === null ? [] : D.series(a, 1, 10).map((r) => ({ t: r.t, v: r.hum }));
    const irr = a.irrigating === null ? '—' : a.irrigating ? 'Riego encendido' : 'Riego apagado';
    return `${areaHead(a, 'ahora')}${banner}
    <div class="prio" aria-label="Datos prioritarios">
      <div style="--pct:${a.hum ?? 0}"><div class="k">Humedad del suelo</div><div class="v num ${cls} ${a.hum === null ? 'none' : ''}">${fmt(a.hum) ?? '—'}${a.hum === null ? '' : '<small> %</small>'}</div></div>
      <div><div class="k">Flujo de agua</div><div class="v num ${cls} ${a.flow === null ? 'none' : ''}">${fmt(a.flow) ?? '—'}${a.flow === null ? '' : '<small> L/min</small>'}</div><div class="note">${irr}${a.accum === null ? '' : ' · Acumulado ' + a.accum + ' L'}</div></div>
      <div><div class="k">E.T.O.</div><div class="v num ${cls} ${a.eto === null ? 'none' : ''}">${fmt(a.eto) ?? '—'}${a.eto === null ? '' : '<small> mm/día</small>'}</div></div></div>
    ${pts.length ? `<div class="sect"><h2>Humedad del suelo · últimas 24 h</h2>${chart(pts, 'Humedad del suelo', '%')}</div>` : `<div class="sect"><h2>Humedad del suelo</h2><div class="empty">Sin lecturas para graficar. Se mostrarán cuando el nodo reporte.</div></div>`}
    <div class="two"><div class="sect"><h2>Suelo</h2><dl class="dl"><div><dt>Conductividad</dt>${f(L?.soil.conductivity, 'dS/m', 2)}</div><div><dt>Temperatura</dt>${f(L?.soil.temperature, '°C')}</div><div><dt>Humedad</dt>${f(L?.soil.humidity, '%')}</div><div><dt>Potencial hídrico</dt>${f(L?.soil.water_potential, 'MPa')}</div></dl></div>
    <div class="sect"><h2>Ambiente</h2><dl class="dl"><div><dt>Temperatura</dt>${f(L?.environmental.temperature, '°C')}</div><div><dt>Humedad relativa</dt>${f(L?.environmental.relative_humidity, '%', 0)}</div><div><dt>Viento</dt>${f(L?.environmental.wind_speed, 'km/h')}</div><div><dt>Radiación solar</dt>${f(L?.environmental.solar_radiation, 'W/m²', 0)}</div></dl></div></div>
    <div class="two"><div class="sect"><h2>Clima de referencia <span class="meta" style="font-weight:400;color:var(--muted)">· externo, por predio</span></h2><dl class="dl"><div><dt>Temperatura</dt><dd class="num">19.0 <small>°C</small></dd></div><div><dt>Viento</dt><dd class="num">9 <small>km/h</small></dd></div></dl></div>
    <div class="sect"><h2>NDVI <span class="meta" style="font-weight:400;color:var(--muted)">· último punto, Sentinel-2</span></h2><dl class="dl"><div><dt>Índice</dt><dd class="num">0.62</dd></div><div><dt>Fecha</dt><dd class="num">28/10/2026</dd></div></dl></div></div>`;
  };
  const histRows = (a) => {
    const h = S.hist; let days = h.days;
    if (h.cycle === 'cycle' && a.cycle) { const [d, m, y] = a.cycle.start.split('/').map(Number); days = Math.max(1, Math.round((D.NOW - new Date(y, m - 1, d)) / 864e5)); }
    const step = days <= 2 ? 10 : days <= 40 ? 60 : 360;
    return { rows: D.series(a, days, step).reverse(), days };
  };
  const METRICS = { hum: ['Humedad suelo', '%'], flow: ['Flujo de agua', 'L/min'], eto: ['E.T.O.', 'mm/día'], soilT: ['Temp. suelo', '°C'], airT: ['Temp. aire', '°C'], rh: ['H. relativa', '%'] };
  const viewHistorial = (a) => {
    const h = S.hist, { rows, days } = histRows(a), per = 10, pages = Math.max(1, Math.ceil(rows.length / per)); h.page = Math.min(h.page, pages - 1);
    const [mLabel, mUnit] = METRICS[h.metric];
    const presets = [['1', 'Hoy'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['mes', 'Este mes'], ['año', 'Este año'], ['custom', 'Personalizado']];
    const body = rows.length ? `${chart(rows.slice().reverse().map((r) => ({ t: r.t, v: r[h.metric] })), mLabel, mUnit)}
      <div class="tablewrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table><caption class="sr">Lecturas del rango</caption><thead><tr><th>Fecha y hora</th><th class="n">Humedad %</th><th class="n">Flujo L/min</th><th class="n">E.T.O. mm/día</th><th class="n">T. suelo °C</th><th class="n">T. aire °C</th><th class="n">H. rel. %</th></tr></thead><tbody>${rows.slice(h.page * per, h.page * per + per).map((r) => `<tr><td class="num">${pad(r.t.getDate())}/${pad(r.t.getMonth() + 1)}/${r.t.getFullYear()} ${pad(r.t.getHours())}:${pad(r.t.getMinutes())}</td><td class="n num">${r.hum}</td><td class="n num">${r.flow}</td><td class="n num">${r.eto}</td><td class="n num">${r.soilT}</td><td class="n num">${r.airT}</td><td class="n num">${r.rh}</td></tr>`).join('')}</tbody></table></div>
      <div class="pager"><span class="num">Página ${h.page + 1} de ${pages} · ${rows.length} lecturas</span><button class="btn sm" data-page="-1" ${h.page === 0 ? 'disabled' : ''}>Anterior</button><button class="btn sm" data-page="1" ${h.page >= pages - 1 ? 'disabled' : ''}>Siguiente</button></div>`
      : `<div class="empty">Esta área no tiene lecturas en el rango. Prueba con «Este año» o elige otro ciclo.</div>`;
    return `${areaHead(a, 'historial')}<div class="filters">
      <div class="chipset" role="group" aria-label="Rango">${presets.map(([k, l]) => `<button type="button" data-preset="${k}" aria-pressed="${h.preset === k}">${l}</button>`).join('')}</div>
      <div class="line2">${h.preset === 'custom' ? `<div class="field"><label for="d1">Fecha inicio</label><input id="d1" type="date" value="2026-10-25"></div><div class="field"><label for="d2">Fecha fin</label><input id="d2" type="date" value="2026-10-31"></div>` : ''}
      <div class="field"><label for="cyc">Ciclo de cultivo</label><select id="cyc" ${a.cycle ? '' : 'disabled'}><option value="all" ${h.cycle === 'all' ? 'selected' : ''}>${a.cycle ? 'Todos los ciclos' : 'Sin ciclo definido'}</option>${a.cycle ? `<option value="cycle" ${h.cycle === 'cycle' ? 'selected' : ''}>Desde ${a.cycle.start} · sin fecha de fin</option>` : ''}</select></div>
      <div class="chipset" role="group" aria-label="Métrica de la gráfica">${Object.entries(METRICS).map(([k, [l]]) => `<button type="button" data-metric="${k}" aria-pressed="${h.metric === k}">${l}</button>`).join('')}</div></div></div>
      <div class="toolbar" style="margin-top:14px"><span class="sub num" style="margin:0 auto 0 0">Rango: ${days} ${days === 1 ? 'día' : 'días'} · fechas en UTC</span><span class="sim">Demostración</span><button class="btn" data-dl="CSV">Descargar CSV</button><button class="btn" data-dl="Excel">Descargar Excel</button><button class="btn" data-dl="PDF">Descargar PDF</button></div>${body}`;
  };
  const viewDetalles = (a) => {
    const p = prop(a.propertyId);
    return `${areaHead(a, 'detalles')}<div class="two"><div class="sect"><h2>Área</h2><dl class="dl"><div><dt>Cultivo</dt><dd>${esc(a.crop)}</dd></div><div><dt>Tamaño</dt><dd class="num">${a.ha} <small>ha</small></dd></div><div><dt>Predio</dt><dd>${esc(p.name)}</dd></div><div><dt>Ubicación del predio</dt><dd>${esc(p.location ?? 'Sin ubicación registrada')}</dd></div></dl></div>
    <div class="sect"><h2>Ciclo de cultivo</h2><dl class="dl"><div><dt>Inicio</dt><dd class="num">${a.cycle ? a.cycle.start : '—'}</dd></div><div><dt>Fin</dt><dd>${a.cycle ? (a.cycle.end ?? 'Sin fecha de fin') : '—'}</dd></div></dl>${a.cycle ? '' : '<p class="sub">Sin ciclo activo. El administrador lo define.</p>'}</div></div>
    <div class="two"><div class="sect"><h2>Nodo</h2><dl class="dl"><div><dt>Número de serie</dt><dd>${esc(a.node?.serial ?? 'Sin nodo')}</dd></div><div><dt>GPS</dt><dd class="num">${a.node ? a.node.lat + ', ' + a.node.lon : '—'}</dd></div></dl></div>
    <div class="sect"><h2>Equipo del predio</h2><dl class="dl"><div><dt>Estado</dt><dd>${p.equipo === 'vinculado' ? 'Vinculado' : 'Pendiente de vincular'}</dd></div></dl><p class="sub">Decisión pendiente: si el productor debe ver «Equipo pendiente».</p></div></div>`;
  };
  const viewArea = (id, tab) => { const a = byId(id); if (!a) return `<div class="empty">Área no encontrada. <a href="#/predios">Volver a Mis predios</a></div>`; return tab === 'historial' ? viewHistorial(a) : tab === 'detalles' ? viewDetalles(a) : viewAhora(a); };

  // ---------- Cuenta ----------
  const viewCuenta = () => `<h1 class="page-title">Cuenta</h1><p class="sub">Datos del productor (ejemplo)</p>
    <div class="sect"><h2>Perfil</h2><dl class="dl"><div><dt>Nombre</dt><dd>${esc(D.client.contacto)}</dd></div><div><dt>Correo</dt><dd>${esc(D.client.correo)}</dd></div></dl><div class="quick"><button class="btn" data-form="perfil">Editar perfil</button></div></div>
    <div class="sect"><h2>Plan y contraseña</h2><div class="pending-c">En <code>main</code> «Ver Planes» y «Cambiar Contraseña» no hacen nada y «Plan Profesional» está escrito a mano. <b>Decisión pendiente del usuario</b> (09-fases, punto 3). No se muestran como funciones.</div></div>
    <div class="sect"><h2>Fase 2 · apagada</h2><p class="sub">Alertas, umbrales, notificaciones y asistente IA conservan sus rutas y se acceden desde aquí solo si su módulo está activo. Hoy no lo están. <span class="phase2">Bloqueada</span></p></div>`;

  // ---------- Hoy (admin) ----------
  const viewHoy = () => {
    const c = counts(), noCycle = D.areas.filter((a) => !a.cycle), tasks = [];
    if (c.sin_comunicacion) tasks.push(['stale', `${c.sin_comunicacion} ${c.sin_comunicacion === 1 ? 'área sin comunicación' : 'áreas sin comunicación'}`, D.areas.filter((a) => a.state === 'sin_comunicacion').map((a) => `${a.name}: ${ago(a.minutesAgo)}`).join(' · '), 'Ver área', `#/directorio?area=${D.areas.find((a) => a.state === 'sin_comunicacion').id}`]);
    if (c.sin_datos) tasks.push(['nodata', `${c.sin_datos} nodo que nunca ha enviado datos`, D.areas.filter((a) => a.state === 'sin_datos').map((a) => a.name).join(' · '), 'Ver nodo', '#/red/nodos']);
    if (c.sin_nodo) tasks.push(['nonode', `${c.sin_nodo} área sin nodo`, D.areas.filter((a) => a.state === 'sin_nodo').map((a) => a.name).join(' · '), 'Asignar nodo', `#/directorio?area=${D.areas.find((a) => a.state === 'sin_nodo').id}&tab=nodo`]);
    tasks.push(['ok', `${noCycle.length} áreas sin ciclo activo`, noCycle.map((a) => a.name).join(' · '), 'Crear ciclo', `#/directorio?area=${noCycle[0].id}&tab=ciclos`]);
    tasks.push(['stale', '1 predio con equipo por vincular', 'Huerta Sur', 'Vincular', '#/red/equipos']);
    return `<h1 class="page-title">Hoy</h1><p class="sub">Pendientes derivados de datos existentes · sábado, 31 de octubre de 2026</p>
    <div class="summary" role="status" style="margin-top:16px"><span class="big num">${tasks.length} pendientes</span><span>de revisión del administrador</span></div>
    <div class="inbox">${tasks.map(([i, t, d, b, h]) => `<div class="task"><span style="color:${i === 'ok' ? 'var(--muted)' : 'var(--warn)'}">${ic(i === 'ok' ? 'nodata' : i, 22)}</span><div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div><a class="btn" href="${h}">${esc(b)}</a></div>`).join('')}</div>
    <div class="totals" aria-label="Totales"><div><div class="k">Clientes</div><div class="v num">1</div></div><div><div class="k">Predios</div><div class="v num">${D.properties.length}</div></div><div><div class="k">Nodos habilitados</div><div class="v num">5/5</div></div><div><div class="k">Lecturas hoy</div><div class="v num">612</div></div></div>
    <div class="quick"><button class="btn primary" data-form="cliente">${ic('plus', 16)} Nuevo cliente</button><button class="btn" data-toast="Conservado: ruta /admin/umbrales. El módulo de Fase 2 está apagado.">Configurar umbrales <span class="phase2">Fase 2</span></button><button class="btn" data-go="#/ajustes/auditoria">Ver auditoría</button></div>`;
  };

  // ---------- Directorio (admin) ----------
  const FORMS = {
    cliente: ['Nuevo cliente', [['Nombre de la empresa', 'text'], ['Nombre de contacto', 'text'], ['Correo', 'email'], ['Contraseña temporal', 'password'], ['Teléfono', 'tel']]],
    predio: ['Nuevo predio', [['Nombre del predio', 'text'], ['Ubicación (opcional)', 'text']]],
    area: ['Nueva área de riego', [['Nombre del área', 'text'], ['Tipo de cultivo', 'select'], ['Tamaño en hectáreas (opcional)', 'number']]],
    ciclo: ['Nuevo ciclo de cultivo', [['Fecha de inicio', 'date'], ['Fecha de fin (opcional)', 'date']]],
    nodo: ['Nuevo nodo', [['Nombre del nodo', 'text'], ['Número de serie', 'text'], ['Latitud GPS (opcional)', 'number'], ['Longitud GPS (opcional)', 'number']]],
    perfil: ['Editar perfil', [['Nombre completo', 'text']]],
    cultivo: ['Nuevo tipo de cultivo', [['Nombre del cultivo', 'text'], ['Descripción', 'text']]],
  };
  const dirPanel = () => {
    const d = S.dir;
    if (d.type === 'client') return `<h2 class="t">${esc(D.client.empresa)}</h2><p class="sub">Contacto: ${esc(D.client.contacto)} · ${esc(D.client.correo)} · Sin teléfono</p><div class="quick"><button class="btn" data-form="perfil">Editar cliente</button><button class="btn" data-toast="Demostración: preferencias del dashboard del cliente (misma regla que main).">Preferencias del dashboard</button><button class="btn primary" data-form="predio">${ic('plus', 16)} Nuevo predio</button></div><div class="list">${D.properties.map((p) => `<div><span><b>${esc(p.name)}</b> <span class="meta" style="color:var(--muted)">${esc(p.location ?? 'Sin ubicación registrada')}</span></span><button class="btn sm" data-sel="property:${p.id}">Abrir</button></div>`).join('')}</div>`;
    if (d.type === 'property') { const p = prop(d.id), as = D.areas.filter((a) => a.propertyId === p.id); return `<h2 class="t">${esc(p.name)}</h2><p class="sub">${esc(p.location ?? 'Sin ubicación registrada')} · Equipo: ${p.equipo === 'vinculado' ? 'vinculado' : 'pendiente de vincular'}</p><div class="quick"><button class="btn" data-form="predio">Editar predio</button><button class="btn primary" data-form="area">${ic('plus', 16)} Nueva área</button></div><div class="list">${as.map((a) => `<div><span><b>${esc(a.name)}</b> <span style="color:var(--muted)">${esc(a.crop)} · ${a.ha} ha</span></span><span style="display:flex;gap:8px;align-items:center">${badge(a.state)}<button class="btn sm" data-sel="area:${a.id}">Abrir</button></span></div>`).join('')}</div>`; }
    const a = byId(d.id), tab = d.tab, next = !a.cycle ? ['Define el ciclo de cultivo para agrupar los datos por temporada.', 'Crear ciclo', 'ciclo'] : !a.node ? ['Registra el nodo de esta área para recibir datos.', 'Nuevo nodo', 'nodo'] : null;
    const tabs = `<nav class="tabs" aria-label="Secciones del área">${[['resumen', 'Resumen'], ['ciclos', 'Ciclos'], ['nodo', 'Nodo']].map(([k, l]) => `<a href="#/directorio?area=${a.id}&tab=${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
    const inner = tab === 'ciclos' ? `<div class="quick"><button class="btn primary" data-form="ciclo">${ic('plus', 16)} Nuevo ciclo</button></div><div class="list">${a.cycle ? `<div><span class="num"><b>${a.cycle.start}</b> — ${a.cycle.end ?? 'sin fecha de fin'} <span class="state s-al_dia">${ic('ok', 14)}Activo</span></span><button class="btn sm danger" data-toast="Demostración: no se borró nada.">Eliminar</button></div>` : '<div class="empty" style="width:100%">Sin ciclos. Crea el primero con «Nuevo ciclo».</div>'}</div>`
      : tab === 'nodo' ? `<dl class="dl" style="margin-top:12px"><div><dt>Serie</dt><dd>${esc(a.node?.serial ?? 'Sin nodo')}</dd></div><div><dt>GPS</dt><dd class="num">${a.node ? a.node.lat + ', ' + a.node.lon : '—'}</dd></div><div><dt>Estado de datos</dt><dd>${badge(a.state)}</dd></div></dl><div class="quick"><button class="btn ${a.node ? '' : 'primary'}" data-form="nodo">${a.node ? 'Editar nodo' : 'Nuevo nodo'}</button><button class="btn" data-go="#/red/equipos">Ver equipo</button></div>`
      : `<dl class="dl" style="margin-top:12px"><div><dt>Cultivo</dt><dd>${esc(a.crop)}</dd></div><div><dt>Tamaño</dt><dd class="num">${a.ha} <small>ha</small></dd></div><div><dt>Último dato</dt><dd class="num" style="font-size:15px">${esc(ago(a.minutesAgo))}</dd></div><div><dt>Estado</dt><dd>${badge(a.state)}</dd></div></dl><div class="quick"><button class="btn" data-form="area">Editar área</button></div>`;
    return `<h2 class="t">${esc(a.name)}</h2><p class="sub">${esc(prop(a.propertyId).name)} › ${esc(D.client.empresa)}</p>${tabs}${next ? `<div class="next"><span><b>Siguiente paso:</b> ${esc(next[0])}</span><button class="btn primary" data-form="${next[2]}">${esc(next[1])}</button></div>` : ''}${inner}<div class="pending-c"><b>Ver como cliente</b> — requisito de AGENTS.md §3 sin pantalla hoy. Clase C: <b>pendiente de autorización</b>, no incluido en el prototipo.</div>`;
  };
  const viewDirectorio = () => {
    const d = S.dir, sel = (t, i) => d.type === t && d.id === i;
    const tree = `<ul aria-label="Clientes, predios y áreas"><li><button data-sel="client:1" ${sel('client', 1) ? 'aria-current="true"' : ''}>${ic('users', 18)} ${esc(D.client.empresa)}</button><ul>${D.properties.map((p) => `<li><button data-sel="property:${p.id}" ${sel('property', p.id) ? 'aria-current="true"' : ''}>${ic('pins', 18)} ${esc(p.name)}</button><ul>${D.areas.filter((a) => a.propertyId === p.id).map((a) => `<li><button data-sel="area:${a.id}" ${sel('area', a.id) ? 'aria-current="true"' : ''}>${ic(ICON[a.state], 16)} ${esc(a.name)}</button></li>`).join('')}</ul></li>`).join('')}</ul></li></ul>`;
    return `<h1 class="page-title">Clientes</h1><p class="sub">Directorio: cliente › predio › área, con altas y ediciones en contexto</p><div class="toolbar" style="margin-top:14px"><button class="btn primary" data-form="cliente">${ic('plus', 16)} Nuevo cliente</button></div>
    <div class="dir" data-level="${d.level}"><div class="tree">${tree}</div><div class="panel"><button class="btn backbtn" data-back>${ic('back', 16)} Volver al árbol</button>${dirPanel()}</div></div>`;
  };

  // ---------- Red y Ajustes ----------
  const subtabs = (base, items, cur) => `<nav class="tabs" aria-label="Secciones">${items.map(([k, l]) => `<a href="#/${base}/${k}" ${cur === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const viewRed = (tab = 'equipos') => {
    let body;
    if (tab === 'nodos') body = `<div class="tablewrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table><thead><tr><th>Nodo</th><th>Área</th><th>Estado</th><th>Último dato</th></tr></thead><tbody>${D.areas.map((a) => `<tr><td>${esc(a.node?.serial ?? '—')}</td><td>${esc(a.name)}</td><td>${badge(a.state)}</td><td class="num">${esc(ago(a.minutesAgo))}</td></tr>`).join('')}</tbody></table></div><div class="quick"><button class="btn primary" data-form="nodo">${ic('plus', 16)} Nuevo nodo</button></div>`;
    else if (tab === 'mapa') body = `<div class="split"><div class="empty" style="text-align:left;color:var(--ink)">Filtros por cliente, predio y área; marcadores o clusters (misma lógica que main). <span class="phase2">Maqueta mínima</span></div>${mapBox(D.areas)}</div>`;
    else body = `<div class="tablewrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table><thead><tr><th>Predio</th><th>Estado del equipo</th><th class="n">Áreas</th><th></th></tr></thead><tbody>${D.gateways.map((g) => `<tr><td>${esc(prop(g.propertyId).name)}</td><td>${esc(g.status)}</td><td class="n num">${g.slots}</td><td><button class="btn sm" data-toast="Demostración: detalle del equipo.">Ver detalle</button></td></tr>`).join('')}</tbody></table></div><div class="quick"><button class="btn primary" data-toast="Demostración: asistente de 3 pasos (predio y áreas › vincular › revisar), misma lógica que main.">${ic('plus', 16)} Nuevo equipo</button><span class="sub" style="margin:0">El emparejamiento <code>/pair</code> y <code>/admin/gateways/pair</code> no cambian.</span></div>`;
    return `<h1 class="page-title">Red</h1><p class="sub">Equipos, nodos y mapa</p>${subtabs('red', [['equipos', 'Equipos'], ['nodos', 'Nodos'], ['mapa', 'Mapa']], tab)}${body}`;
  };
  const viewAjustes = (tab = 'catalogo') => {
    const body = tab === 'auditoria' ? `<p class="sub"><span class="phase2">Fase 2 · lógica sin tocar</span></p><div class="tablewrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table><thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Entidad</th></tr></thead><tbody>${D.audit.map((r) => `<tr><td class="num">${r.when}</td><td>${esc(r.who)}</td><td>${r.action}</td><td>${esc(r.entity)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="quick" style="margin-top:0;margin-bottom:8px"><button class="btn primary" data-form="cultivo">${ic('plus', 16)} Nuevo cultivo</button></div><div class="rows">${D.crops.map((c) => `<div class="row" style="grid-template-columns:1fr auto;min-height:52px"><span class="name">${c}</span><span style="display:flex;gap:8px"><button class="btn sm" data-form="cultivo">Editar</button><button class="btn sm danger" data-toast="Demostración: no se borró nada.">Eliminar</button></span></div>`).join('')}</div>`;
    return `<h1 class="page-title">Ajustes</h1><p class="sub">Catálogo de cultivos y auditoría</p>${subtabs('ajustes', [['catalogo', 'Catálogo'], ['auditoria', 'Auditoría']], tab)}${body}`;
  };

  // ---------- marco ----------
  const NAV = { productor: [['predios', 'Mis predios', 'pins', '#/predios'], ['cuenta', 'Cuenta', 'user', '#/cuenta']], admin: [['hoy', 'Hoy', 'home', '#/hoy'], ['directorio', 'Clientes', 'users', '#/directorio'], ['red', 'Red', 'net', '#/red/equipos'], ['ajustes', 'Ajustes', 'gear', '#/ajustes/catalogo']] };
  const parse = () => {
    const raw = location.hash.replace(/^#/, '') || '/', [path, qs] = raw.split('?'), seg = path.split('/').filter(Boolean), q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { seg, q };
  };
  const section = (seg) => (seg[0] === 'area' ? 'predios' : seg[0] || (S.role === 'admin' ? 'hoy' : 'predios'));
  const frame = (content, sec) => {
    const nav = NAV[S.role];
    return `<a class="skip" href="#main">Saltar al contenido</a>
    <div class="demo"><strong>PROPUESTA ${esc(VARIANTS[S.variant])}</strong><span class="grow">Datos de ejemplo anonimizados · los formularios y descargas son simulados: nada se guarda</span>
      <span class="seg" role="group" aria-label="Propuesta visual">${Object.entries(VARIANTS).map(([k, l]) => `<button data-variant="${k}" aria-pressed="${S.variant === k}" title="${l}">${l.slice(0, 1)}</button>`).join('')}</span>
      <span class="seg" role="group" aria-label="Rol de demostración"><button data-role="productor" aria-pressed="${S.role === 'productor'}">Productor</button><button data-role="admin" aria-pressed="${S.role === 'admin'}">Admin</button></span>
      <span class="seg" role="group" aria-label="Tema"><button data-theme="light" aria-pressed="${S.theme === 'light'}">Claro</button><button data-theme="dark" aria-pressed="${S.theme === 'dark'}">Oscuro</button></span></div>
    <header class="top"><a class="brand" href="${nav[0][3]}">${ic('logo', 22)} Sensores Agrícolas</a>
      <nav class="topnav" aria-label="Principal">${nav.map(([k, l, , h]) => `<a href="${h}" ${sec === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav><span class="spacer"></span>
      <button class="iconbtn" data-menu aria-haspopup="true" aria-expanded="${S.menu}">${ic('user', 18)}<span class="acct-name">${S.role === 'admin' ? 'Administración' : 'Mi cuenta'}</span>${ic('down', 14)}</button></header>
    ${S.menu ? `<div class="menu" role="menu"><div class="who">${S.role === 'admin' ? 'Administrador (ejemplo)' : esc(D.client.contacto)}</div>${S.role === 'productor' ? '<a role="menuitem" href="#/cuenta">Cuenta</a>' : ''}<button role="menuitem" data-theme="${S.theme === 'dark' ? 'light' : 'dark'}">Tema ${S.theme === 'dark' ? 'claro' : 'oscuro'}</button><button role="menuitem" data-toast="Demostración: cerrar sesión no hace nada.">Cerrar sesión</button></div>` : ''}
    <main id="main" tabindex="-1">${content}</main>
    <nav class="tabbar" aria-label="Principal móvil">${nav.map(([k, l, i, h]) => `<a href="${h}" ${sec === k ? 'aria-current="page"' : ''}>${ic(i, 22)}<span>${l}</span></a>`).join('')}</nav>
    ${S.drawer ? drawer() : ''}${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`;
  };
  const drawer = () => {
    const [title, fields] = FORMS[S.drawer];
    return `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dt"><header><div><h2 id="dt" style="font-size:18px">${esc(title)}</h2><span class="sim">Demostración · no guarda</span></div><button class="iconbtn" data-close aria-label="Cerrar">${ic('x', 18)}</button></header><div class="body">${fields.map(([l, t], i) => `<div class="field"><label for="f${i}">${esc(l)}</label>${t === 'select' ? `<select id="f${i}">${D.crops.map((c) => `<option>${c}</option>`).join('')}</select>` : `<input id="f${i}" type="${t}">`}</div>`).join('')}</div><footer><button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Guardar (simulado)</button></footer></aside>`;
  };

  let toastTimer;
  const toast = (m) => { S.toast = m; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; render(); }, 3200); };
  const render = () => {
    const { seg, q } = parse();
    if (S.role === 'admin' && ['predios', 'cuenta'].includes(seg[0])) { location.hash = '#/hoy'; return; }
    if (S.role === 'productor' && ['hoy', 'directorio', 'red', 'ajustes'].includes(seg[0])) { location.hash = '#/predios'; return; }
    if (S.role === 'admin' && seg[0] === 'area') { location.hash = `#/directorio?area=${seg[1]}`; return; }
    if (seg[0] === 'directorio' && q.area && S.fromHash) { S.dir = { type: 'area', id: +q.area, tab: q.tab || 'resumen', level: 'detail' }; }
    S.fromHash = false;
    let html;
    switch (seg[0]) {
      case 'area': html = viewArea(seg[1], seg[2] || 'ahora'); break;
      case 'cuenta': html = viewCuenta(); break;
      case 'hoy': html = viewHoy(); break;
      case 'directorio': html = viewDirectorio(); break;
      case 'red': html = viewRed(seg[1]); break;
      case 'ajustes': html = viewAjustes(seg[1]); break;
      default: html = S.role === 'admin' ? viewHoy() : viewPredios();
    }
    const y = window.scrollY, fo = document.activeElement?.dataset?.restore;
    $app.innerHTML = frame(html, section(seg));
    document.documentElement.dataset.variant = S.variant; document.documentElement.dataset.theme = S.theme; document.documentElement.dataset.role = S.role;
    window.scrollTo(0, y);
    if (fo) document.querySelector(`[data-restore="${fo}"]`)?.focus();
  };

  // ---------- eventos ----------
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
  document.addEventListener('click', (e) => {
    let t = e.target.closest('[data-variant],[data-role],[data-theme],[data-menu],[data-view],[data-pin],[data-preset],[data-metric],[data-page],[data-dl],[data-form],[data-toast],[data-go],[data-sel],[data-back],[data-close],[data-save]');
    if (t && !$app.contains(t)) t = null; // <html> también lleva data-role y data-theme
    if (!t) { if (S.menu && !e.target.closest('.menu')) { S.menu = false; render(); } return; }
    const d = t.dataset;
    if (d.variant) { S.variant = d.variant; store.set('proto-variant', S.variant); render(); return; }
    if (d.role) { S.role = d.role; S.menu = false; go(d.role === 'admin' ? '#/hoy' : '#/predios'); return; }
    if (d.theme) { S.theme = d.theme; store.set('proto-theme', S.theme); S.menu = false; render(); return; }
    if (t.hasAttribute('data-menu')) { S.menu = !S.menu; render(); return; }
    S.menu = false;
    if (d.view) S.view = d.view;
    else if (d.pin) { S.mapSel = +d.pin; document.querySelector(`[data-row="${d.pin}"]`)?.classList.add('hl'); }
    else if (d.preset) { const m = { 1: 1, 7: 7, 30: 30, mes: 31, 'año': 304, custom: 7 }; S.hist.preset = d.preset; S.hist.days = m[d.preset]; S.hist.page = 0; }
    else if (d.metric) S.hist.metric = d.metric;
    else if (d.page) S.hist.page += +d.page;
    else if (d.dl) toast(`Demostración: aquí se descargaría el ${d.dl} con los mismos filtros. No se descargó nada.`);
    else if (t.hasAttribute('data-form')) S.drawer = d.form;
    else if (d.toast) toast(d.toast);
    else if (d.go) { go(d.go); return; }
    else if (d.sel) { const [ty, id] = d.sel.split(':'); S.dir = { type: ty, id: +id, tab: 'resumen', level: 'detail' }; }
    else if (t.hasAttribute('data-back')) S.dir.level = 'tree';
    else if (t.hasAttribute('data-close')) S.drawer = null;
    else if (t.hasAttribute('data-save')) { S.drawer = null; toast('Demostración: no se guardó nada.'); }
    render();
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'cyc') { S.hist.cycle = e.target.value; S.hist.page = 0; render(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (S.drawer || S.menu)) { S.drawer = null; S.menu = false; render(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.pin')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  window.addEventListener('hashchange', () => { S.fromHash = true; S.drawer = null; S.menu = false; S.mapSel = null; if (!/directorio/.test(location.hash)) S.dir.level = 'tree'; render(); window.scrollTo(0, 0); });

  // ---------- arranque ----------
  const params = new URLSearchParams(location.search);
  const sys = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  S.theme = ['light', 'dark'].includes(params.get('theme')) ? params.get('theme') : store.get('proto-theme') || sys;
  S.variant = ['a', 'b', 'c'].includes(params.get('variant')) ? params.get('variant') : store.get('proto-variant') || 'a';
  S.role = ['productor', 'admin'].includes(params.get('role')) ? params.get('role') : 'productor';
  if (!location.hash) location.hash = S.role === 'admin' ? '#/hoy' : '#/predios';
  S.fromHash = true;
  render();
})();
