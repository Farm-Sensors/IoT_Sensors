# Prompt listo para Claude Code

Quiero aplicar al proyecto `IoT_Sensors` una **identidad visual preliminar** para el nombre temporal **Sensores Agrícolas**. La identidad y el nombre son provisionales, no decisiones comerciales definitivas.

Lee primero, en este orden:
1. `README.md` de este paquete.
2. `BRAND_BRIEF.md`.
3. `VISUAL_GUIDELINES.md`.
4. `IMPLEMENTATION_INSTRUCTIONS.md`.
5. Los SVG dentro de `assets/logos/` y el PDF `assets/references/pantallas-sensores-agricolas.pdf`.
6. La documentación, instrucciones de agentes y estructura real del repositorio `IoT_Sensors`.

## Contexto de producto

El prototipo de referencia contiene login, lista y detalle de predios, resumen de humedad y flujo de agua, historial/gráficas, mapa, clientes, nodos, equipos, catálogo de cultivos y ciclos. La UX y organización funcional están aprobadas; la estética puede recibir la nueva identidad. La marca debe apoyar monitoreo agrícola conectado sin competir con datos, mapas, gráficas y alertas.

## Requisito previo obligatorio

**No edites archivos todavía.** Primero inspecciona el repo y presenta un plan concreto con:
- archivos/componentes/tokens que propones tocar;
- ubicación prevista de los SVG y estrategia de tipografía;
- cómo conservarás UX y lógica;
- verificaciones para desktop, móvil y modo claro/oscuro;
- dudas o riesgos encontrados en el repo.

Luego **detente y espera mi aprobación explícita** antes de hacer cambios. No interpretes este prompt como aprobación anticipada del plan.

## Después de que apruebe el plan

Implementa la identidad con el menor cambio visual necesario para lograr consistencia:
- utiliza la paleta aprobada en `VISUAL_GUIDELINES.md`, respetando tokens semánticos de estados;
- incorpora Plus Jakarta Sans solo si encaja con las convenciones, disponibilidad y requisitos del proyecto; conserva un fallback adecuado;
- selecciona versiones del logo según fondo y tamaño; verifica legibilidad de favicon/app icon;
- aplica marca en app y prototipo donde existan y corresponda, sin duplicar fuentes de verdad;
- conserva los textos y nombres reales que ya sean parte del producto; “Sensores Agrícolas” es solo el nombre provisional autorizado para el proyecto si no hay otro nombre establecido;
- conserva la UX aprobada: navegación, arquitectura de información, pantallas, jerarquía y flujos.

## Límites estrictos

No cambies lógica de negocio, cálculos, API, servicios, autenticación, base de datos, esquema, migraciones, persistencia, permisos ni contratos funcionales. No sustituyas funcionalidad por mockups. No elimines trabajo existente ni hagas refactors ajenos a la identidad. No añadas dependencias sin justificar y sin incluirlas en el plan aprobado. No hagas commit, push ni despliegue.

Si durante el trabajo descubres que un cambio visual requiere tocar lógica o backend, detente y explícame el bloqueo antes de hacerlo.

## Verificación y entrega

Después de implementar, ejecuta solo las verificaciones relevantes que el repo ya soporte y documenta resultados. Revisa desktop/móvil, claro/oscuro cuando estén disponibles, accesibilidad básica, contraste, estados, escalado del logo y que mapas/gráficas sigan legibles. Inspecciona el diff completo y confirma que los cambios se limitan a presentación y assets de marca.

Al terminar, informa: resumen visual, archivos tocados, verificaciones realizadas y resultado, limitaciones encontradas. No declares definitivo el nombre ni la identidad.
