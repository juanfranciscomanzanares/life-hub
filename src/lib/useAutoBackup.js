import { useEffect } from "react";

export const ALL_KEYS = [
  "lh_tasks", "lh_gym", "lh_work_log", "lh_runbooks", "lh_uni_tasks", "lh_study_hours",
  "lh_tt_drills", "lh_tt_notes", "lh_finance", "lh_investments", "lh_contribs",
  "lh_invest_goal", "lh_habits", "lh_notes", "lh_goals", "lh_portfolio_history",
  "lh_events", "lh_routine", "lh_reminders", "lh_health", "lh_srs", "lh_adjuntos",
  "lh_gym_sesiones", "lh_gym_rutinas", "lh_gym_ejercicios",
  "lh_budgets", "lh_budget_mensual", "lh_savings", "lh_subs", "lh_banco_reglas",
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
