"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  prevLabel: string;
  nextLabel: string;
};

export function getPageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", total];
  }
  if (current >= total - 3) {
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function CatalogPagination({ currentPage, totalPages, onPageChange, prevLabel, nextLabel }: Props) {
  if (totalPages <= 1) return null;

  const pageItems = getPageItems(currentPage, totalPages);

  return (
    <nav className="catalog-pagination" aria-label="Paginación">
      <button
        type="button"
        className="catalog-pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label={prevLabel}
      >
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        <span>{prevLabel}</span>
      </button>

      <div className="catalog-pagination-pages" role="group" aria-label="Páginas">
        {pageItems.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="catalog-pagination-ellipsis"
                aria-hidden="true"
              >
                …
              </span>
            );
          }

          const isActive = item === currentPage;

          return (
            <button
              key={item}
              type="button"
              className={`catalog-pagination-page${isActive ? " is-active" : ""}`}
              onClick={() => onPageChange(item)}
              disabled={isActive}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Página ${item}`}
            >
              {item}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="catalog-pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label={nextLabel}
      >
        <span>{nextLabel}</span>
        <CaretRight size={16} weight="bold" aria-hidden="true" />
      </button>
    </nav>
  );
}
