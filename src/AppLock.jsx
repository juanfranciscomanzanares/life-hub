import { useState, useEffect } from "react";
import { Lock, Fingerprint } from "lucide-react";
import { isLockEnabled, hasBiometric, verifyPin, verifyBiometric } from "./lib/lock";

/*
  Envuelve la app. Si el bloqueo está activado, muestra una pantalla de acceso
  (biometría o PIN) antes de dejar ver el contenido.
*/
export default function AppLock({ children }) {
  const [locked, setLocked] = useState(isLockEnabled());
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const bio = hasBiometric();

  const tryBiometric = async () => {
    setError("");
    try {
      if (await verifyBiometric()) setLocked(false);
    } catch {
      setError("Biometría cancelada. Usa el PIN.");
    }
  };

  useEffect(() => {
    if (locked && bio) tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPin = async () => {
    if (await verifyPin(pin)) {
      setLocked(false);
      setPin("");
    } else {
      setError("PIN incorrecto.");
      setPin("");
    }
  };

  if (!locked) return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
      <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
          <Lock size={26} />
        </div>
        <h1 className="mb-1 text-lg font-bold text-slate-100">Life Hub bloqueado</h1>
        <p className="mb-5 text-sm text-slate-400">Introduce tu PIN para continuar.</p>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitPin()}
          placeholder="PIN"
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-lg tracking-widest text-slate-100 focus:border-indigo-500 focus:outline-none"
          autoFocus
        />
        <button onClick={submitPin} className="mb-3 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
          Desbloquear
        </button>

        {bio && (
          <button onClick={tryBiometric} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            <Fingerprint size={16} /> Usar Face ID / huella
          </button>
        )}

        {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
