import { describe, it, expect } from "vitest";
import { lunesDe } from "./TenisEntrenos.jsx";

/*
  Agrupar por semana es la parte delicada: en JavaScript getDay() devuelve 0
  para el DOMINGO, así que restar getDay() sin más mandaría el domingo a la
  semana siguiente y descuadraría las horas.
*/
describe("lunesDe", () => {
  it("un lunes se devuelve a sí mismo", () => {
    expect(lunesDe("2026-07-27")).toBe("2026-07-27"); // lunes
  });

  it("cualquier día entre semana cae en su lunes", () => {
    expect(lunesDe("2026-07-28")).toBe("2026-07-27"); // martes
    expect(lunesDe("2026-07-30")).toBe("2026-07-27"); // jueves
    expect(lunesDe("2026-08-01")).toBe("2026-07-27"); // sábado
  });

  it("el domingo cuenta en la semana que termina, no en la siguiente", () => {
    expect(lunesDe("2026-08-02")).toBe("2026-07-27"); // domingo
    // El lunes siguiente ya es otra semana.
    expect(lunesDe("2026-08-03")).toBe("2026-08-03");
  });

  it("funciona a caballo entre dos meses y dos años", () => {
    expect(lunesDe("2026-12-31")).toBe("2026-12-28"); // jueves
    expect(lunesDe("2027-01-01")).toBe("2026-12-28"); // viernes
    expect(lunesDe("2027-01-03")).toBe("2026-12-28"); // domingo
  });

  it("una fecha vacía o inválida no rompe el agrupado", () => {
    expect(lunesDe("")).toBe("");
    expect(lunesDe("no es una fecha")).toBe("");
  });
});
