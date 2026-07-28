/*
  Funciones compartidas entre login-inicial.mjs (manual, una vez) y sync.mjs
  (automático, cada día).

  Aula Virtual UMU = Sakai (no Moodle). El login pasa por CAS con segundo
  factor (SMS/llamada/email/app OTP). Una vez completado el 2FA una vez y
  aceptado "Registro de dispositivo de confianza", ese navegador (identificado
  por sus cookies) no vuelve a pedir 2FA durante un tiempo — por eso
  login-inicial.mjs guarda el storageState de Playwright y sync.mjs lo
  reutiliza sin volver a tocar el 2FA.
*/

export const BASE = "https://aulavirtual.um.es";

export async function estaConectado(page) {
  const res = await page.goto(`${BASE}/portal`, { waitUntil: "networkidle" });
  const html = await res.text().catch(() => "");
  return /"loggedIn"\s*:\s*true/.test(html);
}

export async function leerTareas(page) {
  const [sitiosRes, tareasRes] = await Promise.all([
    page.request.get(`${BASE}/direct/site.json`),
    page.request.get(`${BASE}/direct/assignment/my.json`),
  ]);

  if (!sitiosRes.ok() || !tareasRes.ok()) {
    throw new Error(
      `El Aula Virtual respondió site=${sitiosRes.status()} assignment=${tareasRes.status()}`
    );
  }

  const sitios = await sitiosRes.json();
  const tareas = await tareasRes.json();

  const nombrePorSitio = new Map(
    (sitios?.site_collection ?? sitios?.sites ?? []).map((s) => [
      s.entityId ?? s.id,
      s.title ?? s.entityTitle ?? s.entityId ?? s.id,
    ])
  );

  return (tareas?.assignment_collection ?? tareas?.assignments ?? [])
    .filter((a) => !a.draft)
    .map((a) => ({
      id: a.id ?? a.entityId,
      titulo: a.title ?? "(sin título)",
      asignatura: nombrePorSitio.get(a.context) ?? a.context ?? "—",
      abre: a.openTimeString ?? a.openTime ?? null,
      entrega: a.dueTimeString ?? a.dueTime ?? null,
      cierra: a.closeTimeString ?? a.closeTime ?? null,
    }))
    .sort((a, b) => String(b.entrega ?? "").localeCompare(String(a.entrega ?? "")));
}

export async function subirASupabase({ url, anonKey, email, contrasena, tareas }) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, anonKey);

  const { data: auth, error: errLogin } = await supabase.auth.signInWithPassword({
    email,
    password: contrasena,
  });
  if (errLogin) throw new Error(`No se pudo entrar en Life Hub: ${errLogin.message}`);

  const userId = auth.user.id;
  const ahora = new Date().toISOString();

  const { error: errTareas } = await supabase
    .from("app_state")
    .upsert({ key: "lh_aula_tareas", value: tareas, user_id: userId });
  if (errTareas) throw new Error(`No se pudo guardar lh_aula_tareas: ${errTareas.message}`);

  const { error: errFecha } = await supabase
    .from("app_state")
    .upsert({ key: "lh_aula_ultima_sync", value: ahora, user_id: userId });
  if (errFecha) throw new Error(`No se pudo guardar lh_aula_ultima_sync: ${errFecha.message}`);

  await supabase.auth.signOut();
}
