import { LucideIcon } from "lucide-react";
import { PillButton } from "./PillButton";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Illustrated empty state with icon, title, description and optional CTA.
 * Replaces plain "No hay datos" text for a more polished UX.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-[24px] bg-[var(--card-sand)] flex items-center justify-center mb-4">
        <Icon aria-hidden="true" className="w-8 h-8 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-lg font-medium text-[var(--text-main)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs">{description}</p>
      )}
      {action && (
        <PillButton className="mt-5" onClick={action.onClick}>
          {action.label}
        </PillButton>
      )}
    </div>
  );
}
