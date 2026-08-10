/* ------------------------------------------------------------------ */
/*  UI compartida y utilidades                                         */
/* ------------------------------------------------------------------ */

/*
  Tarjeta de la app: translúcida, con desenfoque y un brillo que sigue al
  cursor. El aspecto vive en `.lh-card` (src/index.css); aquí solo se calcula
  la posición del ratón para el foco radial.

  El puntero solo se escucha en dispositivos con ratón: en táctil no hay hover,
  el brillo nunca se vería y el listener sería trabajo tirado en cada scroll.

  El relleno va en `padding` y NO en `className`.

  Tailwind no resuelve los choques por el orden del atributo class, sino por el
  orden en la hoja generada, donde `p-5` va después de `p-0` y `p-3`. Es decir:
  un `<Card className="p-3">` seguía teniendo 20px de relleno, en silencio. Con
  la prop solo se emite una clase de relleno y gana la que se pide.
*/
export function Card({ children, className = "", padding = "p-5", ...resto }) {
  const seguirCursor = (e) => {
    const caja = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - caja.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - caja.top}px`);
  };

  const conRaton = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;

  return (
    <div className={`lh-card ${padding} ${className}`} onPointerMove={conRaton ? seguirCursor : undefined} {...resto}>
      {children}
    </div>
  );
}

/*
  Ficha de métrica: las cifras grandes de la parte de arriba de una sección.

  Estaba maquetada a mano y distinta en cada sitio (Inicio con el icono al lado
  del número, Salud con otro tamaño de icono), así que dos pantallas que
  enseñaban lo mismo no se parecían.

  La composición no es la obvia, y es a propósito:

  - LA ETIQUETA VA ARRIBA, en versalitas pequeñas y con el interletrado
    abierto. Con la etiqueta debajo del número, la vista tiene que leer la
    cifra, bajar y volver para saber de qué era. Arriba se lee "PARA HOY → 2",
    que es el orden en el que se pregunta.
  - EL NÚMERO MANDA, en la tipografía de display y a 3xl. Es el único dato de
    la tarjeta que importa a un metro de distancia.
  - EL ICONO SE APARTA a una esquina y se hace pequeño. Antes competía en peso
    con la cifra estando al lado; aquí solo sirve para reconocer la tarjeta de
    un vistazo, que es todo lo que se le pide.

  `tabular-nums` para que al cambiar de 9 a 10 no bailen las columnas.
*/
export function Metrica({ icono: Icono, etiqueta, valor, detalle = null, color = "bg-indigo-500/15 text-indigo-400" }) {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">{etiqueta}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
          {Icono ? <Icono size={16} aria-hidden="true" /> : null}
        </div>
      </div>
      <p className="font-display text-3xl font-bold tabular-nums leading-none text-slate-100">{valor}</p>
      {detalle && <p className="mt-1.5 text-xs text-slate-500">{detalle}</p>}
    </Card>
  );
}

/*
  El icono va con el color de la SECCIÓN (`seccion-*`), no con el acento global:
  es lo que hace que cada área se reconozca de un vistazo. Los tonos salen de
  `data-seccion`, que pone el shell (ver src/index.css).
*/
export function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    /*
      El título crece a 3xl en escritorio y baja a 2xl en el móvil. Antes era
      2xl siempre: en una pantalla grande se quedaba del mismo tamaño que los
      encabezados de las tarjetas de debajo, y la jerarquía se aplanaba justo
      donde había sitio de sobra para marcarla.

      `-tracking-[0.01em]` es cosa de la tipografía de display: Space Grotesk
      viene bastante suelta y a tamaños grandes se abre demasiado. Apretarla un
      pelo es lo que hace que un titular parezca compuesto y no escrito.
    */
    <div className="mb-6 flex items-center gap-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-seccion-500/15 text-seccion-400 ring-1 ring-inset ring-seccion-500/25 sm:h-12 sm:w-12">
        {Icon ? <Icon size={22} aria-hidden="true" /> : null}
      </div>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold -tracking-[0.01em] text-slate-100 sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

/*
  Logo de la app: un núcleo con tres satélites sobre su órbita.

  El degradado va en clases de Tailwind (no dentro del SVG) a propósito: así
  sigue el color de acento que el usuario elige en Ajustes, porque
  `from-indigo-500` apunta a las variables --c-indigo-*. La misma marca, con
  el degradado fijo, está en public/icon.svg para el icono de la PWA y la
  pantalla de carga, donde todavía no hay CSS de la app cargado.
*/
export function Logo({ size = 36, className = "" }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 512 512" width={size * 0.78} height={size * 0.78} aria-hidden="true" focusable="false">
        <circle cx="256" cy="256" r="148" fill="none" stroke="#fff" strokeWidth="26" opacity="0.38" />
        <g fill="#fff">
          <circle cx="256" cy="256" r="62" />
          <circle cx="256" cy="108" r="44" />
          <circle cx="384" cy="330" r="36" />
          <circle cx="128" cy="330" r="36" />
        </g>
      </svg>
    </div>
  );
}

/*
  Bloque de carga con barrido. `lineas` pinta varias barras de alto de texto;
  sin él, un solo bloque de la altura que se le pase por className.
*/
export function Skeleton({ lineas = 0, className = "" }) {
  if (lineas > 0) {
    return (
      <div className={`space-y-2 ${className}`} role="status" aria-label="Cargando">
        {Array.from({ length: lineas }, (_, i) => (
          // La última línea más corta: imita el final de un párrafo real.
          <div key={i} className={`lh-skeleton h-4 ${i === lineas - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    );
  }
  return <div className={`lh-skeleton ${className}`} role="status" aria-label="Cargando" />;
}

