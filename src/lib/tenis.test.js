import { describe, it, expect } from "vitest";
import {
  parsearCabecera,
  parsearPartidos,
  parsearActa,
  extraerEnlacesActa,
  extraerEnlacesRanking,
  temporadasConRanking,
  normalizarTemporada,
  buscarEnRanking,
  nombreLegible,
  estadisticas,
  porJornada,
  porRival,
  parsearTotalesJugador,
  parsearPaginaJugador,
  rendimientoPorSet,
  remontadas,
  clutch,
  rachas,
  porLetra,
} from "./tenis";

const LICENCIA = "23789";

/*
  Textos reales extraídos de las actas de la RFETM. Se usan tal cual para que
  los tests fallen si la federación cambia el formato del PDF.
*/

// Jornada 1: Eliocroca es VISITANTE y además juega en el lado XYZ.
// Pierde los dos individuales por 0-3.
const ACTA_J1 = `Acta del partido celebrado en Totana (Murcia) el día 28 de Septiembre de 2025 a las 10:30 horas.
Local de juego PABELLON MANOLO IBAÑEZ Competición Segunda División Masculina Grupo 11 J. 1 TEMPORADA 2025/2026
Equipo Local: FRAMUSA TOTANA Equipo Visitante: ASOCIACION DEPORTIVA ELIOCROCA LORCA TM
Árbitro Principal: CANO VERA, FRANCISCO Lic: 17112 Árbitro Asistente: Lic:
ABC FRAMUSA TOTANA XYZ ASOCIACION DEPORTIVA ELIOCROCA LORCA TM J1 J2 J3 J4 J5 JUEG. TOT.
A MENDEZ GARCIA, DOMINGO (17430) Y MONTES ROSA, PEDRO ANTONIO (7376) 11 - 6 11 - 9 11 - 9 3 - 0 1 - 0
B MENDEZ GARCIA, SANTIAGO (17431) X MANZANARES GOMEZ, JUAN FRANCISCO (23789) 11 - 4 11 - 9 11 - 2 3 - 0 2 - 0
C MARTINEZ HERNANDEZ, JOSE (34923) Z MARTINEZ GARCIA, MATEO (1343) 11 - 4 6 - 11 11 - 6 7 - 11 11 - 3 3 - 2 3 - 0
A MENDEZ GARCIA, DOMINGO (17430) X MANZANARES GOMEZ, JUAN FRANCISCO (23789) 11 - 6 11 - 0 11 - 9 3 - 0 4 - 0
C MARTINEZ HERNANDEZ, JOSE (34923) Y MONTES ROSA, PEDRO ANTONIO (7376) 11 - 9 14 - 12 4 - 11 8 - 11 12 - 10 3 - 2 5 - 0
B MENDEZ GARCIA, SANTIAGO (17431) Z MARTINEZ GARCIA, MATEO (1343) 11 - 9 8 - 11 11 - 8 8 - 11 11 - 8 3 - 2 6 - 0
GANADOR:
FRAMUSA TOTANA`;

// Jornada 2: el local es CTM ILICITANO pero Eliocroca aparece como ABC.
// Es el caso que demuestra que ABC/XYZ no equivale a local/visitante.
const ACTA_J2 = `Acta del partido celebrado en Elche/Elx (Alicante) el día 05 de Octubre de 2025 a las 10:00 horas.
Local de juego PABELLON ESPERANZA LAG Competición Segunda División Masculina Grupo 11 J. 2 TEMPORADA 2025/2026
Equipo Local: CTM ILICITANO Equipo Visitante: ASOCIACION DEPORTIVA ELIOCROCA LORCA TM
ABC ASOCIACION DEPORTIVA ELIOCROCA LORCA TM XYZ CTM ILICITANO J1 J2 J3 J4 J5 JUEG. TOT.
A MARTINEZ GARCIA, MATEO (1343) Y TEJUELO GARCIA, JOSE ANTONIO (943) 11 - 6 11 - 6 11 - 5 3 - 0 1 - 0
B MANZANARES GOMEZ, JUAN FRANCISCO (23789) X IBAÑEZ CARRILLO, FRANCISCO JOSE (1521) 5 - 11 12 - 10 6 - 11 6 - 11 1 - 3 1 - 1
C MONTES ROSA, PEDRO ANTONIO (7376) Z ARANGUREN PEREZ, DIONISIO DOMINGO (18404) 8 - 11 11 - 9 14 - 12 11 - 13 7 - 11 2 - 3 1 - 2
A MARTINEZ GARCIA, MATEO (1343) X IBAÑEZ CARRILLO, FRANCISCO JOSE (1521) 6 - 11 6 - 11 9 - 11 0 - 3 1 - 3
C MONTES ROSA, PEDRO ANTONIO (7376) Y TEJUELO GARCIA, JOSE ANTONIO (943) 11 - 7 11 - 7 11 - 4 3 - 0 2 - 3
B MANZANARES GOMEZ, JUAN FRANCISCO (23789) Z ARANGUREN PEREZ, DIONISIO DOMINGO (18404) 11 - 6 8 - 11 11 - 4 11 - 6 3 - 1 3 - 3
Db MONTES ROSA, PEDRO ANTONIO (7376)
MARTINEZ GARCIA, MATEO (1343) Db IBAÑEZ CARRILLO, FRANCISCO JOSE (1521)
GANADOR:
ASOCIACION DEPORTIVA ELIOCROCA LORCA TM`;

