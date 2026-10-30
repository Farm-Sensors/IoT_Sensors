import { ChevronDown } from "lucide-react";
import { type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface DisclosureProps {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Datos secundarios o de soporte, cerrados por defecto («Datos para soporte»). */
export function Disclosure({ summary, children, defaultOpen = false, className = "" }: DisclosureProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={className}>
      <CollapsibleTrigger
        className="group inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-medium text-[var(--text-muted)]
          hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180"
        />
        {summary}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pt-2 text-sm">{children}</CollapsibleContent>
    </Collapsible>
  );
}
