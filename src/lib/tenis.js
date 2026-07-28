/*
  Tenis de mesa: lectura de actas de la RFETM y de rankings de la FTMRM.

  Las dos fuentes son PDFs públicos. Una Edge Function los descarga y extrae el
  texto (el navegador no puede por CORS); aquí solo se interpreta ese texto, que
  es lo que se puede probar con tests.

  Formato de una línea de acta:

    B MANZANARES GOMEZ, JUAN FRANCISCO (23789) X IBAÑEZ CARRILLO, F. (1521) 5 - 11 12 - 10 6 - 11 6 - 11 1 - 3 1 - 1
    ^ letra                          ^ licencia ^ letra                      ^ los sets            ^ juegos ^ acumulado

  Cuidado con una trampa: ABC/XYZ NO es local/visitante. En la jornada 2 el
  equipo local era CTM Ilicitano y sin embargo Eliocroca figuraba como ABC. Lo
  que manda es la letra del jugador (A/B/C = equipo ABC, X/Y/Z = equipo XYZ).
*/

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function aISO(dia, mes, anio) {
  const m = MESES[String(mes).toLowerCase()];
  if (!m) return "";
  return `${anio}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Todos los pares "N - N" de una cadena, en orden.
function pares(texto) {
  return [...texto.matchAll(/(\d+)\s*-\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

/*
  Cabecera del acta: fecha, competición, jornada y equipos.
*/
export function parsearCabecera(texto) {
  const fecha = texto.match(/el día (\d{1,2}) de (\w+) de (\d{4})/i);
  const comp = texto.match(/Competición\s+(.+?)\s+J\.\s*(\d+)\s+TEMPORADA\s+(\S+)/i);
  const equipos = texto.match(/Equipo Local:\s*(.+?)\s+Equipo Visitante:\s*(.+?)\s*$/im);
  const lados = texto.match(/ABC\s+(.+?)\s+XYZ\s+(.+?)\s+J1\s/i);

  return {
    fecha: fecha ? aISO(fecha[1], fecha[2], fecha[3]) : "",
    competicion: comp ? comp[1].trim() : "",
    jornada: comp ? Number(comp[2]) : null,
    temporada: comp ? comp[3].trim() : "",
    local: equipos ? equipos[1].trim() : "",
    visitante: equipos ? equipos[2].trim() : "",
    equipoABC: lados ? lados[1].trim() : "",
    equipoXYZ: lados ? lados[2].trim() : "",
  };
}

/*
  Partidos individuales del acta.

  Los dobles (líneas "Db") se ignoran: van repartidos en varias líneas con dos
  jugadores por lado y necesitan otro tratamiento. Se cuentan aparte para poder
  avisar de que existen en vez de fingir que no.
*/
export function parsearPartidos(texto) {
  const partidos = [];
  let dobles = 0;

  texto.split(/\r?\n/).forEach((linea) => {
    if (/^\s*Db\b/.test(linea)) {
      dobles += 1;
      return;
    }

    const m = linea.match(
      /^\s*([ABC])\s+(.+?)\s*\((\d+)\)\s+([XYZ])\s+(.+?)\s*\((\d+)\)\s+(.+)$/
    );
    if (!m) return;

    const todos = pares(m[7]);
    // Los dos últimos pares son el total de juegos y el marcador acumulado del
    // encuentro; los anteriores son los sets. Si no hay al menos tres, la línea
    // está incompleta.
    if (todos.length < 3) return;

    const acumulado = todos[todos.length - 1];
    const juegos = todos[todos.length - 2];
    const sets = todos.slice(0, -2);

    partidos.push({
      letraABC: m[1],
      jugadorABC: limpiarNombre(m[2]),
      licenciaABC: m[3],
      letraXYZ: m[4],
      jugadorXYZ: limpiarNombre(m[5]),
      licenciaXYZ: m[6],
      sets,
      juegos,
      acumulado,
    });
  });

  return { partidos, dobles };
}

function limpiarNombre(n) {
  return String(n).replace(/\s+/g, " ").trim();
}

// "MANZANARES GOMEZ, JUAN FRANCISCO" -> "Juan Francisco Manzanares Gomez"
export function nombreLegible(nombre) {
  const [apellidos, pila] = String(nombre).split(",").map((s) => (s || "").trim());
  const capitalizar = (t) =>
    t
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  return pila ? `${capitalizar(pila)} ${capitalizar(apellidos)}` : capitalizar(apellidos);
}

/*
  Un acta completa, ya desde el punto de vista de un jugador concreto.
  Se filtra por licencia y no por nombre: los nombres llegan con acentos y
  mayúsculas inconsistentes ("MARTíNEZ"), la licencia no.
*/
export function parsearActa(texto, licencia) {
  const cabecera = parsearCabecera(texto);
  const { partidos, dobles } = parsearPartidos(texto);
  const lic = String(licencia);

  const mios = partidos
    .filter((p) => p.licenciaABC === lic || p.licenciaXYZ === lic)
    .map((p) => {
      const soyABC = p.licenciaABC === lic;

      // Los marcadores vienen siempre como ABC - XYZ, así que si juego en XYZ
      // hay que darles la vuelta para verlos desde mi lado.
      const misJuegos = soyABC ? p.juegos[0] : p.juegos[1];
      const susJuegos = soyABC ? p.juegos[1] : p.juegos[0];
      const misSets = p.sets.map(([a, b]) => (soyABC ? [a, b] : [b, a]));

      return {
        fecha: cabecera.fecha,
        jornada: cabecera.jornada,
        competicion: cabecera.competicion,
        temporada: cabecera.temporada,
        miEquipo: soyABC ? cabecera.equipoABC : cabecera.equipoXYZ,
        equipoRival: soyABC ? cabecera.equipoXYZ : cabecera.equipoABC,
        rival: nombreLegible(soyABC ? p.jugadorXYZ : p.jugadorABC),
        licenciaRival: soyABC ? p.licenciaXYZ : p.licenciaABC,
        juegosGanados: misJuegos,
        juegosPerdidos: susJuegos,
        ganado: misJuegos > susJuegos,
        sets: misSets,
        puntosAFavor: misSets.reduce((t, [a]) => t + a, 0),
        puntosEnContra: misSets.reduce((t, [, b]) => t + b, 0),
      };
    });

  return { ...cabecera, dobles, partidos: mios };
}

/* Enlaces a las actas dentro de la página de resultados de un grupo. */
export function extraerEnlacesActa(html) {
  const ids = [...String(html).matchAll(/ligas\/partido\/(\d+)\/imprimir\/acta/g)].map((m) => m[1]);
  return [...new Set(ids)].map((id) => ({
    id,
    url: `https://clubs.rfetm.es/ligas/partido/${id}/imprimir/acta`,
  }));
}

