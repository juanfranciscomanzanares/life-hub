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
  /*
    Comprobar el PIN ya no es instantáneo: se deriva con PBKDF2 y 200.000
    iteraciones (ver src/lib/lock.js), que en un móvil son unas décimas. Sin
    avisar, ese silencio parece que el botón no ha respondido y se pulsa otra
    vez.
  */
  const [comprobando, setComprobando] = useState(false);

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
    // Sin este cortafuegos, mantener pulsado Enter lanza una derivación por
    // repetición de tecla y el móvil se queda pillado.
    if (comprobando || !pin) return;
    setComprobando(true);
    setError("");
    try {
      if (await verifyPin(pin)) {
        setLocked(false);
        setPin("");
      } else {
        setError("PIN incorrecto.");
        setPin("");
      }
    } finally {
      setComprobando(false);
    }
  };

  if (!locked) return children;

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-slate-200">
      <div className="lh-card w-full max-w-xs p-8 text-center">
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
          aria-label="PIN"
          disabled={comprobando}
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-lg tracking-widest text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
          autoFocus
        />
        <button
          onClick={submitPin}
          disabled={comprobando}
          className="mb-3 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-70"
        >
          {comprobando ? "Comprobando…" : "Desbloquear"}
        </button>

        {bio && (
          <button onClick={tryBiometric} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            <Fingerprint size={16} aria-hidden="true" /> Usar Face ID / huella
          </button>
        )}

        {/* role=alert para que un lector de pantalla lo anuncie: el mensaje
            aparece sin que el foco se mueva a ningún sitio. */}
        {error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
