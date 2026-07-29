import { useState, useEffect } from "react";
import { Database, Download, Upload, Bell, Plus, Trash2, FileSpreadsheet, FileText, Lock, Fingerprint } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, exportCSV, downloadFile, MONTHS } from "../lib/ui";
import { isLockEnabled, hasBiometric, biometricSupported, enableLock, disableLock, registerBiometric } from "../lib/lock";
import { encryptJSON, decryptJSON } from "../lib/crypto";
import { restoreSnapshot } from "../lib/useAutoBackup";

const DATASETS = [
  { key: "lh_gym", file: "gimnasio.csv", label: "Gimnasio" },
  { key: "lh_work_log", file: "trabajo_agrosana.csv", label: "Trabajo (Agrosana)" },
  { key: "lh_finance", file: "finanzas.csv", label: "Finanzas" },
  { key: "lh_contribs", file: "aportaciones.csv", label: "Aportaciones" },
  { key: "lh_investments", file: "inversiones.csv", label: "Inversiones" },
];

const ALL_KEYS = [
  "lh_tasks", "lh_gym", "lh_work_log", "lh_runbooks", "lh_uni_tasks", "lh_study_hours",
  "lh_tt_drills", "lh_tt_notes", "lh_finance", "lh_investments", "lh_contribs",
  "lh_invest_goal", "lh_habits", "lh_notes", "lh_goals", "lh_portfolio_history", "lh_events", "lh_reminders",
  "lh_gym_sesiones", "lh_gym_rutinas", "lh_gym_ejercicios", "lh_aula_tareas",
  "lh_budgets", "lh_budget_mensual", "lh_savings", "lh_subs", "lh_banco_reglas",
];

