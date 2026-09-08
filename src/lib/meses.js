/*
  Meses en formato "2026-07": la clave con la que Finanzas y Trabajo agrupan
  sus registros y etiquetan los selectores.

  Estaban escritas dentro del bloque de Trabajo en LifeDashboard.jsx y Finanzas
  las usaba desde ahí sin importarlas, porque en un archivo único todo estaba a
  mano. Al separar las secciones eso se convertía en un ReferenceError al abrir
  Finanzas — que el build NO detecta. Aquí son compartidas de verdad.
*/

export const NOMBRES_MES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

// De "2026-07-15" a "2026-07". Se corta la cadena en vez de pasar por Date:
// `new Date("2026-07-15")` se interpreta en UTC y en España puede devolver el
// mes anterior para las fechas del día 1.
export function claveMes(fecha) {
  return String(fecha || "").slice(0, 7);
}

// "2026-07" → "Jul 26". Devuelve la clave tal cual si no la reconoce, para que
// un registro con la fecha corrupta se vea raro pero no tumbe la sección.
export function etiquetaMes(clave) {
  const [y, m] = String(clave || "").split("-");
  const nombre = NOMBRES_MES[Number(m) - 1];
  if (!nombre || !y) return String(clave || "");
  return `${nombre} ${y.slice(2)}`;
}

/*
  Los últimos `n` meses hasta hoy, del más antiguo al más reciente.

  Se construyen con `new Date(año, mes - i, 1)`, que ya normaliza el salto de
  año: pedir el mes -1 da diciembre del año anterior sin tener que restarlo a
  mano.
*/
export function ultimosMeses(n, hoy = new Date()) {
  const total = Math.max(0, Math.floor(Number(n) || 0));
  const salida = [];
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    salida.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return salida;
}
