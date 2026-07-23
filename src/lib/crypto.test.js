import { describe, it, expect } from "vitest";
import { encryptJSON, decryptJSON } from "./crypto";

describe("crypto (AES-GCM + PBKDF2)", () => {
  it("cifra y descifra correctamente (roundtrip)", async () => {
    const obj = { a: 1, b: "hola €ñ", c: [1, 2, 3], d: { x: true } };
    const enc = await encryptJSON(obj, "clave-secreta-123");
    expect(typeof enc).toBe("string");
    expect(enc).not.toContain("hola"); // el contenido va cifrado
    const dec = await decryptJSON(enc, "clave-secreta-123");
    expect(dec).toEqual(obj);
  });

  it("falla con contraseña incorrecta", async () => {
    const enc = await encryptJSON({ secreto: 42 }, "buena");
    await expect(decryptJSON(enc, "mala")).rejects.toBeTruthy();
  });
});
