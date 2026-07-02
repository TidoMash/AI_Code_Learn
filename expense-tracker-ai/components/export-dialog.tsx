"use client";

import { useMemo, useState } from "react";
import { Check, Close, Download } from "./icons";
import { ExportFormat, ExportableExpense, exportExpenses } from "@/lib/export-data";

const FORMATS: { value: ExportFormat; label: string; detail: string }[] = [
  { value: "csv", label: "CSV", detail: "Best for spreadsheets" },
  { value: "json", label: "JSON", detail: "Structured data" },
  { value: "pdf", label: "PDF", detail: "Ready to share" },
];

type Props = {
  expenses: ExportableExpense[];
  categories: readonly string[];
  onClose: () => void;
  onExported: (message: string) => void;
};

export default function ExportDialog({ expenses, categories, onClose, onExported }: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(() => new Set(categories));
  const [filename, setFilename] = useState(`pennywise-export-${new Date().toISOString().slice(0, 10)}`);
  const [exporting, setExporting] = useState(false);

  const preview = useMemo(() => expenses
    .filter((expense) => (!startDate || expense.date >= startDate) && (!endDate || expense.date <= endDate) && selectedCategories.has(expense.category))
    .sort((a, b) => b.date.localeCompare(a.date)), [expenses, startDate, endDate, selectedCategories]);

  function toggleCategory(category: string) {
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  async function handleExport() {
    if (!preview.length || exporting) return;
    setExporting(true);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    exportExpenses(preview, format, filename);
    onExported(`${preview.length} expense${preview.length === 1 ? "" : "s"} exported as ${format.toUpperCase()}`);
    setExporting(false);
    onClose();
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !exporting) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="animate-enter flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-[920px] sm:rounded-2xl">
      <header className="flex items-start justify-between border-b border-[#e8ebf1] px-6 py-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#5267ef]">Data workspace</p><h2 id="export-title" className="mt-1 text-xl font-bold tracking-[-.03em]">Export expenses</h2><p className="mt-1 text-xs text-[#8e98aa]">Configure, review, and download your expense data.</p></div>
        <button onClick={onClose} disabled={exporting} aria-label="Close export dialog" className="grid h-9 w-9 place-items-center rounded-full text-[#7f899a] hover:bg-[#f3f4f7] disabled:opacity-40"><Close className="h-5 w-5" /></button>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[340px_1fr] lg:overflow-hidden">
        <aside className="space-y-6 border-b border-[#e8ebf1] bg-[#fafbfc] p-6 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <section><OptionLabel step="01" label="File format" /><div className="mt-3 grid grid-cols-3 gap-2">{FORMATS.map((option) => <button key={option.value} onClick={() => setFormat(option.value)} className={`rounded-xl border p-3 text-left transition ${format === option.value ? "border-[#5267ef] bg-white shadow-sm ring-1 ring-[#5267ef]" : "border-[#e0e4eb] bg-white hover:border-[#b9c1d0]"}`}><span className="block text-xs font-bold">{option.label}</span><span className="mt-1 block text-[9px] leading-3 text-[#929bad]">{option.detail}</span></button>)}</div></section>

          <section><OptionLabel step="02" label="Date range" /><div className="mt-3 grid grid-cols-2 gap-2"><Field label="Start date"><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-full rounded-lg border border-[#dfe3eb] bg-white px-2 text-xs" /></Field><Field label="End date"><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full rounded-lg border border-[#dfe3eb] bg-white px-2 text-xs" /></Field></div></section>

          <section><div className="flex items-center justify-between"><OptionLabel step="03" label="Categories" /><button onClick={() => setSelectedCategories(selectedCategories.size === categories.length ? new Set() : new Set(categories))} className="text-[10px] font-bold text-[#5267ef]">{selectedCategories.size === categories.length ? "Clear all" : "Select all"}</button></div><div className="mt-3 grid grid-cols-2 gap-2">{categories.map((category) => { const checked = selectedCategories.has(category); return <button key={category} onClick={() => toggleCategory(category)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium ${checked ? "border-[#cbd2fa] bg-[#f2f4ff] text-[#4053c7]" : "border-[#e0e4eb] bg-white text-[#747f91]"}`}><span className={`grid h-4 w-4 place-items-center rounded ${checked ? "bg-[#5267ef] text-white" : "border border-[#cbd1dc]"}`}>{checked && <Check className="h-2.5 w-2.5" />}</span>{category}</button>; })}</div></section>

          <section><OptionLabel step="04" label="Filename" /><div className="mt-3 flex items-center rounded-lg border border-[#dfe3eb] bg-white focus-within:border-[#8796ef]"><input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="expense-export" className="h-10 min-w-0 flex-1 rounded-lg px-3 text-xs outline-none" /><span className="pr-3 text-xs font-semibold text-[#9aa3b5]">.{format}</span></div></section>
        </aside>

        <main className="flex min-h-[420px] flex-col p-6 lg:min-h-0 lg:overflow-hidden">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#929bad]">Live preview</p><h3 className="mt-1 font-bold">Records to export</h3></div><div className="rounded-xl bg-[#eef0ff] px-4 py-2 text-right"><span className="block text-lg font-bold text-[#4053c7]">{preview.length}</span><span className="block text-[9px] font-bold uppercase tracking-wider text-[#7d89cc]">records</span></div></div>
          <div className="mt-5 min-h-0 flex-1 overflow-auto rounded-xl border border-[#e3e7ed]">
            <table className="w-full min-w-[520px] border-collapse text-left"><thead className="sticky top-0 bg-[#f7f8fb] text-[10px] font-bold uppercase tracking-wider text-[#8d97a8]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Description</th></tr></thead><tbody>{preview.slice(0, 12).map((expense, index) => <tr key={`${expense.date}-${expense.description}-${index}`} className="border-t border-[#edf0f4] text-xs"><td className="whitespace-nowrap px-4 py-3 text-[#748094]">{expense.date}</td><td className="px-4 py-3 font-medium">{expense.category}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">${expense.amount.toFixed(2)}</td><td className="max-w-[200px] truncate px-4 py-3 text-[#657087]">{expense.description}</td></tr>)}</tbody></table>
            {!preview.length && <div className="grid h-52 place-items-center px-6 text-center"><div><p className="text-sm font-semibold">No matching records</p><p className="mt-1 text-xs text-[#929bad]">Adjust the date range or category selection.</p></div></div>}
          </div>
          {preview.length > 12 && <p className="mt-2 text-right text-[10px] text-[#929bad]">Previewing 12 of {preview.length} records</p>}
        </main>
      </div>

      <footer className="flex flex-col gap-3 border-t border-[#e8ebf1] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#7d8798]"><strong className="text-[#293347]">{preview.length}</strong> records will be exported to <strong className="uppercase text-[#293347]">{format}</strong></p><div className="flex gap-2"><button onClick={onClose} disabled={exporting} className="h-10 rounded-xl border border-[#dfe3eb] px-4 text-xs font-semibold text-[#606b7e] hover:bg-[#f7f8fb] disabled:opacity-40">Cancel</button><button onClick={handleExport} disabled={!preview.length || !filename.trim() || exporting} className="flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#3758f9] px-5 text-xs font-semibold text-white hover:bg-[#2948df] disabled:cursor-not-allowed disabled:opacity-45">{exporting ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />Preparing export</> : <><Download className="h-4 w-4" />Export {format.toUpperCase()}</>}</button></div></footer>
    </div>
  </div>;
}

function OptionLabel({ step, label }: { step: string; label: string }) { return <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-[#5267ef]">{step}</span><h3 className="text-xs font-bold uppercase tracking-[.08em] text-[#4f5a6d]">{label}</h3></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-[#929bad]">{label}</span>{children}</label>; }
