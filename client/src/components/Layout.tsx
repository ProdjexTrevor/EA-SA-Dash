import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Bars3Icon,
  ChartBarIcon,
  ChartBarSquareIcon,
  GlobeAltIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MapIcon,
  ScaleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@tremor/react";
import { formatQuarterLabel } from "../lib/quarters";

const reportLinks = [
  { to: "/", label: "Quarterly report", end: true, icon: ChartBarSquareIcon },
  { to: "/region-report", label: "Quarter report", end: false, icon: MapIcon },
  { to: "/compare", label: "Compare", end: false, icon: ScaleIcon },
  { to: "/scorecard", label: "Scorecard", end: false, icon: ChartBarIcon },
  { to: "/trends", label: "Trends", end: false, icon: MagnifyingGlassIcon },
  { to: "/health-check", label: "Health Check", end: false, icon: HeartIcon },
  { to: "/health-map", label: "Health Map", end: false, icon: GlobeAltIcon },
];

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${compact ? "" : "px-1"}`}>
      <div
        className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-700 shadow-glow ring-1 ring-white/20"
        aria-hidden
      >
        <span className="absolute inset-1 rounded-[0.65rem] border border-white/25" />
        <span className="text-sm font-bold tracking-tight text-white">EA</span>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-soft-pulse" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-white">EA-SA Dash</p>
        {!compact && (
          <p className="mt-1 text-sm leading-snug text-white/80">
            East Africa · Southern Africa · The Moon
          </p>
        )}
      </div>
    </div>
  );
}

function NavSection({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: { to: string; label: string; end?: boolean; icon: typeof ChartBarIcon }[];
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-3 text-sm font-semibold text-white/70">{title}</p>
      <div className="space-y-1">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `dash-nav-link ${isActive ? "dash-nav-link-active" : ""}`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{l.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="relative border-b border-white/10 px-5 py-6">
        <div className="pointer-events-none absolute inset-0 bg-sidebar-glow" />
        <div className="relative">
          <BrandMark />
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge color="emerald" size="xs">
              Live history
            </Badge>
            <Badge color="amber" size="xs">
              Moon demo
            </Badge>
          </div>
        </div>
      </div>
      <nav className="relative flex-1 overflow-y-auto p-3">
        <NavSection
          title="Reports"
          links={reportLinks}
          onNavigate={() => setMobileOpen(false)}
        />
      </nav>
      <div className="relative border-t border-white/10 px-4 py-4">
        <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3">
          <p className="text-sm font-semibold text-white/80">Scope</p>
          <p className="mt-1 text-sm leading-relaxed text-white/85">
            Reads <span className="font-semibold text-white">Dash_*</span> tables only — production
            masters stay untouched.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <header className="flex items-center justify-between border-b border-ink-800/80 bg-ink-950 px-4 py-3 md:hidden">
        <BrandMark compact />
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-emerald-50 hover:bg-white/10"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            className="flex-1 bg-ink-950/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="flex w-72 max-w-[85vw] flex-col border-l border-white/10 bg-gradient-to-b from-ink-900 via-ink-950 to-brand-950 shadow-dash-lg">
            {sidebar}
          </aside>
        </div>
      )}

      <aside className="relative hidden w-64 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-ink-900 via-ink-950 to-brand-950 md:flex">
        {sidebar}
      </aside>

      <main className="dash-canvas relative flex-1 overflow-auto print:overflow-visible">
        <div className="relative z-[1] mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 print:max-w-none print:px-2">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 animate-fade-up print:mb-4">
      <h2 className="text-2xl font-bold text-slate-900 sm:text-[1.75rem]">{title}</h2>
      {subtitle && (
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-slate-700">{subtitle}</p>
      )}
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
    <label className="inline-flex flex-col gap-1 text-[15px] print:hidden sm:flex-row sm:items-center sm:gap-2">
      <span className="font-medium text-slate-700">Reporting quarter</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="dash-input min-w-[10rem]">
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
  return (
    <Badge color={severity === "critical" ? "red" : "amber"} size="sm">
      {severity}
    </Badge>
  );
}

export function HealthScoreRing({ score }: { score: number }) {
  const color =
    score >= 90 ? "text-brand-700" : score >= 75 ? "text-amber-700" : "text-red-700";
  return (
    <div className={`text-4xl font-bold tabular-nums ${color}`}>
      {score}
      <span className="text-lg font-medium text-slate-500">%</span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}) {
  const tones = {
    neutral: "",
    good: "dash-stat-good",
    warn: "dash-stat-warn",
    bad: "dash-stat-bad",
  };
  return (
    <div className={`dash-stat ${tones[tone]} ${className}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 sm:text-[1.65rem]">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-sm leading-snug text-slate-600">{hint}</p>}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="dash-panel-solid p-12 text-center">
      <div className="mx-auto mb-3 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-brand-400 to-transparent bg-[length:200%_100%]" />
      </div>
      <p className="text-[15px] text-slate-600">Loading report…</p>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-dash">
      <p className="text-lg font-semibold">Could not load this report</p>
      <p className="mt-1 text-[15px] text-red-800">{message}</p>
      <p className="mt-2 text-[15px] text-red-800">Check your connection and try again.</p>
    </div>
  );
}

export function SectionShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`dash-panel-solid p-4 sm:p-5 ${className}`}>{children}</section>;
}
