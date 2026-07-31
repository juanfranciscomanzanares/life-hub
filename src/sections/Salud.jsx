import { useState } from "react";
import { HeartPulse, Plus, Trash2, Moon, Footprints, Droplet, Scale, Watch } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle, todayISO } from "../lib/ui";

import { nuevoId } from "../lib/id";
// Vacío a propósito: estos cuatro días eran de ejemplo y se guardaban como
// reales. Además falseaban el patrón de sueño frente a gimnasio de Analítica.
const INITIAL_HEALTH = [];

const empty = { fecha: "", peso: "", sueno: "", pasos: "", fc: "", agua: "" };

export default function Salud() {
  const [log, setLog] = usePersisted("lh_health", INITIAL_HEALTH);
  const [perfil, setPerfil] = usePersisted("lh_salud_perfil", { altura: 175, objetivo: 72 });
  const [ajustes] = usePersisted("lh_settings", { metaAgua: 2 });
  const metaAgua = Number(ajustes.metaAgua) || 2;
  const [form, setForm] = useState(empty);

  const sorted = [...log].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const last = sorted[0] || {};
  const recent = sorted.slice(0, 7);
  const avg = (k) => (recent.length ? Math.round((recent.reduce((a, b) => a + Number(b[k] || 0), 0) / recent.length) * 10) / 10 : 0);

  const pesos = [...log].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-10);
  const minP = Math.min(...pesos.map((p) => p.peso));
  const maxP = Math.max(...pesos.map((p) => p.peso));
  const range = maxP - minP || 1;

  const add = () => {
    if (!form.peso && !form.sueno && !form.pasos && !form.fc && !form.agua) return;
    setLog([
      {
        id: nuevoId(),
        fecha: form.fecha || todayISO(),
        peso: Number(form.peso) || 0,
        sueno: Number(form.sueno) || 0,
        pasos: Number(form.pasos) || 0,
        fc: Number(form.fc) || 0,
        agua: Number(form.agua) || 0,
      },
      ...log,
    ]);
    setForm(empty);
  };

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const kpis = [
    { label: "Peso", value: last.peso ? `${last.peso} kg` : "—", icon: Scale, color: "text-indigo-400 bg-indigo-500/15" },
    { label: "Sueño (media 7d)", value: `${avg("sueno")} h`, icon: Moon, color: "text-sky-400 bg-sky-500/15" },
    { label: "Pasos (media 7d)", value: avg("pasos").toLocaleString("es-ES"), icon: Footprints, color: "text-emerald-400 bg-emerald-500/15" },
    { label: "FC reposo", value: last.fc ? `${last.fc} ppm` : "—", icon: HeartPulse, color: "text-rose-400 bg-rose-500/15" },
  ];

  return (
    <div>
      <SectionTitle icon={HeartPulse} title="Salud" subtitle="Tu bienestar físico día a día" />

      {/* Aviso de reloj */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-800/60 bg-sky-500/10 p-4">
        <Watch size={20} className="mt-0.5 shrink-0 text-sky-300" />
        <p className="text-sm text-sky-100/90">
          Cuando conectes tu reloj (Apple Watch, Garmin, Fitbit…), estos campos —peso, sueño, pasos, frecuencia
          cardíaca, calorías, agua— podrán rellenarse automáticamente. De momento puedes registrarlos a mano.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.color}`}><Icon size={20} /></div>
              <div>
                <p className="text-xl font-bold text-slate-100">{k.value}</p>
                <p className="text-xs text-slate-400">{k.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* IMC, objetivo e hidratación */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100"><Scale size={18} className="text-indigo-400" /> IMC y objetivo</h2>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Altura (cm)</label>
            <input type="number" value={perfil.altura} onChange={(e) => setPerfil({ ...perfil, altura: Number(e.target.value) || 0 })} className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Peso objetivo (kg)</label>
            <input type="number" step="0.1" value={perfil.objetivo} onChange={(e) => setPerfil({ ...perfil, objetivo: Number(e.target.value) || 0 })} className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none" />
          </div>
          {(() => {
            const imc = last.peso && perfil.altura ? last.peso / Math.pow(perfil.altura / 100, 2) : 0;
            const cat = imc < 18.5 ? "Bajo peso" : imc < 25 ? "Normal" : imc < 30 ? "Sobrepeso" : "Obesidad";
            const col = imc < 18.5 ? "text-sky-400" : imc < 25 ? "text-emerald-400" : imc < 30 ? "text-amber-400" : "text-rose-400";
            return (
              <div className="ml-auto text-right">
                <p className={`text-2xl font-bold ${col}`}>{imc ? imc.toFixed(1) : "—"}</p>
                <p className="text-xs text-slate-400">IMC · {imc ? cat : "sin datos"}</p>
              </div>
            );
          })()}
        </div>
        {last.peso > 0 && perfil.objetivo > 0 && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>Actual: {last.peso} kg</span>
              <span>{last.peso > perfil.objetivo ? `Faltan ${(last.peso - perfil.objetivo).toFixed(1)} kg` : "¡Objetivo alcanzado!"}</span>
              <span>Meta: {perfil.objetivo} kg</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${Math.min(100, (perfil.objetivo / last.peso) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="mt-4 rounded-xl border border-sky-800/50 bg-sky-500/10 p-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-sky-200"><Droplet size={15} /> Hidratación de hoy</span>
            <span className="text-slate-300">{last.agua || 0} / {metaAgua} L</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(100, ((last.agua || 0) / metaAgua) * 100)}%` }} />
          </div>
        </div>
      </Card>

      {/* Evolución del peso */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100"><Scale size={18} className="text-indigo-400" /> Evolución del peso</h2>
        {pesos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Registra tu peso para ver la evolución.</p>
        ) : (
          <div className="flex h-40 items-end justify-between gap-2">
            {pesos.map((p) => (
              <div key={p.id} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] text-slate-400">{p.peso}</span>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400" style={{ height: `${20 + ((p.peso - minP) / range) * 80}%` }} title={`${p.fecha}: ${p.peso} kg`} />
                </div>
                <span className="text-[10px] text-slate-500">{p.fecha.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Registro diario */}
      <Card className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100"><Droplet size={18} className="text-sky-400" /> Registrar día</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
          <input type="number" step="0.1" placeholder="Peso kg" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} className={inputCls} />
          <input type="number" step="0.1" placeholder="Sueño h" value={form.sueno} onChange={(e) => setForm({ ...form, sueno: e.target.value })} className={inputCls} />
          <input type="number" placeholder="Pasos" value={form.pasos} onChange={(e) => setForm({ ...form, pasos: e.target.value })} className={inputCls} />
          <input type="number" placeholder="FC ppm" value={form.fc} onChange={(e) => setForm({ ...form, fc: e.target.value })} className={inputCls} />
          <input type="number" step="0.1" placeholder="Agua L" value={form.agua} onChange={(e) => setForm({ ...form, agua: e.target.value })} className={inputCls} />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={add} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"><Plus size={15} /> Guardar</button>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Peso</th>
              <th className="px-5 py-3 font-medium">Sueño</th>
              <th className="px-5 py-3 font-medium">Pasos</th>
              <th className="px-5 py-3 font-medium">FC</th>
              <th className="px-5 py-3 font-medium">Agua</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-400">{r.fecha}</td>
                <td className="px-5 py-3 text-slate-200">{r.peso || "—"}{r.peso ? " kg" : ""}</td>
                <td className="px-5 py-3 text-slate-300">{r.sueno || "—"}{r.sueno ? " h" : ""}</td>
                <td className="px-5 py-3 text-slate-300">{r.pasos ? r.pasos.toLocaleString("es-ES") : "—"}</td>
                <td className="px-5 py-3 text-slate-300">{r.fc || "—"}</td>
                <td className="px-5 py-3 text-slate-300">{r.agua || "—"}{r.agua ? " L" : ""}</td>
                <td className="px-5 py-3 text-right"><button onClick={() => removeWithUndo(log, setLog, r.id, "Registro")} className="text-slate-500 transition hover:text-rose-400"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