// Skeleton con forma de sección: título, fila de tarjetas y bloque grande.
export function SkeletonSeccion() {
  return (
    <div className="section-fade">
      <div className="mb-6 flex items-center gap-3">
        <div className="lh-skeleton h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <div className="lh-skeleton h-5 w-40" />
          <div className="lh-skeleton h-3 w-56" />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="lh-skeleton h-24" />
        ))}
      </div>
      <div className="lh-skeleton h-64" />
    </div>
  );
}

/* --- Formato --- */
/*
  Importes con 0 o 2 decimales, nunca uno suelto ni quince.

  Sumar en coma flotante deja restos como 199.10000000000002, y eso se colaba
  tal cual en pantalla ("Te quedan 199.10000000000002€ de presupuesto"). Los
  céntimos van siempre de dos en dos (600,90€, no 600,9€) para que las cifras
  de una misma columna se lean alineadas.
*/
export const fmtEuro = (n) => {
  const v = Number(n) || 0;
  const decimales = Math.round(v * 100) % 100 === 0 ? 0 : 2;
  return `${v.toLocaleString("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}€`;
};

export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const monthKey = (fecha) => (fecha || "").slice(0, 7);

export function monthLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

export function lastNMonths(n) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}

/*
  La fecha de hoy en HORA LOCAL.

  Antes esto era `new Date().toISOString().slice(0, 10)`, que da la fecha en
  UTC. En España (UTC+1 en invierno, +2 en verano) eso significa que entre
  medianoche y las 01:00 o las 02:00 devolvía el día ANTERIOR: una serie de
  gimnasio apuntada a las 00:30 se guardaba con la fecha de ayer, y "lo de hoy"
  comparaba contra el día equivocado.
*/
export function todayISO(fecha = new Date()) {
  const p2 = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p2(fecha.getMonth() + 1)}-${p2(fecha.getDate())}`;
}

/* --- Exportar a CSV (compatible con Excel en español) --- */
/*
  Las cabeceras salen de TODAS las filas, no solo de la primera.

  Los registros no siempre tienen las mismas claves: los de trabajo anteriores
  a que existiera la modalidad no la llevan, y los km solo aparecen en los días
  con distancia distinta a la habitual. Mirando solo `rows[0]`, esas columnas
  desaparecían del CSV exportado sin previo aviso.
*/
export function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(";")));
  return lines.join("\n");
}

export function downloadFile(filename, content, mime = "text/csv;charset=utf-8") {
  // BOM para que Excel muestre bien los acentos y el euro
  const bom = mime.startsWith("text/csv") ? "﻿" : "";
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(filename, rows) {
  downloadFile(filename, toCSV(rows));
}
