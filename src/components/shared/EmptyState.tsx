import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`grid place-items-center rounded-[20px] bg-card px-6 py-14 text-center shadow-soft ${
        className ?? ""
      }`}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-surface text-muted-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-h3 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h3>
      {description && <p className="mt-1 max-w-sm text-body-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