function readKey(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function Datos() {
  const [reminders, setReminders] = usePersisted("lh_reminders", []);
  const [form, setForm] = useState({ cuando: "", titulo: "", repetir: "una vez" });
  const [permiso, setPermiso] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  // Comprueba recordatorios vencidos cada 30s y lanza notificación
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setReminders((prev) => {
        let changed = false;
        const upd = prev.map((r) => {
          if (!r.avisado && new Date(r.cuando).getTime() <= now) {
            changed = true;
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try { new Notification("Life Hub", { body: r.titulo }); } catch {}
            }
            if (r.repetir === "diario" || r.repetir === "semanal") {
              const next = new Date(r.cuando);
              next.setDate(next.getDate() + (r.repetir === "semanal" ? 7 : 1));
              const p2 = (n) => String(n).padStart(2, "0");
              const nc = `${next.getFullYear()}-${p2(next.getMonth() + 1)}-${p2(next.getDate())}T${p2(next.getHours())}:${p2(next.getMinutes())}`;
              return { ...r, cuando: nc, avisado: false };
            }
            return { ...r, avisado: true };
          }
          return r;
        });
        return changed ? upd : prev;
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [setReminders]);

  const pedirPermiso = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermiso(p);
  };

  const addReminder = () => {
    if (!form.cuando || !form.titulo.trim()) return;
    setReminders([...reminders, { id: Date.now(), cuando: form.cuando, titulo: form.titulo, avisado: false, repetir: form.repetir }]);
    setForm({ cuando: "", titulo: "", repetir: form.repetir });
  };

  const exportarCSV = (key, file) => {
    const data = readKey(key, []);
    if (!Array.isArray(data) || data.length === 0) {
      alert("No hay datos para exportar en esta sección todavía.");
      return;
    }
    exportCSV(file, data);
  };

  const backup = () => {
    const dump = {};
    ALL_KEYS.forEach((k) => {
      const v = window.localStorage.getItem(k);
      if (v !== null) dump[k] = JSON.parse(v);
    });
    const fecha = new Date().toISOString().slice(0, 10);
    downloadFile(`life-hub-backup-${fecha}.json`, JSON.stringify(dump, null, 2), "application/json");
  };

  const restaurar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        Object.entries(data).forEach(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)));
        alert("Copia restaurada. La página se recargará para aplicar los cambios.");
        window.location.reload();
      } catch {
        alert("El archivo no es una copia válida.");
      }
    };
    reader.readAsText(file);
  };

  const restaurarAuto = () => {
    try {
      const raw = localStorage.getItem("lh_autobackup");
      if (!raw) return alert("Aún no hay copia automática guardada.");
      const { fecha, data } = JSON.parse(raw);
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
      alert("Restaurada la copia automática de " + new Date(fecha).toLocaleString("es-ES") + ". Se recargará la página.");
      window.location.reload();
    } catch {
      alert("No se pudo restaurar la copia automática.");
    }
  };

  const [snaps] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lh_snapshots") || "[]"); } catch { return []; }
  });
  const restaurarSnap = (data) => {
    restoreSnapshot(data);
    alert("Punto de restauración aplicado. Se recargará la página.");
    window.location.reload();
  };

  const backupCifrado = async () => {
    const pass = prompt("Elige una contraseña para cifrar la copia (no la olvides):");
    if (!pass) return;
    const dump = {};
    ALL_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v !== null) dump[k] = JSON.parse(v); });
    const cifrado = await encryptJSON(dump, pass);
    downloadFile(`life-hub-cifrado-${new Date().toISOString().slice(0, 10)}.json`, cifrado, "application/json");
  };

  const restaurarCifrado = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pass = prompt("Contraseña de la copia cifrada:");
    if (!pass) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = await decryptJSON(String(reader.result), pass);
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        alert("Copia cifrada restaurada. Se recargará la página.");
        window.location.reload();
      } catch {
        alert("Contraseña incorrecta o archivo no válido.");
      }
    };
    reader.readAsText(file);
  };

  // --- Informe mensual (PDF vía impresión del navegador) ---
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));

  const informe = () => {
    const [y, m] = mes.split("-");
    const inM = (f) => (f || "").slice(0, 7) === mes;
    const work = readKey("lh_work_log", []).filter((r) => inM(r.fecha));
    const gym = readKey("lh_gym", []).filter((r) => inM(r.fecha));
    const fin = readKey("lh_finance", []).filter((r) => inM(r.fecha));
    const contr = readKey("lh_contribs", []).filter((r) => inM(r.fecha));
    const health = readKey("lh_health", []).filter((r) => inM(r.fecha));

    const sum = (arr, k) => arr.reduce((a, b) => a + Number(b[k] || 0), 0);
    const ingresos = fin.filter((f) => f.monto > 0).reduce((a, b) => a + b.monto, 0);
    const gastos = fin.filter((f) => f.monto < 0).reduce((a, b) => a + Math.abs(b.monto), 0);
    const sueno = health.length ? (sum(health, "sueno") / health.length).toFixed(1) : "—";

    const fila = (k, v) => `<tr><td>${k}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${MONTHS[Number(m) - 1]} ${y}</title>
      <style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:640px;margin:40px auto;padding:0 20px}
      h1{margin-bottom:0}h2{color:#4f46e5;margin-top:28px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
      table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #eef2f7}
      .muted{color:#64748b}</style></head><body>
      <h1>Life Hub · Informe mensual</h1>
      <p class="muted">${MONTHS[Number(m) - 1]} ${y}</p>
      <h2>Trabajo (Agrosana)</h2><table>${fila("Horas totales", sum(work, "horas") + " h")}${fila("Actividades", work.length)}</table>
      <h2>Gimnasio</h2><table>${fila("Sesiones registradas", gym.length)}</table>
      <h2>Finanzas</h2><table>${fila("Ingresos", ingresos + " €")}${fila("Gastos", gastos + " €")}${fila("Balance", ingresos - gastos + " €")}</table>
      <h2>Inversión</h2><table>${fila("Aportado este mes", sum(contr, "monto") + " €")}</table>
      <h2>Salud</h2><table>${fila("Sueño medio", sueno + " h")}${fila("Días registrados", health.length)}</table>
      <p class="muted" style="margin-top:32px">Generado por Life Hub · usa Ctrl/Cmd+P → Guardar como PDF</p>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  // --- Bloqueo de la app ---
  const [lockOn, setLockOn] = useState(isLockEnabled());
  const [pin, setPin] = useState("");
  const [lockMsg, setLockMsg] = useState("");

  const activarLock = async () => {
    try {
      await enableLock(pin);
      setLockOn(true);
      setPin("");
      setLockMsg("Bloqueo activado. Se pedirá el PIN al abrir la app.");
    } catch (e) {
      setLockMsg(e.message);
    }
  };
  const quitarLock = () => { disableLock(); setLockOn(false); setLockMsg("Bloqueo desactivado."); };
  const registrarBio = async () => {
    try { await registerBiometric(); setLockMsg("Biometría registrada (Face ID / huella)."); }
    catch (e) { setLockMsg("No se pudo registrar la biometría: " + e.message); }
  };

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Database} title="Datos y recordatorios" subtitle="Exporta, haz copias y no olvides nada" />

      {/* Recordatorios */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Bell size={18} className="text-amber-400" /> Recordatorios
          </h2>
          {permiso !== "granted" && permiso !== "unsupported" && (
            <button onClick={pedirPermiso} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-400">
              Activar notificaciones
            </button>
          )}
          {permiso === "granted" && <span className="text-xs text-emerald-400">● Notificaciones activas</span>}
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <input type="datetime-local" value={form.cuando} onChange={(e) => setForm({ ...form, cuando: e.target.value })} className={inputCls} />
          <input placeholder="Recordatorio (entregar práctica, aportar al fondo...)" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={`flex-1 ${inputCls}`} />
          <select value={form.repetir} onChange={(e) => setForm({ ...form, repetir: e.target.value })} className={inputCls}>
            <option value="una vez">Una vez</option>
            <option value="diario">Cada día</option>
            <option value="semanal">Cada semana</option>
          </select>
          <button onClick={addReminder} className="flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
            <Plus size={15} /> Añadir
          </button>
        </div>

        <ul className="space-y-2">
          {reminders.length === 0 && <li className="py-2 text-center text-sm text-slate-500">Sin recordatorios.</li>}
          {reminders
            .slice()
            .sort((a, b) => a.cuando.localeCompare(b.cuando))
            .map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className={r.avisado ? "text-slate-500" : "text-slate-200"}>
                  <span className="text-slate-500">{r.cuando.replace("T", " ")}</span> · {r.titulo}
                  {r.avisado && <span className="ml-2 text-[10px] text-emerald-400">avisado</span>}
                </span>
                <button onClick={() => setReminders(reminders.filter((x) => x.id !== r.id))} className="text-slate-500 hover:text-rose-400">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Las notificaciones se muestran mientras la app está abierta en el navegador o instalada en el móvil.
        </p>
      </Card>

      {/* Exportar a CSV/Excel */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileSpreadsheet size={18} className="text-emerald-400" /> Exportar a Excel (CSV)
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DATASETS.map((d) => (
            <button
              key={d.key}
              onClick={() => exportarCSV(d.key, d.file)}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 transition hover:border-indigo-500 hover:bg-slate-700"
            >
              <Download size={15} /> {d.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Copia de seguridad */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Database size={18} className="text-indigo-400" /> Copia de seguridad completa
        </h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={backup} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
            <Download size={16} /> Descargar copia (JSON)
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            <Upload size={16} /> Restaurar copia
            <input type="file" accept="application/json" onChange={restaurar} className="hidden" />
          </label>
          <button onClick={restaurarAuto} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            Restaurar copia automática
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-800 pt-3">
          <button onClick={backupCifrado} className="flex items-center gap-2 rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500">
            <Lock size={16} /> Copia cifrada (contraseña)
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            <Upload size={16} /> Restaurar copia cifrada
            <input type="file" accept="application/json" onChange={restaurarCifrado} className="hidden" />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Descarga todo tu historial en un archivo. Útil para guardarlo a salvo o pasar los datos a otro dispositivo.
        </p>
      </Card>

      {/* Puntos de restauración */}
      <Card className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Database size={18} className="text-emerald-400" /> Puntos de restauración
        </h2>
        {snaps.length === 0 ? (
          <p className="text-sm text-slate-500">Se irán guardando automáticamente cada 20 min mientras usas la app.</p>
        ) : (
          <ul className="space-y-2">
            {snaps.map((sn, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="text-slate-300">{new Date(sn.fecha).toLocaleString("es-ES")}</span>
                <button onClick={() => restaurarSnap(sn.data)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-600">
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Como una papelera/máquina del tiempo: vuelve a un estado anterior si borraste algo por error.</p>
      </Card>

      {/* Informe mensual en PDF */}
      <Card className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileText size={18} className="text-amber-400" /> Informe mensual (PDF)
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputCls} />
          <button onClick={informe} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
            <FileText size={16} /> Generar informe
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Se abre una vista lista para imprimir. Elige "Guardar como PDF".</p>
      </Card>

      {/* Seguridad: bloqueo de la app */}
      <Card className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Lock size={18} className="text-rose-400" /> Bloqueo de la app
        </h2>
        {lockOn ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-emerald-400">● Bloqueo activado</span>
            {biometricSupported() && (
              <button onClick={registrarBio} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
                <Fingerprint size={16} /> {hasBiometric() ? "Volver a registrar Face ID" : "Registrar Face ID / huella"}
              </button>
            )}
            <button onClick={quitarLock} className="rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500">
              Desactivar bloqueo
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">PIN (mínimo 4 dígitos)</label>
              <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" className={inputCls} />
            </div>
            <button onClick={activarLock} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
              Activar bloqueo
            </button>
          </div>
        )}
        {lockMsg && <p className="mt-3 text-xs text-slate-400">{lockMsg}</p>}
        <p className="mt-2 text-xs text-slate-500">
          El PIN es el respaldo obligatorio; la biometría (Face ID / huella) es opcional y usa el sensor del dispositivo.
        </p>
      </Card>
    </div>
  );
}
