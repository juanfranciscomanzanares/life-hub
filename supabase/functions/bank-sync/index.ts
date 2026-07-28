/*
  Lectura de movimientos bancarios vía GoCardless Bank Account Data (PSD2).

  Desplegar:
    supabase secrets set GC_SECRET_ID=... GC_SECRET_KEY=...
    supabase functions deploy bank-sync

  Por qué esto vive en el servidor y no en el navegador: GC_SECRET_ID y
  GC_SECRET_KEY son claves secretas. Cualquier cosa que vaya en el bundle de la
  app es pública, así que irían regaladas.

  IMPORTANTE (esto es solo lectura): la normativa PSD2 permite consultar
  movimientos y saldos, nunca mover dinero.

  Flujo de GoCardless, que es en varios pasos porque el banco tiene que
  autorizar explícitamente:

    bancos       -> lista de entidades del país
    conectar     -> crea una "requisition" y devuelve el enlace del banco
    cuentas      -> tras autorizar, devuelve las cuentas concedidas
    movimientos  -> transacciones de una cuenta

  El consentimiento caduca a los 90 días por normativa: pasado ese plazo hay
  que repetir "conectar". No es un fallo, es el máximo que permite la ley.
*/

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://bankaccountdata.gocardless.com/api/v2";

// supabase-js manda también `apikey` y `x-client-info`. Si no se autorizan, el
// navegador corta en el preflight y el cliente dice "Failed to send a request
// to the Edge Function" sin que la función llegue a ejecutarse.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/*
  Comprueba que quien llama es un usuario con sesión válida.

  La versión anterior de esta función no lo hacía: estaba abierta a internet,
  así que cualquiera podía agotar la cuota de la cuenta de GoCardless o lanzar
  conexiones bancarias en su nombre.
*/
async function usuarioDeLaPeticion(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

// El token de GoCardless dura 24 h; se pide uno por invocación, que es barato
// comparado con guardarlo y tener que gestionar su caducidad.
async function tokenGoCardless() {
  const res = await fetch(`${BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret_id: Deno.env.get("GC_SECRET_ID"),
      secret_key: Deno.env.get("GC_SECRET_KEY"),
    }),
  });
  if (!res.ok) throw new Error(`GoCardless rechazó las credenciales (${res.status})`);
  const { access } = await res.json();
  return access as string;
}

async function gc(ruta: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    // GoCardless devuelve el motivo en campos distintos según el error.
    const motivo =
      cuerpo?.detail ?? cuerpo?.summary ?? cuerpo?.status_code ?? `HTTP ${res.status}`;
    throw new Error(String(motivo));
  }
  return cuerpo;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const usuario = await usuarioDeLaPeticion(req);
    if (!usuario) return json({ error: "Necesitas iniciar sesión." }, 401);

    const { accion, ...datos } = await req.json();
    const token = await tokenGoCardless();

    switch (accion) {
      /* Entidades disponibles en un país (ES por defecto). */
      case "bancos": {
        const lista = await gc(`/institutions/?country=${datos.pais ?? "ES"}`, token);
        return json({
          bancos: (lista ?? [])
            .map((b: any) => ({
              id: b.id,
              nombre: b.name,
              logo: b.logo,
              // Días de histórico que da esa entidad: varía mucho entre bancos.
              dias: b.transaction_total_days ?? 90,
            }))
            .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
        });
      }

      /*
        Crea el acuerdo y la requisition. Devuelve el enlace al que hay que
        mandar al usuario para que autorice en la web de su banco.
      */
      case "conectar": {
        const dias = Math.min(Number(datos.dias) || 90, 730);

        const acuerdo = await gc("/agreements/enduser/", token, {
          method: "POST",
          body: JSON.stringify({
            institution_id: datos.bancoId,
            // 90 días es el máximo legal de validez del consentimiento.
            access_valid_for_days: 90,
            max_historical_days: dias,
            access_scope: ["balances", "details", "transactions"],
          }),
        });

        const requisition = await gc("/requisitions/", token, {
          method: "POST",
          body: JSON.stringify({
            institution_id: datos.bancoId,
            agreement: acuerdo.id,
            redirect: datos.volverA,
            // Referencia propia para poder rastrear la conexión.
            reference: `${usuario.id}-${Date.now()}`,
            user_language: "ES",
          }),
        });

        return json({ requisitionId: requisition.id, enlace: requisition.link });
      }

      /* Tras autorizar, qué cuentas ha concedido el banco. */
      case "cuentas": {
        const requisition = await gc(`/requisitions/${datos.requisitionId}/`, token);
        const ids: string[] = requisition.accounts ?? [];

        const cuentas = await Promise.all(
          ids.map(async (id) => {
            // Si una cuenta concreta falla no tumbamos las demás.
            try {
              const detalle = await gc(`/accounts/${id}/details/`, token);
              return {
                id,
                iban: detalle?.account?.iban ?? "",
                nombre: detalle?.account?.name ?? detalle?.account?.product ?? "Cuenta",
                moneda: detalle?.account?.currency ?? "EUR",
              };
            } catch {
              return { id, iban: "", nombre: "Cuenta", moneda: "EUR" };
            }
          })
        );

        return json({ estado: requisition.status, cuentas });
      }

      /*
        Movimientos ya contabilizados. Los pendientes se ignoran a propósito:
        cambian de importe y de fecha, y duplicarían al confirmarse.
      */
      case "movimientos": {
        const datosTx = await gc(`/accounts/${datos.cuentaId}/transactions/`, token);
        const contabilizados = datosTx?.transactions?.booked ?? [];

        return json({
          movimientos: contabilizados.map((t: any) => ({
            // Identificador del banco: es lo que permite no duplicar al reimportar.
            refBanco:
              t.internalTransactionId ??
              t.transactionId ??
              `${t.bookingDate}-${t.transactionAmount?.amount}-${(t.remittanceInformationUnstructured ?? "").slice(0, 24)}`,
            fecha: t.bookingDate ?? t.valueDate ?? "",
            concepto:
              t.remittanceInformationUnstructured ??
              (t.remittanceInformationUnstructuredArray ?? []).join(" ") ??
              t.creditorName ??
              t.debtorName ??
              "Movimiento",
            contraparte: t.creditorName ?? t.debtorName ?? "",
            monto: Number(t.transactionAmount?.amount ?? 0),
            moneda: t.transactionAmount?.currency ?? "EUR",
          })),
        });
      }

      default:
        return json({ error: `Acción desconocida: ${accion}` }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
