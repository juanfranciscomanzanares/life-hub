/*
  Gráficos reutilizables, sin librerías externas.

  Se apoyan en SVG en lugar de en divs con altura en porcentaje: se escalan
  solos al ancho disponible, permiten rejilla y etiquetas legibles, y no
  desbordan en el móvil.

  Sobre los colores: lo ESTRUCTURAL (rejilla, fondo del anillo) usa las
  variables de la paleta, así que sigue al tema claro y al color de acento. Un
  hex fijo se veía bien en oscuro y desaparecía en claro.

  Lo que sí queda fijo son los colores de SERIE cuando se pasan a mano desde
  una sección (verde = ganado, rojo = perdido): ahí el color significa algo y
  tiene que decir lo mismo en los dos temas.
*/
import { useState, useId } from "react";
import { caminoSuave } from "./curva";

// Anillo de proporción. Para un reparto de dos valores (ganados/perdidos) se
// lee de un vistazo mucho mejor que dos barras.
export function Anillo({ valor, total, etiqueta, color = "rgb(var(--c-emerald-400))", fondo = "rgb(var(--c-slate-700))" }) {
  const r = 52;
  const circunferencia = 2 * Math.PI * r;
  const proporcion = total ? valor / total : 0;
  const porcentaje = Math.round(proporcion * 100);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 130 130" className="h-32 w-32 -rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke={fondo} strokeWidth="12" />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circunferencia * proporcion} ${circunferencia}`}
        />
        <text
          x="65"
          y="60"
          textAnchor="middle"
          className="rotate-90 fill-slate-100 text-[26px] font-bold"
          style={{ transformOrigin: "65px 65px" }}
        >
          {porcentaje}%
        </text>
        <text
          x="65"
          y="80"
          textAnchor="middle"
          className="rotate-90 fill-slate-500 text-[12px]"
          style={{ transformOrigin: "65px 65px" }}
        >
          {valor}/{total}
        </text>
      </svg>
      <p className="mt-1 text-xs text-slate-400">{etiqueta}</p>
    </div>
  );
}

/*
  Línea de evolución con área. Para una serie temporal es mucho más claro que
  barras: la tendencia se ve de un vistazo.

  Tres cosas que la hacen legible:

  - La curva es una spline MONÓTONA (ver src/lib/curva.js): suaviza sin
    inventarse valles ni picos entre dos puntos, cosa que una curva suave
    normal sí hace y que en una gráfica de peso o de euros sería mentir.
  - El área se rellena con un degradado que se desvanece hacia abajo, para que
    no compita con la línea, que es la que lleva el dato.
  - El cursor no tiene que acertar sobre la línea: una franja invisible por
    punto captura el ratón y se marca el más cercano. Aciertas apuntando a una
    jornada, no a una línea de 2 píxeles.
*/
export function Linea({ datos, valor, etiqueta, color = "rgb(var(--c-indigo-400))", sufijo = "", max = 100 }) {
  const [activo, setActivo] = useState(null);
  // Un id propio por gráfica: dos degradados con el mismo id en la misma página
  // hacen que la segunda gráfica use el color de la primera.
  const idGrad = useId();

  if (datos.length < 2)
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Hacen falta al menos dos jornadas para ver la evolución.
      </p>
    );

  const W = 600;
  const H = 180;
  const pad = { i: 34, d: 10, arriba: 12, abajo: 24 };
  const ancho = W - pad.i - pad.d;
  const alto = H - pad.arriba - pad.abajo;
  const tope = Math.max(max, ...datos.map(valor));

  const x = (i) => pad.i + (datos.length === 1 ? ancho / 2 : (i / (datos.length - 1)) * ancho);
  const y = (v) => pad.arriba + alto - (v / tope) * alto;

  const puntos = datos.map((d, i) => [x(i), y(valor(d))]);
  const linea = caminoSuave(puntos);
  const base = pad.arriba + alto;
  const area = `${linea} L${puntos[puntos.length - 1][0]},${base} L${puntos[0][0]},${base} Z`;

  // Una etiqueta de cada N para que no se amontonen con muchas jornadas.
  const salto = Math.ceil(datos.length / 10);
  const anchoFranja = ancho / Math.max(1, datos.length - 1);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        onPointerLeave={() => setActivo(null)}
      >
        <defs>
          <linearGradient id={`area-${idGrad}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((p) => {
          const v = (p / 100) * tope;
          return (
            <g key={p}>
              <line x1={pad.i} x2={W - pad.d} y1={y(v)} y2={y(v)} stroke="rgb(var(--c-slate-800))" strokeWidth="1" />
              <text x={pad.i - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-600 text-[11px]">
                {Math.round(v)}
              </text>
            </g>
          );
        })}

        <path d={area} fill={`url(#area-${idGrad})`} />
        <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Guía vertical del punto señalado. */}
        {activo !== null && (
          <line
            x1={puntos[activo][0]}
            x2={puntos[activo][0]}
            y1={pad.arriba}
            y2={base}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.6"
          />
        )}

        {puntos.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={activo === i ? 5 : 3}
            fill={color}
            // El anillo del color del fondo despega el punto del área.
            stroke="rgb(var(--lh-fondo))"
            strokeWidth="2"
          />
        ))}

        {datos.map((d, i) =>
          i % salto === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {etiqueta(d)}
            </text>
          ) : null
        ) }

        {/*
          Zonas de captura: una franja por punto, de lado a lado en vertical.
          Son transparentes y van al final para quedar por encima de todo.
        */}
        {datos.map((d, i) => (
          <rect
            key={`z${i}`}
            x={puntos[i][0] - anchoFranja / 2}
            y={pad.arriba}
            width={anchoFranja}
            height={alto}
            fill="transparent"
            onPointerEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            tabIndex={0}
            role="img"
            aria-label={`${etiqueta(d)}: ${valor(d)}${sufijo}`}
          />
        ))}
      </svg>

      {/*
        El aviso va en HTML y no dentro del SVG: así hereda la tipografía y los
        colores de la app sin repetirlos, y no hay que calcular saltos de línea
        a mano. Se coloca en porcentaje sobre el contenedor, que es lo que hace
        que siga al punto aunque el SVG se escale.
      */}
      {activo !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-center shadow-lg"
          style={{
            left: `${(puntos[activo][0] / W) * 100}%`,
            top: `${(puntos[activo][1] / H) * 100}%`,
            marginTop: "-10px",
          }}
        >
          <p className="text-sm font-bold tabular-nums text-slate-100">
            {valor(datos[activo])}
            {sufijo}
          </p>
          <p className="text-[11px] text-slate-400">{etiqueta(datos[activo])}</p>
        </div>
      )}
    </div>
  );
}

