import { describe, it, expect } from "vitest";
import { caminoSuave, puntoMasCercano } from "./curva";

/*
  Recorre el camino SVG evaluando cada bézier para comprobar por dónde pasa la
  curva de verdad, no solo por dónde dice el texto que pasa.
*/
function alturasDe(camino) {
  const numeros = camino.match(/-?\d+(\.\d+)?/g).map(Number);
  const alturas = [];
  // M x,y y luego grupos de 6 números por cada C.
  let x0 = numeros[0];
  let y0 = numeros[1];
  for (let i = 2; i + 5 < numeros.length; i += 6) {
    const [cx1, cy1, cx2, cy2, x1, y1] = numeros.slice(i, i + 6);
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      alturas.push(u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y1);
    }
    x0 = x1;
    y0 = y1;
  }
  return alturas;
}

describe("caminoSuave", () => {
  it("empieza en el primer punto y termina en el último", () => {
    const d = caminoSuave([[0, 10], [10, 20], [20, 5]]);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.endsWith("20,5")).toBe(true);
  });

  it("con dos puntos traza una recta, sin curva", () => {
    expect(caminoSuave([[0, 0], [10, 10]])).toBe("M0,0 L10,10");
  });

  it("no se sale del rango de los datos (esto es lo importante)", () => {
    /*
      Con una curva suave normal (Catmull-Rom o Bézier a ojo), este perfil
      dibuja un valle por debajo de 5 entre el segundo y el tercer punto: un
      mínimo que no existe en los datos. En una gráfica de peso o de euros eso
      es inventarse una bajada.
    */
    const datos = [[0, 5], [10, 30], [20, 30], [30, 5]];
    const alturas = alturasDe(caminoSuave(datos));
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(5 - 0.001);
    expect(Math.max(...alturas)).toBeLessThanOrEqual(30 + 0.001);
  });

  it("una subida constante nunca baja por el camino", () => {
    const alturas = alturasDe(caminoSuave([[0, 0], [10, 10], [20, 20], [30, 40]]));
    for (let i = 1; i < alturas.length; i++) {
      expect(alturas[i]).toBeGreaterThanOrEqual(alturas[i - 1] - 0.001);
    }
  });

  it("un pico aislado no rebota por debajo del mínimo", () => {
    // Serie casi plana con un pico: el clásico que dispara la curva.
    const alturas = alturasDe(caminoSuave([[0, 10], [10, 10], [20, 90], [30, 10], [40, 10]]));
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(10 - 0.001);
  });

  it("aguanta listas vacías, de un punto y con x repetida", () => {
    expect(caminoSuave([])).toBe("");
    expect(caminoSuave([[3, 4]])).toBe("M3,4");
    // Dos puntos con la misma x darían una división por cero.
    expect(caminoSuave([[0, 0], [0, 5], [10, 10]])).not.toContain("NaN");
  });

  it("una serie totalmente plana se queda plana", () => {
    const alturas = alturasDe(caminoSuave([[0, 7], [10, 7], [20, 7], [30, 7]]));
    alturas.forEach((a) => expect(a).toBeCloseTo(7, 5));
  });
});

describe("puntoMasCercano", () => {
  const xs = [0, 50, 100, 150];

  it("encuentra el índice más próximo", () => {
    expect(puntoMasCercano(xs, 0)).toBe(0);
    expect(puntoMasCercano(xs, 48)).toBe(1);
    expect(puntoMasCercano(xs, 140)).toBe(3);
  });

  it("fuera de rango se queda en el extremo", () => {
    expect(puntoMasCercano(xs, -30)).toBe(0);
    expect(puntoMasCercano(xs, 900)).toBe(3);
  });

  it("en el punto medio exacto se queda con el primero", () => {
    expect(puntoMasCercano(xs, 25)).toBe(0);
  });

  it("sin datos devuelve -1", () => {
    expect(puntoMasCercano([], 10)).toBe(-1);
  });
});
