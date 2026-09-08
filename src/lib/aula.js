/*
  Aula Virtual UMU (Sakai): interpretar lo que devuelve la API.

  Toda la lógica vive aquí y no en la Edge Function, por lo mismo que en tenis:
  aquí se puede cubrir con tests contra datos reales; dentro de la función
  habría que duplicarla o dejarla sin probar. La función es solo el puente que
  inicia sesión y devuelve el JSON en crudo (recortado).
*/

export const BASE_AULA = "https://aulavirtual.um.es";

export function normalizar(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    // ̀-ͯ son los diacríticos que NFD separa de la letra. Escrito con el
    // código y no con los caracteres, que son invisibles.
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Los sitios de Sakai se llaman "(6584) FUNDAMENTOS DE REDES DE DATOS  [25/26]".
  Se parte en sus tres trozos para poder enseñar el nombre legible y, aparte,
  el curso: dos sitios distintos pueden ser la MISMA asignatura de dos años
  ("(6585) ... [24/25]" y "(6585) ... [25/26]"), y mezclarlos sería un lío.
*/
export function partirTituloSitio(titulo = "") {
  const texto = String(titulo).trim();
  const codigo = texto.match(/^\((\d+)\)/)?.[1] ?? "";
  const curso = texto.match(/\[([^\]]+)\]\s*$/)?.[1] ?? "";
  const nombre = texto
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*\[[^\]]+\]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return { codigo, nombre, curso };
}

// "FUNDAMENTOS DE REDES DE DATOS" -> "Fundamentos de Redes de Datos".
// Sakai lo guarda todo en mayúsculas y leído en una lista canta mucho.
const MENUDAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "para", "con", "por"]);
export function capitalizar(texto = "") {
  return String(texto)
    .toLowerCase()
    .split(" ")
    .map((palabra, i) =>
      i > 0 && MENUDAS.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)
    )
    .join(" ");
}

export function nombreAsignatura(tituloSitio) {
  const { nombre, codigo } = partirTituloSitio(tituloSitio);
  return nombre ? capitalizar(nombre) : codigo || String(tituloSitio || "").trim();
}

/*
  ¿Es esta asignatura del Aula Virtual la misma que una de las de la app?

  Las de la app van abreviadas ("Infraest. Comp. Altas Prest.") y las del Aula
  Virtual completas y en mayúsculas ("INFRAESTRUCTURA PARA LA COMPUTACIÓN DE
  ALTAS PRESTACIONES"). Comparar los textos enteros no serviría de nada, así
  que cada trozo de la abreviatura tiene que ser el principio de alguna palabra
  del nombre largo: infraest→INFRAESTRUCTURA, comp→COMPUTACIÓN, altas→ALTAS,
  prest→PRESTACIONES.
*/
export function coincideAsignatura(nombreAula, asignaturaApp) {
  const palabras = normalizar(nombreAula).split(" ").filter(Boolean);
  const trozos = normalizar(asignaturaApp).replace(/\./g, " ").split(" ").filter(Boolean);
  if (trozos.length === 0 || palabras.length === 0) return false;
  return trozos.every((t) => palabras.some((p) => p.startsWith(t)));
}

// La asignatura de la app que corresponde, o null si no hay ninguna. Null es
// una respuesta legítima: las del curso pasado no están en la lista de la app.
export function asignaturaDeApp(nombreAula, asignaturasApp = []) {
  return asignaturasApp.find((a) => coincideAsignatura(nombreAula, a)) ?? null;
}

const aFecha = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

/*
  Estado de una tarea:

    entregada — la has entregado tú
    proxima   — publicada pero todavía no se puede entregar
    abierta   — se puede entregar ahora
    cerrada   — pasó el plazo

  "entregada" manda sobre el resto: una tarea abierta que ya has entregado no
  te tiene que salir en la lista de pendientes.
*/
export function estadoDe(tarea, ahora = new Date()) {
  if (tarea.entregada) return "entregada";

  const abre = aFecha(tarea.abre);
  const limite = aFecha(tarea.cierra) ?? aFecha(tarea.entrega);

  if (limite && ahora > limite) return "cerrada";
  if (abre && ahora < abre) return "proxima";
  return "abierta";
}

export const esPendiente = (tarea) => tarea.estado === "abierta" || tarea.estado === "proxima";

