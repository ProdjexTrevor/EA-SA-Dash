import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { formatQuarterLabel } from "../lib/quarters";

const reportLinks = [
  { to: "/", label: "Quarterly report", end: true },
  { to: "/region-report", label: "Quarter report (simple)" },
  { to: "/compare", label: "Compare regions & countries" },
  { to: "/scorecard", label: "Regional scorecard" },
  { to: "/trends", label: "Trends over time" },
];

function NavSection({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: { to: string; label: string; end?: boolean }[];
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-4">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="px-5 py-6 border-b border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">EA · SA · Moon</p>
        <h1 className="text-lg font-bold text-slate-900 mt-1">EA-SA Dash</h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">East Africa, Southern Africa &amp; The Moon (demo)</p>
      </div>
      <nav className="p-3 flex-1 overflow-y-auto">
        <NavSection title="Reports" links={reportLinks} onNavigate={() => setMobileOpen(false)} />
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <header className="md:hidden flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-brand-600">EA-SA Dash</p>
          <p className="font-bold text-slate-900">Reporting</p>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            className="flex-1 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">{sidebar}</aside>
        </div>
      )}

      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">{sidebar}</aside>

      <main className="flex-1 overflow-auto print:overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 print:max-w-none print:px-2">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 print:mb-4">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="text-slate-600 mt-1 text-sm sm:text-base">{subtitle}</p>}
    </div>
  );
}

export function QuarterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { date: string; row_count: number }[];
  onChange: (d: string) => void;
}) {
  return (
    <label className="inline-flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm print:hidden">
      <span className="text-slate-600 font-medium">Reporting quarter</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 min-w-[10rem]"
      >
        {options.map((o) => (
          <option key={o.date} value={o.date}>
            {formatQuarterLabel(o.date)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SeverityBadge({ severity }: { severity: "critical" | "warning" }) {
  const cls =
    severity === "critical"
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-amber-100 text-amber-800 border-amber-200";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {severity}
    </span>
  );
}

export function HealthScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? "text-brand-600" : score >= 75 ? "text-amber-600" : "text-red-600";
  return (
    <div className={`text-4xl font-bold tabular-nums ${color}`}>
      {score}
      <span className="text-lg font-medium text-slate-400">%</span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-slate-200",
    good: "border-brand-200 bg-brand-50/40",
    warn: "border-amber-200 bg-amber-50/40",
    bad: "border-red-200 bg-red-50/40",
  };
  return (
    <div className={`rounded-xl border bg-white p-4 sm:p-5 shadow-sm print:shadow-none print:border-slate-300 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
      Loading report…
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
      <p className="font-semibold">Could not load this report</p>
      <p className="text-sm mt-1">{message}</p>
      <p className="text-sm mt-2 text-red-700">Check your connection and try again.</p>
    </div>
  );
}
