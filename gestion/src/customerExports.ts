type CustomerExportValue = string | number;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportCustomersXlsx(rows: Record<string, CustomerExportValue>[]) {
  if (!rows.length) return;
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const headings = Object.keys(rows[0]);
  const data = [
    headings.map((value) => ({
      value,
      fontWeight: "bold" as const,
      textColor: "#ffffff",
      backgroundColor: "#263a2c",
    })),
    ...rows.map((row) => headings.map((key) => {
      const value = row[key];
      return typeof value === "number"
        ? { value, format: "#,##0" }
        : { value: String(value) };
    })),
  ];
  const columns = headings.map((heading) => ({
    width: Math.min(40, Math.max(14, heading.length + 3, ...rows.map((row) => String(row[heading] ?? "").length + 2))),
  }));
  const blob = await writeXlsxFile(data, {
    sheet: "Clientes",
    stickyRowsCount: 1,
    columns,
  }).toBlob();
  download(blob, `matearte-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
