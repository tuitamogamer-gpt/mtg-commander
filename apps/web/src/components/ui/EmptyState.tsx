import type { ReactNode } from "react";

/** Friendly empty-state with an icon, copy, and optional call-to-action. */
export function EmptyState({
  icon = "✦",
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface/50 py-12 px-6 text-center">
      <div className="text-3xl text-muted">{icon}</div>
      <div className="text-lg font-semibold text-white">{title}</div>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
