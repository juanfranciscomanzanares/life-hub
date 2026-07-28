import { useState, useEffect, useRef } from "react";
import { supabase, cloudEnabled } from "./supabase";

/*
  Capa de datos unificada con:
  - Persistencia local (localStorage), funciona sin conexión.
  - Sincronización en la nube (tabla app_state) si Supabase está configurado.
  - Tiempo real (Supabase Realtime): los cambios aparecen al instante en otros
    dispositivos.
  - Resolución de conflictos por marca de tiempo: si editas en dos sitios, gana
    la versión más reciente (updated_at).

  Cada clave guarda TODO su contenido en un único JSON, así que escribir es caro:
  añadir una fila al gimnasio reescribe el array entero. Por eso las escrituras
  van agrupadas (debounce) y las lecturas y suscripciones se comparten entre
  componentes.
*/

const metaKey = (key) => "lh_meta:" + key;
const getTs = (key) => localStorage.getItem(metaKey(key)) || "";
const setTs = (key, ts) => localStorage.setItem(metaKey(key), ts);

/*
  Marca de "cambiado y aún sin confirmar en el servidor".

  La marca de tiempo la pone ahora Postgres, pero mientras estás sin conexión no
  hay ninguna: solo tenemos una provisional del reloj del dispositivo. Si ese
  reloj va atrasado, la comparación por fecha decidiría que lo remoto es más
  nuevo y tus cambios locales se perderían al reconectar. Con esta marca, un
  cambio local pendiente se sube siempre, sin depender de relojes.
*/
const pendienteKey = (key) => "lh_pend:" + key;
const hayPendiente = (key) => localStorage.getItem(pendienteKey(key)) === "1";
const marcarPendiente = (key) => localStorage.setItem(pendienteKey(key), "1");
const limpiarPendiente = (key) => localStorage.removeItem(pendienteKey(key));

function loadLocal(key, initial) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : initial;
  } catch {
    return initial;
  }
}

function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /*
      Se llenó localStorage (el tope ronda los 5 MB) o el navegador lo bloquea.
      Antes esto se tragaba en silencio y el usuario creía estar guardando. Al
      menos dejamos rastro; en la nube sí se sigue guardando.
    */
    console.warn(
      `No se pudo guardar "${key}" en el navegador (¿almacenamiento lleno?). ` +
        "Con la nube activada tus datos siguen a salvo."
    );
    return false;
  }
}

async function loadCloud(key) {
  const { data, error } = await supabase
    .from("app_state")
    .select("value, updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn("Supabase load error:", error.message);
    return undefined;
  }
  return data || undefined;
}

/*
  Lecturas compartidas.

  Claves como lh_work_log se usan desde 10 componentes, y cada uno lanzaba su
  propia consulta idéntica al arrancar: ~80 consultas en vez de 27. Aquí se
  reutiliza la petición que ya esté en vuelo para esa clave.
*/
const lecturasEnCurso = new Map();

export function loadCloudCompartido(key) {
  const enCurso = lecturasEnCurso.get(key);
  if (enCurso) return enCurso;

  const promesa = loadCloud(key);
  lecturasEnCurso.set(key, promesa);
  // then(ok, ko) en vez de finally: así una lectura fallida no genera además
  // un rechazo sin gestionar por esta rama.
  const limpiar = () => {
    if (lecturasEnCurso.get(key) === promesa) lecturasEnCurso.delete(key);
  };
  promesa.then(limpiar, limpiar);
  return promesa;
}

async function saveCloud(key, value) {
  /*
    getSession() en lugar de getUser(): getUser() consulta al servidor de auth,
    así que cada guardado eran DOS viajes de red. getSession() lee la sesión ya
    guardada en el dispositivo.
  */
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  /*
    No mandamos updated_at: lo pone un trigger de Postgres y nos lo devolvemos
    con select(), para guardar en local la hora AUTORITATIVA del servidor. Así
    la comparación entre dispositivos no depende de que sus relojes coincidan.
  */
  const { data, error } = await supabase
    .from("app_state")
    .upsert({ key, value, user_id: user.id })
    .select("updated_at")
    .single();

  if (error) {
    console.warn("Supabase save error:", error.message);
    return; // sigue pendiente: se reintentará al volver a abrir la app
  }
  if (data?.updated_at) setTs(key, data.updated_at);
  limpiarPendiente(key);
}

/*
  Escrituras agrupadas.

  Sin esto, escribir una nota de 20 caracteres subía el blob completo 20 veces.
  El agrupado es POR CLAVE (no por componente), así que si dos componentes usan
  la misma clave sus cambios se funden en una sola subida.
*/
export const RETARDO_GUARDADO = 600;
const guardadosPendientes = new Map();

export function guardarEnNubeConRetraso(key, valor) {
  const previo = guardadosPendientes.get(key);
  if (previo) clearTimeout(previo.temporizador);

  const temporizador = setTimeout(() => {
    const pendiente = guardadosPendientes.get(key);
    guardadosPendientes.delete(key);
    if (pendiente) saveCloud(key, pendiente.valor);
  }, RETARDO_GUARDADO);

  guardadosPendientes.set(key, { valor, temporizador });
}

