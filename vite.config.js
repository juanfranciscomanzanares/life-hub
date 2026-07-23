import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true permite abrir la app desde el móvil en la misma red WiFi
export default defineConfig({
  plugins: [react()],
  server: { host: true },
});
