import { Moon, Sun } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { useTheme } from "../../context/ThemeContext";
import { BrandSymbol } from "../BrandSymbol";

interface AuthSplitLayoutProps {
  heading: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Nodo de campo: mástil blanco sobre trípode, caja del tamaño de una de fusibles y panel solar arriba,
 * en medio del cultivo (los sensores van enterrados y no se dibujan). La señal sale de la caja.
 * Blanco, azul panel y lima sobre el verde de la marca; la tierra es opaca y tapa las ondas.
 */
function FieldIllustration() {
  const d = (n: number) => ({ "--d": `${n}s` }) as CSSProperties;
  const cx = 262;
  const cy = 118; // centro de la caja
  const arc = (r: number, a1: number, a2: number) => {
    const p = (a: number) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`;
    return `M${p(a1)} A${r} ${r} 0 0 1 ${p(a2)}`;
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 520 240" className="relative w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs><clipPath id="auth-ground"><rect x="0" y="0" width="520" height="240" rx="18" /></clipPath></defs>
      <g className="auth-grow" style={d(0.5)}>
        <g stroke="#C9A24B" strokeWidth="3" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            return <path key={i} d={`M${(440 + 22 * Math.cos(a)).toFixed(1)} ${(54 + 22 * Math.sin(a)).toFixed(1)}L${(440 + 29 * Math.cos(a)).toFixed(1)} ${(54 + 29 * Math.sin(a)).toFixed(1)}`} />;
          })}
        </g>
        <circle cx="440" cy="54" r="16" fill="#C9A24B" />
      </g>
      <g clipPath="url(#auth-ground)">
        <path d="M-10 176C120 158 300 160 530 174V250H-10Z" fill="#5A3E24" className="auth-rise" style={d(0.3)} />
        <path d="M-10 200C150 188 330 188 530 202" stroke="#8A5E36" strokeOpacity={0.8} strokeWidth="6" pathLength={1} className="auth-draw" style={d(0.6)} />
        <path d="M-10 224C150 212 330 212 530 226" stroke="#A9733F" strokeOpacity={0.8} strokeWidth="7" pathLength={1} className="auth-draw" style={d(0.75)} />
      </g>
      {/* tres plantas de tamaños distintos, solo contorno y poco relleno */}
      {[[105, 1.15], [186, 0.8], [402, 1]].map(([x, sc], k) => (
        <g key={x} transform={`translate(${x} ${176 + (k % 2) * 3}) scale(${sc})`}>
          <g className="auth-grow" style={d(0.9 + k * 0.15)} stroke="#CDE8A0" strokeWidth="2.2">
            <path d="M0 0V-18" />
            <path d="M0 -7C-10 -7 -14 -13 -14 -21 -6 -20 -1 -15 0 -9" fill="#CDE8A0" fillOpacity={0.18} />
            <path d="M1 -12C2 -21 9 -27 18 -27 18 -18 13 -13 2 -10" fill="#CDE8A0" fillOpacity={0.18} />
          </g>
        </g>
      ))}
      {/* nodo */}
      <g className="auth-grow" style={d(1.0)}>
        <g stroke="#FFFFFF" strokeWidth="4">
          <path d="M262 172V62" />
          <path d="M262 150L238 182M262 150L286 182M262 156V184" strokeWidth="3.5" />
        </g>
        {/* panel solar inclinado con su cuadrícula */}
        <g transform="rotate(-8 262 52)">
          <rect x="212" y="26" width="100" height="52" rx="3" fill="#1F3A5F" stroke="#E8F5E9" strokeWidth="2.4" />
          <path d="M237 26V78M262 26V78M287 26V78M212 44H312M212 61H312" stroke="#E8F5E9" strokeOpacity={0.7} strokeWidth="0.9" />
        </g>
        {/* caja blanca (del tamaño de una de fusibles) */}
        <rect x="248" y="104" width="28" height="30" rx="3" fill="#FFFFFF" />
        <rect x="253" y="110" width="18" height="6" rx="1.5" fill="#D8E2EA" />
        <circle cx="262" cy="124" r="2.6" fill="#F6C453" />
      </g>
      {/* señal: arcos inclinados hacia arriba a los lados, fuera del panel y de las plantas */}
      <g stroke="#8BC34A" strokeOpacity={0.8} strokeWidth="3" fill="none">
        {[66, 84, 102].map((r, i) => (
          <g key={r}>
            <path d={arc(r, -32, 8)} className="auth-ping" style={d(1.8 + i * 0.8)} />
            <path d={arc(r, 172, 212)} className="auth-ping" style={d(1.8 + i * 0.8)} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Curvas de nivel decorativas (identidad «Levantamiento»). */
function Contours() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" strokeWidth="1">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
        <path key={i} opacity={0.03 + (i % 4) * 0.012} d={`M-20 ${120 + i * 38} C 60 ${60 + i * 36}, 120 ${200 + i * 30}, 210 ${150 + i * 34} S 360 ${90 + i * 40}, 430 ${170 + i * 32}`} />
      ))}
    </svg>
  );
}

export function AuthSplitLayout({ heading, description, children, footer }: AuthSplitLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-[var(--brand-forest)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Contours />
        <div className="relative flex items-center gap-3">
          <BrandSymbol onDark className="h-24 w-24" />
          <p className="text-xl font-semibold">Sensores Agrícolas</p>
        </div>

        <div className="relative max-w-md">
          <p className="auth-rise mb-4 text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl" style={{ "--d": "0.1s" } as CSSProperties}>
            Tu riego, predio por predio.
          </p>
          <p className="auth-rise text-base text-white/80" style={{ "--d": "0.3s" } as CSSProperties}>
            Consulta cada área de riego, cuándo reportó por última vez su nodo y el histórico de la temporada.
          </p>
          <p className="auth-rise mt-6 text-sm font-semibold text-[#B9DAB9]" style={{ "--d": "0.5s" } as CSSProperties}>Tecnología que impulsa el campo.</p>
        </div>

        <FieldIllustration />
      </aside>

      <main className="flex flex-col px-4 py-6 md:px-10 lg:px-16">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 lg:invisible">
            <BrandSymbol className="h-14 w-14" />
            <p className="text-base font-semibold text-[var(--text-title)]">Sensores Agrícolas</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
          >
            {theme === "light" ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>

        <div className="auth-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10" style={{ "--d": "0.2s" } as CSSProperties}>
          <div className="mb-6 overflow-hidden rounded-3xl bg-[var(--brand-forest)] px-6 pt-5 lg:hidden">
            <FieldIllustration />
          </div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-[var(--text-title)]">{heading}</h1>
          <p className="mb-8 text-sm text-[var(--text-subtle)]">{description}</p>

          {children}

          {footer ? <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
