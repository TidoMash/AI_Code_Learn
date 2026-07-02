"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, Close, Dots, Download, Edit, Filter, Plus, Search, Trash, Trend, Wallet } from "./icons";
import CloudExportHub from "./cloud-export-hub";

const CATEGORIES = ["Food", "Transportation", "Entertainment", "Shopping", "Bills", "Other"] as const;
type Category = (typeof CATEGORIES)[number];
type Expense = { id: string; date: string; amount: number; category: Category; description: string; createdAt: number };
type FormData = { date: string; amount: string; category: Category | ""; description: string };

const COLORS: Record<Category, string> = { Food: "#ff8d64", Transportation: "#6c7df7", Entertainment: "#ad6cf6", Shopping: "#f4ba44", Bills: "#42b9a2", Other: "#8792a8" };
const ICONS: Record<Category, string> = { Food: "☕", Transportation: "↗", Entertainment: "♫", Shopping: "◇", Bills: "▣", Other: "•••" };
const STORAGE_KEY = "pennywise-expenses-v1";
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => localDate(new Date());
const initialForm = (): FormData => ({ date: today(), amount: "", category: "", description: "" });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const shortMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function seedExpenses(): Expense[] {
  const now = new Date();
  const d = (days: number) => { const copy = new Date(now); copy.setDate(copy.getDate() - days); return localDate(copy); };
  return [
    { id: "demo-1", description: "Grocery shopping", category: "Food", amount: 84.36, date: d(1), createdAt: Date.now() - 1000 },
    { id: "demo-2", description: "Monthly internet", category: "Bills", amount: 64.99, date: d(3), createdAt: Date.now() - 2000 },
    { id: "demo-3", description: "Coffee with friends", category: "Food", amount: 18.5, date: d(5), createdAt: Date.now() - 3000 },
    { id: "demo-4", description: "Train pass", category: "Transportation", amount: 45, date: d(8), createdAt: Date.now() - 4000 },
    { id: "demo-5", description: "Movie tickets", category: "Entertainment", amount: 32, date: d(12), createdAt: Date.now() - 5000 },
    { id: "demo-6", description: "Running shoes", category: "Shopping", amount: 119.95, date: d(18), createdAt: Date.now() - 6000 },
  ];
}

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [cloudOpen, setCloudOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setExpenses(saved ? JSON.parse(saved) : seedExpenses());
    } catch { setExpenses(seedExpenses()); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)); }, [expenses, ready]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 2600); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", handler); document.body.style.overflow = "hidden";
    setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [modalOpen]);

  const currentMonth = monthKey(new Date());
  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(currentMonth)), [expenses, currentMonth]);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthly = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = useMemo(() => CATEGORIES.map((name) => ({ name, value: monthExpenses.filter((e) => e.category === name).reduce((s, e) => s + e.amount, 0) })).sort((a, b) => b.value - a.value), [monthExpenses]);
  const top = categoryTotals[0];
  const filtered = useMemo(() => expenses.filter((e) => {
    const query = search.trim().toLowerCase();
    return (!query || e.description.toLowerCase().includes(query) || e.category.toLowerCase().includes(query)) && (category === "All" || e.category === category) && (!from || e.date >= from) && (!to || e.date <= to);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [expenses, search, category, from, to]);

  const weekly = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, i) => { const end = new Date(); end.setDate(end.getDate() - (5 - i) * 7); const start = new Date(end); start.setDate(start.getDate() - 6); return { label: `${start.getMonth() + 1}/${start.getDate()}`, start: localDate(start), end: localDate(end), value: 0 }; });
    expenses.forEach((e) => { const bucket = buckets.find((b) => e.date >= b.start && e.date <= b.end); if (bucket) bucket.value += e.amount; });
    return buckets;
  }, [expenses]);
  const maxWeek = Math.max(...weekly.map((w) => w.value), 1);

  function showToast(message: string) { setToast(""); setTimeout(() => setToast(message), 10); }
  function openAdd() { setEditing(null); setForm(initialForm()); setErrors({}); setModalOpen(true); }
  function openEdit(expense: Expense) { setEditing(expense); setForm({ date: expense.date, amount: String(expense.amount), category: expense.category, description: expense.description }); setErrors({}); setMenuId(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setErrors({}); }
  function validate() {
    const next: typeof errors = {};
    if (!form.date) next.date = "Choose a date.";
    else if (form.date > today()) next.date = "Date cannot be in the future.";
    const amount = Number(form.amount);
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) next.amount = "Enter an amount greater than zero.";
    else if (amount > 1000000) next.amount = "Amount must be below $1,000,000.";
    if (!form.category) next.category = "Choose a category.";
    if (!form.description.trim()) next.description = "Add a short description.";
    else if (form.description.trim().length > 80) next.description = "Keep the description under 80 characters.";
    setErrors(next); return Object.keys(next).length === 0;
  }
  function submit(e: FormEvent) {
    e.preventDefault(); if (!validate() || !form.category) return;
    const payload = { date: form.date, amount: Math.round(Number(form.amount) * 100) / 100, category: form.category, description: form.description.trim() };
    if (editing) { setExpenses((items) => items.map((item) => item.id === editing.id ? { ...item, ...payload } : item)); showToast("Expense updated"); }
    else { setExpenses((items) => [{ ...payload, id: crypto.randomUUID(), createdAt: Date.now() }, ...items]); showToast("Expense added"); }
    closeModal();
  }
  function remove(expense: Expense) {
    if (!window.confirm(`Delete “${expense.description}”? This cannot be undone.`)) return;
    setExpenses((items) => items.filter((item) => item.id !== expense.id)); setMenuId(null); showToast("Expense deleted");
  }
  function clearFilters() { setSearch(""); setCategory("All"); setFrom(""); setTo(""); }
  const filtersActive = category !== "All" || !!from || !!to;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[#e7eaf0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 lg:px-10">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#3758f9] text-white shadow-lg shadow-indigo-200"><Wallet className="h-5 w-5" /></div><div><div className="text-[17px] font-bold tracking-[-.02em]">Pennywise</div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9aa3b5]">Expense tracker</div></div></div>
          <button onClick={openAdd} className="flex h-10 items-center gap-2 rounded-xl bg-[#3758f9] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2948df] active:scale-[.98]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add expense</span><span className="sm:hidden">Add</span></button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
        <section className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-1 text-sm font-medium text-[#8b94a7]">Personal dashboard</p><h1 className="text-3xl font-bold tracking-[-.04em] text-[#172033] sm:text-[34px]">Your spending overview</h1></div>
          <p className="max-w-sm text-sm leading-6 text-[#8b94a7]">Stay on top of where your money goes. Your data remains private on this device.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Total spending" value={money.format(total)} note={`${expenses.length} expense${expenses.length === 1 ? "" : "s"} recorded`} icon={<Wallet className="h-5 w-5" />} color="indigo" />
          <SummaryCard label="This month" value={money.format(monthly)} note={new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date())} icon={<Calendar className="h-5 w-5" />} color="teal" />
          <SummaryCard label="Top category" value={top?.value ? top.name : "No spending"} note={top?.value ? `${money.format(top.value)} this month` : "Add an expense to begin"} icon={<Trend className="h-5 w-5" />} color="orange" />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.45fr_.8fr]">
          <div className="rounded-2xl border border-[#e5e8ef] bg-white p-5 shadow-[0_2px_12px_rgba(20,30,55,.035)] sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold tracking-[-.02em]">Spending trend</h2><p className="mt-1 text-xs text-[#9aa3b5]">Last six weeks</p></div><span className="rounded-lg bg-[#f2f4ff] px-2.5 py-1 text-xs font-semibold text-[#5368d9]">{shortMoney.format(weekly.reduce((s, w) => s + w.value, 0))}</span></div>
            <div className="mt-7 flex h-[170px] items-end gap-3 sm:gap-5" aria-label="Six week spending bar chart">{weekly.map((w, i) => <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div title={`${w.label}: ${money.format(w.value)}`} className="w-full max-w-12 rounded-t-md bg-[#dfe4ff] transition-all hover:bg-[#6c7df7]" style={{ height: `${Math.max((w.value / maxWeek) * 130, 5)}px`, backgroundColor: i === weekly.length - 1 ? "#5267ef" : undefined }} /><span className="text-[10px] font-medium text-[#9aa3b5]">{w.label}</span></div>)}</div>
          </div>
          <div className="rounded-2xl border border-[#e5e8ef] bg-white p-5 shadow-[0_2px_12px_rgba(20,30,55,.035)] sm:p-6">
            <div><h2 className="font-bold tracking-[-.02em]">By category</h2><p className="mt-1 text-xs text-[#9aa3b5]">Current month</p></div>
            <div className="mt-5 space-y-3.5">{categoryTotals.slice(0, 4).map((item) => <div key={item.name}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-[#616b7f]">{item.name}</span><span className="font-semibold">{money.format(item.value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#eef0f4]"><div className="h-full rounded-full transition-all" style={{ width: `${monthly ? Math.max(item.value / monthly * 100, item.value ? 2 : 0) : 0}%`, background: COLORS[item.name] }} /></div></div>)}</div>
          </div>
        </section>

        <section className="mt-5 overflow-visible rounded-2xl border border-[#e5e8ef] bg-white shadow-[0_2px_12px_rgba(20,30,55,.035)]">
          <div className="border-b border-[#edf0f4] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-bold tracking-[-.02em]">Recent expenses</h2><p className="mt-1 text-xs text-[#9aa3b5]">{filtered.length} of {expenses.length} transactions</p></div><button onClick={() => setCloudOpen(true)} className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#18213a] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#293652]"><Download className="h-4 w-4" />Cloud export</button></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9da6b6]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="focus-ring h-10 w-full rounded-lg border border-[#dfe3eb] bg-[#fafbfc] pl-9 pr-3 text-sm placeholder:text-[#aab1bf]" /></label><button onClick={() => setFiltersOpen(!filtersOpen)} className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${filtersActive ? "border-[#8796ef] bg-[#f3f5ff] text-[#3758f9]" : "border-[#dfe3eb] text-[#5d687b] hover:bg-[#f7f8fb]"}`}><Filter className="h-4 w-4" />Filters{filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-[#3758f9]" />}</button></div>
            {filtersOpen && <div className="animate-enter mt-3 grid gap-3 rounded-xl bg-[#f7f8fb] p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"><Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value as Category | "All")} className="focus-ring h-9 w-full rounded-lg border border-[#dfe3eb] bg-white px-2 text-xs"><option>All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="From"><input type="date" value={from} max={to || today()} onChange={(e) => setFrom(e.target.value)} className="focus-ring h-9 w-full rounded-lg border border-[#dfe3eb] bg-white px-2 text-xs" /></Field><Field label="To"><input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="focus-ring h-9 w-full rounded-lg border border-[#dfe3eb] bg-white px-2 text-xs" /></Field><button onClick={clearFilters} className="self-end px-2 pb-2 text-xs font-semibold text-[#657087] hover:text-[#3758f9]">Clear</button></div>}
          </div>
          {!ready ? <div className="space-y-3 p-6">{[1,2,3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#f2f4f7]" />)}</div> : filtered.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#f1f3f8] text-[#8892a5]"><Search className="h-5 w-5" /></div><h3 className="font-semibold">No expenses found</h3><p className="mt-1 max-w-xs text-sm text-[#929bad]">Try adjusting your search or filters, or add a new expense.</p><button onClick={filtersActive || search ? clearFilters : openAdd} className="mt-4 text-sm font-semibold text-[#3758f9]">{filtersActive || search ? "Clear filters" : "Add expense"}</button></div> : <div>{filtered.map((expense) => <ExpenseRow key={expense.id} expense={expense} menuOpen={menuId === expense.id} setMenu={() => setMenuId(menuId === expense.id ? null : expense.id)} edit={() => openEdit(expense)} remove={() => remove(expense)} />)}</div>}
        </section>
        <footer className="py-8 text-center text-xs text-[#9aa3b5]">Pennywise · Stored privately in your browser</footer>
      </main>

      {modalOpen && <div onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }} className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="animate-enter max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-[520px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#edf0f4] px-6 py-5"><div><h2 id="dialog-title" className="text-lg font-bold">{editing ? "Edit expense" : "Add an expense"}</h2><p className="mt-1 text-xs text-[#929bad]">{editing ? "Update the transaction details below." : "Record a new transaction in your tracker."}</p></div><button aria-label="Close" onClick={closeModal} className="grid h-9 w-9 place-items-center rounded-full text-[#7f899a] hover:bg-[#f3f4f7]"><Close className="h-5 w-5" /></button></div>
        <form onSubmit={submit} noValidate className="p-6"><div className="grid gap-5 sm:grid-cols-2"><FormField label="Date" error={errors.date}><input type="date" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass(!!errors.date)} /></FormField><FormField label="Amount" error={errors.amount}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#818b9c]">$</span><input inputMode="decimal" type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${inputClass(!!errors.amount)} pl-7`} /></div></FormField></div><div className="mt-5"><FormField label="Category" error={errors.category}><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} className={`${inputClass(!!errors.category)} ${form.category ? "text-[#172033]" : "text-[#9aa3b5]"}`}><option value="" disabled>Select a category</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FormField></div><div className="mt-5"><FormField label="Description" error={errors.description}><input value={form.description} maxLength={81} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Weekly groceries" className={inputClass(!!errors.description)} /></FormField></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={closeModal} className="h-11 rounded-xl border border-[#dfe3eb] px-5 text-sm font-semibold text-[#606b7e] hover:bg-[#f7f8fb]">Cancel</button><button type="submit" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3758f9] px-5 text-sm font-semibold text-white hover:bg-[#2948df]"><Check className="h-4 w-4" />{editing ? "Save changes" : "Add expense"}</button></div></form>
      </div></div>}
      {cloudOpen && <CloudExportHub expenses={expenses} onClose={() => setCloudOpen(false)} notify={showToast} />}
      {toast && <div role="status" className="animate-enter fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#172033] px-4 py-3 text-sm font-medium text-white shadow-xl"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#42b9a2]"><Check className="h-3 w-3" /></span>{toast}</div>}
    </div>
  );
}

