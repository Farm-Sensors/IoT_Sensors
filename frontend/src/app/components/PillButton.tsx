import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

interface PillButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function PillButton({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  "aria-label": ariaLabel,
}: PillButtonProps) {
  const variants = {
    primary: "bg-[var(--accent-primary)] text-[var(--text-inverted)] hover:opacity-90 active:opacity-95",
    secondary: "bg-[var(--card-sand)] text-[var(--text-main)] hover:opacity-90",
    outline: "border border-[var(--outline-contrast)] text-[var(--text-main)] bg-transparent hover:bg-[var(--hover-overlay)]",
    ghost: "text-[var(--text-main)] hover:bg-[var(--hover-overlay)]",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center gap-2
        min-h-[44px] px-6 py-2.5 rounded-full font-medium
        transition-[background-color,color,opacity,transform,box-shadow] duration-200
        active:scale-[0.97]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--bg-base)]
        ${variants[variant]}
        ${isDisabled ? "opacity-[var(--disabled-opacity)] cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {children}
    </button>
  );
}
