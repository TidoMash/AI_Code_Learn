"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, Close, Trend } from "./icons";

type Expense = { date: string; category: string; amount: number; description: string };
type View = "deliver" | "integrations" | "automate" | "activity";
type HistoryItem = { id: string; action: string; detail: string; timestamp: string; status: "Complete" | "Scheduled" };

const HISTORY_KEY = "pennywise-cloud-export-history-v1";
const SCHEDULE_KEY = "pennywise-cloud-export-schedule-v1";
const templates = [
  { id: "tax", name: "Tax Report", detail: "Annual, audit-ready records", icon: "TX", color: "#6956e8" },
  { id: "monthly", name: "Monthly Summary", detail: "Trends and key totals", icon: "MO", color: "#168f78" },
  { id: "category", name: "Category Analysis", detail: "Spending by category", icon: "CA", color: "#e17843" },
] as const;
const services = [
  { id: "sheets", name: "Google Sheets", detail: "Live, editable spreadsheet", mark: "G", color: "#20a464" },
  { id: "dropbox", name: "Dropbox", detail: "Save exports to a folder", mark: "D", color: "#2567e8" },
  { id: "onedrive", name: "OneDrive", detail: "Sync with Microsoft 365", mark: "O", color: "#168bd2" },
  { id: "slack", name: "Slack", detail: "Post reports to a channel", mark: "S", color: "#6a3d78" },
] as const;

