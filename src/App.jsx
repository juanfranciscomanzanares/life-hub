import { useState, useEffect } from "react";
import { supabase, cloudEnabled } from "./lib/supabase";
import LifeDashboard from "./LifeDashboard.jsx";
import AppLock from "./AppLock.jsx";

/*
  App = puerta de acceso + dashboard.
  - Sin Supabase configurado: entra directo (datos solo en el navegador).
  - Con Supabase: pide el email y envía un enlace mágico. Al iniciar sesión,
    los datos se sincronizan entre dispositivos.
*/
export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(cloudEnabled);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!cloudEnabled) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Cargando...
      </div>
    );

  // Con nube pero sin sesión: pantalla de acceso.
  if (!session) {
    const sendLink = async () => {
      if (!email) return;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (!error) setSent(true);
      else alert("Error: " + error.message);
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

          {sent ? (
            <p className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              Te hemos enviado un enlace de acceso a <b>{email}</b>. Ábrelo en este
              dispositivo para entrar.
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
                className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={sendLink}
                className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Enviar enlace de acceso
              </button>
            </>
          )}
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
