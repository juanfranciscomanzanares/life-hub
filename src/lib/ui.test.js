import { describe, it, expect } from "vitest";
import { toCSV, monthLabel, lastNMonths, fmtEuro, monthKey, todayISO } from "./ui";

describe("todayISO", () => {
  it("usa la hora LOCAL, no UTC", () => {
    /*
      Fallo real: con toISOString(), a las 00:30 del 30 de julio en España
      (UTC+2) la fecha en UTC sigue siendo el 29, así que una serie de gimnasio
      apuntada de madrugada se guardaba con la fecha de ayer.

      El test construye la medianoche y pico LOCAL, sea cual sea la zona de la
      máquina, y comprueba que sale el mismo día que marca el calendario.
    */
    const madrugada = new Date(2026, 6, 30, 0, 30); // 30 de julio, 00:30 local
    expect(todayISO(madrugada)).toBe("2026-07-30");
  });

  it("rellena mes y día con cero", () => {
    expect(todayISO(new Date(2027, 0, 5))).toBe("2027-01-05");
  });

  it("sin argumentos devuelve hoy en formato ISO corto", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("utilidades de UI", () => {
  it("fmtEuro añade el símbolo", () => {
    expect(fmtEuro(1000)).toContain("€");
    expect(fmtEuro(0)).toContain("0");
  });

  it("fmtEuro corta los restos de la coma flotante", () => {
    // 800 - 600.9 en coma flotante da 199.10000000000002
    expect(fmtEuro(199.10000000000002)).toBe("199,10€");
    expect(fmtEuro(600.9000000000001)).toBe("600,90€");
  });

  it("fmtEuro pone los céntimos de dos en dos, o ninguno", () => {
    expect(fmtEuro(68.4)).toBe("68,40€");
    expect(fmtEuro(13)).toBe("13€");
    expect(fmtEuro(-32.5)).toBe("-32,50€");
  });

  it("toCSV escapa comillas y separadores", () => {
    const csv = toCSV([
      { a: 1, b: "x" },
      { a: 2, b: "y;z" },
    ]);
    const filas = csv.split("\n");
    expect(filas[0]).toBe("a;b");
    expect(csv).toContain('"y;z"');
  });

  it("lastNMonths devuelve N meses en orden", () => {
    const m = lastNMonths(6);
    expect(m.length).toBe(6);
    expect(m[0] <= m[5]).toBe(true);
    expect(/^\d{4}-\d{2}$/.test(m[0])).toBe(true);
  });

  it("monthKey y monthLabel", () => {
    expect(monthKey("2026-07-21")).toBe("2026-07");
    expect(monthLabel("2026-01")).toContain("Ene");
  });
});
