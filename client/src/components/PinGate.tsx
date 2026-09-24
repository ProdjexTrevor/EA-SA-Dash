import { FormEvent, useState } from "react";

const PIN = "16331";
const STORAGE_KEY = "ea-sa-dash.unlocked";

function alreadyUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(alreadyUnlocked);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (pin.trim() === PIN) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* private mode */
      }
      setUnlocked(true);
      return;
    }
    setError("That PIN is not correct.");
    setPin("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mesh-main px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-700 shadow-glow ring-1 ring-white/20"
            aria-hidden
          >
            <span className="absolute inset-1 rounded-[0.65rem] border border-white/25" />
            <span className="text-sm font-bold tracking-tight text-white">EA</span>
          </div>
          <div>
            <p className="text-lg font-bold leading-tight text-slate-900">EA-SA Dash</p>
            <p className="text-sm text-slate-600">Enter the site PIN to continue</p>
          </div>
        </div>

        <form onSubmit={submit} className="dash-panel-solid p-6 sm:p-7">
          <label htmlFor="site-pin" className="block text-sm font-semibold text-slate-700">
            PIN
          </label>
          <input
            id="site-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              if (error) setError(null);
            }}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-xl tracking-[0.35em] text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "site-pin-error" : undefined}
          />
          {error && (
            <p id="site-pin-error" className="mt-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-dash hover:from-emerald-500 hover:to-teal-600"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