/*
  Junta las tareas con el nombre de su asignatura y les calcula el estado.

  Ojo con los sitios: `/direct/site.json` devuelve solo 10 por defecto, así que
  hay que pedirle un límite alto o la mayoría de las tareas se quedan sin
  nombre y salen como "6596_G_2025_N_N". Cuando aun así falta un sitio, se
  enseña el identificador en crudo antes que dejar la fila sin etiqueta.
*/
export function normalizarTareas({ tareas = [], sitios = [] } = {}, ahora = new Date()) {
  const tituloPorSitio = new Map(sitios.map((s) => [s.id, s.titulo]));

  return tareas
    .filter((t) => !t.borrador)
    .map((t) => {
      const tituloSitio = tituloPorSitio.get(t.contexto) ?? t.contexto ?? "";
      const { curso, codigo } = partirTituloSitio(tituloSitio);
      const tarea = {
        id: t.id,
        titulo: t.titulo || "(sin título)",
        contexto: t.contexto,
        asignatura: nombreAsignatura(tituloSitio),
        codigo,
        curso,
        abre: t.abre ?? null,
        entrega: t.entrega ?? null,
        cierra: t.cierra ?? null,
        entregada: Boolean(t.entregada),
        url: t.contexto ? `${BASE_AULA}/portal/site/${t.contexto}` : BASE_AULA,
      };
      return { ...tarea, estado: estadoDe(tarea, ahora) };
    })
    .sort(porFechaLimite);
}

/*
  Las pendientes primero y, dentro, la de plazo más cercano arriba: es el orden
  en el que hay que ponerse a hacerlas. Las cerradas van al final, de la más
  reciente a la más antigua, que es como se consulta el histórico.
*/
function porFechaLimite(a, b) {
  const pendA = esPendiente(a);
  const pendB = esPendiente(b);
  if (pendA !== pendB) return pendA ? -1 : 1;

  const fa = a.entrega ?? a.cierra ?? "";
  const fb = b.entrega ?? b.cierra ?? "";
  if (!fa) return 1;
  if (!fb) return -1;
  return pendA ? String(fa).localeCompare(String(fb)) : String(fb).localeCompare(String(fa));
}

// Agrupa por asignatura, con las asignaturas que tengan pendientes arriba.
export function agruparPorAsignatura(lista = []) {
  const grupos = new Map();
  lista.forEach((t) => {
    if (!grupos.has(t.asignatura)) grupos.set(t.asignatura, []);
    grupos.get(t.asignatura).push(t);
  });

  return [...grupos.entries()]
    .map(([asignatura, tareas]) => ({
      asignatura,
      curso: tareas[0].curso,
      tareas,
      pendientes: tareas.filter(esPendiente).length,
    }))
    .sort((a, b) => b.pendientes - a.pendientes || a.asignatura.localeCompare(b.asignatura));
}

/*
  Pone una tarea del Aula Virtual en la forma que esperan el calendario y la
  pantalla de Inicio: `{ id, text, subject, entrega, done }`.

  Antes esto servía para COPIAR la tarea a una lista propia (`lh_uni_tasks`) que
  se mantenía a mano. Se quitó: las tareas de la carrera son las del Aula
  Virtual, ya vienen con su fecha límite y se actualizan solas al sincronizar,
  así que llevar una copia paralela solo era trabajo doble y una fuente de
  desajustes en cuanto la de la UMU cambiaba de fecha.

  La asignatura se traduce a la de la app cuando se reconoce; si no (las del
  curso pasado, por ejemplo), se queda con su nombre del Aula Virtual, que es
  mejor etiqueta que meterla a la fuerza en una asignatura que no es.

  `done` sale de si está ENTREGADA en la UMU, que es la única marca de "hecho"
  que existe ahora y además es la de verdad.
*/
export function aTareaDeApp(tarea, asignaturasApp = []) {
  return {
    id: `av-${tarea.id}`,
    aulaId: tarea.id,
    text: tarea.titulo,
    subject: asignaturaDeApp(tarea.asignatura, asignaturasApp) ?? tarea.asignatura,
    entrega: tarea.entrega ?? tarea.cierra ?? null,
    done: Boolean(tarea.entregada),
  };
}

/* Todas las del Aula Virtual, listas para el calendario y para Inicio. */
export const tareasParaLaApp = (tareasAula = [], asignaturasApp = []) =>
  tareasAula.map((t) => aTareaDeApp(t, asignaturasApp));
