import { CalendarClock, Download, GraduationCap, Bell, CalendarDays } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, downloadFile } from "../lib/ui";

const hoyISO = () => new Date().toISOString().slice(0, 10);

function diasHasta(fechaISO) {
  const hoy = new Date(hoyISO() + "T00:00:00");
  const d = new Date(fechaISO.slice(0, 10) + "T00:00:00");
  return Math.round((d - hoy) / 86400000);
}

function etiquetaDias(n) {
  if (n < 0) return "pasado";
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  return `en ${n} días`;
}

export default function Proximos() {
  const [events] = usePersisted("lh_events", []);
  const [reminders] = usePersisted("lh_reminders", []);

  // Unifica eventos (día) y recordatorios (fecha+hora)
  const items = [];
  events.forEach((e) => items.push({ id: "e" + e.id, fecha: e.fecha, titulo: e.titulo, tipo: e.titulo.toLowerCase().startsWith("examen") ? "Examen" : "Evento", hora: "" }));
  reminders.forEach((r) => items.push({ id: "r" + r.id, fecha: (r.cuando || "").slice(0, 10), titulo: r.titulo, tipo: "Recordatorio", hora: (r.cuando || "").slice(11, 16) }));

  const futuros = items
    .filter((i) => i.fecha && diasHasta(i.fecha) >= 0)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  const proximoExamen = futuros.find((i) => i.tipo === "Examen");

  const estilo = {
    Examen: "border-rose-800/60 bg-rose-500/10 text-rose-300",
    Evento: "border-fuchsia-800/60 bg-fuchsia-500/10 text-fuchsia-300",
    Recordatorio: "border-amber-800/60 bg-amber-500/10 text-amber-300",
  };
  const icono = { Examen: GraduationCap, Evento: CalendarDays, Recordatorio: Bell };

  // Exporta a .ics para el calendario del iPhone
  const exportarICS = () => {
    const pad = (n) => String(n).padStart(2, "0");
    const dt = (fecha, hora) => {
      const d = fecha.replace(/-/g, "");
      return hora ? `${d}T${hora.replace(":", "")}00` : d;
    };
    const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Life Hub//ES", "CALSCALE:GREGORIAN"];
    futuros.forEach((i) => {
      lineas.push("BEGIN:VEVENT");
      lineas.push(`UID:${i.id}@lifehub`);
      lineas.push(`DTSTAMP:${dt(hoyISO(), "")}T000000Z`);
      if (i.hora) lineas.push(`DTSTART:${dt(i.fecha, i.hora)}`);
      else lineas.push(`DTSTART;VALUE=DATE:${dt(i.fecha, "")}`);
      lineas.push(`SUMMARY:${i.titulo.replace(/,/g, "\\,")}`);
      lineas.push("END:VEVENT");
    });
    lineas.push("END:VCALENDAR");
    downloadFile("life-hub.ics", lineas.join("\r\n"), "text/calendar;charset=utf-8");
  };

  const imprimir = () => {
    const filas = futuros.map((i) => `<tr><td>${i.fecha}${i.hora ? " " + i.hora : ""}</td><td>${i.tipo}</td><td>${i.titulo}</td></tr>`).join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Agenda</title><style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#0f172a}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}</style></head><body><h1>Agenda · Life Hub</h1><p>${new Date().toLocaleDateString("es-ES")}</p><table>${filas}</table><scr` + `ipt>window.onload=()=>window.print()</scr` + `ipt></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div>
      <SectionTitle icon={CalendarClock} title="Próximos" subtitle="Exámenes, eventos y recordatorios que vienen" />

      {/* Cuenta atrás al próximo examen */}
      {proximoExamen && (
        <Card className="mb-6 flex items-center gap-4 border-rose-800/50 bg-rose-500/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300"><GraduationCap size={28} /></div>
          <div className="flex-1">
            <p className="text-sm text-rose-200/80">Próximo examen</p>
            <p className="text-lg font-bold text-slate-100">{proximoExamen.titulo.replace("Examen: ", "")}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-rose-300">{diasHasta(proximoExamen.fecha)}</p>
            <p className="text-xs text-slate-400">días ({proximoExamen.fecha})</p>
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button onClick={imprimir} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">Imprimir agenda</button>
        <button onClick={exportarICS} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
          <Download size={16} /> Exportar a calendario (.ics)
        </button>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Agenda</h2>
        {futuros.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nada próximo. Añade exámenes/eventos en Calendario o recordatorios en Datos.</p>
        ) : (
          <ul className="space-y-2">
            {futuros.map((i) => {
              const Icon = icono[i.tipo];
              const n = diasHasta(i.fecha);
              return (
                <li key={i.id} className={`flex items-center gap-3 rounded-xl border p-3 ${estilo[i.tipo]}`}>
                  <Icon size={18} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-100">{i.titulo}</p>
                    <p className="text-xs text-slate-400">{i.fecha}{i.hora ? ` · ${i.hora}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${n <= 3 ? "bg-rose-500/20 text-rose-200" : "bg-slate-800 text-slate-300"}`}>
                    {etiquetaDias(n)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
