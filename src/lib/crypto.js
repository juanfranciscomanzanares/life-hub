/*
  Cifrado real de copias de seguridad.
  AES-GCM 256 con clave derivada de tu contraseña mediante PBKDF2 (200k iteraciones).
  El archivo resultante solo se puede abrir con la misma contraseña; si la olvidas,
  no hay forma de recuperarlo (por diseño).
*/

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJSON(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, alg: "AES-GCM", salt: b64.enc(salt), iv: b64.enc(iv), data: b64.enc(ct) });
}

export async function decryptJSON(bundleStr, pass) {
  const b = JSON.parse(bundleStr);
  const key = await deriveKey(pass, b64.dec(b.salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.dec(b.iv) }, key, b64.dec(b.data));
  return JSON.parse(dec.decode(pt));
}