/*
  Barras horizontales. Con etiquetas de texto (nombres, "Set 3", letras) se leen
  mucho mejor que en vertical, donde el texto se gira o se corta.

  `anchoEtiqueta` sale fuera porque no todas las etiquetas miden lo mismo: "Set 3"
  o una letra caben de sobra en w-16, pero un nombre de asignatura como
  "Ciberseguridad" se sale y pisa la barra.
*/
export function BarrasH({
  datos,
  valor,
  etiqueta,
  detalle,
  color = "bg-indigo-500",
  sufijo = "%",
  anchoEtiqueta = "w-16",
  formato = null,
}) {
  const max = Math.max(...datos.map(valor), 1);
  /*
    `valor` tiene que seguir devolviendo un número, que es de donde sale el
    ancho de la barra. `formato` solo cambia cómo se ESCRIBE: sin esto, media
    hora salía como "3.5 h", con el punto decimal del inglés, en una app que
    está entera en español.
  */
  const escribir = (v) =>
    formato ? formato(v) : `${v}${sufijo}`;
  return (
    <div className="space-y-2">
      {datos.map((d, i) => {
        const v = valor(d);
        const vacia = !(v > 0);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className={`${anchoEtiqueta} shrink-0 truncate text-right text-xs text-slate-400`} title={String(etiqueta(d))}>
              {etiqueta(d)}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-800">
              {/*
                A cero no se pinta barra, y la cifra va fuera y apagada. Antes se
                dibujaba igualmente un rectángulo de ancho 0 que, por el relleno
                y el texto de dentro, se veía como un muñón de color: parecía que
                esa asignatura tenía algo cuando marcaba justo lo contrario.
              */}
              {vacia ? (
                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-medium text-slate-500">
                  {escribir(v)}
                </span>
              ) : (
                <div
                  className={`flex h-full items-center justify-end rounded-md ${color} px-2 transition-all`}
                  style={{ width: `${Math.max((v / max) * 100, 8)}%` }}
                >
                  <span className="text-[11px] font-semibold text-white">{escribir(v)}</span>
                </div>
              )}
            </div>
            {detalle && <span className="w-14 shrink-0 text-xs text-slate-500">{detalle(d)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/*
  Barras apiladas de ganados y perdidos por jornada.

  En SVG y no con divs: la versión anterior daba las alturas en porcentaje
  dentro de un contenedor `flex-1`, que no tiene altura definida, así que los
  porcentajes no resolvían y las barras salían con altura cero. En SVG las
  coordenadas son absolutas y no dependen del contexto de maquetación.
*/
export function BarrasApiladas({ datos }) {
  const [activo, setActivo] = useState(null);

  if (!datos.length)
    return <p className="py-8 text-center text-sm text-slate-500">Sin partidos todavía.</p>;

  const W = 600;
  const H = 170;
  const pad = { i: 26, d: 6, arriba: 10, abajo: 22 };
  const ancho = W - pad.i - pad.d;
  const alto = H - pad.arriba - pad.abajo;

  const max = Math.max(...datos.map((d) => d.jugados), 1);
  const paso = ancho / datos.length;
  const grosor = Math.min(paso * 0.7, 26);
  const y = (v) => pad.arriba + alto - (v / max) * alto;
  const salto = Math.ceil(datos.length / 14);
  const base = pad.arriba + alto;

  const GANADO = "rgb(var(--c-emerald-500))";
  const PERDIDO = "rgb(var(--c-rose-500))";

  return (
    <div className="relative">
      {/* Leyenda: con dos series el color no puede ser la única pista. */}
      <div className="mb-2 flex justify-end gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: GANADO }} /> Ganados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PERDIDO }} /> Perdidos
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        onPointerLeave={() => setActivo(null)}
      >
        {Array.from({ length: max + 1 }, (_, i) => i).map((v) => (
          <g key={v}>
            <line x1={pad.i} x2={W - pad.d} y1={y(v)} y2={y(v)} stroke="rgb(var(--c-slate-800))" strokeWidth="1" />
            <text x={pad.i - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-600 text-[11px]">
              {v}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const x = pad.i + i * paso + (paso - grosor) / 2;
          const perdidos = d.jugados - d.ganados;
          const altoGanados = (d.ganados / max) * alto;
          const altoPerdidos = (perdidos / max) * alto;
          const señalada = activo === i;
          return (
            <g key={d.jornada} opacity={activo === null || señalada ? 1 : 0.45}>
              {perdidos > 0 && (
                <rect
                  x={x}
                  y={base - altoPerdidos}
                  width={grosor}
                  height={altoPerdidos}
                  fill={PERDIDO}
                  rx="2"
                />
              )}
              {d.ganados > 0 && (
                <rect
                  x={x}
                  /*
                    Los 2px de separación entre los dos tramos son a propósito:
                    sin ellos, verde y rojo se tocan y el ojo lee una sola barra
                    bicolor en vez de dos cantidades apiladas.
                  */
                  y={base - altoPerdidos - altoGanados - (perdidos > 0 ? 2 : 0)}
                  width={grosor}
                  height={altoGanados}
                  fill={GANADO}
                  rx="2"
                />
              )}
              {i % salto === 0 && (
                <text x={x + grosor / 2} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
                  {d.jornada}
                </text>
              )}
            </g>
          );
        })}

        {/* Zona de captura por jornada, más ancha que la barra: apuntar a una
            barra de 20px con el dedo es pedir demasiado. */}
        {datos.map((d, i) => (
          <rect
            key={`z${i}`}
            x={pad.i + i * paso}
            y={pad.arriba}
            width={paso}
            height={alto}
            fill="transparent"
            onPointerEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            tabIndex={0}
            role="img"
            aria-label={`Jornada ${d.jornada}: ${d.ganados} ganados, ${d.jugados - d.ganados} perdidos`}
          />
        ))}
      </svg>

      {activo !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 shadow-lg"
          style={{ left: `${((pad.i + activo * paso + paso / 2) / W) * 100}%`, bottom: "22%" }}
        >
          <p className="mb-1 text-[11px] text-slate-400">Jornada {datos[activo].jornada}</p>
          <p className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-100">
            <span className="h-2 w-2 rounded-sm" style={{ background: GANADO }} />
            {datos[activo].ganados} ganados
          </p>
          <p className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-100">
            <span className="h-2 w-2 rounded-sm" style={{ background: PERDIDO }} />
            {datos[activo].jugados - datos[activo].ganados} perdidos
          </p>
        </div>
      )}
    </div>
  );
}

/* Medidor compacto para un porcentaje suelto. */
export function Medidor({ titulo, valor, sub, color = "bg-indigo-500" }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-slate-400">{titulo}</span>
        <span className="text-sm font-bold text-slate-100">{valor}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${valor}%` }} />
      </div>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

/*
  Barras VERTICALES apiladas por serie.

  Para "cuánto he estudiado cada día, y de qué". Una barra por tramo (un día de
  la semana, un mes) y dentro un trozo por asignatura, cada una con su color
  fijo. De un vistazo se ve el volumen del día Y su reparto, que con barras
  horizontales de una sola tinta hacían falta dos gráficos.

  Verticales porque el eje del tiempo se lee de izquierda a derecha; y en SVG,
  no con divs de altura en porcentaje, por lo mismo que `BarrasApiladas`: un
  porcentaje dentro de un contenedor sin altura definida no resuelve y las
  barras salen a cero.

  `colorDe(clave)` devuelve un color CSS por serie. El color va con la ENTIDAD y
  no con su puesto en el ranking: si siguiera al orden, filtrar una asignatura
  repintaría las demás y el gráfico diría una cosa distinta cada semana.
*/
export function BarrasVerticales({
  datos = [],
  colorDe,
  formato = (v) => String(v),
  etiquetaTramo = (d) => d.etiqueta,
  // Los agregados de fechas.js llaman `horas` al total del tramo; se acepta
  // `total` también para no obligar a renombrarlo antes de pintar.
  valor = (d) => d.total ?? d.horas ?? 0,
  alturaBarra = 150,
}) {
  const [activo, setActivo] = useState(null);

  const max = Math.max(...datos.map(valor), 1);
  const hayAlgo = datos.some((d) => valor(d) > 0);

  return (
    <div>
      <div className="flex items-end gap-1 sm:gap-2" style={{ height: alturaBarra }}>
        {datos.map((d, i) => {
          const total = valor(d);
          const esActivo = activo === i;
          return (
            <div
              key={d.clave ?? d.etiqueta ?? i}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              tabIndex={0}
              /*
                Cada barra es enfocable y se anuncia entera: sin esto, la única
                forma de saber el reparto de un día sería pasar el ratón por
                encima, que con teclado o lector de pantalla no existe.
              */
              aria-label={`${etiquetaTramo(d)}: ${formato(total)}${
                d.partes?.length
                  ? ". " + d.partes.map((p) => `${p.clave}, ${formato(p.valor)}`).join("; ")
                  : ""
              }`}
            >
              {/* La cifra solo en la barra que se está mirando y en las que
                  tienen algo: un número sobre cada columna es ruido. */}
              <span
                className={`mb-1 text-center text-[10px] font-semibold tabular-nums transition ${
                  esActivo && total > 0 ? "text-slate-100" : "text-transparent"
                }`}
              >
                {formato(total)}
              </span>

              {/*
                Con un tope de ancho. A pantalla completa, siete columnas se
                repartían 1.000 px y cada barra salía de 143: dejaban de leerse
                como barras y parecían bloques de color. Centradas y con tope se
                mantienen esbeltas en el escritorio y siguen llenando el hueco
                en el móvil, que es donde el espacio falta.
              */}
              <div
                className="mx-auto flex w-full max-w-14 flex-col justify-end overflow-hidden rounded-t"
                style={{ height: `${(total / max) * 100}%` }}
              >
                {(d.partes || []).map((p) => (
                  <div
                    key={p.clave}
                    title={`${etiquetaTramo(d)} · ${p.clave}: ${formato(p.valor)}`}
                    style={{
                      height: `${total ? (p.valor / total) * 100 : 0}%`,
                      background: colorDe(p.clave),
                      // Separación de 2px entre trozos: pegados, dos colores
                      // parecidos se leen como una sola mancha.
                      boxShadow: "0 -2px 0 0 rgb(var(--lh-fondo))",
                    }}
                  />
                ))}
              </div>

              {/*
                Alto de línea fijo: sin él, las etiquetas con tilde ("Mié",
                "Sáb") crecen la caja de texto y se quedan unos píxeles más
                abajo que las demás, con lo que la fila de días no cuadra.
              */}
              <span
                className={`mt-1.5 block h-4 truncate text-center text-[10px] leading-4 transition ${
                  d.esHoy || esActivo ? "font-semibold text-slate-200" : "text-slate-500"
                }`}
              >
                {etiquetaTramo(d)}
              </span>
            </div>
          );
        })}
      </div>

      {!hayAlgo && (
        <p className="mt-2 text-center text-xs text-slate-500">Nada apuntado en este periodo.</p>
      )}
    </div>
  );
}
