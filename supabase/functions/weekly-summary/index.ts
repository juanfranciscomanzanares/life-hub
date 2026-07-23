// Edge Function: envía tu resumen semanal por email (con Resend).
// Programar cada domingo a las 20:00 con el cron de Supabase (ver INTEGRACIONES.md).
//
// Secretos:
//   supabase secrets set RESEND_KEY=re_xxx  RESUMEN_EMAIL=tu@email.com
//
// Lee el estado del usuario de la tabla app_state (mismas claves que la app)
// y calcula un resumen de la última semana.

// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const get = async (key: string) => {
      const { data } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
      return data?.value ?? [];
    };

    const lunes = new Date();
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const desde = lunes.toISOString().slice(0, 10);

    const work = await get("lh_work_log");
    const gym = await get("lh_gym");
    const contribs = await get("lh_contribs");

    const hTrabajo = work.filter((w: any) => w.fecha >= desde).reduce((a: number, b: any) => a + Number(b.horas || 0), 0);
    const nGym = gym.filter((g: any) => g.fecha >= desde).length;
    const invertido = contribs.filter((c: any) => c.fecha >= desde).reduce((a: number, b: any) => a + Number(b.monto || 0), 0);

    const html = `<h2>Tu semana en Life Hub</h2>
      <ul>
        <li>Horas de trabajo: <b>${hTrabajo} h</b></li>
        <li>Sesiones de gym: <b>${nGym}</b></li>
        <li>Invertido: <b>${invertido} €</b></li>
      </ul>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Life Hub <onboarding@resend.dev>",
        to: [Deno.env.get("RESUMEN_EMAIL")],
        subject: "Resumen semanal · Life Hub",
        html,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