describe("cabecera del acta", () => {
  it("saca fecha, competición, jornada, temporada y equipos", () => {
    expect(parsearCabecera(ACTA_J1)).toMatchObject({
      fecha: "2025-09-28",
      competicion: "Segunda División Masculina Grupo 11",
      jornada: 1,
      temporada: "2025/2026",
      local: "FRAMUSA TOTANA",
      visitante: "ASOCIACION DEPORTIVA ELIOCROCA LORCA TM",
    });
  });

  it("distingue los lados ABC y XYZ del equipo local y visitante", () => {
    /*
      Esta es la trampa del formato: en la jornada 2 el equipo LOCAL es CTM
      Ilicitano y sin embargo Eliocroca figura como lado ABC. Guiarse por
      "Equipo Local" para saber de qué lado están los marcadores daría todos
      los resultados invertidos.
    */
    const c = parsearCabecera(ACTA_J2);
    expect(c.local).toBe("CTM ILICITANO");
    expect(c.equipoABC).toBe("ASOCIACION DEPORTIVA ELIOCROCA LORCA TM");
    expect(c.equipoXYZ).toBe("CTM ILICITANO");
  });
});

describe("partidos individuales", () => {
  it("lee los seis individuales de un acta", () => {
    const { partidos } = parsearPartidos(ACTA_J1);
    expect(partidos).toHaveLength(6);
  });

  it("separa los sets del total de juegos y del marcador acumulado", () => {
    const { partidos } = parsearPartidos(ACTA_J1);
    // "11 - 4 11 - 9 11 - 2 3 - 0 2 - 0": tres sets, juegos 3-0, acumulado 2-0
    const suyo = partidos.find((p) => p.licenciaXYZ === LICENCIA);
    expect(suyo.sets).toEqual([[11, 4], [11, 9], [11, 2]]);
    expect(suyo.juegos).toEqual([3, 0]);
    expect(suyo.acumulado).toEqual([2, 0]);
  });

  it("lee partidos de cinco sets", () => {
    const { partidos } = parsearPartidos(ACTA_J2);
    const cinco = partidos.find((p) => p.sets.length === 5);
    expect(cinco.sets).toEqual([[8, 11], [11, 9], [14, 12], [11, 13], [7, 11]]);
    expect(cinco.juegos).toEqual([2, 3]);
  });

  it("los juegos coinciden con los sets ganados por cada lado", () => {
    // Comprobación de coherencia: si el parseo se desalineara, esto saltaría.
    const { partidos } = parsearPartidos(ACTA_J2);
    partidos.forEach((p) => {
      const abc = p.sets.filter(([a, b]) => a > b).length;
      const xyz = p.sets.filter(([a, b]) => b > a).length;
      expect([abc, xyz]).toEqual(p.juegos);
    });
  });

  it("cuenta los dobles aparte en vez de colarlos como individuales", () => {
    const { partidos, dobles } = parsearPartidos(ACTA_J2);
    expect(dobles).toBeGreaterThan(0);
    expect(partidos.every((p) => p.licenciaABC && p.licenciaXYZ)).toBe(true);
  });
});