// Sube ya lo que esté esperando. Se llama al cerrar u ocultar la pestaña.
export function vaciarGuardadosPendientes() {
  for (const [key, pendiente] of guardadosPendientes) {
    clearTimeout(pendiente.temporizador);
    saveCloud(key, pendiente.valor);
  }
  guardadosPendientes.clear();
}

/*
  En el móvil el sistema congela o mata la pestaña sin avisar, así que hay que
  vaciar al ocultarse. Aunque se pierda el envío, no se pierde el dato: queda en
  localStorage marcado como pendiente y se sube al volver a abrir la app.
*/
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", vaciarGuardadosPendientes);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") vaciarGuardadosPendientes();
  });
}

/*
  Suscripciones de tiempo real COMPARTIDAS por clave.

  Antes cada llamada a usePersisted abría su propio canal con el topic
  "app_state:<clave>". Pero muchas claves se usan desde varios componentes a la
  vez (lh_work_log en 10 sitios, lh_gym en 8...), y supabase.channel(topic)
  devuelve el canal YA EXISTENTE cuando el topic coincide. El segundo componente
  recibía un canal ya suscrito y .on() lanzaba:

    "cannot add postgres_changes callbacks for realtime:app_state:X after subscribe()"

  Era una carrera: solo fallaba si el primer canal llegaba al estado "joined"
  antes de que montara el segundo, por eso aparecía en unos dispositivos y en
  otros no. Ahora hay un único canal por clave y los oyentes se reparten el
  mensaje; el canal se cierra cuando se va el último.
*/
const suscripciones = new Map();
let contadorTopic = 0;

// Exportada para poder testear el reparto de canales (ver store.test.js).
export function suscribirClave(key, oyente) {
  let entrada = suscripciones.get(key);

  if (!entrada) {
    entrada = { canal: null, oyentes: new Set() };
    // Sufijo incremental: si un canal anterior aún se está cerrando, el topic
    // nuevo no colisiona con él.
    entrada.canal = supabase
      .channel(`app_state:${key}:${++contadorTopic}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_state", filter: "key=eq." + key },
        (payload) => entrada.oyentes.forEach((fn) => fn(payload))
      )
      .subscribe();
    suscripciones.set(key, entrada);
  }

  entrada.oyentes.add(oyente);

  return () => {
    entrada.oyentes.delete(oyente);
    if (entrada.oyentes.size === 0) {
      suscripciones.delete(key);
      supabase.removeChannel(entrada.canal);
    }
  };
}

export function usePersisted(key, initial) {
  const [value, setValue] = useState(() => loadLocal(key, initial));
  const hydrated = useRef(false);
  const serialized = useRef(JSON.stringify(loadLocal(key, initial)));

  useEffect(() => {
    let active = true;
    if (!cloudEnabled) {
      hydrated.current = true;
      return;
    }

    // Al cargar: decidir entre lo local y lo remoto.
    loadCloudCompartido(key)
      .then((remote) => {
        if (!active) return;
        const localTs = getTs(key);

        if (hayPendiente(key)) {
          /*
            Hay un cambio local sin confirmar (se hizo sin conexión, o la subida
            no llegó a salir). Se sube sin mirar fechas: su marca es provisional
            y del reloj del dispositivo, así que compararla no es fiable.
          */
          guardarEnNubeConRetraso(key, JSON.parse(serialized.current));
        } else if (remote && (!localTs || remote.updated_at > localTs)) {
          serialized.current = JSON.stringify(remote.value);
          setTs(key, remote.updated_at);
          setValue(remote.value);
        }
        hydrated.current = true;
      })
      .catch((e) => {
        // Sin conexión seguimos con lo que haya en localStorage; lo importante es
        // marcar hydrated para que los cambios posteriores sí intenten subirse.
        console.warn("No se pudo cargar de la nube:", key, e?.message || e);
        if (active) hydrated.current = true;
      });

    const desuscribir = suscribirClave(key, (payload) => {
      const row = payload.new;
      if (!row || row.value === undefined) return;
      if (row.updated_at && row.updated_at > getTs(key)) {
        serialized.current = JSON.stringify(row.value);
        setTs(key, row.updated_at);
        setValue(row.value);
      }
    });

    return () => {
      active = false;
      desuscribir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // Local va siempre inmediato: es síncrono y es la red de seguridad si se
    // cierra la pestaña antes de que salga la subida.
    saveLocal(key, value);
    const s = JSON.stringify(value);
    if (s !== serialized.current) {
      serialized.current = s;
      // Marca provisional del reloj local: solo sirve para saber que hay algo
      // más nuevo que lo remoto. La definitiva la pone el servidor al subir.
      setTs(key, new Date().toISOString());
      if (cloudEnabled && hydrated.current) {
        marcarPendiente(key);
        guardarEnNubeConRetraso(key, value);
      }
    }
  }, [key, value]);

  return [value, setValue];
}
