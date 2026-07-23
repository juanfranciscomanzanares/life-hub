import { defineConfig } from "vitest/config";

// Config de tests independiente (no carga el plugin de React para poder
// ejecutar los tests de lógica pura sin dependencias de UI).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
