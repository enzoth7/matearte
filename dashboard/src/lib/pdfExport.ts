import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProductionItem } from "../types";
import { formatDate, normalizeText } from "./format";

export const getProductionPdfFilename = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `matearte-produccion-${year}-${month}-${day}.pdf`;
};

export interface CustomerProductionGroup {
  customer: string;
  items: ProductionItem[];
  orders: OrderProductionGroup[];
  totalUnits: number;
}

export interface OrderProductionGroup {
  orderId: string;
  createdAt: string | null;
  items: ProductionItem[];
  totalUnits: number;
  orderType: "normal" | "no_cost";
}

export function groupProductionByOrder(items: ProductionItem[]): OrderProductionGroup[] {
  const groups = new Map<string, ProductionItem[]>();
  items.forEach((item) => {
    const key = item.orderId?.trim() || item.lineId;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([orderId, orderItems]) => {
    const datedItems = orderItems.filter((item) => item.createdAt);
    const createdAt = datedItems.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())[0]?.createdAt ?? null;
    return {
      orderId,
      createdAt,
      items: orderItems,
      totalUnits: orderItems.reduce((sum, item) => sum + item.quantity, 0),
      orderType: (orderItems.some((item) => item.orderType === "no_cost") ? "no_cost" : "normal") as OrderProductionGroup["orderType"],
    };
  }).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.orderId.localeCompare(b.orderId, "es");
  });
}

