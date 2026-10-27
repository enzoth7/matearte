import type { Customer, OrderLine } from "./data";
import { formatDate } from "./dateFormat";
import { wholesaleLineValue } from "./wholesaleAdapter";
import { GENERIC_WHOLESALE_VARIANT } from "./wholesaleSaleSelection";
import type { WholesaleLine, WholesaleSnapshot } from "./wholesaleSource";
import type { WholesaleCurrency } from "./wholesaleExports";
import { discountSummary, formatPercent, orderDiscountPercent } from "./wholesaleDiscount";

export type WholesaleOrderPdfKind = "workshop" | "customer";
export type WholesaleOrderPdfInput = {
  reference: string;
  date: string;
  customerName: string;
  customer?: Pick<Customer, "address" | "city" | "country">;
  items?: OrderLine[];
  lines: WholesaleLine[];
  snapshot: WholesaleSnapshot;
  currency: WholesaleCurrency;
};

const brown: [number, number, number] = [70, 38, 25];
const ink: [number, number, number] = [33, 27, 24];
const muted: [number, number, number] = [98, 91, 86];
const rule: [number, number, number] = [216, 213, 210];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const money = (amount: number, currency: WholesaleCurrency) => `${currency} ${new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}`;
const sentenceName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-UY")
  .replace(/(^|[\s'’.-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("es-UY"));
const label = (value: string | null | undefined) => value?.trim() || "-";

function lineRows(input: WholesaleOrderPdfInput) {
  return input.lines.map((line) => {
    const orderItem = input.items?.find((item) => item.wholesaleLineId === line.line_id);
    const exact = input.snapshot.products.find((item) => normalize(item.model) === normalize(line.model) && normalize(item.variant) === normalize(line.variant));
    const product = exact ?? (normalize(line.variant) === normalize(GENERIC_WHOLESALE_VARIANT)
      ? input.snapshot.products.filter((item) => normalize(item.model) === normalize(line.model)).sort((a, b) => (a.sku || "").localeCompare(b.sku || "", "es", { numeric: true }))[0]
      : undefined);
    const value = wholesaleLineValue(line, product, input.snapshot.exchangeRate);
    return {
      sku: product?.sku?.trim() || "-",
      model: sentenceName(orderItem?.title || line.model), variant: sentenceName(orderItem?.variant || line.variant), quantity: Number(line.quantity),
      unitPrice: input.currency === "ARS" ? value.unitArg : value.unitUyu,
      // El detalle va a precio de lista; el descuento del pedido se resta abajo, en Subtotal / Descuento / Total.
      amount: input.currency === "ARS" ? value.grossArg : value.grossUyu,
      net: input.currency === "ARS" ? value.arg : value.uyu,
    };
  });
}

async function brandLogo(): Promise<string> {
  const response = await fetch("/matearte-icon.png");
  if (!response.ok) throw new Error("No se pudo cargar el logo de MateArte.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el logo de MateArte."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function createWholesaleOrderPdf(kind: WholesaleOrderPdfKind, input: WholesaleOrderPdfInput, logoDataUrl: string) {
  if (!input.lines.length) throw new Error("Este pedido no tiene artículos para exportar.");
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const customerSheet = kind === "customer";
  const rows = lineRows(input);
  const customerName = sentenceName(input.customerName);
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const { subtotal, discount, total: amount } = discountSummary(rows.map((row) => ({ gross: row.amount, net: row.net })));
  const percent = orderDiscountPercent(input.lines);
  const showDiscount = customerSheet && discount > 0;

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brown);
  pdf.setFontSize(19);
  pdf.text(`Pedido ${input.reference}`, 18, 59);
  pdf.setDrawColor(...rule);
  pdf.setLineWidth(0.25);
  pdf.line(18, 74, 192, 74);

  const detail = (name: string, value: string, x: number, y: number, valueX: number) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...muted);
    pdf.text(name, x, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...ink);
    const lines = pdf.splitTextToSize(label(value), x === 18 ? 63 : 49) as string[];
    pdf.text(lines, valueX, y);
    return y + (lines.length - 1) * 4.2;
  };
  const nameEnd = detail("Cliente", customerName, 18, 90, 39);
  const dateEnd = detail("Fecha", formatDate(input.date), 18, Math.max(100, nameEnd + 10), 39);
  let rightEnd = 0;
  if (customerSheet) {
    const addressEnd = detail("Dirección", input.customer?.address || "", 112, 90, 135);
    const cityEnd = detail("Ciudad", input.customer?.city || "", 112, Math.max(100, addressEnd + 10), 135);
    rightEnd = detail("País", input.customer?.country || "", 112, Math.max(110, cityEnd + 10), 135);
    pdf.setDrawColor(...rule);
    pdf.line(106, 87, 106, rightEnd + 3);
  }

  const startY = Math.max(customerSheet ? 124 : 113, dateEnd + 13, rightEnd + 14);
  const headers = customerSheet
    ? ["SKU", "Producto / modelo", "Variante", "Unid.", "Precio unitario", "Importe"]
    : ["SKU", "Producto / modelo", "Variante", "Unidades"];
  const body = rows.map((row) => customerSheet
    ? [row.sku, row.model, row.variant, String(row.quantity), money(row.unitPrice, input.currency), money(row.amount, input.currency)]
    : [row.sku, row.model, row.variant, String(row.quantity)]);
  const lastColumn = headers.length - 1;
  autoTable(pdf, {
    startY,
    margin: { left: 18, right: 18, top: 48, bottom: 23 },
    tableWidth: 174,
    theme: "plain",
    showHead: "everyPage",
    head: [headers], body,
    styles: { font: "helvetica", fontSize: customerSheet ? 8.4 : 9.2, textColor: ink, cellPadding: { top: 4, bottom: 4, left: 1, right: 1 }, overflow: "linebreak" },
    headStyles: { fontStyle: "bold", textColor: brown, fontSize: customerSheet ? 7.7 : 8.4 },
    columnStyles: customerSheet
      ? { 0: { cellWidth: 18 }, 1: { cellWidth: 55, fontStyle: "bold" }, 2: { cellWidth: 26 }, 3: { cellWidth: 14 }, 4: { cellWidth: 29, halign: "right" }, 5: { cellWidth: 32, halign: "right" } }
      : { 0: { cellWidth: 18 }, 1: { cellWidth: 97, fontStyle: "bold" }, 2: { cellWidth: 35 }, 3: { cellWidth: 24, halign: "right" } },
    didDrawCell: (data) => {
      if (data.column.index !== lastColumn) return;
      if (data.section === "head") {
        pdf.setDrawColor(...brown);
        pdf.setLineWidth(0.5);
        pdf.line(18, data.cell.y, 192, data.cell.y);
      }
      pdf.setDrawColor(...rule);
      pdf.setLineWidth(0.2);
      pdf.line(18, data.cell.y + data.cell.height, 192, data.cell.y + data.cell.height);
    },
  });

  const tableEnd = (pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  const totalBlockHeight = 24 + (showDiscount ? 20 : 0);
  const totalOnNextPage = tableEnd + totalBlockHeight > 281;
  if (totalOnNextPage) pdf.addPage();
  const totalY = totalOnNextPage ? 65 : tableEnd + 17;
  pdf.setDrawColor(...brown);
  pdf.setLineWidth(0.55);
  pdf.line(18, totalY, 192, totalY);
  // Con descuento: Subtotal y Descuento primero; el Total baja una fila más abajo, separado por una línea fina.
  let totalRowY = totalY + 10;
  if (showDiscount) {
    const summaryRow = (name: string, value: string, y: number) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...muted);
      pdf.text(name, 18, y);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...ink);
      pdf.text(value, 192, y, { align: "right" });
    };
    summaryRow("Subtotal", money(subtotal, input.currency), totalY + 9);
    summaryRow(percent > 0 ? `Descuento (${formatPercent(percent)})` : "Descuento", `-${money(discount, input.currency)}`, totalY + 16);
    pdf.setDrawColor(...rule);
    pdf.setLineWidth(0.25);
    pdf.line(18, totalY + 20, 192, totalY + 20);
    totalRowY = totalY + 30;
  }
  pdf.setTextColor(...ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(customerSheet ? "Total" : "Total de unidades", customerSheet ? 18 : 136, totalRowY);
  pdf.setTextColor(...brown);
  pdf.setFontSize(14);
  if (customerSheet) {
    const units = String(quantity);
    pdf.text(units, 118, totalRowY);
    pdf.setFont("helvetica", "normal");
    pdf.text("u.", 118 + pdf.getTextWidth(units) + 1.4, totalRowY);
    pdf.setFont("helvetica", "bold");
    pdf.text(money(amount, input.currency), 192, totalRowY, { align: "right" });
  } else pdf.text(String(quantity), 192, totalRowY, { align: "right" });

  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFillColor(...brown);
    pdf.rect(0, 0, 210, 39, "F");
    pdf.rect(0, 285, 210, 12, "F");
    pdf.addImage(logoDataUrl, "PNG", 18, 10, 18, 18);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("MateArte", 41, 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(customerSheet ? "Detalle de pedido" : "Orden de producción", 41, 27);
    pdf.setFontSize(9);
    pdf.text("www.matearteuruguay.com", 105, 292.5, { align: "center" });
  }
  return pdf;
}

export async function exportWholesaleOrderPdf(kind: WholesaleOrderPdfKind, input: WholesaleOrderPdfInput) {
  const logo = await brandLogo();
  const pdf = await createWholesaleOrderPdf(kind, input, logo);
  const reference = input.reference.replace(/[^a-zA-Z0-9-]/g, "") || "pedido";
  pdf.save(`matearte-${reference}-${kind === "workshop" ? "taller" : "cliente"}.pdf`);
}
