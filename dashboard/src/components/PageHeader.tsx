import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <section className="page-header-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