export function groupProductionByCustomer(items: ProductionItem[]): CustomerProductionGroup[] {
  const groups = new Map<string, ProductionItem[]>();
  for (const item of items) {
    const customer = item.customer?.trim() || "Sin Cliente";
    const current = groups.get(customer);
    if (current) {
      current.push(item);
    } else {
      groups.set(customer, [item]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([customer, groupItems]) => ({
      customer,
      items: groupItems,
      orders: groupProductionByOrder(groupItems),
      totalUnits: groupItems.reduce((sum, item) => sum + item.quantity, 0),
    }));
}

export interface VariantSummary {
  model: string;
  variant: string;
  pending: number;
  inProduction: number;
  total: number;
}

export function buildVariantSummary(items: ProductionItem[]): VariantSummary[] {
  const map = new Map<string, VariantSummary>();

  for (const item of items) {
    const key = `${item.model || ""}||${item.variant || ""}`;
    let summary = map.get(key);
    if (!summary) {
      summary = {
        model: item.model || "-",
        variant: item.variant || "-",
        pending: 0,
        inProduction: 0,
        total: 0,
      };
      map.set(key, summary);
    }
    // Asumimos que status viene en el item, tal como pide la consigna.
    if ((item as any).status === "Pendiente") {
      summary.pending += item.quantity;
    } else if ((item as any).status === "En producción") {
      summary.inProduction += item.quantity;
    }
    summary.total += item.quantity;
  }

  return Array.from(map.values()).sort((a, b) => {
    const modelCompare = a.model.localeCompare(b.model, "es");
    if (modelCompare !== 0) return modelCompare;
    return a.variant.localeCompare(b.variant, "es");
  });
}

export function createProductionPdfDocument(items: ProductionItem[]): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const customerGroups = groupProductionByCustomer(items);

  if (customerGroups.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(50, 45, 40);
    doc.text("MATEARTE — ORDEN DE PRODUCCIÓN", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(120, 115, 110);
    doc.text("No hay pedidos activos en producción.", 14, 30);
    return doc;
  }

  const todayFormatted = formatDate(new Date().toISOString(), false);

  // --- Nueva hoja resumen inicial ---
  doc.setFontSize(10);
  doc.setTextColor(130, 120, 110);
  doc.setFont("helvetica", "bold");
  doc.text("MATEARTE — RESUMEN DE PRODUCCIÓN", 14, 18);

  doc.setFontSize(18);
  doc.setTextColor(30, 25, 20);
  doc.text("Unidades por modelo y variante", 14, 28);
  
  doc.setFontSize(9);
  doc.setTextColor(110, 105, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${todayFormatted}`, 14, 35);

  doc.setDrawColor(220, 215, 210);
  doc.setLineWidth(0.5);
  doc.line(14, 39, 196, 39);

  const summaryData = buildVariantSummary(items);
  const summaryBody = summaryData.map(row => [
    row.model,
    row.variant,
    String(row.pending),
    String(row.inProduction),
    String(row.total),
  ]);

  autoTable(doc, {
    startY: 44,
    head: [["Modelo", "Variante", "Pendiente", "En producción", "Total"]],
    body: summaryBody,
    theme: "striped",
    headStyles: {
      fillColor: [24, 66, 45],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: {
      fillColor: [250, 249, 247],
    },
    columnStyles: {
      2: { halign: "center", cellWidth: 26 },
      3: { halign: "center", cellWidth: 26 },
      4: { halign: "center", cellWidth: 20, fontStyle: "bold" },
    },
    styles: {
      cellPadding: 3.5,
      lineColor: [230, 225, 220],
      lineWidth: 0.1,
    },
    margin: { left: 14, right: 14 },
  });

  const drawCustomerHeader = (customer: string) => {
    doc.setFontSize(10);
    doc.setTextColor(130, 120, 110);
    doc.setFont("helvetica", "bold");
    doc.text("MATEARTE — ORDEN DE PRODUCCIÓN", 14, 18);
    doc.setFontSize(18);
    doc.setTextColor(30, 25, 20);
    doc.text(customer, 14, 28);
    doc.setFontSize(9);
    doc.setTextColor(110, 105, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Impreso: ${todayFormatted}`, 14, 35);
    doc.setDrawColor(220, 215, 210);
    doc.setLineWidth(0.5);
    doc.line(14, 39, 196, 39);
  };

  customerGroups.forEach((group) => {
    doc.addPage();
    drawCustomerHeader(group.customer);
    let nextY = 48;

    group.orders.forEach((order, orderIndex) => {
      if (nextY > 265) {
        doc.addPage();
        drawCustomerHeader(group.customer);
        nextY = 48;
      }

      const orderDate = formatDate(order.createdAt, false);
      const costLabel = order.orderType === "no_cost" ? " · SIN COSTO" : "";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(24, 66, 45);
      doc.text(`Pedido ${orderIndex + 1} · ${orderDate} · ${order.orderId}${costLabel}`, 14, nextY);

      const tableBody = order.items.map((item, itemIdx) => [
        String(itemIdx + 1),
        item.model || "-",
        item.variant || "-",
        String(item.quantity),
      ]);

      autoTable(doc, {
        startY: nextY + 3,
        head: [["#", "Modelo", "Variante", "Cantidad"]],
        body: tableBody,
        foot: [["", "Total del pedido", "", String(order.totalUnits)]],
        theme: "striped",
        headStyles: { fillColor: [45, 40, 35], textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold", halign: "left" },
        footStyles: { fillColor: [240, 238, 235], textColor: [30, 25, 20], fontSize: 10, fontStyle: "bold", halign: "left" },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [250, 249, 247] },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { halign: "left", cellWidth: 55 },
          2: { halign: "left" },
          3: { halign: "center", cellWidth: 26, fontStyle: "bold" },
        },
        styles: { cellPadding: 3.5, lineColor: [230, 225, 220], lineWidth: 0.1 },
        margin: { left: 14, right: 14 },
      });
      nextY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY) + 10;
    });
  });

  return doc;
}

export function exportProductionToPdf(
  items: ProductionItem[],
  filename: string = getProductionPdfFilename(),
): void {
  const doc = createProductionPdfDocument(items);
  doc.save(filename);
}

export const getCustomerPendingPdfFilename = (customer: string, date: Date = new Date()) => {
  const safeCustomer = normalizeText(customer).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
  const suffix = getProductionPdfFilename(date).replace("matearte-produccion-", "");
  return `matearte-pendientes-${safeCustomer}-${suffix}`;
};

export function exportCustomerPendingToPdf(items: ProductionItem[], customer: string): void {
  const customerKey = normalizeText(customer);
  const pendingItems = items.filter((item) => item.status === "Pendiente" && normalizeText(item.customer) === customerKey);
  exportProductionToPdf(pendingItems, getCustomerPendingPdfFilename(customer));
}
