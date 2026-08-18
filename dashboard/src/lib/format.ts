import * as XLSX from "xlsx";
import type { Product, ProductionItem } from "../types";

export interface ProductionExportRow {
  Pedido: string;
  Cliente: string;
  Modelo: string;
  Variante: string;
  Virola: string;
  Cuero: string;
  Cantidad: number;
  Estado: string;
  "Precio Unitario ARG": number;
  "Total ARG": number;
  "Total UYU": number;
}

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

export const getProductionExportFilename = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `matearte-produccion-${year}-${month}-${day}.xlsx`;
};

export const buildProductionExportRows = (
  items: ProductionItem[],
  products: Product[],
  exchangeRate: number,
): ProductionExportRow[] =>
  items.map((item) => {
    const product = findProduct(products, item);
    const priceArg = product?.priceArg ?? 0;
    const totalArg = item.quantity * priceArg;
    const totalUyu = Math.round(totalArg * exchangeRate * 100) / 100;

    return {
      Pedido: item.orderId?.trim() || "-",
      Cliente: item.customer?.trim() || "-",
      Modelo: item.model?.trim() || "-",
      Variante: item.variant?.trim() || "-",
      Virola: product?.rimType?.trim() || "-",
      Cuero: product?.leatherType?.trim() || "-",
      Cantidad: item.quantity,
      Estado: item.status,
      "Precio Unitario ARG": priceArg,
      "Total ARG": totalArg,
      "Total UYU": totalUyu,
    };
  });

export const createProductionWorkbook = (
  items: ProductionItem[],
  products: Product[],
  exchangeRate: number,
) => {
  const rows = buildProductionExportRows(items, products, exchangeRate);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Producción");
  return workbook;
};

export const exportProductionToExcel = (
  items: ProductionItem[],
  products: Product[],
  exchangeRate: number,
  filename: string = getProductionExportFilename(),
) => {
  const workbook = createProductionWorkbook(items, products, exchangeRate);
  XLSX.writeFile(workbook, filename);
};
