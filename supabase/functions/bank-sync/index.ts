// Edge Function de EJEMPLO para leer movimientos del banco vía GoCardless
// (Bank Account Data / PSD2). Despliega con: supabase functions deploy bank-sync
//
// Secretos necesarios (NO en el navegador):
//   supabase secrets set GC_SECRET_ID=... GC_SECRET_KEY=...
//
// Este ejemplo muestra la estructura. El flujo completo de GoCardless requiere,
// la primera vez, que el usuario autorice el acceso en la web de su banco
// (crear "requisition" y redirigir). Aquí se asume que ya existe un accountId.

// deno-lint-ignore-file
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { accountId } = await req.json();
    const SECRET_ID = Deno.env.get("GC_SECRET_ID");
    const SECRET_KEY = Deno.env.get("GC_SECRET_KEY");
    const BASE = "https://bankaccountdata.gocardless.com/api/v2";

    // 1) Token de acceso
    const tokenRes = await fetch(`${BASE}/token/new/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_id: SECRET_ID, secret_key: SECRET_KEY }),
    });
    const { access } = await tokenRes.json();

    // 2) Transacciones de la cuenta ya autorizada
    const txRes = await fetch(`${BASE}/accounts/${accountId}/transactions/`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await txRes.json();

    // 3) Normalizar al formato de la sección Finanzas (lh_finance)
    const movimientos = (data?.transactions?.booked ?? []).map((t: any) => ({
      id: t.internalTransactionId ?? crypto.randomUUID(),
      fecha: t.bookingDate,
      concepto: t.remittanceInformationUnstructured ?? "Movimiento",
      categoria: Number(t.transactionAmount.amount) >= 0 ? "Ingreso" : "Banco",
      monto: Number(t.transactionAmount.amount),
    }));

    return new Response(JSON.stringify({ movimientos }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
