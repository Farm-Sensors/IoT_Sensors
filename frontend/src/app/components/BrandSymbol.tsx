/**
 * Símbolo de la identidad provisional «Sensores Agrícolas» (brote conectado sobre surcos).
 * Archivos en `public/brand/`; la versión se elige por tema con la variante `dark:` de Tailwind.
 * `onDark` fuerza la versión clara para fondos oscuros fijos (p. ej. el panel verde del login).
 */
export function BrandSymbol({ className = "h-6 w-6", onDark = false }: { className?: string; onDark?: boolean }) {
  if (onDark) return <img src="/brand/sensores-agricolas-symbol-dark.svg" alt="" aria-hidden="true" className={className} />;
  return (
    <>
      <img src="/brand/sensores-agricolas-symbol.svg" alt="" aria-hidden="true" className={`${className} dark:hidden`} />
      <img src="/brand/sensores-agricolas-symbol-dark.svg" alt="" aria-hidden="true" className={`${className} hidden dark:block`} />
    </>
  );
}
