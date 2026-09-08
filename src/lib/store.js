import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, cloudEnabled } from "./supabase";
import {
  sellar,
  fusionar,
  podarTumbas,
  metaVacia,
  meterEnSobre,
  abrirSobre,
} from "./fusionar";

/*
  Capa de datos unificada con:
  - Persistencia local (localStorage), funciona sin conexión.
  - Sincronización en la nube (tabla app_state) si Supabase está configurado.
  - Tiempo real (Supabase Realtime): los cambios aparecen al instante en otros
    dispositivos.
  - FUSIÓN POR ELEMENTO al resolver conflictos (ver fusionar.js).

  Sobre lo último, que es el cambio importante: antes competían los bloques
  enteros y ganaba el más reciente, así que apuntar un gasto en el móvil y otro
  en el PC hacía desaparecer uno de los dos. Ahora compiten los elementos: dos
  gastos distintos se conservan los dos, y solo hay que decidir cuando se ha
  tocado el MISMO elemento en dos sitios.

  Cada clave sigue guardando todo su contenido en un único JSON, así que
  escribir es caro: añadir una fila al gimnasio reescribe el array entero. Por
  eso las escrituras van agrupadas (debounce) y las lecturas y suscripciones se
  comparten entre componentes.
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

  Con la fusión por elemento esto solo hace falta ya para los valores SUELTOS
  (un número, un texto): en las listas y los mapas manda la marca de cada
  elemento, que no se pisan entre sí.
*/
const pendienteKey = (key) => "lh_pend:" + key;
const hayPendiente = (key) => localStorage.getItem(pendienteKey(key)) === "1";
const marcarPendiente = (key) => localStorage.setItem(pendienteKey(key), "1");
const limpiarPendiente = (key) => localStorage.removeItem(pendienteKey(key));

/*
  Las marcas por elemento viven en su propia clave, aparte del dato.

  Podrían ir dentro del valor, pero el valor lo leen directamente otros sitios
  (la paleta de comandos abre `lh_tasks` a pelo, las copias de seguridad
  recorren todas las claves). Mezclando ambas cosas habría que tocar todo eso, y
  una copia restaurada traería metadatos de otro dispositivo. Separadas, el
  formato de `lh_*` no cambia y nada de fuera se entera.
*/
const sincKey = (key) => "lh_sync:" + key;

function leerMeta(key) {
  try {
    const raw = localStorage.getItem(sincKey(key));
    if (!raw) return metaVacia();
    const m = JSON.parse(raw);
    return { tocado: m?.tocado || {}, borrado: m?.borrado || {} };
  } catch {
    return metaVacia();
  }
}

function guardarMeta(key, meta) {
  try {
    localStorage.setItem(sincKey(key), JSON.stringify(meta));
  } catch {
    /* almacenamiento lleno: se avisa al guardar el valor, no hace falta repetirlo */
  }
}

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