function SummaryCard({ label, value, note, icon, color }: { label: string; value: string; note: string; icon: React.ReactNode; color: "indigo" | "teal" | "orange" }) {
  const styles = { indigo: "bg-[#eef0ff] text-[#5368d9]", teal: "bg-[#e8f7f4] text-[#2d9e8b]", orange: "bg-[#fff2e9] text-[#ed8258]" };
  return <div className="rounded-2xl border border-[#e5e8ef] bg-white p-5 shadow-[0_2px_12px_rgba(20,30,55,.035)] sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.08em] text-[#929bad]">{label}</p><p className="mt-3 text-2xl font-bold tracking-[-.04em]">{value}</p><p className="mt-1.5 text-xs text-[#9aa3b5]">{note}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${styles[color]}`}>{icon}</div></div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#929bad]">{label}</span>{children}</label>; }
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-[#4f5a6d]">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-[#d14c4c]">{error}</span>}</label>; }
function inputClass(error: boolean) { return `focus-ring h-11 w-full rounded-xl border bg-[#fafbfc] px-3 text-sm placeholder:text-[#adb4c1] ${error ? "border-[#df7777]" : "border-[#dfe3eb]"}`; }

function ExpenseRow({ expense, menuOpen, setMenu, edit, remove }: { expense: Expense; menuOpen: boolean; setMenu: () => void; edit: () => void; remove: () => void }) {
  return <div className="group relative flex items-center gap-3 border-b border-[#f0f2f5] px-5 py-4 last:border-0 sm:px-6"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ color: COLORS[expense.category], background: `${COLORS[expense.category]}18` }}>{ICONS[expense.category]}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#293347]">{expense.description}</p><div className="mt-1 flex items-center gap-2 text-[11px] text-[#98a1b2]"><span>{expense.category}</span><span className="h-0.5 w-0.5 rounded-full bg-[#b9c0cc]" /><span>{dateLabel(expense.date)}</span></div></div><p className="shrink-0 text-sm font-bold tabular-nums text-[#293347]">{money.format(expense.amount)}</p><button aria-label={`Actions for ${expense.description}`} onClick={setMenu} className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8e97a8] hover:bg-[#f1f3f6]"><Dots className="h-4 w-4" /></button>{menuOpen && <><button aria-label="Close actions" onClick={setMenu} className="fixed inset-0 z-10 cursor-default" /><div className="absolute right-5 top-12 z-20 w-36 rounded-xl border border-[#e1e5ec] bg-white p-1.5 shadow-xl"><button onClick={edit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#526074] hover:bg-[#f4f6f9]"><Edit className="h-3.5 w-3.5" />Edit</button><button onClick={remove} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#cf4d4d] hover:bg-[#fff1f1]"><Trash className="h-3.5 w-3.5" />Delete</button></div></>}</div>;
}
