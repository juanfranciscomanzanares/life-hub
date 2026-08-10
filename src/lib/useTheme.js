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

/*
  `fijo` es el acento que impone el perfil (ver src/lib/perfiles.js). Cuando lo
  hay, manda sobre lo guardado y no se puede cambiar.

  Podría parecer más amable dejarlo solo como valor inicial, pero `lh_accent` es
  del DISPOSITIVO, no de la cuenta: en un navegador compartido Carmen heredaría
  el color que dejara Quico la última vez y su perfil no sería suyo. Con `fijo`
  el perfil se ve igual en cualquier navegador, que es justo lo que se pedía.

  Tampoco se escribe en `lh_accent`: si se guardara, al volver Quico se
  encontraría su acento cambiado por el paso de ella.
*/
export function useAccent(fijo = null) {
  const [accent, setAccent] = useState(() => localStorage.getItem("lh_accent") || "indigo");
  const impuesto = fijo && ACENTOS.some((a) => a.id === fijo) ? fijo : null;
  const activo = impuesto || accent;

  useEffect(() => {
    const valido = ACENTOS.some((a) => a.id === activo) ? activo : "indigo";
    document.documentElement.dataset.accent = valido;
    if (!impuesto) localStorage.setItem("lh_accent", valido);
  }, [activo, impuesto]);

  return { accent: activo, setAccent, fijado: Boolean(impuesto) };
}

/*
  El "mundo" de color del perfil: pone `data-perfil` en <html>, de donde cuelgan
  las variables --c-slate-* rosadas de src/index.css.

  Va aparte del acento porque son dos capas distintas: el acento tiñe botones y
  enlaces, y esto tiñe el fondo, las tarjetas y los bordes. Un perfil sin tema
  propio deja el atributo fuera y la app se ve como siempre.
*/
export function usePerfilTema(tema) {
  useEffect(() => {
    const raiz = document.documentElement;
    if (tema) raiz.dataset.perfil = tema;
    else delete raiz.dataset.perfil;
  }, [tema]);
}

/*
  El color de la barra del navegador, que tiene que ir a juego con el fondo real
  de la app. Son los mismos valores que --c-slate-950 de src/index.css: si los
  cambias allí, cámbialos aquí, porque una franja gris sobre un fondo rosa se ve
  igual de mal que la franja oscura sobre fondo claro que había antes.
*/
const BARRA = {
  "": { light: "#f8fafc", dark: "#020617" },
  rosa: { light: "#fdf6f8", dark: "#180a10" },
};

// Tema claro/oscuro persistente (se aplica en <html data-theme>).
export function useTheme(perfilTema = null) {
  const [theme, setTheme] = useState(() => localStorage.getItem("lh_theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lh_theme", theme);
    // La barra del navegador (y la de estado en iOS) sigue al tema; si no, en
    // claro se quedaba una franja oscura arriba.
    const meta = document.querySelector('meta[name="theme-color"]');
    const paleta = BARRA[perfilTema || ""] || BARRA[""];
    if (meta) meta.setAttribute("content", theme === "light" ? paleta.light : paleta.dark);
  }, [theme, perfilTema]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}
