export type ExportFormat = "csv" | "json" | "pdf";

export type ExportableExpense = {
  date: string;
  category: string;
  amount: number;
  description: string;
};

const columns = ["Date", "Category", "Amount", "Description"];

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function createCsv(expenses: ExportableExpense[]) {
  return [
    columns.join(","),
    ...expenses.map((expense) => [expense.date, expense.category, expense.amount.toFixed(2), expense.description].map(csvCell).join(",")),
  ].join("\r\n");
}

function pdfText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/([\\()])/g, "\\$1");
}

function createPdf(expenses: ExportableExpense[]) {
  const rowsPerPage = 34;
  const pageRows = expenses.length ? Array.from({ length: Math.ceil(expenses.length / rowsPerPage) }, (_, index) => expenses.slice(index * rowsPerPage, (index + 1) * rowsPerPage)) : [[]];
  const pageIds = pageRows.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  pageRows.forEach((rows, pageIndex) => {
    const streamId = pageIds[pageIndex] + 1;
    const lines = [
      { text: "Pennywise Expense Export", size: 16 },
      { text: `Generated: ${new Date().toLocaleDateString()}  |  Records: ${expenses.length}`, size: 9 },
      { text: "", size: 9 },
      { text: "Date          Category             Amount        Description", size: 10 },
      ...rows.map((expense) => ({
        text: `${expense.date.padEnd(14)}${expense.category.slice(0, 18).padEnd(21)}${expense.amount.toFixed(2).padStart(10)}        ${expense.description.slice(0, 48)}`,
        size: 9,
      })),
      ...(rows.length ? [] : [{ text: "No expenses matched the selected filters.", size: 10 }]),
      { text: "", size: 8 },
      { text: `Page ${pageIndex + 1} of ${pageRows.length}`, size: 8 },
    ];
    const stream = lines.map((line, index) => `BT /F1 ${line.size} Tf 40 ${570 - index * 14} Td (${pdfText(line.text)}) Tj ET`).join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(output).length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}

export function buildExportFile(expenses: ExportableExpense[], format: ExportFormat, filename: string) {
  const safeName = filename.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "-") || "expense-export";
  const baseName = safeName.replace(/\.(csv|json|pdf)$/i, "");
  let blob: Blob;

  if (format === "csv") blob = new Blob([createCsv(expenses)], { type: "text/csv;charset=utf-8" });
  else if (format === "json") blob = new Blob([JSON.stringify(expenses, null, 2)], { type: "application/json" });
  else blob = createPdf(expenses);

  return { blob, filename: `${baseName}.${format}` };
}

export function exportExpenses(expenses: ExportableExpense[], format: ExportFormat, filename: string) {
  const file = buildExportFile(expenses, format, filename);
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}
