import type { Product, ProductionItem } from "../types";

export const formatArg = (value: number) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const formatUyu = (value: number) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(value);

export const formatDate = (value: string | null, includeTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();

export const findProduct = (products: Product[], item: Pick<ProductionItem, "model" | "variant">) =>
  products.find(
    (product) =>
      normalizeText(product.model) === normalizeText(item.model) &&
      normalizeText(product.variant) === normalizeText(item.variant),
  );

export const getLineValueArg = (products: Product[], item: ProductionItem) =>
  (findProduct(products, item)?.priceArg ?? 0) * item.quantity;

export const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
