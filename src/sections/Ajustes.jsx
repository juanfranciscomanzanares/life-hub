import { Settings, RotateCcw } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";

export default function Ajustes() {
  const [aj, setAj] = usePersisted("lh_settings", { nombre: "Quico", metaAgua: 2, metaSueno: 8 });

  const set = (campo, valor) => setAj({ ...aj, [campo]: valor });
  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none";

  const rehacerTour = () => {
    localStorage.removeItem("lh_onboarded");
    alert("El tour de bienvenida volverá a aparecer al recargar.");
  };

  return (
    <div>
      <SectionTitle icon={Settings} title="Ajustes" subtitle="Personaliza tu Life Hub" />

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Perfil</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Tu nombre</label>
            <input value={aj.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputCls} />
            <p className="mt-1 text-[10px] text-slate-500">Se usa en el saludo de Inicio.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Meta de agua (L/día)</label>
            <input type="number" step="0.1" value={aj.metaAgua} onChange={(e) => set("metaAgua", Number(e.target.value) || 0)} className={inputCls} />
            <p className="mt-1 text-[10px] text-slate-500">Se usa en el medidor de hidratación (Salud).</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Meta de sueño (h/día)</label>
            <input type="number" step="0.5" value={aj.metaSueno} onChange={(e) => set("metaSueno", Number(e.target.value) || 0)} className={inputCls} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">General</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={rehacerTour} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            <RotateCcw size={16} /> Rehacer tour de bienvenida
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          El tema claro/oscuro y la búsqueda están en la barra lateral. Copias, cifrado y bloqueo, en Datos.
        </p>
      </Card>
    </div>
  );
}
