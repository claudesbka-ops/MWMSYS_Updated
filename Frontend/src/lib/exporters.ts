import jsPDF from "jspdf";

function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(","));
  for (const r of rows) {
    lines.push((r ?? []).map(escapeCsvCell).join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPdfSimpleTable(filename: string, title: string, headers: string[], rows: Array<Array<unknown>>): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const marginX = 40;
  let y = 50;

  doc.setFontSize(16);
  doc.text(title, marginX, y);
  y += 20;

  doc.setFontSize(10);

  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - marginX * 2;
  const colWidth = usableWidth / Math.max(1, headers.length);

  const drawRow = (cells: string[], isHeader: boolean) => {
    const rowHeight = 18;
    if (y + rowHeight > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 40;
    }

    if (isHeader) {
      doc.setFont(undefined, "bold");
    } else {
      doc.setFont(undefined, "normal");
    }

    cells.forEach((c, i) => {
      const x = marginX + i * colWidth;
      const text = (c ?? "").toString();
      doc.text(text.length > 40 ? text.slice(0, 37) + "..." : text, x, y);
    });

    y += rowHeight;
  };

  drawRow(headers, true);
  for (const r of rows) {
    drawRow((r ?? []).map((x) => (x == null ? "" : String(x))), false);
  }

  doc.save(filename);
}
