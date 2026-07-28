import { describe, it, expect } from "vitest";
import { reemplazarTemporada } from "./tenisSync";

/*
  Regresión de un descuadre real: la app decía 39 partidos y 22 victorias
  mientras la ficha oficial de la RFETM decía 42 y 23.

  Causa: el identificador de cada partido se formaba con la fecha, pero las
  fichas de temporadas pasadas NO traen fecha (0 de 42 en 2024-2025). Dos
  partidos contra el mismo rival y con la misma letra en jornadas distintas
  compartían identificador y uno se perdía al guardar.
*/

// Los tres pares que colisionaban de verdad en la temporada 2024-2025.
const partidos24 = [
  { jornada: 15, licenciaRival: "18404", miLetra: "A", fecha: "", ganado: false },
  { jornada: 11, licenciaRival: "18404", miLetra: "A", fecha: "", ganado: true },
  { jornada: 15, licenciaRival: "1521", miLetra: "A", fecha: "", ganado: false },
  { jornada: 11, licenciaRival: "1521", miLetra: "A", fecha: "", ganado: false },
  { jornada: 12, licenciaRival: "14813", miLetra: "A", fecha: "", ganado: true },
  { jornada: 9, licenciaRival: "14813", miLetra: "A", fecha: "", ganado: true },
];

const idConFecha = (t, p) => `${t}-${p.fecha}-${p.licenciaRival}-${p.miLetra}`;
const idConJornada = (t, p) => `${t}-J${p.jornada}-${p.licenciaRival}-${p.miLetra}`;

describe("identificador de partido", () => {
  it("con la fecha se pierden partidos cuando la ficha no la trae", () => {
    // Deja constancia del fallo que se corrigió.
    const ids = new Set(partidos24.map((p) => idConFecha("2024-2025", p)));
    expect(ids.size).toBe(3);
    expect(ids.size).toBeLessThan(partidos24.length);
  });

  it("con la jornada cada partido es único", () => {
    const ids = new Set(partidos24.map((p) => idConJornada("2024-2025", p)));
    expect(ids.size).toBe(partidos24.length);
  });
});

describe("reemplazarTemporada", () => {
  const viejos = [
    { id: "a", temporada: "2024-2025" },
    { id: "b", temporada: "2024-2025" },
    { id: "c", temporada: "2025-2026" },
  ];

  it("sustituye la temporada indicada y deja intactas las demás", () => {
    const r = reemplazarTemporada(viejos, [{ id: "z", temporada: "2024-2025" }], "2024-2025");
    expect(r.map((x) => x.id).sort()).toEqual(["c", "z"]);
  });

  it("no deja conviviendo filas antiguas cuando cambia el formato del id", () => {
    /*
      Esto es lo que haría una fusión por id: los identificadores viejos
      (con fecha) y los nuevos (con jornada) son distintos, así que se
      acumularían unos con otros y saldrían partidos duplicados.
    */
    const conIdViejo = [{ id: "2024-2025--18404-A", temporada: "2024-2025" }];
    const conIdNuevo = [
      { id: "2024-2025-J15-18404-A", temporada: "2024-2025" },
      { id: "2024-2025-J11-18404-A", temporada: "2024-2025" },
    ];
    const r = reemplazarTemporada(conIdViejo, conIdNuevo, "2024-2025");
    expect(r).toHaveLength(2);
    expect(r.some((x) => x.id === "2024-2025--18404-A")).toBe(false);
  });

  it("añadir una temporada nueva no toca las anteriores", () => {
    const r = reemplazarTemporada(viejos, [{ id: "n", temporada: "2026-2027" }], "2026-2027");
    expect(r).toHaveLength(4);
  });
});
