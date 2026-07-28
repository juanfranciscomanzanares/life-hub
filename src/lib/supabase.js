import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no hay credenciales, la app funciona en modo local (solo navegador).
export const cloudEnabled = Boolean(url && anonKey);

/*
  Almacenamiento a prueba de fallos.

  En Safari iOS en modo privado (y con algunas configuraciones de "bloquear
  cookies") localStorage lanza una excepción al escribir. Como este módulo se
  evalúa al cargar la app, esa excepción tumbaba TODA la app antes de pintar
  nada: pantalla en negro. Con este envoltorio, como mucho se pierde la sesión
  al cerrar, pero la app arranca.
*/
const memoria = new Map();
const almacenSeguro = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return memoria.has(k) ? memoria.get(k) : null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      memoria.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      memoria.delete(k);
    }
  },
};

export const supabase = cloudEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Lee el token que llega en la URL del enlace mágico y crea la sesión.
        detectSessionInUrl: true,
        /*
          "implicit" (token en el # de la URL) en lugar de PKCE.

          Con PKCE, el "code verifier" se guarda en el navegador que PIDIÓ el
          enlace. En el móvil el enlace casi siempre se abre desde la app de
          Gmail/Mail, que usa su propio navegador embebido: allí no existe ese
          verifier y el login falla. Con implicit el enlace funciona se abra
          donde se abra.
        */
        flowType: "implicit",
        storage: almacenSeguro,
      },
    })
  : null;
