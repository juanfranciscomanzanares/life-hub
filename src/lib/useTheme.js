import { useState, useEffect } from "react";

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
