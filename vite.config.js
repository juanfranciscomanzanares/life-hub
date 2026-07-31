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
    rollupOptions: {
      output: {
        /*
          Las librerías, en trozos aparte de nuestro código.

          No es para descargar menos la primera vez —React y Supabase hacen
          falta igual—, sino para no volver a descargarlos en CADA despliegue.
          El nombre del archivo lleva un hash del contenido: si todo va junto,
          tocar una línea de una sección cambia el hash del bundle entero y el
          móvil se baja otra vez los 130 kB completos. Separados, un despliegue
          normal solo invalida el trozo de la app.

          Con esto Supabase queda además aislado, que era la idea de
          "cargarlo en diferido". Diferirlo de verdad con import() no serviría
          aquí: App.jsx llama a supabase.auth nada más arrancar para saber si
          enseñar el login o el panel, así que la descarga ocurriría igual, solo
          que en una segunda petición y con toda la capa de datos vuelta del
          revés a async.
        */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase") || id.includes("postgrest") || id.includes("realtime-js") || id.includes("gotrue"))
            return "supabase";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler"))
            return "react";
        },
      },
    },
  },
});
