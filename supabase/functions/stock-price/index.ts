// Edge Function: precios de acciones/ETF con Finnhub (clave secreta, no en el navegador).
// Despliegue:
//   supabase secrets set FINNHUB_KEY=tu_clave
//   supabase functions deploy stock-price
// Uso desde la app:  GET .../stock-price?tickers=AAPL,MSFT
// Respuesta: { "AAPL": 231.2, "MSFT": 405.1 }

// deno-lint-ignore-file
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const tickers = (url.searchParams.get("tickers") || "").split(",").map((t) => t.trim()).filter(Boolean);
    const KEY = Deno.env.get("FINNHUB_KEY");
    if (!KEY) throw new Error("Falta FINNHUB_KEY");

    const out: Record<string, number> = {};
    await Promise.all(
      tickers.map(async (t) => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${t}&token=${KEY}`);
        const j = await r.json();
        if (typeof j.c === "number" && j.c > 0) out[t] = j.c; // 'c' = precio actual
      })
    );

    return new Response(JSON.stringify(out), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
