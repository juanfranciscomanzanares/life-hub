import { useEffect } from "react";
import { usePersisted } from "./store";

/*
  Avisa (notificación del navegador) unos minutos antes de cada actividad de la
  rutina semanal, mientras la app está abierta. Recuerda lo ya avisado por día
  para no repetir. Ajustable con `antesMin` (minutos de antelación).
*/
export function useRoutineNotifier(antesMin = 30) {
  const [routine] = usePersisted("lh_routine", []);

  useEffect(() => {
    const avisados = new Set();
    const tick = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const now = new Date();
      const hoy = (now.getDay() + 6) % 7;
      routine
        .filter((r) => Number(r.dia) === hoy)
        .forEach((r) => {
          const [h, m] = r.hora.split(":").map(Number);
          const target = new Date(now);
          target.setHours(h, m, 0, 0);
          const diffMin = (target - now) / 60000;
          const clave = `${now.toDateString()}-${r.id}`;
          if (diffMin > 0 && diffMin <= antesMin && !avisados.has(clave)) {
            avisados.add(clave);
            try {
              new Notification("Pronto: " + r.titulo, { body: `${r.hora} · ${r.tipo}` });
            } catch {
              /* ignore */
            }
          }
        });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [routine, antesMin]);
}
