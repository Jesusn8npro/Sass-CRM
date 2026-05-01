import path from "node:path";
import fs from "node:fs";

const rutaEnv = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(rutaEnv)) {
  const contenido = fs.readFileSync(rutaEnv, "utf-8");
  for (const lineaCruda of contenido.split(/\r?\n/)) {
    const linea = lineaCruda.trim();
    if (!linea || linea.startsWith("#")) continue;
    const igual = linea.indexOf("=");
    if (igual < 0) continue;
    const clave = linea.slice(0, igual).trim();
    let valor = linea.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) {
      process.env[clave] = valor;
    }
  }
}
