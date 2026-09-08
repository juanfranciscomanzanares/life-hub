/*
  Bloqueo de la app: PIN (obligatorio como respaldo) + biometría opcional
  (Face ID / huella) vía WebAuthn. Todo local en el dispositivo.

  Nota de seguridad honesta: al ser 100% cliente, este bloqueo protege frente a
  miradas ajenas y accesos casuales, pero no cifra los datos. Quien tenga el
  dispositivo desbloqueado puede abrir localStorage y leerlos sin pasar por
  aquí. Para eso haría falta cifrar el contenido con una clave derivada del PIN.

  Lo que sí se arregló: cómo se guarda el propio PIN. Antes era un SHA-256 a
  secas del PIN. Un PIN de 4 dígitos son 10.000 combinaciones y SHA-256 está
  pensado para ser RÁPIDO, así que quien leyera `lh_lock_pin` recuperaba el
  número al instante con una tabla precalculada — y mucha gente reutiliza el
  mismo PIN en el móvil o en la tarjeta. Ahora se deriva con PBKDF2 (misma
  familia que ya usaban las copias cifradas, ver crypto.js): sal aleatoria por
  dispositivo, que invalida las tablas precalculadas, y 200.000 iteraciones,
  que convierten el barrido de las 10.000 combinaciones en algo lento de verdad.
*/

const K_ENABLED = "lh_lock_enabled";
const K_PIN = "lh_lock_pin"; // v2: JSON {v,salt,hash,iter}. v1: hex de SHA-256.
const K_CRED = "lh_lock_cred"; // id de credencial biométrica (base64)

// Igual que en crypto.js: subirlas encarece el ataque y también el desbloqueo
// legítimo, que aquí es una sola derivación de ~0,2 s.
const ITERACIONES = 200000;

export const isLockEnabled = () => localStorage.getItem(K_ENABLED) === "1";
export const hasBiometric = () => !!localStorage.getItem(K_CRED);

const enc = new TextEncoder();

const aHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* --- Formato antiguo (v1), solo para poder migrar --- */
async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(texto));
  return aHex(buf);
}

/* --- Formato actual (v2) --- */
async function derivar(pin, salt, iteraciones = ITERACIONES) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iteraciones, hash: "SHA-256" },
    base,
    256
  );
  return aHex(bits);
}

/*
  Comparación en tiempo constante.

  Aquí el atacante ya tiene el dispositivo en la mano y puede leer el hash
  directamente, así que medir tiempos no le aporta nada; se hace igual porque
  cuesta tres líneas y evita que alguien copie este patrón a un sitio donde sí
  importe.
*/
function igualdadConstante(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

const salAleatoria = () => crypto.getRandomValues(new Uint8Array(16));

const bytesAHex = (bytes) => aHex(bytes);
const hexABytes = (hex) =>
  new Uint8Array(String(hex).match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? []);

// Lee lo guardado. Devuelve null si no hay nada o si está corrupto: en ese caso
// verifyPin falla y el usuario puede volver a fijar el PIN desde Datos.
function leerGuardado() {
  const bruto = localStorage.getItem(K_PIN);
  if (!bruto) return null;
  try {
    const o = JSON.parse(bruto);
    if (o && o.v === 2 && o.salt && o.hash) return o;
    return null;
  } catch {
    /*
      No es JSON: es el formato viejo, el hex pelado de SHA-256. Se devuelve
      marcado para que verifyPin lo compruebe a la antigua y lo migre.
    */
    return { v: 1, hash: bruto };
  }
}

async function guardarPin(pin) {
  const salt = salAleatoria();
  const hash = await derivar(pin, salt);
  localStorage.setItem(
    K_PIN,
    JSON.stringify({ v: 2, salt: bytesAHex(salt), hash, iter: ITERACIONES })
  );
}

export async function enableLock(pin) {
  if (!pin || pin.length < 4) throw new Error("El PIN debe tener al menos 4 dígitos.");
  await guardarPin(pin);
  localStorage.setItem(K_ENABLED, "1");
}

export function disableLock() {
  localStorage.removeItem(K_ENABLED);
  localStorage.removeItem(K_PIN);
  localStorage.removeItem(K_CRED);
}

/*
  Comprueba el PIN y, de paso, migra.

  Quien ya tuviera el bloqueo puesto sigue entrando con su PIN de siempre: se
  valida contra el SHA-256 antiguo y, si acierta, se reescribe al formato nuevo
  en ese mismo momento. Sin esto, reforzar el guardado habría dejado fuera a
  quien ya lo usaba.
*/
export async function verifyPin(pin) {
  const guardado = leerGuardado();
  if (!guardado || !pin) return false;

  if (guardado.v === 1) {
    const ok = igualdadConstante(guardado.hash, await sha256Hex(pin));
    if (ok) await guardarPin(pin); // migración silenciosa
    return ok;
  }

  const hash = await derivar(pin, hexABytes(guardado.salt), guardado.iter || ITERACIONES);
  return igualdadConstante(guardado.hash, hash);
}

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

export function biometricSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

// Registra una credencial de plataforma (Face ID / huella)
export async function registerBiometric() {
  if (!biometricSupported()) throw new Error("Este dispositivo no soporta biometría web.");
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Life Hub", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "life-hub", displayName: "Life Hub" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  });
  localStorage.setItem(K_CRED, b64.enc(cred.rawId));
}

// Pide la biometría para desbloquear
export async function verifyBiometric() {
  const id = localStorage.getItem(K_CRED);
  if (!id) return false;
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: b64.dec(id) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return true; // si no lanza error, la biometría fue correcta
}
