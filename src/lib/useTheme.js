import { useState, useEffect } from "react";

/*
  Color de acento.

  Todo el código usa clases `indigo-*` para el color principal (botones,
  enlaces, foco, gráficas), y esas clases apuntan a las variables
  --c-indigo-*. Así que cambiar el acento es solo redefinir esas variables:
  se hace en src/index.css según `html[data-accent]`, y no hay que tocar ni un
  componente.

  El nombre "indigo" se queda como está a propósito: renombrarlo a algo
  neutro obligaría a repasar cientos de clases por toda la app para no ganar
  nada funcional.
*/
export const ACENTOS = [
  { id: "indigo", nombre: "Índigo", muestra: "#6366f1" },
  { id: "violeta", nombre: "Violeta", muestra: "#8b5cf6" },
  { id: "cian", nombre: "Cian", muestra: "#0ea5e9" },
  { id: "esmeralda", nombre: "Esmeralda", muestra: "#10b981" },
  { id: "ambar", nombre: "Ámbar", muestra: "#d97706" },
  { id: "rosa", nombre: "Rosa", muestra: "#f43f5e" },
];

export function useAccent() {
  const [accent, setAccent] = useState(() => localStorage.getItem("lh_accent") || "indigo");

  useEffect(() => {
    const valido = ACENTOS.some((a) => a.id === accent) ? accent : "indigo";
    document.documentElement.dataset.accent = valido;
    localStorage.setItem("lh_accent", valido);
  }, [accent]);

  return { accent, setAccent };
}

// Tema claro/oscuro persistente (se aplica en <html data-theme>).
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("lh_theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lh_theme", theme);
    // La barra del navegador (y la de estado en iOS) sigue al tema; si no, en
    // claro se quedaba una franja oscura arriba.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f8fafc" : "#020617");
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}