async function saveCloud(key, value, meta) {
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

    Lo que sí viaja es el SOBRE: el valor más las marcas por elemento. Sin ellas
    el otro dispositivo no podría saber cuál de dos versiones de una misma fila
    es la nueva.
  */
  const { data, error } = await supabase
    .from("app_state")
    .upsert({ key, value: meterEnSobre(value, meta || metaVacia()), user_id: user.id })
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

export function guardarEnNubeConRetraso(key, valor, meta) {
  const previo = guardadosPendientes.get(key);
  if (previo) clearTimeout(previo.temporizador);

  const temporizador = setTimeout(() => {
    const pendiente = guardadosPendientes.get(key);
    guardadosPendientes.delete(key);
    if (pendiente) saveCloud(key, pendiente.valor, pendiente.meta);
  }, RETARDO_GUARDADO);

  guardadosPendientes.set(key, { valor, meta, temporizador });
}

// Sube ya lo que esté esperando. Se llama al cerrar u ocultar la pestaña.
export function vaciarGuardadosPendientes() {
  for (const [key, pendiente] of guardadosPendientes) {
    clearTimeout(pendiente.temporizador);
    saveCloud(key, pendiente.valor, pendiente.meta);
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

/*
  Avisos DENTRO de la pestaña, entre componentes que comparten clave.

  Sin esto la fusión se volvía peligrosa. Ejemplo real: tienes Finanzas abierta
  (su usePersisted tiene la lista en memoria) y añades un gasto con el botón +,
  que es otro componente con la MISMA clave. El de Finanzas no se entera y sigue
  con la lista de antes. En cuanto edites algo allí, guardaría su lista vieja y
  la comparación vería que al gasto nuevo "le han quitado" → tumba → borrado
  para siempre y en todos los dispositivos.

  Antes de fusionar, ese mismo escenario también perdía el gasto, pero solo en
  local y hasta la siguiente recarga. Con tumbas pasaría a ser definitivo, así
  que aquí se corta: quien escribe avisa al resto de instancias de su clave.
*/
const oyentesLocales = new Map();

function avisarEnLaPestana(key, valor, meta, emisor) {
  const oyentes = oyentesLocales.get(key);
  if (!oyentes) return;
  for (const oyente of oyentes) if (oyente !== emisor) oyente(valor, meta);
}

function escucharEnLaPestana(key, oyente) {
  let oyentes = oyentesLocales.get(key);
  if (!oyentes) {
    oyentes = new Set();
    oyentesLocales.set(key, oyentes);
  }
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) oyentesLocales.delete(key);
  };
}

export function usePersisted(key, initial) {
  const [value, setValue] = useState(() => loadLocal(key, initial));
  const hydrated = useRef(false);
  const serialized = useRef(JSON.stringify(loadLocal(key, initial)));
  const meta = useRef(leerMeta(key));
  // Marca los cambios que llegan de fuera (fusión o aviso de la pestaña) para
  // que el efecto de guardado no los vuelva a sellar como si fueran tuyos.
  const deFuera = useRef(false);

  // Aplica un valor que viene de fuera sin re-sellarlo ni resubirlo.
  const aplicarDeFuera = useCallback((valor, metaNueva) => {
    deFuera.current = true;
    serialized.current = JSON.stringify(valor);
    meta.current = metaNueva;
    setValue(valor);
  }, []);

  // Otros componentes de esta misma pestaña que usan la misma clave.
  useEffect(() => escucharEnLaPestana(key, aplicarDeFuera), [key, aplicarDeFuera]);

  useEffect(() => {
    let active = true;
    if (!cloudEnabled) {
      hydrated.current = true;
      return;
    }

    /*
      Junta lo de este dispositivo con lo del servidor. Se usa igual al cargar
      y al recibir un cambio en tiempo real.

      Devuelve si el resultado aporta algo que al servidor le falta; en ese caso
      hay que volver a subirlo. Eso es lo que cierra la carrera de "los dos
      dispositivos escriben a la vez": el que se entera segundo publica la unión
      y los dos acaban igual.
    */
    const juntarCon = (guardadoRemoto, selloRemoto) => {
      const remoto = abrirSobre(guardadoRemoto);
      const local = {
        valor: JSON.parse(serialized.current),
        meta: meta.current,
        sello: getTs(key),
      };
      const resultado = fusionar(local, { ...remoto, sello: selloRemoto });

      /*
        Los valores sueltos (un número, un texto) no tienen elementos que casar
        y se deciden por fecha. Si aquí hay un cambio sin confirmar, la fecha
        local es del reloj de este dispositivo y no es de fiar: se conserva lo
        local y ya se subirá.
      */
      if (resultado.forma === "suelto" && hayPendiente(key)) return true;

      const fusionado = JSON.stringify(resultado.valor);
      if (fusionado !== serialized.current) {
        aplicarDeFuera(resultado.valor, resultado.meta);
        saveLocal(key, resultado.valor);
        guardarMeta(key, resultado.meta);
        avisarEnLaPestana(key, resultado.valor, resultado.meta, aplicarDeFuera);
      } else {
        meta.current = resultado.meta;
        guardarMeta(key, resultado.meta);
      }

      return fusionado !== JSON.stringify(remoto.valor);
    };

    loadCloudCompartido(key)
      .then((remoto) => {
        if (!active) return;

        if (!remoto) {
          // Nada en la nube todavía: si aquí hay algo, que suba.
          if (hayPendiente(key)) {
            guardarEnNubeConRetraso(key, JSON.parse(serialized.current), meta.current);
          }
          hydrated.current = true;
          return;
        }

        if (juntarCon(remoto.value, remoto.updated_at)) {
          guardarEnNubeConRetraso(key, JSON.parse(serialized.current), meta.current);
        } else {
          setTs(key, remoto.updated_at);
          limpiarPendiente(key);
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
      if (juntarCon(row.value, row.updated_at)) {
        // Traíamos algo que al servidor le faltaba: se publica la unión.
        guardarEnNubeConRetraso(key, JSON.parse(serialized.current), meta.current);
      } else {
        setTs(key, row.updated_at);
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

    /*
      La bandera se consume SIEMPRE, antes de cualquier salida.

      Es sutil y costó un fallo real: `aplicarDeFuera` ya deja `serialized`
      igual al valor nuevo, así que este efecto sale por la comparación de
      abajo. Si la bandera se limpiara después de esa comparación, se quedaría
      en `true` para siempre, y el SIGUIENTE cambio de verdad del usuario se
      tomaría por venido de fuera: se guardaría en el navegador pero sin marca
      de tiempo, y por tanto no subiría nunca a la nube.
    */
    /*
      La bandera se consume SIEMPRE, antes de cualquier salida.

      Es sutil y costó un fallo real: `aplicarDeFuera` ya deja `serialized`
      igual al valor nuevo, así que este efecto sale por la comparación de
      abajo. Si la bandera se limpiara después de esa comparación, se quedaría
      en `true` para siempre, y el SIGUIENTE cambio de verdad del usuario se
      tomaría por venido de fuera: se guardaría en el navegador pero sin marca
      de tiempo, y por tanto no subiría nunca a la nube.
    */
    const venidoDeFuera = deFuera.current;
    deFuera.current = false;

    if (s === serialized.current) return;

    // Cambio venido de fuera: ya está sellado y guardado, no hay que tocarlo.
    if (venidoDeFuera) {
      serialized.current = s;
      return;
    }

    /*
      Cambio del usuario en este dispositivo: se compara con lo que había para
      anotar QUÉ elemento ha cambiado y cuál se ha quitado. Esa marca por
      elemento es lo que permite fusionar en vez de pisar.
    */
    const anterior = JSON.parse(serialized.current);
    meta.current = podarTumbas(sellar(anterior, value, meta.current));
    guardarMeta(key, meta.current);
    serialized.current = s;

    // Marca provisional del reloj local: solo sirve para saber que hay algo
    // más nuevo que lo remoto. La definitiva la pone el servidor al subir.
    setTs(key, new Date().toISOString());

    avisarEnLaPestana(key, value, meta.current, aplicarDeFuera);

    if (cloudEnabled && hydrated.current) {
      marcarPendiente(key);
      guardarEnNubeConRetraso(key, value, meta.current);
    }
  }, [key, value, aplicarDeFuera]);

  return [value, setValue];
}
