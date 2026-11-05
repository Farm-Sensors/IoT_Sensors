# Auditoría de diseño · Admin › Umbrales (aplicada)

Fase 2 autorizada (ver `README.md`). Misma pantalla para administrador y productor (`/admin/umbrales`, `/cliente/umbrales`). Solo presentación: la lógica de crear, editar y eliminar, los payloads y las validaciones de fondo no cambian. Capturas con respuestas simuladas de `/thresholds` (no se escribe en la base): `audit/108-umbrales-admin.mjs`, resultados en `audit/results/umbrales-admin/`.

## Hallazgos

1. **Tabla de 7 columnas** (Área, Parámetro, Min, Max, Severidad, Estado, Acciones) que obliga a leer de lado a lado y a combinar «Min» y «Max» para entender la regla; en móvil se desplaza horizontalmente.
2. **La regla no se lee como regla:** «Humedad 20 / 30» no dice qué pasa fuera del rango ni en qué unidad.
3. **«Área #3»:** solo el nombre del área, sin predio ni cliente; con varios predios no se sabe de cuál es.
4. **Filtro de áreas plano:** una lista con todas las áreas (mismo problema que en Alertas), más «Parámetro» y «Estado».
5. **Severidad en inglés y mayúsculas** («WARNING», «CRITICAL») y **«Min/Max»** abreviados.
6. **Lista de 12 parámetros sin orden** («Suelo: Conductividad», «Riego: Activo», «Ambiental: ETO»…), con «C» por °C y «bool» como unidad.
7. **Formulario en un modal propio**, sin foco atrapado ni Escape garantizados, con errores en inglés y con nombres de campo internos («Debes capturar min_value o max_value»).
8. **Borrar con `window.confirm`**, con texto sin tildes («Seguro que deseas eliminar este umbral?») que no dice qué se pierde.
9. **Dos iconos «+»** en el botón «Nuevo Umbral» (error de maquetación).
10. **Consejo al pie** («habilitar semáforos completos en dashboard») que habla de una función que hoy no está.
11. **Vacío genérico:** «No hay umbrales para los filtros actuales».

## Cambios aplicados

- **Lista agrupada por área** («Cliente › Predio › Área · n») y **cada regla como frase**: «Humedad del suelo — Avisar si baja de 20 % o sube de 30 %», con unidad y valores en tipografía de datos. Gravedad en barra, icono y texto (Crítica, Aviso, Información) y estado **Activo / Pausado** (los pausados se atenúan). Editar y eliminar como acciones de 44 px con nombre accesible.
- **Filtros como en Alertas:** primero **Predio** (con el cliente para el admin); el **Área** solo aparece con un predio elegido, con «Todas las áreas del predio (n)». Después **Medición** (agrupada) y **Todos / Activos / Pausados**. Con `?area=` (desde Área › Detalles) el predio se elige solo.
- **Mediciones agrupadas** en Suelo, Riego y Ambiente, con nombres en español y la unidad entre paréntesis.
- **Formulario en `FormDialog`** (foco atrapado, Escape, foco de vuelta), «Avisar si la medición… Baja de (%) / Sube de (%)» con «Déjalo vacío si no hay límite de ese lado», gravedad en español, y **errores en español en el propio diálogo** («Elige el área…», «Escribe un mínimo, un máximo o los dos», «El mínimo no puede ser mayor que el máximo»).
- **Eliminar con `ConfirmDialog`:** explica qué dejará de avisar y que las alertas ya creadas se conservan (verificado: `umbral_id` pasa a nulo, la baja es lógica).
- **Vacíos útiles:** «Aún no hay umbrales» con «Crear el primer umbral», y «Ningún umbral coincide con el filtro» con «Limpiar filtros».
- Se quitaron el icono «+» duplicado y el consejo al pie.

## Lo que no cambia
Rutas, permisos, API (`/thresholds`), campos y payloads, el filtrado por un área a la vez (para un predio completo se piden sus áreas y se unen, igual que en Alertas) y el alcance del productor a sus propias áreas.

## Pendiente
- Un filtro `property_id` en el backend evitaría una consulta por área (mejora opcional, sin tocar hoy).
- Preferir un interruptor Activo/Pausado en la propia fila (hoy se cambia desde «Editar»).
