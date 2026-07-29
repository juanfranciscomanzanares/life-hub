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

/*
  El motivo real de que falle una Edge Function.

  Cuando la función responde con un código distinto de 2xx, supabase-js entrega
  un error cuyo `message` es siempre el mismo: "Edge Function returned a non-2xx
  status code". El motivo que escribió la función viaja en el cuerpo de la
  respuesta, que queda en `error.context`. Sin leerlo, cualquier fallo (usuario
  mal, sesión caducada, el servicio caído) se ve idéntico y no hay por dónde
  empezar a mirar.
*/
export async function motivoDelError(error, porDefecto = "No se pudo contactar con el servidor.") {
  try {
    const cuerpo = await error?.context?.json?.();
    if (cuerpo?.error) return String(cuerpo.error);
  } catch {
    // La respuesta no era JSON (un 502 del proxy, por ejemplo): nos quedamos
    // con el mensaje genérico, que al menos dice que no fue un 2xx.
  }
  return error?.message || porDefecto;
}

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
