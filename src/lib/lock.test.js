import { describe, it, expect, beforeEach } from "vitest";
import { enableLock, disableLock, verifyPin, isLockEnabled } from "./lock";

/*
  localStorage de mentira: los tests corren en entorno "node" (ver
  vitest.config.js), donde no existe.
*/
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};

// El SHA-256 hex del formato antiguo, para simular un PIN ya guardado.
async function sha256HexAntiguo(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("bloqueo con PIN", () => {
  beforeEach(() => almacen.clear());

  it("acepta el PIN correcto y rechaza el incorrecto", async () => {
    await enableLock("1234");
    expect(await verifyPin("1234")).toBe(true);
    expect(await verifyPin("1235")).toBe(false);
  });

  it("deja el bloqueo activado", async () => {
    expect(isLockEnabled()).toBe(false);
    await enableLock("1234");
    expect(isLockEnabled()).toBe(true);
  });

  it("exige al menos 4 dígitos", async () => {
    await expect(enableLock("123")).rejects.toThrow(/4 dígitos/);
    await expect(enableLock("")).rejects.toThrow();
  });

  it("NO guarda el PIN en claro", async () => {
    await enableLock("1234");
    expect(almacen.get("lh_lock_pin")).not.toContain("1234");
  });

  it("guarda sal e iteraciones, no un SHA-256 pelado", async () => {
    await enableLock("1234");
    const guardado = JSON.parse(almacen.get("lh_lock_pin"));
    expect(guardado.v).toBe(2);
    expect(guardado.iter).toBeGreaterThanOrEqual(100000);
    expect(guardado.salt).toMatch(/^[0-9a-f]{32}$/); // 16 bytes en hex
    expect(guardado.hash).toMatch(/^[0-9a-f]{64}$/); // 256 bits en hex
  });

  it("dos dispositivos con el MISMO PIN guardan hashes distintos", async () => {
    // Es lo que aporta la sal: sin ella, un hash igual delata que el PIN es el
    // mismo, y una tabla precalculada sirve para todo el mundo a la vez.
    await enableLock("1234");
    const primero = JSON.parse(almacen.get("lh_lock_pin"));
    almacen.clear();
    await enableLock("1234");
    const segundo = JSON.parse(almacen.get("lh_lock_pin"));
    expect(segundo.salt).not.toBe(primero.salt);
    expect(segundo.hash).not.toBe(primero.hash);
  });

  it("desactivar borra el PIN guardado", async () => {
    await enableLock("1234");
    disableLock();
    expect(almacen.get("lh_lock_pin")).toBeUndefined();
    expect(isLockEnabled()).toBe(false);
    expect(await verifyPin("1234")).toBe(false);
  });

  it("sin PIN guardado no deja pasar a nadie", async () => {
    expect(await verifyPin("1234")).toBe(false);
    expect(await verifyPin("")).toBe(false);
  });

  it("con el PIN guardado corrupto, falla en vez de dejar pasar", async () => {
    almacen.set("lh_lock_pin", JSON.stringify({ v: 2, salt: "aa" })); // sin hash
    expect(await verifyPin("1234")).toBe(false);
  });
});

describe("migración desde el formato antiguo (SHA-256 sin sal)", () => {
  beforeEach(() => almacen.clear());

  it("quien ya tenía el bloqueo sigue entrando con su PIN de siempre", async () => {
    almacen.set("lh_lock_pin", await sha256HexAntiguo("4321"));
    almacen.set("lh_lock_enabled", "1");
    expect(await verifyPin("4321")).toBe(true);
  });

  it("y sigue rechazando el PIN equivocado", async () => {
    almacen.set("lh_lock_pin", await sha256HexAntiguo("4321"));
    expect(await verifyPin("0000")).toBe(false);
  });

  it("al acertar, reescribe el PIN al formato nuevo", async () => {
    almacen.set("lh_lock_pin", await sha256HexAntiguo("4321"));
    await verifyPin("4321");

    const guardado = JSON.parse(almacen.get("lh_lock_pin"));
    expect(guardado.v).toBe(2);
    expect(guardado.salt).toMatch(/^[0-9a-f]{32}$/);
    // Y el PIN sigue valiendo después de migrar.
    expect(await verifyPin("4321")).toBe(true);
    expect(await verifyPin("0000")).toBe(false);
  });

  it("un PIN erróneo NO migra nada", async () => {
    const viejo = await sha256HexAntiguo("4321");
    almacen.set("lh_lock_pin", viejo);
    await verifyPin("0000");
    expect(almacen.get("lh_lock_pin")).toBe(viejo);
  });
});
