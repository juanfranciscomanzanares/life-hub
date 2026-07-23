/*
  Bloqueo de la app: PIN (obligatorio como respaldo) + biometría opcional
  (Face ID / huella) vía WebAuthn. Todo local en el dispositivo.

  Nota de seguridad honesta: al ser 100% cliente, este bloqueo protege frente a
  miradas ajenas y accesos casuales, pero no es cifrado de datos de nivel bancario.
  Para eso haría falta cifrar el contenido con una clave derivada del PIN.
*/

const K_ENABLED = "lh_lock_enabled";
const K_PIN = "lh_lock_pin"; // hash SHA-256 en hex
const K_CRED = "lh_lock_cred"; // id de credencial biométrica (base64)

export const isLockEnabled = () => localStorage.getItem(K_ENABLED) === "1";
export const hasBiometric = () => !!localStorage.getItem(K_CRED);

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function enableLock(pin) {
  if (!pin || pin.length < 4) throw new Error("El PIN debe tener al menos 4 dígitos.");
  localStorage.setItem(K_PIN, await sha256(pin));
  localStorage.setItem(K_ENABLED, "1");
}

export function disableLock() {
  localStorage.removeItem(K_ENABLED);
  localStorage.removeItem(K_PIN);
  localStorage.removeItem(K_CRED);
}

export async function verifyPin(pin) {
  const stored = localStorage.getItem(K_PIN);
  return stored && stored === (await sha256(pin));
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
