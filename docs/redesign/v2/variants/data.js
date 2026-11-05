// Datos de ejemplo ANONIMIZADOS para el prototipo v2. Nada aquí proviene de personas reales.
// Forma tomada de la API: áreas, predios, nodos/geo, lecturas y ciclos. «null» = sin dato (nunca se muestra como 0).
window.DATA = (() => {
  const NOW = new Date('2026-10-31T15:00:00');
  const FRESH_MINUTES = 20; // igual que FRESH_MINUTES_THRESHOLD del backend

  const client = { id: 1, empresa: 'Agrícola Demo Norte', contacto: 'Persona de ejemplo', correo: 'contacto@ejemplo.test', telefono: null };
  const crops = ['Nogal', 'Alfalfa', 'Manzana', 'Maíz', 'Chile', 'Algodón'];

  const properties = [
    { id: 1, name: 'Rancho Norte', location: 'Sonora, México', equipo: 'vinculado' },
    { id: 2, name: 'Huerta Sur', location: null, equipo: 'pendiente' },
  ];

  // minutesAgo: null → el nodo nunca ha reportado. node: null → el área no tiene nodo.
  const areas = [
    { id: 1, propertyId: 1, name: 'Nogal Norte', crop: 'Nogal', ha: 12.5, minutesAgo: 3, hum: 48.2, flow: 0, eto: 5.2, irrigating: false, accum: 1250, cycle: { start: '01/03/2026', end: null }, node: { serial: 'DEMO-0001', lat: 29.0892, lon: -110.9588 } },
    { id: 2, propertyId: 1, name: 'Alfalfa Este', crop: 'Alfalfa', ha: 8, minutesAgo: 2, hum: 38.3, flow: 8.3, eto: 5.2, irrigating: true, accum: 410, cycle: { start: '15/02/2026', end: null }, node: { serial: 'DEMO-0002', lat: 29.0901, lon: -110.9521 } },
    { id: 3, propertyId: 1, name: 'Chile Principal', crop: 'Chile', ha: 5.5, minutesAgo: 4, hum: 37.4, flow: 0, eto: 5.1, irrigating: false, accum: 96, cycle: null, node: { serial: 'DEMO-0003', lat: 29.0876, lon: -110.9552 } },
    { id: 4, propertyId: 1, name: 'Maíz Lote 2', crop: 'Maíz', ha: 6, minutesAgo: 48 * 60, hum: 62.8, flow: 0, eto: 4.9, irrigating: false, accum: 1235, cycle: null, node: { serial: 'DEMO-0004', lat: 29.0868, lon: -110.9601 } },
    { id: 5, propertyId: 2, name: 'Manzana Alta', crop: 'Manzana', ha: 3, minutesAgo: null, hum: null, flow: null, eto: null, irrigating: null, accum: null, cycle: null, node: { serial: 'DEMO-0005', lat: 28.6851, lon: -106.0766 } },
    { id: 6, propertyId: 2, name: 'Algodón Bajo', crop: 'Algodón', ha: 10, minutesAgo: null, hum: null, flow: null, eto: null, irrigating: null, accum: null, cycle: { start: '01/04/2026', end: null }, node: null },
  ];

  // Estado de datos: solo problemas de DATOS (nunca «falta agua», que requeriría umbrales de Fase 2).
  const stateOf = (a) => {
    if (!a.node) return 'sin_nodo';
    if (a.minutesAgo === null) return 'sin_datos';
    return a.minutesAgo > FRESH_MINUTES ? 'sin_comunicacion' : 'al_dia';
  };
  areas.forEach((a) => { a.state = stateOf(a); });

  // Serie determinista para gráficas y tablas (no es medición real).
  const series = (area, days, stepMin) => {
    const n = Math.round((days * 24 * 60) / stepMin);
    const out = [];
    const end = area.minutesAgo === null ? null : new Date(NOW.getTime() - area.minutesAgo * 60000);
    if (!end) return out;
    for (let i = n - 1; i >= 0; i--) {
      const t = new Date(end.getTime() - i * stepMin * 60000);
      const h = t.getHours() + t.getMinutes() / 60;
      const phase = area.id * 1.7;
      const hum = (area.hum ?? 40) + Math.sin((t.getTime() / 3.6e6 + phase) / 5) * 4 - ((n - i) % 288) * 0.002 + Math.sin(i * 0.9 + phase) * 0.4;
      const irrig = area.irrigating !== null && Math.floor(h) % 6 === area.id % 6 && i % 3 !== 0;
      const flow = irrig ? 6 + Math.sin(i + phase) * 1.2 : 0;
      out.push({
        t, hum: +hum.toFixed(1), flow: +flow.toFixed(1), eto: +(4.6 + Math.sin(h / 3.8) * 0.8 + area.id * 0.02).toFixed(2),
        soilT: +(21 + Math.sin(h / 3.8 - 1) * 2.2).toFixed(1), airT: +(18 + Math.sin(h / 3.8 - 1.5) * 9).toFixed(1), rh: +(48 - Math.sin(h / 3.8 - 1.5) * 18).toFixed(0),
      });
    }
    return out;
  };

  const latestFull = (a) => (a.minutesAgo === null ? null : {
    soil: { conductivity: 2.4 + a.id * 0.03, temperature: 21.6, humidity: a.hum, water_potential: a.id === 3 ? null : -0.8 },
    irrigation: { active: a.irrigating, accumulated_liters: a.accum, flow_per_minute: a.flow },
    environmental: { temperature: 28.1, relative_humidity: 55, wind_speed: 12.5, solar_radiation: 650, eto: a.eto },
  });

  const gateways = [
    { id: 1, propertyId: 1, status: 'Vinculado', slots: 4, bindings: 'al día' },
    { id: 2, propertyId: 2, status: 'Pendiente de vincular', slots: 1, bindings: '—' },
  ];
  const audit = [
    { when: '31/10 14:12', who: 'Administrador', action: 'update', entity: 'Área · Nogal Norte' },
    { when: '31/10 11:40', who: 'Administrador', action: 'create', entity: 'Ciclo · Alfalfa Este' },
    { when: '30/10 09:05', who: 'Administrador', action: 'create', entity: 'Nodo · DEMO-0005' },
  ];

  return { NOW, FRESH_MINUTES, client, crops, properties, areas, series, latestFull, gateways, audit };
})();
