# Auditoría del administrador › Ajustes, Ciclos y preferencias del dashboard, 2026-11-01

Capturas reales (1366 y 390 px, `admin@sensores.com`) en `audit/results/audit-admin-ajustes/`. Cubre **Catálogo de cultivos** y **Auditoría** (Ajustes), **Ciclos de cultivo** (pestaña de Clientes) y **Preferencias del dashboard** de un cliente. Revisada con las guías `frontend-design` y `dataviz`.

**Medidas (escritorio):** Catálogo 33 palabras y 13 botones; Auditoría 33 palabras y 4 campos; Ciclos 29 palabras; Preferencias 63 palabras y 8 casillas. Todas caben en una pantalla; el problema no es el volumen sino lo que dicen y lo que callan.

## Hallazgos

### Catálogo de cultivos (`/admin/cultivos`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **No dice qué cultivo está en uso.** Antes de editar o borrar «Nogal» el administrador no sabe cuántas áreas dependen de él; el catálogo es justamente lo que las áreas referencian. | Alta |
| 2 | **Seis tarjetas de 136 px con «Sin descripción» repetido** y dos íconos sueltos (editar, borrar) cada una, para mostrar solo un nombre. Es otro estilo que Nodos, Equipos y el Directorio, que ya van en filas. | Media |
| 3 | Título «Catálogo de Cultivos» (mayúsculas de título) frente a la pestaña «Catálogo de cultivos», y un subtítulo que no dice nada («Gestiona los tipos de cultivo disponibles»). | Baja |

### Auditoría (`/admin/auditoria`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 4 | **Promete lo que no registra.** Dice «Historial de cambios administrativos en la plataforma», pero el sistema solo escribe en la bitácora los eventos de **alertas, umbrales** (Fase 2, apagada) y de **recuperación de contraseña**. Crear o borrar un cliente, un predio, un área o un nodo **no queda registrado**. Con las alertas apagadas, la bitácora está vacía y seguirá vacía, y «Ver Auditoría» (en Hoy) lleva a una página que parece rota. | Alta |
| 5 | **Los filtros piden códigos internos en inglés:** los ejemplos son «create, update, delete, execute» y «threshold, alert, inactivity_scan», en campos de texto libre. Un administrador no tiene por qué conocer esos nombres, y dos de ellos revelan funciones apagadas. | Alta |
| 6 | **El mensaje vacío no distingue:** «0 eventos registrados» y «No hay eventos para los filtros seleccionados» aparecen aunque no se haya puesto ningún filtro. | Media |

### Ciclos de cultivo (`/admin/ciclos`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 7 | **Solo muestra las áreas que ya tienen ciclo.** Hoy dice que 5 áreas están sin ciclo, pero esta pantalla enseña únicamente «Area Granja Hogar»: las otras 5, que son las que necesitan atención, no aparecen. | Alta |
| 8 | **Título y subtítulo de jerga** («Gestión de Ciclos de Cultivo», «Administra los ciclos de cultivo por área»); un bloque verde grande por ciclo activo; fecha larga («30 de septiembre de 2026 - Actual») distinta del dd/MM/aaaa del resto; y el único control es un bote de basura (no hay editar). | Media |
| 9 | Es la misma información que la pestaña Ciclos de cada área en el Directorio, sin decir de dónde viene ni cómo llegar a ella. | Baja |

### Preferencias del dashboard (`/admin/clientes/:id/dashboard`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 10 | **Las etiquetas ya no corresponden a la pantalla del productor rediseñada.** «Gráfica de humedad (últimas 12 lecturas)» (ahora son 24 h), «Estado del Riego» (ya no es una tarjeta: es la insignia junto a «Datos actuales») y «Suelo» / «Ambiental» (ahora «Otras mediciones»). El administrador elige cosas con nombres que no verá. | Alta |
| 11 | **Ocho casillas vacías significan «automático»,** lo contrario de lo que parecen (que no se muestra nada). La explicación va en una franja aparte y un botón «Volver a automático» desactivado. | Media |
| 12 | La ruta de navegación es la antigua; el resto del Directorio ya usa la barra nueva. | Baja |

Causa de fondo: son pantallas **antiguas que nadie volvió a mirar** al rehacer lo demás, y dos de ellas (Auditoría y Preferencias) **describen una aplicación que ya no es la actual**.

## Propuesta (pendiente de aprobar)

**Catálogo:** lista de filas (como Nodos) con el ícono del cultivo, el nombre y **«N áreas lo usan»**, la descripción solo si existe, y Editar/Eliminar; al eliminar uno en uso, el aviso dice cuántas áreas lo usan. Título «Catálogo de cultivos» sin subtítulo.

**Auditoría:** renombrar a «Registro de eventos» con una línea honesta de qué guarda («Restablecimientos de contraseña y, cuando se activen, alertas y umbrales»). **Acción y Entidad pasan a listas con nombres en español** (sin códigos en inglés). Mensajes distintos: «Aún no hay eventos» frente a «Ningún evento coincide con el filtro». **No se construye registro nuevo** (es de Fase 2, bloqueada); solo se dice la verdad. «Ver Auditoría» en Hoy se conserva.