describe("acta desde el punto de vista de un jugador", () => {
  it("encuentra sus dos partidos jugando en el lado XYZ", () => {
    const acta = parsearActa(ACTA_J1, LICENCIA);
    expect(acta.partidos).toHaveLength(2);
    expect(acta.partidos.every((p) => !p.ganado)).toBe(true);
  });

  it("invierte los marcadores cuando juega en XYZ", () => {
    /*
      El acta escribe siempre ABC - XYZ. En la jornada 1 él es XYZ, así que un
      "11 - 4" del acta es un 4-11 para él. Sin invertir, un 0-3 se leería como
      un 3-0.
    */
    const acta = parsearActa(ACTA_J1, LICENCIA);
    const p = acta.partidos[0];
    expect(p.juegosGanados).toBe(0);
    expect(p.juegosPerdidos).toBe(3);
    expect(p.sets[0]).toEqual([4, 11]);
    expect(p.ganado).toBe(false);
  });

  it("no invierte nada cuando juega en ABC", () => {
    const acta = parsearActa(ACTA_J2, LICENCIA);
    const ganado = acta.partidos.find((p) => p.ganado);
    expect(ganado.juegosGanados).toBe(3);
    expect(ganado.juegosPerdidos).toBe(1);
    expect(ganado.sets[0]).toEqual([11, 6]);
  });

  it("identifica al rival y su equipo, no a un compañero", () => {
    const acta = parsearActa(ACTA_J2, LICENCIA);
    expect(acta.partidos.map((p) => p.rival)).toEqual([
      "Francisco Jose Ibañez Carrillo",
      "Dionisio Domingo Aranguren Perez",
    ]);
    expect(acta.partidos[0].equipoRival).toBe("CTM ILICITANO");
    expect(acta.partidos[0].miEquipo).toBe("ASOCIACION DEPORTIVA ELIOCROCA LORCA TM");
  });

  it("suma los puntos a favor y en contra de cada partido", () => {
    const acta = parsearActa(ACTA_J2, LICENCIA);
    const p = acta.partidos[0]; // 5-11 12-10 6-11 6-11
    expect(p.puntosAFavor).toBe(29);
    expect(p.puntosEnContra).toBe(43);
  });

  it("una licencia que no jugó devuelve cero partidos", () => {
    expect(parsearActa(ACTA_J1, "99999").partidos).toEqual([]);
  });
});

describe("enlaces de las federaciones", () => {
  it("saca las actas de la página de resultados sin repetir", () => {
    const html = `<a href='https://clubs.rfetm.es/ligas/partido/30189/imprimir/acta'>x</a>
      <a href='https://clubs.rfetm.es/ligas/partido/30189/imprimir/acta'>x</a>
      <a href='https://clubs.rfetm.es/ligas/partido/30193/imprimir/acta'>y</a>`;
    expect(extraerEnlacesActa(html).map((a) => a.id)).toEqual(["30189", "30193"]);
  });

  it("asigna cada ranking a la temporada de su cabecera", () => {
    /*
      Los enlaces no llevan la temporada dentro: "Ranking tras I OPEN" existe en
      varias. Lo único que los distingue es bajo qué cabecera están.
    */
    const html = `<h3>TEMPORADA 2025-2026</h3>
      <a href="https://drive.google.com/file/d/AAA/view?usp=sharing">Ranking tras I OPEN</a>
      <h3>TEMPORADA 2024-2025</h3>
      <a href="https://drive.google.com/file/d/BBB/view?usp=sharing">Ranking tras I OPEN</a>`;
    const enlaces = extraerEnlacesRanking(html);

    expect(enlaces).toHaveLength(2);
    expect(enlaces[0]).toMatchObject({ temporada: "2025-2026", idDrive: "AAA" });
    expect(enlaces[1]).toMatchObject({ temporada: "2024-2025", idDrive: "BBB" });
    expect(enlaces[0].url).toContain("uc?export=download");
    expect(temporadasConRanking(enlaces)).toEqual(["2025-2026", "2024-2025"]);
  });

  it("no confunde los rankings de opens con los de ligas regionales", () => {
    /*
      En la misma página conviven dos columnas:
      - "RANKING JUGADORES LIGAS": ligas REGIONALES murcianas, que no interesan
        porque la liga que se juega es la nacional de la RFETM. Se llaman
        "22 Ranking 9 mayo 2026", sin la palabra "tras".
      - "RANKING INDIVIDUAL TRAS PRUEBA": los opens y campeonatos autonómicos.

      Y ojo con "Ranking FINAL tras TOP 8": con un filtro de "Ranking tras"
      literal se quedaba fuera, y es el ranking final de la temporada.
    */
    const html = `<h3>TEMPORADA 2025-2026</h3>
      <a href="https://drive.google.com/file/d/L1/view">22 Ranking 9 mayo 2026</a>
      <a href="https://drive.google.com/file/d/L2/view">16 Ranking 7 marzo 2026</a>
      <a href="https://drive.google.com/file/d/P1/view">Ranking Final tras TOP 8 Autonómico</a>
      <a href="https://drive.google.com/file/d/P2/view">Ranking tras I OPEN 2025 26</a>`;

    const nombres = extraerEnlacesRanking(html).map((e) => e.nombre);
    expect(nombres).toEqual(["Ranking Final tras TOP 8 Autonómico", "Ranking tras I OPEN 2025 26"]);
    expect(nombres.some((n) => /^\d+\s+Ranking/.test(n))).toBe(false);
  });

  it("unifica cómo se escribe la temporada en cada fuente", () => {
    // El acta pone "2025/2026" y la URL de la RFETM "2025-2026".
    expect(normalizarTemporada("2025/2026")).toBe("2025-2026");
    expect(normalizarTemporada("2025-2026")).toBe("2025-2026");
    expect(normalizarTemporada("2025-26")).toBe("2025-2026");
    expect(normalizarTemporada("")).toBe("");
  });
});

