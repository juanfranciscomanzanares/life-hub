/*
  Fusión de datos entre dispositivos, elemento a elemento.

  EL PROBLEMA QUE RESUELVE
  Cada clave (`lh_finance`, `lh_gym`...) se guardaba como un único bloque JSON y
  al sincronizar ganaba el bloque con la fecha más reciente. Es decir: apuntas
  un gasto en el móvil, apuntas otro en el PC, y el que llegue segundo borra el
  primero. Sin aviso y sin forma de recuperarlo. Era la única pérdida de datos
  silenciosa que quedaba en la app.

  Ahora no compiten los bloques, compiten los ELEMENTOS. Dos gastos distintos
  se quedan los dos, vengan de donde vengan, porque cada uno lleva su propia
  marca de tiempo.

  LAS TUMBAS
  Fusionar sin más resucita lo borrado: si borras algo en el móvil, el PC aún
  lo tiene, y al mezclar "el PC aporta un elemento que al móvil le falta" el
  elemento vuelve. Por eso un borrado deja una TUMBA (una marca con su fecha)
  que dice "esto no es que falte, es que se quitó". Las tumbas se podan a los 90
  días, así que un dispositivo que pase más de tres meses apagado sí podría
  resucitar algo; es el precio de no guardar la lista de borrados para siempre.

  LOS RELOJES
  La marca de cada elemento la pone el reloj del dispositivo que lo tocó. Eso
  solo importa cuando el MISMO elemento se edita en dos sitios casi a la vez:
  ahí gana el del reloj más adelantado, que puede no ser el último de verdad.
  Para elementos DISTINTOS —que es el caso que hacía perder datos— los relojes
  dan igual: se conservan los dos.

  Todo son funciones puras: `store.js` es quien las usa contra la red.
*/

// Tres meses. Suficiente para cualquier dispositivo que se use de vez en
// cuando, sin que la lista de borrados crezca sin fin.
export const DIAS_DE_TUMBA = 90;

export const metaVacia = () => ({ tocado: {}, borrado: {} });

const esObjetoLlano = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const tieneId = (v) =>
  esObjetoLlano(v) && (typeof v.id === "string" || typeof v.id === "number");

/*
  Qué se puede fusionar y cómo. No hay una lista de claves escrita a mano: se
  mira el dato que hay. Así una sección nueva hereda la fusión sin tocar nada,
  siempre que sus elementos lleven `id`.

  - "lista": array de objetos con id → se fusiona elemento a elemento.
  - "mapa":  objeto llano → se fusiona por clave de primer nivel (`lh_settings`,
             `lh_study_hours`, las valoraciones por semana del tenis...).
  - "suelto": un número, un texto, o un array sin ids (los partidos de tenis,
             que se regeneran enteros al pegar el acta). Aquí no hay nada que
             casar, así que se conserva el criterio de siempre: gana la versión
             más reciente.

  Un array vacío cuenta como lista: es justo el caso de "lo he borrado todo en
  este dispositivo", y tratarlo como suelto tiraría por tierra las tumbas.
*/
export function formaDe(valor) {
  if (Array.isArray(valor)) return valor.every(tieneId) ? "lista" : "suelto";
  if (esObjetoLlano(valor)) return "mapa";
  return "suelto";
}

// Las dos partes solo se fusionan si coinciden en forma. Si una es lista y la
// otra no (un dato corrupto, o un cambio de formato entre versiones), se cae al
// criterio de "gana el más reciente" en vez de inventar una mezcla.
function formaComun(a, b) {
  const fa = formaDe(a);
  return fa === formaDe(b) ? fa : "suelto";
}

/* Clave→elemento, para poder cruzar las dos versiones sin recorrer arrays. */
function porClave(valor, forma) {
  const mapa = new Map();
  if (forma === "lista") for (const el of valor) mapa.set(String(el.id), el);
  else if (forma === "mapa") for (const k of Object.keys(valor)) mapa.set(k, valor[k]);
  return mapa;
}

const masReciente = (a, b) => (String(a || "") > String(b || "") ? a : b);

/*
  Anota qué ha cambiado entre dos versiones seguidas del MISMO dispositivo.

  Se llama en cada guardado: compara lo que había con lo que hay y actualiza
  las marcas. Lo que no se ha tocado conserva su marca antigua, que es lo que
  permite que un elemento viejo no le gane a uno recién editado en otro sitio.
*/
export function sellar(anterior, nuevo, meta = metaVacia(), ahora = new Date().toISOString()) {
  const forma = formaComun(anterior, nuevo);
  if (forma === "suelto") return { tocado: { ...meta.tocado }, borrado: { ...meta.borrado } };

  const antes = porClave(anterior, forma);
  const despues = porClave(nuevo, forma);

  const tocado = {};
  const borrado = { ...meta.borrado };

  for (const [clave, elemento] of despues) {
    const previo = antes.get(clave);
    const cambiado = previo === undefined || JSON.stringify(previo) !== JSON.stringify(elemento);
    tocado[clave] = cambiado ? ahora : meta.tocado?.[clave] || ahora;
    /*
      Si vuelve algo que estaba enterrado, se levanta la tumba. Pasa de verdad:
      el botón de deshacer de los avisos (removeWithUndo) repone el elemento
      borrado, y sin esto la tumba lo volvería a matar en la siguiente fusión.
    */
    if (borrado[clave]) delete borrado[clave];
  }

  for (const clave of antes.keys()) {
    if (!despues.has(clave)) borrado[clave] = ahora;
  }

  return { tocado, borrado };
}

