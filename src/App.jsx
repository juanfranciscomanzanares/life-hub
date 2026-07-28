import { useState, useEffect } from "react";
import { supabase, cloudEnabled } from "./lib/supabase";
import LifeDashboard from "./LifeDashboard.jsx";
import AppLock from "./AppLock.jsx";
import { reiniciarApp } from "./ErrorBoundary.jsx";

/*
  App = puerta de acceso + dashboard.
  - Sin Supabase configurado: entra directo (datos solo en el navegador).
  - Con Supabase: contraseña (por defecto) o enlace mágico (alternativa).

  Por qué la contraseña es el método principal: el enlace mágico da muchos
  problemas en el móvil. Las apps de correo abren los enlaces en su propio
  navegador interno, así que la sesión se crea allí y no en el navegador donde
  estabas; el enlace es de un solo uso; y el envío está limitado a unos pocos
  correos por hora. Con contraseña nada de eso aplica.
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

// Los mensajes de Supabase vienen en inglés y son poco claros.
function traducirError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed"))
    return "Ese correo aún no está confirmado. Confírmalo en Supabase (Authentication → Users) o usa el enlace por email.";
  if (m.includes("rate limit"))
    return "Se ha alcanzado el límite de correos por hora de Supabase. Entra con contraseña o espera un rato.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ese correo ya tiene cuenta. Entra con tu contraseña.";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sin conexión con el servidor. Revisa tu red.";
  return msg;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(cloudEnabled);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modo, setModo] = useState("password"); // "password" | "enlace"
  const [ocupado, setOcupado] = useState(false);
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
        if (error) setAviso(traducirError(error.message));
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
    const entrar = async () => {
      if (!email || !password || ocupado) return;
      setAviso(null);
      setOcupado(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setOcupado(false);
      if (error) setAviso(traducirError(error.message));
      // Si va bien, onAuthStateChange se encarga de entrar.
    };

    const registrar = async () => {
      if (!email || !password || ocupado) return;
      setAviso(null);
      setOcupado(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setOcupado(false);
      if (error) return setAviso(traducirError(error.message));
      if (data.session) return; // alta inmediata: onAuthStateChange entra solo

      /*
        Supabase no revela si un correo ya está registrado (evita que alguien
        sondee qué cuentas existen): ante un duplicado devuelve "éxito" sin
        sesión y sin enviar nada. La única pista es que identities llega vacío.
        Sin distinguirlo, el usuario se queda esperando un correo que no existe.
      */
      const yaExiste = Array.isArray(data.user?.identities) && data.user.identities.length === 0;
      setAviso(
        yaExiste
          ? "Ese correo ya tiene cuenta. Entra con tu contraseña; si no la recuerdas, cámbiala desde Supabase."
          : "Cuenta creada. Revisa tu correo para confirmarla y luego entra con tu contraseña."
      );
    };

    const enviarEnlace = async () => {
      if (!email || ocupado) return;
      setAviso(null);
      setOcupado(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      setOcupado(false);
      if (!error) setSent(true);
      else setAviso(traducirError(error.message));
    };

    const campoEmail = (
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
      />
    );

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

          {modo === "password" ? (
            <>
              <label className="mb-2 block text-sm text-slate-400">Entra con tu correo y contraseña:</label>
              {campoEmail}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                placeholder="Contraseña"
                autoComplete="current-password"
                className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={entrar}
                disabled={ocupado}
                className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {ocupado ? "Entrando..." : "Entrar"}
              </button>
              <button
                onClick={registrar}
                disabled={ocupado}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-indigo-500 disabled:opacity-50"
              >
                Crear cuenta
              </button>
              <button
                onClick={() => { setModo("enlace"); setAviso(null); }}
                className="mt-4 w-full text-xs text-slate-500 underline"
              >
                Prefiero recibir un enlace por email
              </button>
            </>
          ) : sent ? (
            <p className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              Te hemos enviado un enlace de acceso a <b>{email}</b>. Ábrelo en{" "}
              <b>este mismo navegador</b>. Si tu app de correo lo abre en su propio
              navegador, mantén pulsado el enlace, cópialo y pégalo aquí.
            </p>
          ) : (
            <>
              <label className="mb-2 block text-sm text-slate-400">
                Te enviaremos un enlace de acceso, sin contraseña:
              </label>
              {campoEmail}
              <button
                onClick={enviarEnlace}
                disabled={ocupado}
                className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {ocupado ? "Enviando..." : "Enviar enlace de acceso"}
              </button>
              <button
                onClick={() => { setModo("password"); setAviso(null); }}
                className="mt-4 w-full text-xs text-slate-500 underline"
              >
                Volver a entrar con contraseña
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
