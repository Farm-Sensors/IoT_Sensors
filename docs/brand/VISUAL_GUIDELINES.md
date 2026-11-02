# Guía visual — identidad provisional

## Paleta

| Token sugerido | Color | Uso |
|---|---|---|
| `brand-forest` | `#00450D` | Marca principal, navegación o acciones prioritarias con moderación |
| `brand-green` | `#2E7D32` | Acciones secundarias, estados positivos e interacción |
| `brand-lime` | `#8BC34A` | Acentos, indicadores y detalles; evitar texto pequeño sobre blanco |
| `brand-mist` | `#E8F5E9` | Superficie suave, selección o fondos destacados |
| `text-primary` | `#1F2937` | Texto principal en modo claro |

Conservar tokens actuales que representen estados semánticos (error, advertencia, información). No reemplazar rojo/ámbar/azul funcionales con verdes. Confirmar contraste para texto, controles y gráficas en ambos temas; el color no debe ser el único indicador de estado.

## Tipografía

**Plus Jakarta Sans**, con fallback del sistema. Usar pesos 400, 500, 600 y 700 según la jerarquía. Aprovechar la gestión de fuentes y tokens ya existente. No añadir una dependencia externa ni cargar una fuente remota si el proyecto requiere funcionamiento desconectado o ya define otra fuente aprobada; en ese caso, reportarlo en el plan.

## Logotipo

- Mantener proporciones y espacio libre; no deformar, inclinar ni aplicar sombras.
- En fondos claros usar `sensores-agricolas-logo.svg` o `sensores-agricolas-logo-light.svg`.
- En fondos oscuros usar `sensores-agricolas-logo-dark.svg`.
- Para navegación compacta usar `sensores-agricolas-symbol.svg` o `sensores-agricolas-symbol-dark.svg`.
- La versión inversa en fondo verde es opcional y está en `sensores-agricolas-logo-reverse.svg`.
- No usar el eslogan dentro de encabezados estrechos. El archivo de logo principal lo incluye como elemento editable.
- Favicon y app icon: usar el símbolo dentro del lienzo cuadrado; revisar legibilidad en el tamaño real y no agregar texto.

## Estilo de interfaz

Aplicar la identidad mediante tokens, tipografía, iconografía y detalles de componentes existentes. Mantener el carácter ligero, claro y centrado en datos del prototipo aprobado. Reservar el verde lima para acentos y evitar grandes áreas saturadas que compitan con mapas, series de humedad o alertas.

## Accesibilidad

Revisar contraste WCAG apropiado para texto normal y grande, estados de foco visibles y controles con etiquetas. No asumir que combinaciones de la paleta ya cumplen contraste por el valor de color; verificar el uso concreto. Mantener gráficas con leyenda/etiquetas y estados comunicados por texto o forma además del color.
