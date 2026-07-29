/*
  Trazado de curvas para las gráficas de línea.

  Se usa una spline cúbica MONÓTONA (Fritsch–Carlson) y no una Bézier suave
  cualquiera. La diferencia importa: una curva normal se pasa de largo entre
  dos puntos y dibuja valles y picos que no existen. En estas gráficas eso
  sería mentir — un peso de 70 y otro de 72 no pueden pintar una bajada a 68 en
  medio, y con datos que no pueden ser negativos (kg, horas, euros) la curva
  llegaría a cruzar el cero.

  La spline monótona garantiza que entre dos puntos la curva solo sube si los
  datos suben y solo baja si bajan.
*/

/*
  Pendientes en cada punto, con la corrección de Fritsch–Carlson.

  La idea: se parte de la pendiente media entre vecinos y, allí donde los datos
  cambian de dirección (un máximo o un mínimo local), la pendiente se fuerza a
  cero. Eso es lo que impide el rebote.
*/
function pendientes(puntos) {
  const n = puntos.length;
  const dx = [];
  const dy = [];
  const delta = [];

  for (let i = 0; i < n - 1; i++) {
    dx[i] = puntos[i + 1][0] - puntos[i][0];
    dy[i] = puntos[i + 1][1] - puntos[i][1];
    // dx puede ser 0 si dos puntos comparten x; sin este guardo saldría NaN.
    delta[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  const m = new Array(n);
  m[0] = delta[0] ?? 0;
  m[n - 1] = delta[n - 2] ?? 0;

  for (let i = 1; i < n - 1; i++) {
    // Cambio de dirección (o tramo plano): pendiente cero, sin rebote.
    if (delta[i - 1] * delta[i] <= 0) m[i] = 0;
    else m[i] = (delta[i - 1] + delta[i]) / 2;
  }

  // Ajuste final: limitar la pendiente a tres veces la del tramo evita que la
  // curva se dispare justo antes de un punto.
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = Math.hypot(a, b);
    if (s > 3) {
      m[i] = ((3 / s) * a) * delta[i];
      m[i + 1] = ((3 / s) * b) * delta[i];
    }
  }

  return m;
}

/*
  Camino SVG que pasa por todos los puntos con curva monótona.

  `puntos` es una lista de [x, y] ya en coordenadas del lienzo.
*/
export function caminoSuave(puntos = []) {
  if (puntos.length === 0) return "";
  if (puntos.length === 1) return `M${puntos[0][0]},${puntos[0][1]}`;
  if (puntos.length === 2) {
    return `M${puntos[0][0]},${puntos[0][1]} L${puntos[1][0]},${puntos[1][1]}`;
  }

  const m = pendientes(puntos);
  let d = `M${puntos[0][0]},${puntos[0][1]}`;

  for (let i = 0; i < puntos.length - 1; i++) {
    const [x0, y0] = puntos[i];
    const [x1, y1] = puntos[i + 1];
    // Los puntos de control a un tercio del tramo son la conversión estándar
    // de una hermite cúbica a la bézier que entiende SVG.
    const t = (x1 - x0) / 3;
    d += ` C${x0 + t},${y0 + m[i] * t} ${x1 - t},${y1 - m[i + 1] * t} ${x1},${y1}`;
  }

  return d;
}

/*
  Índice del punto más cercano a una coordenada x.

  Es lo que hace que el cursor no tenga que acertar sobre la línea: basta con
  estar más cerca de un punto que de otro.
*/
export function puntoMasCercano(xs = [], x) {
  if (xs.length === 0) return -1;
  let mejor = 0;
  let distancia = Math.abs(xs[0] - x);
  for (let i = 1; i < xs.length; i++) {
    const d = Math.abs(xs[i] - x);
    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  }
  return mejor;
}
