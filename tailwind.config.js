/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      /*
        Inter para el texto corrido y Space Grotesk (font-display) para títulos
        y cifras grandes. Las dos llegan por npm (@fontsource-variable), no por
        CDN, y se importan en index.css.
      */
      fontFamily: {
        sans: ["Inter Variable", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk Variable", "Inter Variable", "system-ui", "sans-serif"],
      },
      /*
        Los colores apuntan a variables CSS en vez de a valores fijos, para que
        el tema claro se consiga cambiando la paleta y no invirtiendo la página
        entera con un filtro. Los valores están en src/index.css.

        El formato "rgb(var(--x) / <alpha-value>)" es imprescindible para que
        sigan funcionando los modificadores de opacidad, que aquí se usan mucho
        (bg-indigo-500/15, bg-emerald-500/10...).

        Solo se declaran los tonos que el proyecto usa de verdad. Si añades uno
        nuevo, decláralo también en index.css o saldrá transparente.
      */
      colors: {
        slate: {
          100: "rgb(var(--c-slate-100) / <alpha-value>)",
          200: "rgb(var(--c-slate-200) / <alpha-value>)",
          300: "rgb(var(--c-slate-300) / <alpha-value>)",
          400: "rgb(var(--c-slate-400) / <alpha-value>)",
          500: "rgb(var(--c-slate-500) / <alpha-value>)",
          600: "rgb(var(--c-slate-600) / <alpha-value>)",
          700: "rgb(var(--c-slate-700) / <alpha-value>)",
          800: "rgb(var(--c-slate-800) / <alpha-value>)",
          900: "rgb(var(--c-slate-900) / <alpha-value>)",
          950: "rgb(var(--c-slate-950) / <alpha-value>)",
        },
        indigo: {
          300: "rgb(var(--c-indigo-300) / <alpha-value>)",
          400: "rgb(var(--c-indigo-400) / <alpha-value>)",
          500: "rgb(var(--c-indigo-500) / <alpha-value>)",
          600: "rgb(var(--c-indigo-600) / <alpha-value>)",
        },
        emerald: {
          300: "rgb(var(--c-emerald-300) / <alpha-value>)",
          400: "rgb(var(--c-emerald-400) / <alpha-value>)",
          500: "rgb(var(--c-emerald-500) / <alpha-value>)",
          600: "rgb(var(--c-emerald-600) / <alpha-value>)",
          800: "rgb(var(--c-emerald-800) / <alpha-value>)",
        },
        amber: {
          300: "rgb(var(--c-amber-300) / <alpha-value>)",
          400: "rgb(var(--c-amber-400) / <alpha-value>)",
          500: "rgb(var(--c-amber-500) / <alpha-value>)",
          600: "rgb(var(--c-amber-600) / <alpha-value>)",
          800: "rgb(var(--c-amber-800) / <alpha-value>)",
        },
        rose: {
          200: "rgb(var(--c-rose-200) / <alpha-value>)",
          300: "rgb(var(--c-rose-300) / <alpha-value>)",
          400: "rgb(var(--c-rose-400) / <alpha-value>)",
          500: "rgb(var(--c-rose-500) / <alpha-value>)",
          800: "rgb(var(--c-rose-800) / <alpha-value>)",
          900: "rgb(var(--c-rose-900) / <alpha-value>)",
        },
        sky: {
          100: "rgb(var(--c-sky-100) / <alpha-value>)",
          200: "rgb(var(--c-sky-200) / <alpha-value>)",
          300: "rgb(var(--c-sky-300) / <alpha-value>)",
          400: "rgb(var(--c-sky-400) / <alpha-value>)",
          500: "rgb(var(--c-sky-500) / <alpha-value>)",
          700: "rgb(var(--c-sky-700) / <alpha-value>)",
          800: "rgb(var(--c-sky-800) / <alpha-value>)",
        },
        fuchsia: {
          300: "rgb(var(--c-fuchsia-300) / <alpha-value>)",
          400: "rgb(var(--c-fuchsia-400) / <alpha-value>)",
          500: "rgb(var(--c-fuchsia-500) / <alpha-value>)",
          800: "rgb(var(--c-fuchsia-800) / <alpha-value>)",
        },
        teal: {
          300: "rgb(var(--c-teal-300) / <alpha-value>)",
          500: "rgb(var(--c-teal-500) / <alpha-value>)",
        },
        /*
          Color de la sección abierta. No es un tono fijo: el shell pone
          `data-seccion` en el contenedor y index.css redefine estas variables
          según el área (gimnasio acero, tenis rojo, dinero verde...).
        */
        seccion: {
          300: "rgb(var(--c-seccion-300) / <alpha-value>)",
          400: "rgb(var(--c-seccion-400) / <alpha-value>)",
          500: "rgb(var(--c-seccion-500) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
