import { MagnifyingGlassIcon } from "@phosphor-icons/react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <MagnifyingGlassIcon size={28} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
