import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CatalogPagination, getPageItems } from "./CatalogPagination";

afterEach(() => {
  cleanup();
});

describe("getPageItems", () => {
  it("retorna todas las páginas si totalPages <= 7", () => {
    expect(getPageItems(1, 4)).toEqual([1, 2, 3, 4]);
    expect(getPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("agrega elipsis al final cuando estamos cerca del inicio", () => {
    expect(getPageItems(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
    expect(getPageItems(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });

  it("agrega elipsis al inicio cuando estamos cerca del final", () => {
    expect(getPageItems(9, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
    expect(getPageItems(10, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
  });

  it("agrega doble elipsis cuando estamos en el medio", () => {
    expect(getPageItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });
});

describe("CatalogPagination", () => {
  it("no renderiza nada si totalPages <= 1", () => {
    const { container } = render(
      <CatalogPagination
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        prevLabel="Anterior"
        nextLabel="Siguiente"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza los números de página en cuadraditos sin barra diagonal", () => {
    render(
      <CatalogPagination
        currentPage={1}
        totalPages={4}
        onPageChange={vi.fn()}
        prevLabel="Anterior"
        nextLabel="Siguiente"
      />
    );

    expect(screen.queryByText(/\//)).not.toBeInTheDocument();

    const page1 = screen.getByRole("button", { name: "Página 1" });
    const page2 = screen.getByRole("button", { name: "Página 2" });
    const page3 = screen.getByRole("button", { name: "Página 3" });
    const page4 = screen.getByRole("button", { name: "Página 4" });

    expect(page1).toHaveClass("is-active");
    expect(page1).toHaveAttribute("aria-current", "page");
    expect(page2).not.toHaveClass("is-active");
    expect(page3).not.toHaveClass("is-active");
    expect(page4).not.toHaveClass("is-active");
  });

  it("llama a onPageChange al hacer click en un número de página", () => {
    const onPageChange = vi.fn();
    render(
      <CatalogPagination
        currentPage={1}
        totalPages={4}
        onPageChange={onPageChange}
        prevLabel="Anterior"
        nextLabel="Siguiente"
      />
    );

    const page3 = screen.getByRole("button", { name: "Página 3" });
    fireEvent.click(page3);

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("maneja los botones Anterior y Siguiente", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <CatalogPagination
        currentPage={1}
        totalPages={4}
        onPageChange={onPageChange}
        prevLabel="Anterior"
        nextLabel="Siguiente"
      />
    );

    const prevBtn = screen.getByRole("button", { name: "Anterior" });
    const nextBtn = screen.getByRole("button", { name: "Siguiente" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);

    rerender(
      <CatalogPagination
        currentPage={4}
        totalPages={4}
        onPageChange={onPageChange}
        prevLabel="Anterior"
        nextLabel="Siguiente"
      />
    );

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });
});
