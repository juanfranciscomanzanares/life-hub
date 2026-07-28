/*
  Gráficos reutilizables, sin librerías externas.

  Se apoyan en SVG en lugar de en divs con altura en porcentaje: se escalan
  solos al ancho disponible, permiten rejilla y etiquetas legibles, y no
  desbordan en el móvil.
*/

// Anillo de proporción. Para un reparto de dos valores (ganados/perdidos) se
// lee de un vistazo mucho mejor que dos barras.
export function Anillo({ valor, total, etiqueta, color = "#10b981", fondo = "#334155" }) {
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
*/
export function Linea({ datos, valor, etiqueta, color = "#818cf8", sufijo = "", max = 100 }) {
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
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = `${linea} L${puntos[puntos.length - 1][0]},${pad.arriba + alto} L${puntos[0][0]},${pad.arriba + alto} Z`;

  // Una etiqueta de cada N para que no se amontonen con muchas jornadas.
  const salto = Math.ceil(datos.length / 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {[0, 25, 50, 75, 100].map((p) => {
        const v = (p / 100) * tope;
        return (
          <g key={p}>
            <line x1={pad.i} x2={W - pad.d} y1={y(v)} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
            <text x={pad.i - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-600 text-[11px]">
              {Math.round(v)}
            </text>
          </g>
        );
      })}

      <path d={area} fill={color} opacity="0.14" />
      <path d={linea} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />

      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3.5" fill={color} />
          <title>{`${etiqueta(datos[i])}: ${valor(datos[i])}${sufijo}`}</title>
        </g>
      ))}

      {datos.map((d, i) =>
        i % salto === 0 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            className="fill-slate-500 text-[11px]"
          >
            {etiqueta(d)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/*
  Barras horizontales. Con etiquetas de texto (nombres, "Set 3", letras) se leen
  mucho mejor que en vertical, donde el texto se gira o se corta.
*/
export function BarrasH({ datos, valor, etiqueta, detalle, color = "bg-indigo-500", sufijo = "%" }) {
  const max = Math.max(...datos.map(valor), 1);
  return (
    <div className="space-y-2">
      {datos.map((d, i) => {
        const v = valor(d);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-right text-xs text-slate-400">{etiqueta(d)}</span>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-800">
              <div
                className={`flex h-full items-center justify-end rounded-md ${color} px-2 transition-all`}
                style={{ width: `${Math.max((v / max) * 100, v > 0 ? 8 : 0)}%` }}
              >
                <span className="text-[11px] font-semibold text-white">
                  {v}
                  {sufijo}
                </span>
              </div>
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {Array.from({ length: max + 1 }, (_, i) => i).map((v) => (
        <g key={v}>
          <line x1={pad.i} x2={W - pad.d} y1={y(v)} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
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
        return (
          <g key={d.jornada}>
            {perdidos > 0 && (
              <rect
                x={x}
                y={pad.arriba + alto - altoPerdidos}
                width={grosor}
                height={altoPerdidos}
                fill="#f43f5e"
                opacity="0.75"
              >
                <title>{`J${d.jornada}: ${perdidos} perdidos`}</title>
              </rect>
            )}
            {d.ganados > 0 && (
              <rect
                x={x}
                y={pad.arriba + alto - altoPerdidos - altoGanados}
                width={grosor}
                height={altoGanados}
                fill="#10b981"
                rx="2"
              >
                <title>{`J${d.jornada}: ${d.ganados} ganados`}</title>
              </rect>
            )}
            {i % salto === 0 && (
              <text
                x={x + grosor / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-slate-500 text-[11px]"
              >
                {d.jornada}
              </text>
            )}
          </g>
        );
      })}
    </svg>
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
