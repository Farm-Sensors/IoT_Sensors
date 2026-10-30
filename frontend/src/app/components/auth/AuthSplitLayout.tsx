import { Leaf, Moon, Sun } from "lucide-react";
import { type ReactNode } from "react";
import { useTheme } from "../../context/ThemeContext";

interface AuthSplitLayoutProps {
  heading: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

const HIGHLIGHTS = ["Humedad del suelo", "Flujo de agua", "E.T.O.", "Histórico"];

export function AuthSplitLayout({ heading, description, children, footer }: AuthSplitLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
        <section className="hidden rounded-[32px] border border-[var(--border-glass)] bg-[var(--card-dark)] p-8 text-[var(--text-on-dark)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[var(--border-glass)] bg-[var(--hover-overlay)] px-4 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-gold)] text-[var(--text-inverted)]">
                <Leaf aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-wide">Sensores Agrícolas</p>
                <p className="text-xs text-[var(--text-on-dark)]/70">Sistema IoT de riego</p>
              </div>
            </div>

            <p className="mb-4 font-serif text-4xl leading-tight text-[var(--text-on-dark)]">
              Monitoreo de Riego Agrícola en Tiempo Real
            </p>
            <p className="max-w-xl text-base text-[var(--text-on-dark)]/75">
              Visualiza datos prioritarios de humedad de suelo, flujo y evapotranspiración desde una interfaz
              orgánica, clara y orientada a operación diaria.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {HIGHLIGHTS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/15 px-3 py-1 text-xs font-medium text-[var(--text-on-dark)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-2xl font-semibold font-mono-data text-[var(--text-on-dark)]">144+</p>
              <p className="text-[var(--text-on-dark)]/70">Lecturas/día</p>
            </div>
            <div>
              <p className="text-2xl font-semibold font-mono-data text-[var(--text-on-dark)]">3 cat.</p>
              <p className="text-[var(--text-on-dark)]/70">Sensores</p>
            </div>
            <div>
              <p className="text-2xl font-semibold font-mono-data text-[var(--accent-gold)]">99.9%</p>
              <p className="text-[var(--text-on-dark)]/70">Uptime</p>
            </div>
          </div>
        </section>

        <section className="relative rounded-[32px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-6 shadow-soft md:p-8 lg:p-10">
          <div className="mb-8 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[24px] bg-[var(--accent-primary)] text-[var(--text-inverted)]">
                <Leaf aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-title)]">Sensores Agrícolas</p>
                <p className="text-xs text-[var(--text-subtle)]">Panel de acceso</p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-card-primary)] text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
            >
              {theme === "light" ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>

          <div className="mb-7">
            <h1 className="mb-2 text-3xl text-[var(--text-title)]">{heading}</h1>
            <p className="text-sm text-[var(--text-subtle)]">{description}</p>
          </div>

          {children}

          {footer ? <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">{footer}</div> : null}
        </section>
      </div>
    </div>
  );
}
