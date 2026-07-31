/*
  Aislamiento de los datos locales entre usuarios.

  El problema que resuelve, que era real y grave:

  `localStorage` es del NAVEGADOR, no de la cuenta. Al cerrar sesión no se
  borraba nada, así que si otra persona entraba en el mismo navegador la app
  cargaba de `localStorage` los datos del anterior y se los enseñaba como
  suyos. Y no se quedaba ahí: en cuanto tocaba algo, el guardado los marcaba
  como cambio pendiente y los SUBÍA a la cuenta de la recién llegada. No era
  solo verlos, era escribírselos.

  La solución es recordar de quién son los datos que hay guardados. Si al
  arrancar el usuario no coincide, se borran antes de que nada los lea.
*/

const CLAVE_DUENO = "lh_usuario_datos";

// Todo lo que es "datos de un usuario" lleva uno de estos prefijos. Lo demás
// (tema, color de acento, si ya viste el tour) es del dispositivo y se queda:
// no dice nada de nadie y es incómodo perderlo en cada cambio de cuenta.
const PREFIJOS = ["lh_", "lh_meta:", "lh_pend:"];

const DEL_DISPOSITIVO = new Set([
  "lh_theme",
  "lh_accent",
  "lh_onboarded",
  "lh_usuario_datos",
  "lh_lock",
  "lh_lock_bio",
]);

export const esDatoDeUsuario = (clave) =>
  PREFIJOS.some((p) => clave.startsWith(p)) && !DEL_DISPOSITIVO.has(clave);

/*
  Decide qué hacer al arrancar con `usuarioActual` (el id de Supabase, o null
  si no hay sesión).

  Se devuelve la decisión en vez de ejecutarla para poder probarla sin tocar
  localStorage de verdad.

    "nada"      — mismo usuario que la última vez, o primera vez sin datos
    "adoptar"   — hay datos sin dueño y este usuario entra por primera vez:
                  son suyos (venía de usar la app en modo local, sin cuenta)
    "limpiar"   — los datos son de OTRO usuario: hay que borrarlos
*/
export function decidir({ duenoGuardado, usuarioActual, hayDatos }) {
  if (!hayDatos) return "nada";
  if (!usuarioActual) {
    // Sin sesión: no se toca nada. Puede ser el modo local (sin nube), donde
    // los datos no son de ninguna cuenta y borrarlos sería perderlos.
    return "nada";
  }
  if (!duenoGuardado) return "adoptar";
  return duenoGuardado === usuarioActual ? "nada" : "limpiar";
}

// Las claves de datos que hay ahora mismo en el almacén.
export function clavesDeDatos(almacen = window.localStorage) {
  const claves = [];
  for (let i = 0; i < almacen.length; i++) {
    const c = almacen.key(i);
    if (c && esDatoDeUsuario(c)) claves.push(c);
  }
  return claves;
}

/*
  Aplica la decisión. Se llama al arrancar y en cada cambio de sesión, ANTES
  de que las secciones lean nada.

  Devuelve true si ha borrado algo, para que quien llame recargue: los
  componentes ya montados siguen teniendo en memoria lo que se acaba de
  borrar, y sin recargar se volvería a guardar.
*/
export function sincronizarDueno(usuarioActual, almacen = window.localStorage) {
  try {
    const duenoGuardado = almacen.getItem(CLAVE_DUENO);
    const claves = clavesDeDatos(almacen);
    const accion = decidir({ duenoGuardado, usuarioActual, hayDatos: claves.length > 0 });

    if (accion === "limpiar") {
      claves.forEach((c) => almacen.removeItem(c));
      almacen.setItem(CLAVE_DUENO, usuarioActual);
      return true;
    }

    if (accion === "adoptar" || (usuarioActual && duenoGuardado !== usuarioActual)) {
      almacen.setItem(CLAVE_DUENO, usuarioActual);
    }
    return false;
  } catch {
    // Safari en privado puede lanzar al escribir. Mejor seguir que tumbar la
    // app; el peor caso es que no se limpie, como antes.
    return false;
  }
}
