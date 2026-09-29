/* ============================================================
   La pantalla de pruebas · copiar lo de plataforma
   ============================================================

   La pantalla de pruebas (vite --mode pruebas, ver src/pruebas/) corre
   con una base de mentira. Lo único que copia de la de verdad es lo que
   es de la plataforma y no de un comercio: los rubros (su menú, sus
   voces, su pantalla de inicio) y los cuatro roles de fábrica. Sin eso
   el menú de la pantalla de pruebas no sería el de producción, que es
   justo lo que se quiere ver.

   Solo lee, en una transacción de solo lectura. Se corre de nuevo
   cuando cambia un menú o un rol:

     node scripts/armar-datos-de-prueba.mjs
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
try {
  await c.query("begin read only");
  const rubros = (await c.query("select * from rubros order by orden, clave")).rows;
  const roles_base = (await c.query("select * from roles_base order by orden")).rows;
  await c.query("rollback");
  writeFileSync("src/pruebas/plataforma.json", JSON.stringify({ copiado: new Date().toISOString().slice(0, 10), rubros, roles_base }, null, 2) + "\n");
  console.log(`${rubros.length} rubros y ${roles_base.length} roles copiados a src/pruebas/plataforma.json`);
} finally {
  await c.end();
}
