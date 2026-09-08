/*
  Plan financiero: de lo que entra cada mes al colchón y de ahí a la inversión.

  La idea es que el plan no sea un documento, sino un cálculo: tú describes tu
  situación (un "régimen": verano, curso sin contrato, curso con contrato) y de
  ahí sale sola la capacidad de ahorro, cuánto colchón te falta y cuánto puedes
  apartar. Cuando cambia la situación, cambias de régimen y no hay que rehacer
  nada.

  Todo son funciones puras: la sección solo pinta.
*/

import { redondear } from "./numeros";

// 52/12, no 4: usar 4 semanas por mes se deja fuera un mes entero al año, y en
// gastos de transporte diarios eso es mucho dinero.
export const SEMANAS_MES = 52 / 12;

// Se reexporta porque la sección ya lo importaba de aquí.
export { redondear };

const suma = (filas = []) => filas.reduce((a, f) => a + (Number(f?.monto) || 0), 0);

/*
  El transporte se calcula por días presenciales y no como una cuota fija,
  porque es justo la palanca que se puede mover: teletrabajar un día suelto a la
  semana se nota en el mes, y así se ve antes de decidirlo.
*/
export function transporteMensual({ costeDia = 0, diasPresenciales = 0 } = {}) {
  const coste = Number(costeDia) || 0;
  const dias = Number(diasPresenciales) || 0;
  if (coste <= 0 || dias <= 0) return 0;
  return redondear(coste * dias * SEMANAS_MES);
}

export const totalIngresos = (regimen) => redondear(suma(regimen?.ingresos));

export const totalGastos = (regimen) =>
  redondear(suma(regimen?.gastos) + transporteMensual(regimen?.transporte));

// Lo que te queda cada mes. En negativo significa que ese régimen no se
// sostiene y hay que tocar algo antes de pensar en invertir.
export const capacidadAhorro = (regimen) =>
  redondear(totalIngresos(regimen) - totalGastos(regimen));

/* --- Colchón de emergencia --- */

export const objetivoColchon = (gastosMensuales, meses = 3) =>
  redondear(Math.max(0, Number(gastosMensuales) || 0) * (Number(meses) || 0));

// Cuántos meses aguantarías sin ingresos. Es la medida que importa de verdad:
// 1.700 € es mucho o poco según lo que gastes.
export function mesesDeCobertura(saldo, gastosMensuales) {
  const g = Number(gastosMensuales) || 0;
  if (g <= 0) return 0;
  return redondear(Math.max(0, Number(saldo) || 0) / g);
}

/*
  Meses hasta llenar el colchón. Devuelve null cuando no se llega nunca (no
  ahorras nada, o incluso pierdes): así la pantalla puede decirlo en vez de
  pintar un "Infinity meses".
*/
export function mesesHastaObjetivo(saldo, objetivo, capacidadMensual) {
  const falta = (Number(objetivo) || 0) - (Number(saldo) || 0);
  if (falta <= 0) return 0;
  const cap = Number(capacidadMensual) || 0;
  if (cap <= 0) return null;
  return Math.ceil(falta / cap);
}

/* --- Reparto entre plazos --- */

/*
  El excedente se parte en dos bolsas: largo plazo (no se toca en 10+ años, va a
  renta variable) y medio plazo (2-3 años, sin riesgo). Se reparte solo lo que
  hay: si la capacidad es negativa, no hay nada que repartir.
*/
export function reparto(capacidad, pctLargo = 60) {
  const total = Math.max(0, Number(capacidad) || 0);
  const pct = Math.min(100, Math.max(0, Number(pctLargo) || 0));
  const largo = redondear((total * pct) / 100);
  return { largo, medio: redondear(total - largo) };
}

/* --- Proyección --- */

/*
  Valor futuro de aportar `aportacionMensual` todos los meses.

  Se devuelven dos cifras a propósito. La nominal es la que sale en las
  calculadoras y engaña: 800.000 € dentro de 40 años no compran lo que hoy. La
  real descuenta la inflación y es la que hay que mirar para decidir.
*/
export function proyectar({
  aportacionMensual = 0,
  años = 0,
  rentabilidadAnual = 7,
  inflacionAnual = 2.5,
} = {}) {
  const p = Math.max(0, Number(aportacionMensual) || 0);
  const n = Math.max(0, Math.round((Number(años) || 0) * 12));
  const aportado = redondear(p * n);
  if (n === 0 || p === 0) return { aportado, nominal: aportado, real: aportado, interes: 0 };

  const nominal = valorFuturo(p, (Number(rentabilidadAnual) || 0) / 100, n);

  // Rentabilidad real = (1+r)/(1+i) - 1, no la resta simple: con cifras
  // pequeñas se parecen, pero compuesta 40 años la diferencia es enorme.
  const r = (Number(rentabilidadAnual) || 0) / 100;
  const inf = (Number(inflacionAnual) || 0) / 100;
  const tasaReal = (1 + r) / (1 + inf) - 1;

  return {
    aportado,
    nominal: redondear(nominal),
    real: redondear(valorFuturo(p, tasaReal, n)),
    interes: redondear(nominal - aportado),
  };
}

// Valor futuro de una renta mensual con tasa ANUAL `tasa`, durante `meses`.
function valorFuturo(cuota, tasa, meses) {
  const i = tasa / 12;
  // Sin interés la fórmula se indetermina (división por cero): es una suma.
  if (Math.abs(i) < 1e-12) return cuota * meses;
  return cuota * ((Math.pow(1 + i, meses) - 1) / i);
}
