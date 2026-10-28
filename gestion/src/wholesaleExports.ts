import { wholesaleLineValue } from "./wholesaleAdapter";
import type { WholesaleLine, WholesaleSnapshot } from "./wholesaleSource";
import { formatDate } from "./dateFormat";

export type WholesaleCurrency = "UYU" | "ARS";
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const rowsFor = (lines: WholesaleLine[], snapshot: WholesaleSnapshot, currency?: WholesaleCurrency) => lines.map((line): Record<string, string | number> => {
  const product = snapshot.products.find((item) => normalized(item.model) === normalized(line.model) && normalized(item.variant) === normalized(line.variant));
  const value = wholesaleLineValue(line, product, snapshot.exchangeRate);
  return {
    Pedido: line.order_id || `Línea ${line.line_id}`,
    Cliente: line.customer,
    Modelo: line.model,
    Variante: line.variant,
    Virola: product?.rim_type || "",
    Cuero: product?.leather_type || "",
    Cantidad: Number(line.quantity),
    Estado: line.status,
    Tipo: line.order_type === "no_cost" ? "Sin costo" : "Normal",
    ...(currency ? { [`Unitario ${currency}`]: currency === "ARS" ? value.unitArg : value.unitUyu, [`Total ${currency}`]: currency === "ARS" ? value.arg : value.uyu } : { "Unitario ARS": value.unitArg, "Total ARS": value.arg, "Total UYU": value.uyu }),
    Creado: formatDate(line.created_at, ""),
    Completado: formatDate(line.completed_at, ""),
  };
});
const filename = (kind: string, extension: string) => `matearte-${kind}-${new Date().toISOString().slice(0, 10)}.${extension}`;
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type ExportRow = Record<string, string | number>;
/** Vista agrupada de producción (Modelo, Variante, Virolas, Cuero Torpedo): se exporta tal cual se ve en pantalla. */
export type WholesaleViewTable = { title: string; slug: string; headings: string[]; rows: ExportRow[] };
const slugOf = (value: string) => normalized(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function writeCsv(rows: ExportRow[], headings: string[], name: string) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [headings.join(","), ...rows.map((row) => headings.map((key) => escape(row[key])).join(","))].join("\r\n");
  download(new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" }), name);
}
async function writeXlsx(rows: ExportRow[], headings: string[], sheet: string, name: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const data = [
    headings.map((value) => ({ value, fontWeight: "bold" as const, textColor: "#ffffff", backgroundColor: "#263a2c" })),
    ...rows.map((row) => headings.map((key) => {
      const value = row[key];
      return typeof value === "number" ? { value, format: "#,##0.00" } : { value: String(value) };
    })),
  ];
  const blob = await writeXlsxFile(data, { sheet, stickyRowsCount: 1, columns: headings.map((key) => ({ width: Math.max(15, key.length + 4) })) }).toBlob();
  download(blob, name);
}
export function exportWholesaleCsv(lines: WholesaleLine[], snapshot: WholesaleSnapshot, currency?: WholesaleCurrency) {
  const rows = rowsFor(lines, snapshot, currency);
  writeCsv(rows, Object.keys(rows[0] || {}), filename("mayorista", "csv"));
}
export async function exportWholesaleXlsx(lines: WholesaleLine[], snapshot: WholesaleSnapshot, currency?: WholesaleCurrency) {
  const rows = rowsFor(lines, snapshot, currency);
  await writeXlsx(rows, Object.keys(rows[0] || {}), "Producción", filename("produccion-mayorista", "xlsx"));
}
export function exportWholesaleViewCsv(table: WholesaleViewTable) {
  writeCsv(table.rows, table.headings, filename(`produccion-mayorista-${slugOf(table.slug)}`, "csv"));
}
export async function exportWholesaleViewXlsx(table: WholesaleViewTable) {
  await writeXlsx(table.rows, table.headings, table.slug.slice(0, 31), filename(`produccion-mayorista-${slugOf(table.slug)}`, "xlsx"));
}
export async function exportWholesaleViewPdf(table: WholesaleViewTable) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFillColor(38, 58, 44); pdf.rect(0, 0, 297, 28, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(17); pdf.text("MateArte", 14, 12);
  pdf.setFontSize(11); pdf.text(table.title, 14, 21);
  pdf.setTextColor(40, 40, 40); pdf.setFontSize(9);
  pdf.text(`Generado: ${formatDate(new Date())}  |  ${table.rows.length} filas`, 14, 35);
  const numeric = table.headings.map((key) => table.rows.length > 0 && table.rows.every((row) => typeof row[key] === "number"));
  autoTable(pdf, {
    startY: 40,
    head: [table.headings],
    body: table.rows.map((row) => table.headings.map((key) => typeof row[key] === "number" ? Number(row[key]).toLocaleString("es-UY") : String(row[key] ?? ""))),
    styles: { fontSize: 9, cellPadding: 2.6, overflow: "linebreak" },
    headStyles: { fillColor: [38, 58, 44] },
    columnStyles: Object.fromEntries(numeric.map((isNumber, index) => [index, isNumber ? { halign: "right" as const, cellWidth: 32 } : {}])),
    didDrawPage: () => { pdf.setFontSize(8); pdf.setTextColor(100); pdf.text(`Página ${pdf.getNumberOfPages()}`, 278, 200, { align: "right" }); },
  });
  pdf.save(filename(`produccion-mayorista-${slugOf(table.slug)}`, "pdf"));
}
export async function exportWholesalePdf(title: string, lines: WholesaleLine[], snapshot: WholesaleSnapshot, currency?: WholesaleCurrency) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const rows = rowsFor(lines, snapshot, currency);
  const currencies: WholesaleCurrency[] = currency ? [currency] : ["ARS", "UYU"];
  pdf.setFillColor(38, 58, 44); pdf.rect(0, 0, 297, 28, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(17); pdf.text("MateArte", 14, 12);
  pdf.setFontSize(11); pdf.text(title, 14, 21);
  pdf.setTextColor(40, 40, 40); pdf.setFontSize(9);
  pdf.text(`Generado: ${formatDate(new Date())}  |  ${lines.length} líneas`, 14, 35);
  autoTable(pdf, {
    startY: 40,
    head: [["Pedido", "Cliente", "Modelo", "Variante", "Cant.", "Estado", ...currencies]],
    body: rows.map((row) => [row.Pedido, row.Cliente, row.Modelo, row.Variante, row.Cantidad, row.Estado, ...currencies.map((code) => Number(row[`Total ${code}`]).toLocaleString("es-UY"))]),
    styles: { fontSize: 8, cellPadding: 2.3, overflow: "linebreak" },
    headStyles: { fillColor: [38, 58, 44] },
    columnStyles: { 0: { cellWidth: 33 }, 1: { cellWidth: 43 }, 2: { cellWidth: 38 }, 3: { cellWidth: 38 }, 4: { halign: "right", cellWidth: 18 }, 6: { halign: "right", cellWidth: 27 }, 7: { halign: "right", cellWidth: 27 } },
    didDrawPage: () => { pdf.setFontSize(8); pdf.setTextColor(100); pdf.text(`Página ${pdf.getNumberOfPages()}`, 278, 200, { align: "right" }); },
  });
  pdf.save(filename("produccion-mayorista", "pdf"));
}
