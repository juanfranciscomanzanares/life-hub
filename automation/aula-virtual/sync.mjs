/*
  Sincronización diaria, sin interacción. La ejecuta el Programador de tareas
  de Windows (ver instalar-tarea-programada.ps1). Reutiliza la sesión guardada
  por login-inicial.mjs: si el "dispositivo de confianza" sigue vigente, entra
  sin pedir 2FA. Si ya no es válida, lo deja escrito en el log y hace falta
  repetir login-inicial.mjs a mano una vez más.
*/
import { chromium } from "playwright";
import { existsSync, appendFileSync, mkdirSync } from "node:fs";
import { BASE, estaConectado, leerTareas, subirASupabase } from "./lib.mjs";

const CARPETA_DATOS = `${process.env.APPDATA}\\LifeHub`;
mkdirSync(CARPETA_DATOS, { recursive: true });
const SESION_PATH = `${CARPETA_DATOS}\\aula-sesion.json`;
const LOG_PATH = `${CARPETA_DATOS}\\aula-sync.log`;

const log = (msg) => {
  const linea = `[${new Date().toISOString()}] ${msg}`;
  console.log(linea);
  appendFileSync(LOG_PATH, linea + "\n");
};

async function main() {
  if (!existsSync(SESION_PATH)) {
    log("ERROR: no hay sesión guardada. Ejecuta primero: npm run login-inicial");
    process.exit(1);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, LH_EMAIL, LH_PASSWORD } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !LH_EMAIL || !LH_PASSWORD) {
    log("ERROR: faltan variables de Supabase/Life Hub en el entorno.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESION_PATH });
  const page = await context.newPage();

  try {
    const conectado = await estaConectado(page);
    if (!conectado) {
      log(
        "ERROR: la sesión guardada ya no vale (el dispositivo de confianza caducó). " +
          "Ejecuta de nuevo: npm run login-inicial"
      );
      await browser.close();
      process.exit(1);
    }

    const tareas = await leerTareas(page);
    log(`Leídas ${tareas.length} tareas.`);

    await subirASupabase({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      email: LH_EMAIL,
      contrasena: LH_PASSWORD,
      tareas,
    });
    log("Subido a Life Hub correctamente.");

    // Refresca la sesión guardada por si las cookies rotaron.
    await context.storageState({ path: SESION_PATH });
  } catch (e) {
    log(`ERROR: ${e.message}`);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
