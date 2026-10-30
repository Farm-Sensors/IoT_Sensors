import { type RefObject } from "react";

interface SkipLinkProps {
  targetRef: RefObject<HTMLElement | null>;
}

/** Primer elemento enfocable: salta la navegación y lleva el foco al contenido principal. */
export function SkipLink({ targetRef }: SkipLinkProps) {
  return (
    <a
      href="#contenido"
      onClick={(event) => {
        event.preventDefault();
        targetRef.current?.focus();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-full
        focus:bg-[var(--accent-primary)] focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-[var(--text-inverted)]
        focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
    >
      Saltar al contenido
    </a>
  );
}
