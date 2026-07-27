import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true permite abrir la app desde el móvil en la misma red WiFi
export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    /*
      Source maps en producción. Sin esto, un error en el móvil solo dice
      "index-GCam0rIl.js:46:24078", que no sirve para nada. El código ya es
      público en GitHub, así que no exponemos nada nuevo.
    */
    sourcemap: true,
  },
});