/*
  Enlaces "Ranking tras ..." de la página de la federación murciana.

  Van agrupados bajo cabeceras "TEMPORADA 2025-2026", así que se recorre el HTML
  en orden y cada enlace hereda la última cabecera vista. Sin esto no habría
  forma de saber a qué temporada pertenece un "Ranking tras I OPEN", porque hay
  uno por temporada y algunos ni llevan el año en el nombre.
*/
export function extraerEnlacesRanking(html) {
  const re =
    /TEMPORADA\s*(\d{4})\s*[-/]\s*(\d{2,4})|<a[^>]*href="https:\/\/drive\.google\.com\/file\/d\/([^/]+)\/[^"]*"[^>]*>([^<]*Ranking tras[^<]*)<\/a>/gi;

  const enlaces = [];
  let temporada = "";

  for (const m of String(html).matchAll(re)) {
    if (m[1]) {
      const fin = m[2].length === 2 ? `20${m[2]}` : m[2];
      temporada = `${m[1]}-${fin}`;
      continue;
    }
    enlaces.push({
      temporada,
      idDrive: m[3],
      nombre: m[4].trim(),
      // La URL de "ver" devuelve una página HTML; esta descarga el PDF.
      url: `https://drive.google.com/uc?export=download&id=${m[3]}`,
    });
  }

  return enlaces;
}

/* Temporadas que tienen algún ranking publicado, de más reciente a más antigua. */
export function temporadasConRanking(enlaces = []) {
  return [...new Set(enlaces.map((e) => e.temporada).filter(Boolean))].sort().reverse();
}

