import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProductionItem } from "../types";
import { formatDate } from "./format";

export const getProductionPdfFilename = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `matearte-produccion-${year}-${month}-${day}.pdf`;
};

export interface CustomerProductionGroup {
  customer: string;
  items: ProductionItem[];
  totalUnits: number;
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
      totalUnits: groupItems.reduce((sum, item) => sum + item.quantity, 0),
    }));
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

  customerGroups.forEach((group, index) => {
    if (index > 0) {
      doc.addPage();
    }

    // Membrete
    doc.setFontSize(10);
    doc.setTextColor(130, 120, 110);
    doc.setFont("helvetica", "bold");
    doc.text("MATEARTE — ORDEN DE PRODUCCIÓN", 14, 18);

    doc.setFontSize(18);
    doc.setTextColor(30, 25, 20);
    doc.setFont("helvetica", "bold");
    doc.text(group.customer, 14, 28);

    doc.setFontSize(9);
    doc.setTextColor(110, 105, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${todayFormatted}`, 14, 35);

    // Separador visual
    doc.setDrawColor(220, 215, 210);
    doc.setLineWidth(0.5);
    doc.line(14, 39, 196, 39);

    // Tabla de líneas de producción del cliente
    const tableBody = group.items.map((item, itemIdx) => [
      String(itemIdx + 1),
      item.model || "-",
      item.variant || "-",
      String(item.quantity),
    ]);

    autoTable(doc, {
      startY: 44,
      head: [["#", "Modelo", "Variante", "Cantidad"]],
      body: tableBody,
      foot: [["", "Total de unidades", "", String(group.totalUnits)]],
      theme: "striped",
      headStyles: {
        fillColor: [45, 40, 35],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
        halign: "left",
      },
      footStyles: {
        fillColor: [240, 238, 235],
        textColor: [30, 25, 20],
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
        0: { halign: "center", cellWidth: 12 },
        1: { halign: "left", cellWidth: 55 },
        2: { halign: "left" },
        3: { halign: "center", cellWidth: 26, fontStyle: "bold" },
      },
      styles: {
        cellPadding: 3.5,
        lineColor: [230, 225, 220],
        lineWidth: 0.1,
      },
      margin: { left: 14, right: 14 },
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
