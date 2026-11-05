# Instrucciones de implementación para Claude Code

## Antes de editar

1. Identifica el repositorio `IoT_Sensors` y confirma la rama, cambios pendientes y estructura real del proyecto.
2. Lee documentación del repo, `README`, instrucciones de agentes y decisiones de rediseño existentes antes de proponer archivos nuevos.
3. Revisa el prototipo y `assets/references/pantallas-sensores-agricolas.pdf` como referencia de UX aprobada. Confirma con el usuario cualquier contradicción material entre el repo y este paquete.
4. Presenta un plan breve: alcance, archivos que cambiarías, estrategia de tokens/fuente/logo, riesgos, y cómo revisarás desktop/móvil y claro/oscuro.
5. **Espera aprobación explícita del usuario antes de editar.** Si el usuario no aprueba, limítate a aclarar el plan.

## Alcance permitido después de la aprobación

Aplicar la identidad visual provisional donde corresponda en la aplicación y el prototipo existentes; agregar los SVG seleccionados a una ubicación coherente con las convenciones del repo; reutilizar el sistema de diseño actual y sus componentes; actualizar tokens de color/tema y tipografía solo donde sea seguro; sustituir la marca genérica temporal de forma consistente si no pisa el nombre real de producto/organización.

## Límites

- Preservar íntegramente la UX aprobada: navegación, estructura de información, orden de pantallas, jerarquía funcional y flujos.
- No modificar reglas de negocio, cálculos, servicios, API, autenticación, persistencia, backend, base de datos, esquema, migraciones ni datos.
- No cambiar contratos de componentes, comportamiento de formularios, validaciones, permisos o lógica de estado para hacer sitio a la identidad.
- No introducir dependencias sin justificarlo y mencionarlo en el plan.
- No borrar documentación, prototipos, assets o cambios preexistentes.
- No reemplazar marca/nombres reales que el repo muestre sin autorización.
- No asumir que la identidad o el nombre son definitivos.

## Revisión después de implementar

Validar de forma proporcional a las herramientas existentes, sin modificar lógica:
- Arranque/lint/build según los scripts documentados del repo.
- Vistas de escritorio y móvil: navegación, login, resumen de predios, detalle e historial, mapas, clientes, nodos/equipos, catálogo y ciclos.
- Modo claro y oscuro, si ambos existen.
- Contraste, foco, escala del símbolo y ausencia de desbordes/recortes.
- Revisar `git diff` para confirmar que los cambios son de presentación y assets únicamente.

Al final resume archivos tocados, decisiones visuales, verificaciones ejecutadas y cualquier limitación. No hagas commit, push ni despliegue salvo petición posterior.
