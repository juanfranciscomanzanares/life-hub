/*
  Ejecuta esto UNA VEZ, tú mismo, a mano (con `npm run login-inicial` en esta
  carpeta). Abre un navegador de verdad para que veas lo que pasa, hace login
  con tu usuario/contraseña de la UMU, y cuando llegue el segundo factor te
  pide el código AQUÍ MISMO, en esta terminal — sin relevos por chat, así que
  el código se usa al instante y no le da tiempo a caducar.

  Al terminar, si la UMU te ofrece "Registro de dispositivo de confianza",
  este script lo acepta: así este navegador queda recordado y sync.mjs podrá
  entrar todos los días SIN volver a pedir 2FA (hasta que la UMU lo caduque,
  normalmente semanas o meses — cuando pase, solo hay que repetir este paso).

  La sesión (cookies) se guarda en tu perfil de Windows, no en este repositorio.
*/
import { chromium } from "playwright";
import { createInterface } from "node:readline/promises";
import { mkdirSync } from "node:fs";
import { BASE, estaConectado } from "./lib.mjs";

const CARPETA_DATOS = `${process.env.APPDATA}\\LifeHub`;
mkdirSync(CARPETA_DATOS, { recursive: true });
const SESION_PATH = `${CARPETA_DATOS}\\aula-sesion.json`;

const usuario = process.env.UMU_USER;
const contrasena = process.env.UMU_PASS;
if (!usuario || !contrasena) {
  console.error("Faltan UMU_USER / UMU_PASS en el entorno. Ejecuta esto vía ejecutar-login-inicial.ps1.");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pregunta = (texto) => rl.question(texto);

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log("Abriendo el login de la UMU...");
  await page.goto(`${BASE}/portal/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill(usuario);
  await page.locator('input[type="password"]').first().fill(contrasena);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  if ((await page.content()).includes("Credenciales inválidas")) {
    console.error("La UMU dice que el usuario/contraseña no son correctos.");
    await browser.close();
    rl.close();
    process.exit(1);
  }

  // Pantalla de segundo factor (si no hay dispositivo de confianza ya activo).
  const pantallaSegundoFactor = await page
    .getByText("Segundo factor de autenticación", { exact: false })
    .first()
    .isVisible()
    .catch(() => false);

  if (pantallaSegundoFactor) {
    console.log("\nElige cómo recibir el código:");
    console.log("  1) SMS");
    console.log("  2) Llamada telefónica");
    console.log("  3) Correo electrónico");
    const opcion = (await pregunta("Opción [1]: ")).trim() || "1";
    const textoBoton = { "1": "Envío de SMS", "2": "Llamada telefónica", "3": "Envío de correo electrónico" }[opcion] || "Envío de SMS";

    await page.getByText(textoBoton, { exact: false }).first().click();
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const codigo = (await pregunta("\nIntroduce el código que has recibido: ")).trim();
    const codeInput = page.locator('input[type="text"], input[type="tel"], input[type="number"]').first();
    await codeInput.fill(codigo);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    if ((await page.content()).includes("rechazado")) {
      console.error("La UMU rechazó el código (¿caducado?). Vuelve a ejecutar el script.");
      await browser.close();
      rl.close();
      process.exit(1);
    }
  }

  // "Registro de dispositivo de confianza": aceptarlo para no volver a pedir 2FA.
  const registrarBtn = page.getByText("Registrar", { exact: true }).first();
  if (await registrarBtn.isVisible().catch(() => false)) {
    console.log("\nRegistrando este navegador como dispositivo de confianza...");
    await registrarBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }

  const conectado = await estaConectado(page);
  if (!conectado) {
    console.error("No se pudo confirmar el login. Revisa la ventana del navegador.");
    await browser.close();
    rl.close();
    process.exit(1);
  }

  await page.context().storageState({ path: SESION_PATH });
  console.log(`\nListo. Sesión guardada en ${SESION_PATH}`);
  console.log("Ya puedes programar sync.mjs para que se ejecute cada día sin tocar nada.");

  await browser.close();
  rl.close();
}

main();
