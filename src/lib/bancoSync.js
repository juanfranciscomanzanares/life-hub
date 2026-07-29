import { supabase, cloudEnabled, motivoDelError } from "./supabase";

/*
  Cliente de la Edge Function `bank-sync` (GoCardless / PSD2).

  Aquí no hay ninguna credencial: GC_SECRET_ID y GC_SECRET_KEY viven como
  secretos en el servidor. Todo lo que va en este archivo acaba en el bundle,
  que es público.

  Es SOLO LECTURA: la normativa permite consultar movimientos y saldos, nunca
  mover dinero.
*/

export const FUNCION = "bank-sync";

async function llamar(accion, datos = {}) {
  if (!cloudEnabled) {
    throw new Error("Necesitas la nube configurada (Supabase) para conectar el banco.");
  }

  const { data, error } = await supabase.functions.invoke(FUNCION, {
    body: { accion, ...datos },
  });
  if (error) throw new Error(await motivoDelError(error));
  // La función devuelve 200 con `error` dentro cuando el fallo es de GoCardless
  // y no del transporte; ahí está el motivo legible.
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

export async function listarBancos(pais = "ES") {
  const { bancos } = await llamar("bancos", { pais });
  return bancos ?? [];
}

/*
  Devuelve el enlace del banco al que hay que mandar al usuario para que
  autorice. `volverA` tiene que estar dado de alta como redirect en GoCardless.
*/
export function conectarBanco({ bancoId, dias, volverA }) {
  return llamar("conectar", { bancoId, dias, volverA });
}

export function listarCuentas(requisitionId) {
  return llamar("cuentas", { requisitionId });
}

export async function listarMovimientos(cuentaId) {
  const { movimientos } = await llamar("movimientos", { cuentaId });
  return movimientos ?? [];
}
