import { useState } from "react";

export function ReportHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/50">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-brand-900"
        onClick={() => setOpen((v) => !v)}
      >
        How to use this report
        <span className="text-brand-600">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-slate-700 space-y-2 border-t border-brand-100">
          <p>
            Pick your <strong>reporting quarter</strong>, then tap a <strong>region</strong>, <strong>country</strong>, or{" "}
            <strong>engagement</strong> to see more detail. Numbers come from the same quarterly reports your teams submit.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>
              <strong>Change vs last quarter</strong> — % up or down compared to the previous quarter-end.
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