describe("rankings de opens", () => {
  const RANKING = `PUESTO
JUGADOR EQUIPO
I OPEN
II OPEN
TOTAL
1º Vicente Giménez CTM Murcia 75 75
9º Sandra Maneiros CDTM Féminas Cartagena 34 34
RANKING TRAS I OPEN
CATEGORIA SENIOR
3º Juan Francisco Manzanares ELIOCROCA LORCA 50 20 70
RANKING TRAS I OPEN
CATEGORIA ABSOLUTO`;

  it("encuentra al jugador con su puesto y sus puntos por prueba", () => {
    const [r] = buscarEnRanking(RANKING, "Manzanares");
    expect(r).toMatchObject({ puesto: 3, total: 70, porPrueba: [50, 20] });
  });

  it("asigna la categoría correcta pese a que va después de las filas", () => {
    // En el texto extraído del PDF la cabecera aparece DEBAJO de sus filas.
    const [r] = buscarEnRanking(RANKING, "Manzanares");
    expect(r.categoria).toBe("ABSOLUTO");
  });

  it("busca sin distinguir acentos ni mayúsculas", () => {
    expect(buscarEnRanking(RANKING, "GIMÉNEZ")).toHaveLength(1);
    expect(buscarEnRanking(RANKING, "gimenez")).toHaveLength(1);
  });

  it("devuelve vacío si no participaste", () => {
    expect(buscarEnRanking(RANKING, "Pepito Perez")).toEqual([]);
  });
});

describe("estadísticas", () => {
  const partidos = [
    ...parsearActa(ACTA_J1, LICENCIA).partidos,
    ...parsearActa(ACTA_J2, LICENCIA).partidos,
  ];

  it("cuenta jugados, ganados y porcentaje", () => {
    const e = estadisticas(partidos);
    expect(e.jugados).toBe(4);
    expect(e.ganados).toBe(1); // solo el 3-1 de la jornada 2
    expect(e.perdidos).toBe(3);
    expect(e.porcentaje).toBe(25);
  });

  it("suma juegos y puntos de toda la temporada", () => {
    const e = estadisticas(partidos);
    expect(e.juegosAFavor).toBe(4); // 0 + 0 + 1 + 3
    expect(e.juegosEnContra).toBe(10); // 3 + 3 + 3 + 1
    expect(e.puntosAFavor).toBeGreaterThan(0);
  });

  it("una temporada sin partidos no rompe ni divide por cero", () => {
    expect(estadisticas([])).toMatchObject({ jugados: 0, porcentaje: 0 });
  });

  it("agrupa por jornada con el porcentaje acumulado", () => {
    const j = porJornada(partidos);
    expect(j.map((x) => x.jornada)).toEqual([1, 2]);
    expect(j[0]).toMatchObject({ jugados: 2, ganados: 0, acumulado: 0 });
    expect(j[1]).toMatchObject({ jugados: 2, ganados: 1, acumulado: 25 });
  });

  it("agrupa por rival, de más veces jugado a menos", () => {
    const r = porRival(partidos);
    expect(r[0].jugados).toBeGreaterThanOrEqual(r[r.length - 1].jugados);
    expect(r.reduce((t, x) => t + x.jugados, 0)).toBe(4);
  });
});

