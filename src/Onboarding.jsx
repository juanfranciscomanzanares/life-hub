import { useState, useCallback } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { useDialogo } from "./lib/useDialogo";

const PASOS = [
  { emoji: "👋", titulo: "Bienvenido a Life Hub", texto: "Tu panel personal para trabajo, universidad, deporte, finanzas, inversiones y salud, todo en un sitio." },
  { emoji: "⚡", titulo: "Añade rápido", texto: "Usa el botón + (abajo a la derecha) para registrar un gasto, una marca de gym o una tarea desde cualquier pantalla." },
  { emoji: "🔎", titulo: "Busca al instante", texto: "Pulsa Ctrl/Cmd + K para saltar a cualquier sección o encontrar algo que hayas guardado." },
  { emoji: "🗓️", titulo: "Tu rutina", texto: "Define tu rutina semanal en Calendario y la verás cada día en Inicio, con avisos antes de cada actividad." },
  { emoji: "☁️", titulo: "Tus datos, seguros", texto: "Todo se guarda en tu dispositivo. Puedes activar la nube (Supabase) para sincronizar PC y móvil, y un bloqueo con Face ID." },
];

export default function Onboarding() {
  const [visible, setVisible] = useState(() => localStorage.getItem("lh_onboarded") !== "1");
  const [i, setI] = useState(0);

  const cerrar = useCallback(() => {
    localStorage.setItem("lh_onboarded", "1");
    setVisible(false);
  }, []);

  /*
    El hook va ANTES del return temprano: las reglas de los hooks no permiten
    saltárselo cuando el onboarding ya está visto, que es casi siempre.
  */
  const refDialogo = useDialogo(visible, cerrar);

  if (!visible) return null;
  const paso = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div
        ref={refDialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-titulo"
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl"
      >
        <div aria-hidden="true" className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 text-4xl">{paso.emoji}</div>
        <h2 id="onboarding-titulo" className="mb-2 text-xl font-bold text-slate-100">{paso.titulo}</h2>
        <p className="mb-6 text-sm text-slate-400">{paso.texto}</p>

        {/* Los puntos son decorativos; el progreso real se anuncia en el texto
            del botón, que es lo que lee un lector de pantalla. */}
        <div aria-hidden="true" className="mb-5 flex justify-center gap-1.5">
          {PASOS.map((_, j) => (
            <span key={j} className={`h-1.5 rounded-full transition-all ${j === i ? "w-5 bg-indigo-400" : "w-1.5 bg-slate-700"}`} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={cerrar} className="text-sm text-slate-500 hover:text-slate-300">Saltar</button>
          {ultimo ? (
            <button onClick={cerrar} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400">
              <Sparkles size={16} /> Empezar
            </button>
          ) : (
            <button onClick={() => setI(i + 1)} className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
              Siguiente <span className="sr-only">(paso {i + 1} de {PASOS.length})</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