/*
  Normaliza el nombre de temporada a "2025-2026".
  Las actas la escriben "2025/2026" y la URL de la RFETM "2025-2026".
*/
export function normalizarTemporada(t = "") {
  const m = String(t).match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (!m) return "";
  const fin = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${m[1]}-${fin}`;
}

/*
  Fila de un jugador en un ranking de pruebas autonómicas. El PDF trae una
  página por categoría y filas del tipo:

    9º Sandra Maneiros CDTM Féminas Cartagena 34 34

  Se busca por nombre porque estos PDFs no llevan licencia.
*/
export function buscarEnRanking(texto, nombreBuscado) {
  const buscado = sinAcentos(nombreBuscado);
  const lineas = String(texto).split(/\r?\n/);
  let categoria = "";
  const encontrados = [];

  // La categoría aparece DESPUÉS de sus filas en el texto extraído, así que se
  // recorre al revés para saber a cuál pertenece cada una.
  for (let i = lineas.length - 1; i >= 0; i--) {
    const linea = lineas[i];
    const cat = linea.match(/CATEGORIA\s+(.+)$/i);
    if (cat) {
      categoria = cat[1].trim();
      continue;
    }

    const fila = linea.match(/^\s*(\d+)[ºª]\s+(.+?)\s+((?:\d+\s+)*\d+)\s*$/);
    if (!fila) continue;
    if (!sinAcentos(fila[2]).includes(buscado)) continue;

    const numeros = fila[3].trim().split(/\s+/).map(Number);
    encontrados.push({
      categoria,
      puesto: Number(fila[1]),
      // El último número es el total; los anteriores, lo sacado en cada prueba.
      total: numeros[numeros.length - 1],
      porPrueba: numeros.slice(0, -1),
      linea: fila[2].trim(),
    });
  }

  return encontrados;
}

export function sinAcentos(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Estadísticas de una lista de partidos individuales.
*/
export function estadisticas(partidos = []) {
  const jugados = partidos.length;
  const ganados = partidos.filter((p) => p.ganado).length;

  const juegosAFavor = partidos.reduce((t, p) => t + p.juegosGanados, 0);
  const juegosEnContra = partidos.reduce((t, p) => t + p.juegosPerdidos, 0);
  const puntosAFavor = partidos.reduce((t, p) => t + p.puntosAFavor, 0);
  const puntosEnContra = partidos.reduce((t, p) => t + p.puntosEnContra, 0);

  return {
    jugados,
    ganados,
    perdidos: jugados - ganados,
    porcentaje: jugados ? Math.round((ganados / jugados) * 100) : 0,
    juegosAFavor,
    juegosEnContra,
    puntosAFavor,
    puntosEnContra,
    // Un 3-0 y un 3-2 no valen lo mismo: esto lo distingue.
    ratioJuegos: juegosEnContra ? +(juegosAFavor / juegosEnContra).toFixed(2) : juegosAFavor,
  };
}

/* Evolución jornada a jornada, para las gráficas. */
export function porJornada(partidos = []) {
  const mapa = new Map();

  [...partidos]
    .sort((a, b) => (a.jornada ?? 0) - (b.jornada ?? 0))
    .forEach((p) => {
      const clave = p.jornada ?? 0;
      if (!mapa.has(clave))
        mapa.set(clave, {
          jornada: clave,
          fecha: p.fecha,
          jugados: 0,
          ganados: 0,
          juegosAFavor: 0,
          juegosEnContra: 0,
        });
      const j = mapa.get(clave);
      j.jugados += 1;
      j.ganados += p.ganado ? 1 : 0;
      j.juegosAFavor += p.juegosGanados;
      j.juegosEnContra += p.juegosPerdidos;
    });

  // Porcentaje acumulado: enseña la forma a lo largo de la temporada, no el
  // diente de sierra de ganar o perder un partido suelto.
  let jugadosAcum = 0;
  let ganadosAcum = 0;
  return [...mapa.values()].map((j) => {
    jugadosAcum += j.jugados;
    ganadosAcum += j.ganados;
    return { ...j, acumulado: Math.round((ganadosAcum / jugadosAcum) * 100) };
  });
}

/* Balance contra cada rival, de más veces jugado a menos. */
export function porRival(partidos = []) {
  const mapa = new Map();
  partidos.forEach((p) => {
    const actual = mapa.get(p.rival) || { rival: p.rival, jugados: 0, ganados: 0 };
    actual.jugados += 1;
    actual.ganados += p.ganado ? 1 : 0;
    mapa.set(p.rival, actual);
  });
  return [...mapa.values()]
    .map((r) => ({ ...r, perdidos: r.jugados - r.ganados }))
    .sort((a, b) => b.jugados - a.jugados || b.ganados - a.ganados);
}