/*
  Página de resultados por jugador de la RFETM. Fragmento real: dos partidos que
  comparten la celda de fecha y jornada mediante rowspan="2".
*/
const PAGINA_JUGADOR = `<h2>Estad&iacute;sticas Temporada 2025/2026</h2>
<table><tr><td>PARTIDOS JUGADOS</td><td>PARTIDOS GANADOS</td><td>PARTIDOS PERDIDOS</td><td>PORCENTAJE</td></tr>
<tr><td>38</td><td>17</td><td>21</td><td>45 %</td></tr>
<tr><td>PUNTOS DISPUTADOS</td><td>JUEGOS DISPUTADOS</td></tr>
<tr><td>2617 (+81)</td><td>143 (-1)</td></tr>
<tr><td>A FAVOR: 1349</td><td>EN CONTRA: 1268</td><td>A FAVOR: 71</td><td>EN CONTRA: 72</td></tr></table>
<h2>PARTIDOS INDIVIDUALES DISPUTADOS</h2>
<table><tr><td align='center' width='2%'><b>X</b></td><td width='20%'><a href='view.php?jugador=23789&tempo=MTE=' class='looser'><b>MANZANARES GOMEZ, JUAN FRANCISCO</b></a></td><td align='center'><b>B</b></td><td width='20%'><a href='view.php?jugador=30860&tempo=MTE=' class='winner'><b>BORDALLO AZORIN, JUAN MANUEL</b></a></td><td>6-11</td><td>8-11</td><td>7-11</td><td></td><td></td><td><font color='#FF8000'>0</font>-<font color='#21610B'>3</font></td><td rowspan='2'>10/05/2026</td><td rowspan='2'><a href='view.php?tempo=MTE=&liga=NA==&grupo=11&subgrupo=S&jornada=22&sexo=M'><b>SDM - J22</b></a></td></tr>
<tr><td align='center'><b>C</b></td><td><a href='view.php?jugador=40000&tempo=MTE=' class='looser'><b>RIVAL DOS, PEPE</b></a></td><td align='center'><b>Z</b></td><td><a href='view.php?jugador=23789&tempo=MTE=' class='winner'><b>MANZANARES GOMEZ, JUAN FRANCISCO</b></a></td><td>9-11</td><td>8-11</td><td>13-15</td><td></td><td></td><td><font>0</font>-<font>3</font></td></tr></table>`;

describe("página de resultados por jugador (RFETM)", () => {
  it("lee los totales oficiales de la temporada", () => {
    /*
      Este test existe por un fallo real: quitar las etiquetas sustituyéndolas
      por cadena vacía convertía <td>38</td><td>17</td> en "3817", y salían
      38172 partidos jugados. Ahora se sustituyen por un espacio.
    */
    expect(parsearTotalesJugador(PAGINA_JUGADOR)).toEqual({
      jugados: 38,
      ganados: 17,
      perdidos: 21,
      porcentaje: 45,
      puntosAFavor: 1349,
      puntosEnContra: 1268,
      juegosAFavor: 71,
      juegosEnContra: 72,
    });
  });

  it("saca los partidos con su rival, sets y resultado", () => {
    const p = parsearPaginaJugador(PAGINA_JUGADOR, LICENCIA);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({
      fecha: "2026-05-10",
      jornada: 22,
      miLetra: "X",
      suLetra: "B",
      rival: "Juan Manuel Bordallo Azorin",
      ganado: false,
      juegosGanados: 0,
      juegosPerdidos: 3,
    });
  });

  it("arrastra la fecha y la jornada a la fila que las comparte por rowspan", () => {
    // La segunda fila del par no trae celda de fecha: hereda la anterior.
    const p = parsearPaginaJugador(PAGINA_JUGADOR, LICENCIA);
    expect(p[1].fecha).toBe("2026-05-10");
    expect(p[1].jornada).toBe(22);
  });

  it("invierte los marcadores cuando aparece en la segunda columna", () => {
    // En el segundo partido él es el jugador de la derecha y GANA 3-0, pese a
    // que el marcador del acta pone 0-3 desde el punto de vista del otro.
    const p = parsearPaginaJugador(PAGINA_JUGADOR, LICENCIA);
    expect(p[1]).toMatchObject({ ganado: true, juegosGanados: 3, juegosPerdidos: 0 });
    expect(p[1].sets[0]).toEqual([11, 9]);
  });

  it("descarta los sets no jugados en vez de contarlos como 0-0", () => {
    const p = parsearPaginaJugador(PAGINA_JUGADOR, LICENCIA);
    expect(p[0].sets).toHaveLength(3);
  });

  it("una licencia ajena no devuelve nada", () => {
    expect(parsearPaginaJugador(PAGINA_JUGADOR, "1")).toEqual([]);
  });
});

