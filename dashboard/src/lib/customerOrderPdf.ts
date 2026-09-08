import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerProfile, HistoryItem, Product, ProductionItem } from "../types";
import { findProduct, normalizeText } from "./format";

export type CustomerOrderItem = HistoryItem | ProductionItem;
export type CustomerOrderStatus = "Pendiente" | "En producción" | "Finalizado";

export interface CustomerOrderGroup {
  orderId: string;
  createdAt: string | null;
  items: CustomerOrderItem[];
  totalUnits: number;
  totalArg: number;
  orderType: "normal" | "no_cost";
  status: CustomerOrderStatus;
}

const formatPdfDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export const getCustomerOrderDueDate = (createdAt: string | null) => {
  if (!createdAt) return "-";
  const dueDate = new Date(createdAt);
  if (Number.isNaN(dueDate.getTime())) return "-";
  dueDate.setUTCDate(dueDate.getUTCDate() + 30);
  return formatPdfDate(dueDate.toISOString());
};

const formatPdfMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const getUnitPriceArg = (item: CustomerOrderItem, products: Product[]) => {
  if (item.orderType === "no_cost") return 0;
  return item.unitPriceArg ?? findProduct(products, item)?.priceArg ?? 0;
};

const getLineTotalArg = (item: CustomerOrderItem, products: Product[]) => {
  if (item.orderType === "no_cost") return 0;
  return item.totalArg ?? getUnitPriceArg(item, products) * item.quantity;
};

const isProductionItem = (item: CustomerOrderItem): item is ProductionItem => "status" in item;

