import { useEffect } from "react";

/*
  Todo lo que entra en las copias, automáticas y manuales.

  Se había quedado atrás: guardaba `lh_tt_drills` y `lh_tt_notes`, que son de
  una versión antigua de la sección de tenis y ya no existen, y en cambio
  faltaban las seis claves `lh_tenis_*` que sí se usan ahora, las rutinas y
  ejercicios del gimnasio y los ajustes. Una copia a la que le faltan claves
  parece completa hasta el día que la necesitas.
*/
export const ALL_KEYS = [
  // Generales
  "lh_tasks", "lh_settings", "lh_events", "lh_routine", "lh_reminders", "lh_goals", "lh_notes",
  // Universidad
  "lh_uni_tasks", "lh_study_hours", "lh_study_log", "lh_aula_tareas", "lh_aula_usuario",
  // Trabajo
  "lh_work_log", "lh_runbooks",
  // Gimnasio
  "lh_gym", "lh_gym_sesiones", "lh_gym_rutinas", "lh_gym_ejercicios",
  // Tenis de mesa
  "lh_tt_sesiones", "lh_tt_semanas", "lh_tt_mejoras",
  "lh_tenis_partidos", "lh_tenis_opens", "lh_tenis_rondas", "lh_tenis_oficiales",
  "lh_tenis_ficha", "lh_tenis_revisiones", "lh_tenis_config",
  // Dinero
  "lh_finance", "lh_budgets", "lh_budget_mensual", "lh_savings", "lh_subs", "lh_ingresos_fijos",
  "lh_investments", "lh_contribs", "lh_invest_goal", "lh_portfolio_history",
  "lh_banco_reglas", "lh_banco_conexion",
  // Salud y hábitos
  "lh_health", "lh_salud_perfil", "lh_habits",
];

const MAX_SNAPSHOTS = 6;

function snapshotNow() {
  const dump = {};
  ALL_KEYS.forEach((k) => {
    const v = localStorage.getItem(k);
    if (v !== null) dump[k] = v;
  });
  return dump;
}

// Guarda automáticamente puntos de restauración (los últimos MAX_SNAPSHOTS).
export function useAutoBackup(intervaloMin = 20) {
  useEffect(() => {
    const guardar = () => {
      const data = snapshotNow();
      const serial = JSON.stringify(data);
      let snaps = [];
      try {
        snaps = JSON.parse(localStorage.getItem("lh_snapshots") || "[]");
      } catch {
        snaps = [];
      }
      if (snaps.length && JSON.stringify(snaps[0].data) === serial) return;
      snaps.unshift({ fecha: new Date().toISOString(), data });
      snaps = snaps.slice(0, MAX_SNAPSHOTS);
      localStorage.setItem("lh_snapshots", JSON.stringify(snaps));
      localStorage.setItem("lh_autobackup", JSON.stringify({ fecha: new Date().toISOString(), data }));
    };
    guardar();
    const id = setInterval(guardar, intervaloMin * 60000);
    return () => clearInterval(id);
  }, [intervaloMin]);
}

export function restoreSnapshot(data) {
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
}