describe("métricas del estudio", () => {
  // 4 partidos: 2 ganados (uno remontando), 2 perdidos (uno derrumbándose).
  const p = [
    { ganado: true, miLetra: "A", fecha: "2026-01-01", sets: [[9, 11], [11, 8], [11, 9], [12, 10]] },
    { ganado: true, miLetra: "A", fecha: "2026-01-08", sets: [[11, 5], [11, 7], [11, 4]] },
    { ganado: false, miLetra: "B", fecha: "2026-01-15", sets: [[11, 9], [8, 11], [9, 11], [7, 11]] },
    { ganado: false, miLetra: "B", fecha: "2026-01-22", sets: [[4, 11], [11, 9], [9, 11], [11, 6], [8, 11]] },
  ];

  it("calcula el porcentaje de cada set", () => {
    const r = rendimientoPorSet(p);
    expect(r[0]).toMatchObject({ set: 1, jugados: 4, ganados: 2, porcentaje: 50 });
    // Solo un partido llegó al quinto set, y se perdió.
    expect(r[4]).toMatchObject({ set: 5, jugados: 1, ganados: 0, porcentaje: 0 });
  });

  it("distingue remontar de derrumbarse", () => {
    const r = remontadas(p);
    expect(r).toMatchObject({
      empezandoPerdiendo: 2,
      remontados: 1,
      tasaRemontada: 50,
      empezandoGanando: 2,
      remontadosEnContra: 1,
      tasaDerrumbe: 50,
    });
  });

  it("cuenta los sets ajustados y los quintos sets", () => {
    const c = clutch(p);
    expect(c.ajustadosJugados).toBe(1); // el 12-10
    expect(c.ajustadosGanados).toBe(1);
    expect(c.quintosJugados).toBe(1);
    expect(c.quintosGanados).toBe(0);
  });

  it("calcula rachas en orden cronológico", () => {
    const r = rachas(p);
    expect(r.mejorRacha).toBe(2);
    expect(r.peorRacha).toBe(2);
    expect(r.actual).toBe(-2); // acabó con dos derrotas
  });

  it("agrupa el rendimiento por posición en la alineación", () => {
    expect(porLetra(p)).toEqual([
      { letra: "A", jugados: 2, ganados: 2, porcentaje: 100 },
      { letra: "B", jugados: 2, ganados: 0, porcentaje: 0 },
    ]);
  });

  it("ninguna métrica se rompe sin partidos", () => {
    expect(() => {
      rendimientoPorSet([]);
      remontadas([]);
      clutch([]);
      rachas([]);
      porLetra([]);
    }).not.toThrow();
    expect(rachas([]).actual).toBe(0);
  });
});

describe("nombres", () => {
  it("convierte APELLIDOS, NOMBRE en algo legible", () => {
    expect(nombreLegible("MANZANARES GOMEZ, JUAN FRANCISCO")).toBe(
      "Juan Francisco Manzanares Gomez"
    );
  });

  it("aguanta un nombre sin coma", () => {
    expect(nombreLegible("SIN COMA")).toBe("Sin Coma");
  });
});