export function groupCustomerHistoryByOrder(items: CustomerOrderItem[], products: Product[]): CustomerOrderGroup[] {
  const uniqueLines = new Map<string, CustomerOrderItem>();
  items.forEach((item) => {
    const current = uniqueLines.get(item.lineId);
    if (!current) {
      uniqueLines.set(item.lineId, item);
    } else if (isProductionItem(item)) {
      uniqueLines.set(item.lineId, { ...current, ...item, createdAt: item.createdAt ?? current.createdAt });
    } else if (!isProductionItem(current)) {
      uniqueLines.set(item.lineId, item);
    }
  });

  const groups = new Map<string, CustomerOrderItem[]>();
  uniqueLines.forEach((item) => {
    const orderId = item.orderId?.trim() || item.lineId;
    groups.set(orderId, [...(groups.get(orderId) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([orderId, orderItems]) => {
    const createdAt = orderItems
      .map((item) => item.createdAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
    return {
      orderId,
      createdAt,
      items: orderItems,
      totalUnits: orderItems.reduce((sum, item) => sum + item.quantity, 0),
      totalArg: orderItems.reduce((sum, item) => sum + getLineTotalArg(item, products), 0),
      orderType: (orderItems.every((item) => item.orderType === "no_cost") ? "no_cost" : "normal") as CustomerOrderGroup["orderType"],
      status: (orderItems.some((item) => isProductionItem(item) && item.status === "En producción")
        ? "En producción"
        : orderItems.some(isProductionItem) ? "Pendiente" : "Finalizado") as CustomerOrderStatus,
    };
  }).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime || b.orderId.localeCompare(a.orderId, "es");
  });
}

export const getCustomerOrderPdfFilename = (customer: string, orderId: string) => {
  const safeCustomer = normalizeText(customer).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
  const safeOrder = normalizeText(orderId).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pedido";
  return `matearte-${safeCustomer}-${safeOrder}.pdf`;
};

export function createCustomerOrderPdfDocument(
  order: CustomerOrderGroup,
  products: Product[],
  customer: CustomerProfile,
  logoDataUrl?: string,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const green: [number, number, number] = [24, 66, 45];
  const blue: [number, number, number] = [103, 184, 207];

  doc.setFillColor(...blue);
  doc.rect(margin, 16, 43, 17, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(22);
  doc.text("Factura", margin + 3, 27.5);

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(1.6);
  doc.line(margin + 43, 24.5, pageWidth - margin, 24.5);

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "JPEG", pageWidth - margin - 35, 34, 35, 35);
  } else {
    doc.setFillColor(...green);
    doc.roundedRect(pageWidth - margin - 35, 34, 35, 35, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("MateArte", pageWidth - margin - 17.5, 50, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Tu mejor versión", pageWidth - margin - 17.5, 55, { align: "center" });
  }

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.text(`Fecha: ${formatPdfDate(order.createdAt)}`, margin + 2, 43);
  doc.text(`Pedido N°: ${order.orderId}`, margin + 2, 49);
  doc.text(`Fecha de vencimiento: ${getCustomerOrderDueDate(order.createdAt)}`, margin + 2, 55);
  doc.text("Vendedor: Florencia", margin + 2, 61);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(customer.fullName || order.items[0]?.customer || "Cliente", margin, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  const contact = [customer.address, customer.phone, customer.email].filter(Boolean).join(" · ");
  if (contact) doc.text(contact, margin, 86, { maxWidth: pageWidth - margin * 2 });

  const body = order.items.map((item) => {
    const product = findProduct(products, item);
    const description = [item.model, item.variant, product?.rimType, product?.leatherType]
      .filter(Boolean)
      .join(" · ");
    return [
      String(item.quantity),
      product?.id || "-",
      description || "-",
      formatPdfMoney(getUnitPriceArg(item, products)),
      "0%",
      formatPdfMoney(0),
      formatPdfMoney(getLineTotalArg(item, products)),
    ];
  });

  autoTable(doc, {
    startY: contact ? 92 : 87,
    head: [["Cant.", "Artículo", "Descripción", "Precio unitario", "Impuesto %", "IVA", "Total"]],
    body,
    theme: "grid",
    headStyles: {
      fillColor: [5, 5, 5],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9, textColor: [25, 25, 25], cellPadding: 3.2 },
    alternateRowStyles: { fillColor: [226, 226, 226] },
    columnStyles: {
      0: { halign: "right", cellWidth: 14 },
      1: { cellWidth: 18 },
      2: { cellWidth: 48 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 17 },
      5: { halign: "right", cellWidth: 17 },
      6: { halign: "right", cellWidth: 32 },
    },
    styles: { lineColor: [20, 20, 20], lineWidth: 0.25, overflow: "linebreak" },
    margin: { left: margin, right: margin, bottom: 65 },
    didDrawPage: ({ pageNumber }) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Pedido ${order.orderId} · Página ${pageNumber}`, pageWidth - margin, pageHeight - 11, { align: "right" });
    },
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  let totalsY = tableEnd + 9;
  if (totalsY > pageHeight - 67) {
    doc.addPage();
    totalsY = 24;
  }
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total", pageWidth - margin - 46, totalsY, { align: "right" });
  doc.text(formatPdfMoney(order.totalArg), pageWidth - margin, totalsY, { align: "right" });
  doc.text("Saldo a pagar", pageWidth - margin - 46, totalsY + 7, { align: "right" });
  doc.text(formatPdfMoney(order.totalArg), pageWidth - margin, totalsY + 7, { align: "right" });

  doc.setFontSize(10);
  doc.text("Póngase en contacto con nosotros para más información sobre las opciones de pago.", margin, pageHeight - 42);
  doc.text("Gracias por su preferencia.", margin, pageHeight - 31);
  doc.setLineWidth(1.2);
  doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
  return doc;
}

async function loadCustomerOrderLogo(): Promise<string> {
  const response = await fetch("/LogoViejo.jpg");
  if (!response.ok) throw new Error("No se pudo cargar el logo de la factura.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el logo de la factura."));
    reader.readAsDataURL(blob);
  });
}

export async function exportCustomerOrderToPdf(
  order: CustomerOrderGroup,
  products: Product[],
  customer: CustomerProfile,
): Promise<void> {
  let logoDataUrl: string | undefined;
  try {
    logoDataUrl = await loadCustomerOrderLogo();
  } catch {
    logoDataUrl = undefined;
  }
  createCustomerOrderPdfDocument(order, products, customer, logoDataUrl).save(getCustomerOrderPdfFilename(customer.fullName, order.orderId));
}