export default function CloudExportHub({ expenses, onClose, notify }: { expenses: Expense[]; onClose: () => void; notify: (message: string) => void }) {
  const [view, setView] = useState<View>("deliver");
  const [template, setTemplate] = useState<(typeof templates)[number]["id"]>("monthly");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("Here is the latest Pennywise expense report.");
  const [busy, setBusy] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>(["sheets"]);
  const [shareUrl, setShareUrl] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [frequency, setFrequency] = useState("Every month");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [destination, setDestination] = useState("Google Sheets");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      const savedSchedule = localStorage.getItem(SCHEDULE_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      if (savedSchedule) {
        const saved = JSON.parse(savedSchedule);
        setFrequency(saved.frequency); setScheduleTime(saved.scheduleTime); setDestination(saved.destination); setScheduleEnabled(true);
      }
    } catch { /* Keep defaults when local data is unavailable. */ }
  }, []);
  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", keyHandler); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keyHandler); document.body.style.overflow = ""; };
  }, [busy, onClose]);

  const selectedTemplate = templates.find((item) => item.id === template)!;
  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);

  function addHistory(action: string, detail: string, status: HistoryItem["status"] = "Complete") {
    const next = [{ id: crypto.randomUUID(), action, detail, timestamp: new Date().toISOString(), status }, ...history].slice(0, 12);
    setHistory(next); localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }
  async function simulate(id: string, task: () => void) {
    setBusy(id); await new Promise((resolve) => setTimeout(resolve, 850)); task(); setBusy(null);
  }
  function sendEmail() {
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    simulate("email", () => { addHistory("Email delivered", `${selectedTemplate.name} sent to ${email}`); notify("Report email simulated successfully"); });
  }
  function createLink() {
    simulate("link", () => { const url = `https://share.pennywise.app/r/${crypto.randomUUID().slice(0, 8)}`; setShareUrl(url); addHistory("Share link created", selectedTemplate.name); });
  }
  function toggleService(service: (typeof services)[number]) {
    if (connected.includes(service.id)) {
      setConnected((items) => items.filter((item) => item !== service.id)); notify(`${service.name} disconnected`); return;
    }
    simulate(service.id, () => { setConnected((items) => [...items, service.id]); addHistory("Integration connected", service.name); notify(`${service.name} connected in demo mode`); });
  }
  function syncService(service: (typeof services)[number]) {
    simulate(`sync-${service.id}`, () => { addHistory("Cloud sync complete", `${selectedTemplate.name} synced to ${service.name}`); notify(`Synced to ${service.name}`); });
  }
  function saveSchedule() {
    simulate("schedule", () => {
      const config = { frequency, scheduleTime, destination }; localStorage.setItem(SCHEDULE_KEY, JSON.stringify(config)); setScheduleEnabled(true);
      addHistory("Backup scheduled", `${frequency} at ${scheduleTime} · ${destination}`, "Scheduled"); notify("Automatic backup schedule saved");
    });
  }

  return <div className="fixed inset-0 z-50 bg-[#eef2f8] sm:p-4 lg:p-7">
    <div role="dialog" aria-modal="true" aria-labelledby="cloud-title" className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden bg-white shadow-2xl sm:rounded-3xl">
      <header className="flex items-center justify-between border-b border-[#e8ebf1] px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#5267ef] to-[#8a5ce6] text-white shadow-lg shadow-indigo-200"><span className="text-lg">☁</span></div><div><div className="flex items-center gap-2"><h2 id="cloud-title" className="font-bold tracking-[-.025em]">Pennywise Cloud</h2><span className="rounded-full bg-[#e8f7f2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#23806b]">Demo workspace</span></div><p className="text-[11px] text-[#929bad]">Connected exports and automations</p></div></div>
        <div className="flex items-center gap-4"><div className="hidden items-center gap-2 text-[10px] font-semibold text-[#667186] sm:flex"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>All systems operational</div><button onClick={onClose} disabled={!!busy} aria-label="Close cloud export" className="grid h-9 w-9 place-items-center rounded-full text-[#7f899a] hover:bg-[#f3f4f7] disabled:opacity-40"><Close className="h-5 w-5" /></button></div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e8ebf1] bg-[#fafbfc] p-3 lg:w-[210px] lg:flex-col lg:border-b-0 lg:border-r lg:p-4">
          <p className="mb-2 hidden px-3 text-[9px] font-bold uppercase tracking-[.15em] text-[#a0a8b6] lg:block">Workspace</p>
          <NavButton active={view === "deliver"} onClick={() => setView("deliver")} icon="↗" label="Share & send" />
          <NavButton active={view === "integrations"} onClick={() => setView("integrations")} icon="⌘" label="Integrations" />
          <NavButton active={view === "automate"} onClick={() => setView("automate")} icon="◷" label="Automations" badge={scheduleEnabled ? "On" : undefined} />
          <NavButton active={view === "activity"} onClick={() => setView("activity")} icon="≡" label="Export history" badge={history.length ? String(history.length) : undefined} />
          <div className="mt-auto hidden rounded-2xl bg-[#18213a] p-4 text-white lg:block"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8f9ab4]">Cloud snapshot</p><p className="mt-3 text-2xl font-bold">{expenses.length}</p><p className="mt-0.5 text-[10px] text-[#aab3c7]">records ready to sync</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[78%] rounded-full bg-[#7c8cf7]" /></div><p className="mt-2 text-[9px] text-[#7f8ba5]">Encrypted · Last checked now</p></div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f9fc]">
          <section className="border-b border-[#e7eaf0] bg-white px-5 py-5 sm:px-8"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#5267ef]">Export template</p><h3 className="mt-1 text-lg font-bold tracking-[-.025em]">Choose how your data tells the story</h3></div><p className="text-xs text-[#8993a6]">{expenses.length} expenses · {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{templates.map((item) => <button key={item.id} onClick={() => setTemplate(item.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${template === item.id ? "border-[#8997ef] bg-[#f4f5ff] shadow-sm" : "border-[#e2e6ed] hover:border-[#bac2d0]"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-black text-white" style={{ backgroundColor: item.color }}>{item.icon}</span><span><strong className="block text-xs">{item.name}</strong><span className="mt-0.5 block text-[10px] text-[#929bad]">{item.detail}</span></span>{template === item.id && <Check className="ml-auto h-4 w-4 text-[#5267ef]" />}</button>)}</div></section>

          <div className="p-5 sm:p-8">
            {view === "deliver" && <DeliverView email={email} setEmail={setEmail} message={message} setMessage={setMessage} sendEmail={sendEmail} createLink={createLink} shareUrl={shareUrl} busy={busy} templateName={selectedTemplate.name} expenses={expenses} />}
            {view === "integrations" && <IntegrationsView connected={connected} busy={busy} toggle={toggleService} sync={syncService} />}
            {view === "automate" && <AutomateView frequency={frequency} setFrequency={setFrequency} scheduleTime={scheduleTime} setScheduleTime={setScheduleTime} destination={destination} setDestination={setDestination} enabled={scheduleEnabled} save={saveSchedule} busy={busy} templateName={selectedTemplate.name} />}
            {view === "activity" && <ActivityView history={history} clear={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }} />}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function DeliverView({ email, setEmail, message, setMessage, sendEmail, createLink, shareUrl, busy, templateName, expenses }: any) {
  const statusClass = "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider";
  return <div><PageHeading eyebrow="Collaboration" title="Share data without downloading files" copy="Deliver a secure snapshot to teammates, advisors, or clients." /><div className="mt-6 grid gap-5 xl:grid-cols-2">
    <Card><div className="flex items-start justify-between"><CardTitle icon="@" title="Send by email" detail={`Attach ${templateName} as a secure report`} /><span className={`${statusClass} bg-[#edf8f5] text-[#2b806b]`}>Secure</span></div><label className="mt-5 block text-[10px] font-bold uppercase tracking-wider text-[#7d8799]">Recipient</label><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="finance@company.com" className="mt-2 h-11 w-full rounded-xl border border-[#dfe3eb] bg-[#fafbfc] px-3 text-sm outline-none focus:border-[#7f8fec]" /><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-[#7d8799]">Message</label><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-[#dfe3eb] bg-[#fafbfc] p-3 text-sm outline-none focus:border-[#7f8fec]" /><button onClick={sendEmail} disabled={!/^\S+@\S+\.\S+$/.test(email) || busy === "email"} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3758f9] text-sm font-semibold text-white disabled:opacity-45">{busy === "email" ? <Spinner /> : "Send secure email"}</button></Card>
    <Card><div className="flex items-start justify-between"><CardTitle icon="↗" title="Shareable link" detail="Anyone with the link can view a read-only report" /><span className={`${statusClass} bg-[#f0f2f6] text-[#69758a]`}>7-day access</span></div>{shareUrl ? <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_130px]"><div><label className="block text-[10px] font-bold uppercase tracking-wider text-[#7d8799]">Private report link</label><div className="mt-2 flex rounded-xl border border-[#cfd6e3] bg-[#fafbfc] p-1"><input readOnly value={shareUrl} className="min-w-0 flex-1 bg-transparent px-2 text-xs outline-none" /><button onClick={() => navigator.clipboard?.writeText(shareUrl)} className="rounded-lg bg-white px-3 text-xs font-bold shadow-sm">Copy</button></div><div className="mt-4 flex items-center gap-2 text-[10px] text-[#788397]"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live · Read-only · Expires automatically</div></div><div className="rounded-xl border border-[#e1e5ec] bg-white p-2"><QrCode value={shareUrl} /><p className="mt-1 text-center text-[8px] font-bold uppercase tracking-wider text-[#929bad]">Scan to open</p></div></div> : <div className="mt-5 grid min-h-[230px] place-items-center rounded-2xl border border-dashed border-[#ccd3df] bg-[#fafbfc] p-6 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eef0ff] text-xl text-[#5267ef]">∞</div><p className="mt-3 text-sm font-semibold">Create a live report</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#8d97a8]">Generate a controlled link and QR code for {expenses.length} records.</p><button onClick={createLink} disabled={busy === "link"} className="mt-4 h-10 rounded-xl bg-[#18213a] px-5 text-xs font-semibold text-white">{busy === "link" ? <Spinner /> : "Generate secure link"}</button></div></div>}</Card>
  </div></div>;
}

function IntegrationsView({ connected, busy, toggle, sync }: any) { return <div><PageHeading eyebrow="Destinations" title="Connect your financial workspace" copy="Route reports to the tools your team already uses. Connections are simulated in this prototype." /><div className="mt-6 grid gap-4 sm:grid-cols-2">{services.map((service) => { const active = connected.includes(service.id); return <Card key={service.id}><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-black text-white" style={{ backgroundColor: service.color }}>{service.mark}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">{service.name}</h4><span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${active ? "text-emerald-600" : "text-[#9aa3b5]"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[#c5cbd5]"}`} />{active ? "Connected" : "Not connected"}</span></div><p className="mt-1 text-xs text-[#8f99aa]">{service.detail}</p><div className="mt-5 flex gap-2">{active && <button onClick={() => sync(service)} disabled={!!busy} className="h-9 flex-1 rounded-lg bg-[#18213a] text-xs font-semibold text-white">{busy === `sync-${service.id}` ? <Spinner /> : "Sync now"}</button>}<button onClick={() => toggle(service)} disabled={!!busy} className="h-9 flex-1 rounded-lg border border-[#dfe3eb] text-xs font-semibold text-[#606b7e]">{busy === service.id ? <Spinner /> : active ? "Disconnect" : "Connect"}</button></div></div></div></Card>; })}</div></div>; }

function AutomateView({ frequency, setFrequency, scheduleTime, setScheduleTime, destination, setDestination, enabled, save, busy, templateName }: any) { return <div><PageHeading eyebrow="Background workflows" title="Put your exports on autopilot" copy="Create a recurring backup that runs even when the dashboard is closed." /><div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Card><div className="flex items-center justify-between"><CardTitle icon="◷" title="Recurring cloud backup" detail={`Automatically generate the ${templateName}`} /><span className={enabled ? "Status" : "MutedStatus"}>{enabled ? "Active" : "Draft"}</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><SelectField label="Frequency" value={frequency} setValue={setFrequency} options={["Every week", "Every month", "Every quarter"]} /><SelectField label="Destination" value={destination} setValue={setDestination} options={["Google Sheets", "Dropbox", "OneDrive", "Email"]} /><label><span className="text-[10px] font-bold uppercase tracking-wider text-[#7d8799]">Delivery time</span><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#dfe3eb] bg-[#fafbfc] px-3 text-sm" /></label><div><span className="text-[10px] font-bold uppercase tracking-wider text-[#7d8799]">Timezone</span><div className="mt-2 flex h-11 items-center rounded-xl border border-[#e4e7ed] bg-[#f4f6f9] px-3 text-xs text-[#778295]">Africa/Johannesburg</div></div></div><button onClick={save} disabled={busy === "schedule"} className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-[#3758f9] text-sm font-semibold text-white">{busy === "schedule" ? <Spinner /> : enabled ? "Update automation" : "Activate automation"}</button></Card><Card><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#929bad]">Next run</p><div className="mt-5 flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef0ff] text-[#5267ef]"><Calendar className="h-6 w-6" /></div><div><p className="font-bold">{frequency}</p><p className="mt-1 text-xs text-[#8f99aa]">at {scheduleTime} · {destination}</p></div></div><div className="my-6 h-px bg-[#edf0f4]" /><div className="space-y-3 text-xs"><SummaryLine label="Template" value={templateName} /><SummaryLine label="Processing" value="Background queue" /><SummaryLine label="Notification" value="On completion" /></div><div className="mt-6 rounded-xl bg-[#edf8f5] p-3 text-[10px] leading-4 text-[#397766]">Exports are encrypted before transfer. Failed jobs retry automatically and appear in export history.</div></Card></div></div>; }

function ActivityView({ history, clear }: { history: HistoryItem[]; clear: () => void }) { return <div><div className="flex items-end justify-between"><PageHeading eyebrow="Audit trail" title="Export history" copy="A record of cloud deliveries, connections, and scheduled jobs." />{history.length > 0 && <button onClick={clear} className="text-xs font-semibold text-[#8791a3] hover:text-[#cf4d4d]">Clear history</button>}</div><div className="mt-6 overflow-hidden rounded-2xl border border-[#e2e6ed] bg-white">{history.length ? history.map((item) => <div key={item.id} className="flex items-center gap-4 border-b border-[#edf0f4] px-5 py-4 last:border-0"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.status === "Complete" ? "bg-[#e9f7f3] text-[#25806b]" : "bg-[#eef0ff] text-[#5267ef]"}`}>{item.status === "Complete" ? <Check className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold">{item.action}</p><p className="mt-1 truncate text-[10px] text-[#8e98a9]">{item.detail}</p></div><div className="text-right"><span className="block text-[9px] font-bold uppercase tracking-wider text-[#69758a]">{item.status}</span><time className="mt-1 block text-[10px] text-[#a0a8b6]">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.timestamp))}</time></div></div>) : <div className="grid min-h-[280px] place-items-center p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f0f2f6] text-[#8c96a8]"><Trend className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold">No cloud activity yet</p><p className="mt-1 text-xs text-[#929bad]">Exports, shares, and sync jobs will appear here.</p></div></div>}</div></div>; }

function NavButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: string; label: string; badge?: string }) { return <button onClick={onClick} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${active ? "bg-white text-[#26324a] shadow-sm ring-1 ring-[#e3e7ee]" : "text-[#798496] hover:bg-white/70"}`}><span className={`grid h-6 w-6 place-items-center rounded-lg text-sm ${active ? "bg-[#eef0ff] text-[#5267ef]" : "bg-[#eef0f3] text-[#8d97a8]"}`}>{icon}</span><span>{label}</span>{badge && <span className="ml-auto rounded-full bg-[#e8ecf4] px-1.5 py-0.5 text-[8px] font-bold text-[#677286]">{badge}</span>}</button>; }
function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#5267ef]">{eyebrow}</p><h3 className="mt-1 text-xl font-bold tracking-[-.03em] text-[#1d273b]">{title}</h3><p className="mt-1 max-w-xl text-xs leading-5 text-[#8d97a8]">{copy}</p></div>; }
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-[#e2e6ed] bg-white p-5 shadow-[0_3px_14px_rgba(30,45,75,.035)] sm:p-6">{children}</div>; }
function CardTitle({ icon, title, detail }: { icon: string; title: string; detail: string }) { return <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef0ff] text-[#5267ef]">{icon}</span><div><h4 className="text-sm font-bold">{title}</h4><p className="mt-0.5 text-[10px] text-[#929bad]">{detail}</p></div></div>; }
function Spinner() { return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" />; }
function SelectField({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) { return <label><span className="text-[10px] font-bold uppercase tracking-wider text-[#7d8799]">{label}</span><select value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#dfe3eb] bg-[#fafbfc] px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span className="text-[#8c96a7]">{label}</span><strong>{value}</strong></div>; }
function QrCode({ value }: { value: string }) { const cells = useMemo(() => { let hash = 0; for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0; return Array.from({ length: 225 }, (_, index) => { const x = index % 15, y = Math.floor(index / 15); const finder = (x < 5 && y < 5) || (x > 9 && y < 5) || (x < 5 && y > 9); if (finder) { const fx = x > 9 ? x - 10 : x, fy = y > 9 ? y - 10 : y; return fx === 0 || fx === 4 || fy === 0 || fy === 4 || (fx >= 2 && fx <= 2 && fy >= 2 && fy <= 2); } return ((hash >>> (index % 28)) ^ index * 17) % 3 !== 0; }); }, [value]); return <div className="mx-auto grid aspect-square w-full grid-cols-[repeat(15,1fr)] gap-px bg-white p-1">{cells.map((dark, index) => <span key={index} className={dark ? "bg-[#18213a]" : "bg-white"} />)}</div>; }
