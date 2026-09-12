"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  prevLabel: string;
  nextLabel: string;
};

export function CatalogPagination({ currentPage, totalPages, onPageChange, prevLabel, nextLabel }: Props) {
  if (totalPages <= 1) return null;

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

      <span className="catalog-pagination-info" aria-current="page">
        {currentPage} / {totalPages}
      </span>

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