**Ciclos:** lista de **todas** las áreas por predio, con **las que no tienen ciclo primero** («Sin ciclo · Crear ciclo»), fechas en dd/MM/aaaa y el historial plegado; sin título de jerga y sin los bloques verdes grandes.

**Preferencias del dashboard:** etiquetas actualizadas a lo que de verdad ve el productor («Gráfica de humedad de 24 h», «Estado del riego (junto a “Datos actuales”)», «Otras mediciones: suelo», «Otras mediciones: ambiente»), un control claro **«Automático (recomendado) / Elegir tarjetas»** en lugar de ocho casillas vacías y la barra de ruta nueva. Las claves y el endpoint no cambian.

**Meta medible:** que ninguna pantalla prometa algo que no hace, que Ciclos muestre las 6 áreas (no 1), que no quede ningún código en inglés a la vista y que cada etiqueta corresponda a algo visible. Se mantienen: todo el CRUD actual, los mismos endpoints, Fase 2 sin tocar y `null` nunca como 0.

## Investigación: fotos reales del catálogo sin guardarlas (2026-11-01)

Petición de JP: fotos reales de cada cultivo, **sin almacenarlas** en el proyecto y, si existe, con una API **gratuita y sin cuenta**.

**Probado con peticiones reales:**
- **Wikipedia (API REST) y Wikimedia Commons: sí.** Sin cuenta ni clave; las respuestas **y las imágenes** traen `access-control-allow-origin: *`, así que el navegador las puede pedir directamente. `GET https://es.wikipedia.org/api/rest_v1/page/summary/<artículo>` devuelve la miniatura y la imagen original; `…/w/api.php?action=query&generator=search&prop=pageimages&…&origin=*` encuentra el artículo a partir de un nombre libre (probado con «Aguacate», «Sorgo» y «Chile jalapeño»: devolvió imagen en los tres). Commons da la **licencia y el autor** de cada archivo (`prop=imageinfo&iiprop=extmetadata`; el de prueba era CC0).
- **Openverse** (agregador abierto): respondió 504 y luego no respondió; **no es confiable** hoy.
- **Unsplash, Pexels y Pixabay**: requieren cuenta y clave de API; **quedan descartadas** por la condición de JP.

**Límites que hay que conocer:**
1. **No todas son fotos.** La imagen principal de Wikipedia para *maíz* y *alfalfa* es un grabado botánico, y para *chile* («Ají») es una foto de un puesto en Brasil. Para tener fotos se necesita elegir con cuidado el artículo de cada cultivo (por ejemplo «Chile jalapeño», «Capsicum annuum», «Alfalfa» en inglés); para los seis iniciales se puede fijar una tabla pequeña de títulos y, para cualquier cultivo nuevo, buscar por nombre. Aun así, la calidad varía.
2. **«Nogal» en México suele ser nogal pecanero** (*Carya illinoinensis*); el artículo «Nogal» de Wikipedia es el nogal común (*Juglans regia*). Hay que decidir cuál representa tu cultivo.
3. **Atribución:** muchas imágenes son CC BY o CC BY-SA y piden mostrar autor y licencia; se leen de Commons y se pueden mostrar como una línea pequeña.
4. **Dependencia externa:** si Wikimedia no responde o la red del cliente la bloquea, no hay foto; se mantiene el ícono actual como respaldo. Al pedir las imágenes, Wikimedia ve la IP y el navegador del usuario (como cualquier sitio que enlaza imágenes ajenas).
5. **Nada se guarda:** solo se escribe en el proyecto el título del artículo; las fotos viajan directo del servidor de Wikimedia al navegador (y su caché normal).

## Aplicado (2026-11-01)

**Catálogo de cultivos (`/admin/cultivos`)**
- Filas (como Nodos) con la **foto**, el nombre y **«N áreas lo usan»** (de `/irrigation-areas`; «Sin áreas» si ninguna); sin «Sin descripción» repetido. Título «Catálogo de cultivos», sin subtítulo.
- **Eliminar:** el sistema ya impedía borrar un cultivo con áreas activas (409, con el aviso en inglés «Cannot delete crop type…»). Ahora la confirmación dice cuántas áreas lo usan y que no se podrá eliminar mientras las tengan, y el error se muestra en español.
- **Fotos de Wikimedia Commons** (sin cuenta ni clave, sin guardar nada): `services/cropPhotos.ts` busca una foto por cultivo (consulta en inglés fijada para los seis iniciales: nogal → *walnut tree nuts*, alfalfa, manzana → *red apples on tree*, maíz → *maize field*, chile → *green chili pepper on plant*, algodón; para cualquier otro, su nombre), una sola petición por cultivo y sesión, solo JPEG de al menos 800 px y sin escaneos de libros; `components/CropPhoto.tsx` la muestra o, si no hay o falla, el ícono de siempre. **Créditos:** cada foto lleva autor y licencia en su `title` y hay una sección «Fotos de Wikimedia Commons · ver créditos» con autor, licencia y enlace al archivo.
- **Cómo quitar las fotos:** poner `SHOW_CROP_PHOTOS = false` en `services/cropPhotos.ts` (vuelven los íconos, sin otra petición) o borrar `cropPhotos.ts` y `CropPhoto.tsx` y quitar su uso en `CropTypeManagement.tsx`.
- **Resultado visto:** las seis cargan. Nogal (árbol), alfalfa (follaje) y maíz (campo) se entienden; **manzana es un huerto con un árbol, chile es una textura rojo-naranja poco clara** y algodón es una planta con motas. Son las dos candidatas a afinar la consulta o a fijar un archivo concreto.

