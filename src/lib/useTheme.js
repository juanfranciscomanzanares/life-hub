import { useState, useEffect } from "react";

// Tema claro/oscuro persistente (se aplica en <html data-theme>).
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("lh_theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lh_theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}
