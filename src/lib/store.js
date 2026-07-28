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
*/

const metaKey = (key) => "lh_meta:" + key;
const getTs = (key) => localStorage.getItem(metaKey(key)) || "";
const setTs = (key, ts) => localStorage.setItem(metaKey(key), ts);

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
  } catch {
    /* almacenamiento no disponible */
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

async function saveCloud(key, value, ts) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("app_state")
    .upsert({ key, value, user_id: user.id, updated_at: ts });
  if (error) console.warn("Supabase save error:", error.message);
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

    // Al cargar: comparar marcas de tiempo y quedarse con la más reciente
    loadCloud(key).then((remote) => {
      if (!active) return;
      const localTs = getTs(key);
      if (remote && (!localTs || remote.updated_at > localTs)) {
        serialized.current = JSON.stringify(remote.value);
        setTs(key, remote.updated_at);
        setValue(remote.value);
      } else if (localTs && (!remote || localTs > remote.updated_at)) {
        // Lo local es más nuevo: lo subimos
        saveCloud(key, JSON.parse(serialized.current), localTs);
      }
      hydrated.current = true;
    }).catch((e) => {
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
    saveLocal(key, value);
    const s = JSON.stringify(value);
    if (s !== serialized.current) {
      const ts = new Date().toISOString();
      serialized.current = s;
      setTs(key, ts);
      if (cloudEnabled && hydrated.current) saveCloud(key, value, ts);
    }
  }, [key, value]);

  return [value, setValue];
}
