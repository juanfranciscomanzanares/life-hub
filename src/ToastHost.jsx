import { useState, useEffect } from "react";
import { Undo2, X } from "lucide-react";
import { subscribe } from "./lib/toast";

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribe((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 5000);
    });
  }, []);

  const cerrar = (id) => setToasts((prev) => prev.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 shadow-xl">
          <span>{t.mensaje}</span>
          {t.onUndo && (
            <button
              onClick={() => { t.onUndo(); cerrar(t.id); }}
              className="flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              <Undo2 size={13} /> Deshacer
            </button>
          )}
          <button onClick={() => cerrar(t.id)} className="text-slate-500 hover:text-slate-300"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
