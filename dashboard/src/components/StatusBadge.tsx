import type { ProductionStatus } from "../types";

interface StatusBadgeProps {
  status: ProductionStatus | "Completado" | "En curso";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const className = status.toLocaleLowerCase("es").replaceAll(" ", "-").replace("ó", "o");
  return <strong className={`status-badge status-${className}`}>{status}</strong>;
}