**Registro de eventos (antes «Auditoría», `/admin/auditoria`)**
- Se llama **«Registro de eventos»** (pestaña, título y botón de Hoy) y dice qué guarda: «Restablecimientos de contraseña y, cuando se activen, alertas y umbrales». No se creó registro nuevo (Fase 2 bloqueada).
- **Acción** y **«Qué se registró»** son listas en español («Creación», «Cambio», «Umbral», «Alerta», «Recuperación de contraseña»…) en lugar de texto libre con códigos en inglés; la tabla y el detalle usan los mismos nombres (si llega un valor nuevo, se muestra tal cual).
- Dos mensajes vacíos: **«Aún no hay eventos registrados…»** (sin filtros) y **«Ningún evento coincide con el filtro»**.

**Ciclos de cultivo (`/admin/ciclos`)**
- Lista de **todas las áreas, las que no tienen ciclo primero** («Sin ciclo activo» en rojo con **«Crear ciclo»**, que abre el alta con el área ya elegida), fechas dd/mm/aaaa, historial plegado («N ciclos en el historial») con eliminar por ciclo. Título «Ciclos de cultivo» sin subtítulo. Pasó de enseñar 1 área a enseñar las 6. (La vista por área dentro del Directorio no cambia.)

**Preferencias del dashboard**
- Etiquetas puestas al día con lo que ve el productor: «Estado del riego (junto a “Datos actuales”)», «Otras mediciones: suelo», «Otras mediciones: ambiente», «Gráfica de humedad (últimas 24 h)», «Fuentes externas (clima de referencia y NDVI)»; subtítulo «Qué tarjetas ve <cliente> en su pantalla del área (Ahora)»; barra de ruta nueva. **No se hizo** el control «Automático / Elegir tarjetas»: se conservó el comportamiento y la franja explicativa (las pruebas y el endpoint dependen de él); queda como mejora pendiente.

**Pruebas:** typecheck, 162 unitarias (se actualizaron las de Ciclos y Preferencias) y build; sin errores de JavaScript. Fotos comprobadas en el navegador (escritorio y móvil). `navigation.spec.ts` actualizado, **no ejecutado**.


## Cambio de enfoque de las fotos (2026-11-01)

JP prefirió **elegir la foto** en lugar de que se pusiera sola: al **agregar o editar** un cultivo hay una sección «Foto (opcional)» con «Buscar fotos» que ofrece las **6 primeras opciones** de Wikimedia Commons; se elige una (queda marcada) o se deja **sin foto** y el cultivo muestra su ícono de siempre. Se puede escribir otra búsqueda (por defecto, la sugerida para ese cultivo) y «Quitar foto» vuelve al ícono. No se busca nada hasta que se pide.
- **Dónde se guarda:** JP eligió **la base de datos**. Se agregó la migración `f31b06d8c909` (tres columnas opcionales en `tipos_cultivo`: dirección de la miniatura, atribución y página del archivo; **nunca la imagen**), el modelo, el esquema y el servicio. La API valida que la foto sea de Wikimedia (si no, 422), y quitar la foto borra su atribución. `openapi.yaml` regenerado (solo suma campos). **La migración ya se aplicó a la base local de desarrollo** (columnas nuevas y nulas: no cambia ningún dato existente).
- **Lista:** muestra la foto elegida o el ícono; los créditos salen de la base de datos («Fotos de Wikimedia Commons · ver créditos»). Se retiró la búsqueda automática y el interruptor `SHOW_CROP_PHOTOS`.
- **Pruebas:** backend 28 de cultivos (5 nuevas: crear con foto, foto opcional, rechazo de otros orígenes, poner y quitar con su crédito, renombrar sin tocar la foto) y la prueba de sincronía de OpenAPI; frontend 165 (3 nuevas del selector: no busca hasta que se pide y muestra 6, elegir y quitar, y sin conexión). Comprobado en el navegador sin guardar: se ofrecen 6 opciones y la elegida se marca.
- **Nota:** en tu base ya había una foto elegida para Nogal (la guardaste tú) y la lista la muestra.
