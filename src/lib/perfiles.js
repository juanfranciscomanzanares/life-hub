/*
  Perfiles: quién está usando la app.

  Los datos ya estaban separados por cuenta (ver src/lib/sesionLocal.js): lo que
  falta es que la app se VEA distinta según quién entra. Tres cosas dependen del
  perfil y antes eran constantes iguales para todo el mundo:

    - qué secciones existen (`sinSecciones`)
    - de qué color es la app (`tema` y `acento`)
    - qué te dice al entrar (`saludo`)

  Aquí no hay estado ni efectos a propósito: es una tabla y una función pura, y
  por eso se puede probar en `node` sin montar nada. Quien la consume es el
  shell (src/LifeDashboard.jsx), que es el único que sabe el correo de la sesión.
*/

/*
  El perfil se decide por el correo de la cuenta y no por un ajuste guardado.

  Motivo: el ajuste vive en el navegador, así que en un dispositivo compartido
  se quedaría pegado. Si Carmen cierra sesión y entra Quico, el correo cambia al
  instante y el perfil con él; un ajuste guardado habría dejado a Quico con la
  app rosa y sin tenis hasta que alguien se diera cuenta.

  `elegido` existe como escape: sirve para probar el otro perfil y para el modo
  local (sin nube), donde no hay correo del que tirar. Manda menos que el correo
  justo por lo de arriba.
*/
export const PERFIL_POR_DEFECTO = "quico";

export const PERFILES = {
  quico: {
    id: "quico",
    nombre: "Quico",
    /*
      Sin correos: es el perfil por defecto, así que le toca a cualquiera que no
      encaje en otro. Ponerle el correo aquí no cambiaría nada y sería un dato
      personal más en el repo.
    */
    correos: [],
    // `null` = respeta lo que el usuario haya elegido en Ajustes. Solo los
    // perfiles con identidad de color propia lo fijan.
    acento: null,
    tema: null,
    sinSecciones: [],
    saludo: null,
  },

  carmen: {
    id: "carmen",
    nombre: "Carmen",
    /*
      PENDIENTE: falta el correo de la cuenta de Carmen. Hasta que esté, su
      perfil solo se alcanza con `elegido` (Ajustes → Perfil). En cuanto lo
      añadas aquí, entra sola al identificarse.
    */
    correos: [],
    acento: "rosa",
    tema: "rosa",
    /*
      Las dos son de tenis de mesa: "tenis" son los resultados de los partidos y
      "tenis-notas" los entrenamientos. Quitar solo una dejaría media sección
      colgando en el menú de Deporte.
    */
    sinSecciones: ["tenis", "tenis-notas"],
    saludo: "olaaaa tomta",
  },
};

const normalizar = (correo) => String(correo || "").trim().toLowerCase();

/*
  Qué perfil corresponde. Devuelve siempre uno: sin coincidencia, el de por
  defecto, porque una app sin perfil no se puede pintar.
*/
export function perfilDe(correo, elegido = null, tabla = PERFILES) {
  return resolverPerfil(correo, elegido, tabla).perfil;
}

/*
  Igual que `perfilDe`, pero además dice de dónde ha salido: "correo", "elegido"
  o "defecto".

  Lo necesita Ajustes para saber si tiene sentido enseñar el selector de perfil.
  Cuando el correo ya identifica a la persona, elegir a mano no haría nada
  —el correo manda— y un selector que no obedece es peor que no tenerlo.
*/
export function resolverPerfil(correo, elegido = null, tabla = PERFILES) {
  const email = normalizar(correo);
  if (email) {
    const porCorreo = Object.values(tabla).find((p) =>
      (p.correos || []).some((c) => normalizar(c) === email)
    );
    if (porCorreo) return { perfil: porCorreo, origen: "correo" };
  }

  // Sin coincidencia por correo vale la elección manual, si apunta a un perfil
  // que existe (un id inventado en localStorage no debe tumbar la app).
  if (elegido && tabla[elegido]) return { perfil: tabla[elegido], origen: "elegido" };

  return { perfil: tabla[PERFIL_POR_DEFECTO], origen: "defecto" };
}

/*
  El contenido inicial de `lh_settings`.

  Vive aquí porque el nombre por defecto sale del perfil, pero sobre todo porque
  TIENE QUE SER EL MISMO en los tres sitios que leen esa clave: Inicio, Ajustes
  y Salud. Cada uno declaraba el suyo —`{nombre}`, `{nombre, metaAgua, metaSueno}`
  y `{metaAgua}`— y el primero que se montaba escribía SU versión, así que en una
  cuenta recién creada las metas de agua y de sueño salían vacías según qué
  pantalla hubieras abierto antes. Es el aviso de CLAUDE.md sobre varios
  componentes escribiendo la misma clave, pero en la forma del valor inicial.
*/
export function ajustesIniciales(perfil) {
  return {
    nombre: perfil?.nombre || PERFILES[PERFIL_POR_DEFECTO].nombre,
    metaAgua: 2,
    metaSueno: 8,
  };
}

/*
  La navegación del perfil: los grupos de NAV_GROUPS sin las secciones que ese
  perfil no tiene.

  Se poda también el grupo que se queda vacío. Si no, a Carmen le aparecería un
  desplegable "Deporte" con nada dentro el día que se le quiten gimnasio y salud
  además del tenis.
*/
export function navDelPerfil(grupos, sinSecciones = []) {
  const fuera = new Set(sinSecciones);

  return grupos.reduce((lista, grupo) => {
    if (!grupo.items) {
      if (!fuera.has(grupo.id)) lista.push(grupo);
      return lista;
    }
    const items = grupo.items.filter((i) => !fuera.has(i.id));
    if (items.length) lista.push({ ...grupo, items });
    return lista;
  }, []);
}

/*
  Los ids que ese perfil puede abrir. Es lo que recibe `useRuta`: sin esto,
  entrar a mano en #/tenis con el perfil de Carmen pintaría una sección que para
  ella no existe (y que ni siquiera está en su menú para poder salir de ella).
*/
export function idsDelPerfil(grupos, sinSecciones = []) {
  return navDelPerfil(grupos, sinSecciones).flatMap((g) => (g.items ? g.items : [g])).map((s) => s.id);
}
