import { describe, it, expect } from "vitest";
import { toCSV, monthLabel, lastNMonths, fmtEuro, monthKey } from "./ui";

describe("utilidades de UI", () => {
  it("fmtEuro añade el símbolo", () => {
    expect(fmtEuro(1000)).toContain("€");
    expect(fmtEuro(0)).toContain("0");
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
