import { ReactNode } from "react";

interface BentoCardProps {
  children: ReactNode;
  variant?: "light" | "sand" | "dark" | "brown";
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export function BentoCard({
  children,
  variant = "light",
  className = "",
  padding = "md"
}: BentoCardProps) {
  const backgrounds = {
    light: "glass-card text-[var(--text-body)] border border-[var(--border-subtle)]",
    sand: "bg-[var(--card-sand)] text-[var(--text-body)] border border-[var(--border-subtle)]",
    dark: "bg-[var(--card-dark)] text-[var(--text-on-dark)] border border-[var(--border-glass)]",
    brown: "bg-[var(--card-brown)] text-[var(--text-on-dark)] border border-[var(--border-glass)]",
  };

  const paddings = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div className={`${backgrounds[variant]} ${paddings[padding]} rounded-[var(--radius)] transition-colors duration-300 ${className}`}>
      {children}
    </div>
  );
}
