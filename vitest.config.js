import { defineConfig } from "vitest/config";

// Config de tests independiente (no carga el plugin de React para poder
// ejecutar los tests de lógica pura sin dependencias de UI).
export default defineConfig({
  /*
    JSX con el runtime automático, el mismo que usa la app. Sin esto esbuild lo
    compila al modo clásico (React.createElement) y los tests que sí montan
    componentes fallan con "React is not defined", porque desde React 17 ya no
    hace falta importar React para escribir JSX.
  */
  esbuild: { jsx: "automatic" },
  test: {
    /*
      "node" por defecto: casi todos los tests son de lógica pura y levantar un
      DOM para cada uno multiplicaría lo que tardan. Los que necesitan navegador
      lo piden archivo a archivo con `// @vitest-environment jsdom` en la
      primera línea (ver store.sync.test.jsx).
    */
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
