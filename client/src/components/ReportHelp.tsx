import { useState } from "react";

export function ReportHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/90 via-white to-cyan-50/40 shadow-dash">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold text-brand-950 transition hover:bg-white/40"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-600/10 text-xs font-bold text-brand-700">
            ?
          </span>
          How to use this report
        </span>
        <span className="rounded-md bg-white/70 px-2 py-0.5 text-brand-700 shadow-dash-sm">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-brand-100/80 px-4 pb-4 pt-3 text-sm text-slate-700">
          <p>
            Pick your <strong>reporting quarter</strong>, then tap a <strong>region</strong>,{" "}
            <strong>country</strong>, or <strong>engagement</strong> to see more detail. Numbers come
            from the same quarterly reports your teams submit.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>
              <strong>Change vs last quarter</strong> — % up or down compared to the previous
              quarter-end.
            </li>
            <li>
              <strong>MBB</strong> — Muslim-background believers (estimated from your MBB %).
            </li>
            <li>
              <strong>Population</strong> — people group size when we have it on file.
            </li>
            <li>
              <strong>Needs attention</strong> — engagements in the system with no row for the selected
              quarter, and how many quarters they have not reported.
            </li>
            <li>
              <strong>Report gaps</strong> — fields still empty; use this before quarter close.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
