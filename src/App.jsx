import { useState, useEffect } from "react";
import { supabase, cloudEnabled } from "./lib/supabase";
import LifeDashboard from "./LifeDashboard.jsx";
import AppLock from "./AppLock.jsx";
import { reiniciarApp } from "./ErrorBoundary.jsx";

/*
  App = puerta de acceso + dashboard.
  - Sin Supabase configurado: entra directo (datos solo en el navegador).
  - Con Supabase: pide el email y envía un enlace mágico. Al iniciar sesión,
    los datos se sincronizan entre dispositivos.
*/

// Supabase devuelve los errores del enlace mágico en el # (o en la query).
// Sin leerlos, un enlace caducado dejaba la pantalla de login muda.
function leerErrorDeUrl() {
  const params = new URLSearchParams(
    (window.location.hash || "").replace(/^#/, "") || window.location.search.replace(/^\?/, "")
  );
  const code = params.get("error_code");
  const desc = params.get("error_description");
  if (!code && !desc) return null;
  if (code === "otp_expired" || /expired/i.test(desc || ""))
    return "El enlace ha caducado o ya se había usado. Pide uno nuevo y ábrelo cuanto antes (los enlaces son de un solo uso).";
  return (desc || code || "").replace(/\+/g, " ");
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(cloudEnabled);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [aviso, setAviso] = useState(() => (cloudEnabled ? leerErrorDeUrl() : null));

  useEffect(() => {
    if (!cloudEnabled) return;
    let vivo = true;

    /*
      Antes esto era `getSession().then(...)` a secas. Si la promesa se quedaba
      colgada o fallaba, `checking` no se ponía nunca a false y la app se quedaba
      eternamente en "Cargando..." sobre fondo casi negro. Ahora hay tope de
      tiempo y captura de errores: pase lo que pase, se acaba pintando algo.
    */
    const tope = setTimeout(() => {
      if (vivo) {
        setChecking(false);
        setAviso((a) => a || "No se pudo contactar con el servidor. Comprueba tu conexión.");
      }
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setAviso(error.message);
        setSession(data?.session ?? null);
      })
      .catch((e) => {
        if (vivo) setAviso("Error de sesión: " + (e?.message || e));
      })
      .finally(() => {
        if (!vivo) return;
        clearTimeout(tope);
        setChecking(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (!vivo) return;
      setSession(s);
      setChecking(false);
      if (s) {
        setAviso(null);
        // Limpia el token del enlace mágico de la URL: si se queda, al recargar
        // se reintenta un token ya gastado y aparece un error falso.
        if (window.location.hash.includes("access_token") || window.location.search.includes("code=")) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    });

    return () => {
      vivo = false;
      clearTimeout(tope);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Modo local (sin nube): directo al dashboard (con bloqueo opcional).
  if (!cloudEnabled)
    return (
      <AppLock>
        <LifeDashboard onSignOut={null} userEmail={null} />
      </AppLock>
    );

  if (checking)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-400">
        <p>Cargando...</p>
        <button onClick={reiniciarApp} className="text-xs text-slate-600 underline">
          ¿Se queda atascado? Reiniciar app
        </button>
      </div>
    );

  // Con nube pero sin sesión: pantalla de acceso.
  if (!session) {
    const sendLink = async () => {
      if (!email) return;
      setAviso(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (!error) setSent(true);
      else setAviso("Error: " + error.message);
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold text-white">
              Q
            </div>
            <div>
              <p className="text-lg font-bold text-slate-100">Life Hub</p>
              <p className="text-xs text-slate-500">Tu panel personal</p>
            </div>
          </div>

          {aviso && (
            <p className="mb-4 rounded-xl border border-amber-800 bg-amber-500/10 p-3 text-sm text-amber-300">
              {aviso}
            </p>
          )}

          {sent ? (
            <p className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              Te hemos enviado un enlace de acceso a <b>{email}</b>. Ábrelo en{" "}
              <b>este mismo dispositivo</b>. Si tu app de correo lo abre en su
              propio navegador, copia el enlace y pégalo aquí, en este navegador.
            </p>
          ) : (
            <>
              <label className="mb-2 block text-sm text-slate-400">
                Entra con tu correo (recibirás un enlace mágico, sin contraseña):
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendLink()}
                placeholder="tu@email.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={sendLink}
                className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Enviar enlace de acceso
              </button>
            </>
          )}

          <button onClick={reiniciarApp} className="mt-5 w-full text-xs text-slate-600 underline">
            Reiniciar app (borra caché)
          </button>
        </div>
      </div>
    );
  }
  return (
    <AppLock>
      <LifeDashboard
        userEmail={session.user.email}
        onSignOut={() => supabase.auth.signOut()}
      />
    </AppLock>
  );
}