/*
  Junta dos versiones. `sello` es la marca global de cada lado y solo se usa
  para los valores "sueltos", donde no hay elementos que comparar.
*/
export function fusionar(a, b) {
  const valorA = a?.valor;
  const valorB = b?.valor;
  const metaA = a?.meta || metaVacia();
  const metaB = b?.meta || metaVacia();

  const forma = formaComun(valorA, valorB);

  if (forma === "suelto") {
    const ganaB = String(b?.sello || "") > String(a?.sello || "");
    const lado = ganaB ? b : a;
    return { valor: lado?.valor, meta: lado?.meta || metaVacia(), forma };
  }

  const mapaA = porClave(valorA, forma);
  const mapaB = porClave(valorB, forma);

  // Tumbas de los dos lados: si algo se borró en cualquiera, la fecha que
  // cuenta es la más reciente de las dos.
  const borrado = { ...metaA.borrado };
  for (const [clave, cuando] of Object.entries(metaB.borrado)) {
    borrado[clave] = masReciente(borrado[clave], cuando);
  }

  const tocado = {};
  const elegido = new Map();

  const decidir = (clave) => {
    const enA = mapaA.has(clave);
    const enB = mapaB.has(clave);
    const tA = metaA.tocado?.[clave] || "";
    const tB = metaB.tocado?.[clave] || "";

    /*
      ¿Sigue vivo? Se compara la tumba con la última vez que se tocó: si el
      elemento se editó DESPUÉS de borrarse, es que volvió (deshacer, o se
      recreó) y la tumba ya no vale.
    */
    const tumba = borrado[clave];
    const ultimoToque = masReciente(tA, tB);
    if (tumba && !(ultimoToque && String(ultimoToque) > String(tumba))) return;
    if (tumba) delete borrado[clave];

    // Presente en los dos: gana el que se tocó más tarde. Empate (misma marca)
    // o sin marcas: se queda A, que es el lado local, para no dar un salto
    // visible por un cambio que no aporta nada.
    if (enA && enB) {
      const ganaB = String(tB) > String(tA);
      elegido.set(clave, ganaB ? mapaB.get(clave) : mapaA.get(clave));
      tocado[clave] = masReciente(tA, tB) || "";
      return;
    }

    /*
      Solo en un lado. Aquí está el arreglo de verdad: NO se descarta por que
      al otro le falte. Falta porque es nuevo allí, no porque se haya quitado
      —de eso se encargan las tumbas, que ya se han mirado arriba.
    */
    const lado = enA ? mapaA : mapaB;
    elegido.set(clave, lado.get(clave));
    const marca = enA ? tA : tB;
    if (marca) tocado[clave] = marca;
  };

  for (const clave of mapaA.keys()) decidir(clave);
  for (const clave of mapaB.keys()) if (!elegido.has(clave)) decidir(clave);

  if (forma === "mapa") {
    const valor = {};
    for (const [clave, el] of elegido) valor[clave] = el;
    return { valor, meta: { tocado, borrado }, forma };
  }

  /*
    Orden: primero los locales en el orden que ya tenían, y detrás lo que solo
    estaba en el otro dispositivo. Así la pantalla no se reordena sola delante
    de ti, y lo que llega de fuera aparece igualmente. La mayoría de secciones
    ordenan por fecha al pintar, así que el sitio exacto es cosmético; lo que
    importa es que no se pierda nada.
  */
  const valor = [];
  const puestos = new Set();
  for (const clave of mapaA.keys()) {
    if (elegido.has(clave)) {
      valor.push(elegido.get(clave));
      puestos.add(clave);
    }
  }
  for (const [clave, el] of elegido) if (!puestos.has(clave)) valor.push(el);

  return { valor, meta: { tocado, borrado }, forma };
}

/*
  Quita las tumbas pasadas de fecha. Sin esto, borrar y volver a añadir durante
  años deja una lista de difuntos que se sube en cada guardado y acaba pesando
  más que los datos.
*/
export function podarTumbas(meta = metaVacia(), ahora = Date.now(), dias = DIAS_DE_TUMBA) {
  const limite = new Date(ahora - dias * 24 * 60 * 60 * 1000).toISOString();
  const borrado = {};
  for (const [clave, cuando] of Object.entries(meta.borrado || {})) {
    if (String(cuando) >= limite) borrado[clave] = cuando;
  }
  return { tocado: { ...meta.tocado }, borrado };
}

/* --- Sobre/envoltorio para la nube --------------------------------------- */

/*
  A Supabase no va el valor pelado, sino un sobre con el valor Y las marcas: sin
  ellas el otro dispositivo no sabría qué elemento es más nuevo. En el navegador
  se sigue guardando el valor tal cual, porque hay código que lee esas claves
  directamente (la paleta de comandos, las copias de seguridad).
*/
export const MARCA_SOBRE = 2;

export const meterEnSobre = (valor, meta) => ({ _lh: MARCA_SOBRE, datos: valor, meta });

/*
  Abre el sobre. Lo que se guardó ANTES de este cambio es el valor pelado, sin
  marcas: se acepta tal cual, con las marcas vacías. Cada elemento se irá
  sellando conforme se toque, así que la fusión mejora sola sin migrar nada.
*/
export function abrirSobre(guardado) {
  if (esObjetoLlano(guardado) && guardado._lh === MARCA_SOBRE) {
    return {
      valor: guardado.datos,
      meta: {
        tocado: guardado.meta?.tocado || {},
        borrado: guardado.meta?.borrado || {},
      },
    };
  }
  return { valor: guardado, meta: metaVacia() };
}
