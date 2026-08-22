/* ============================================================
   APLICAR UN ARCHIVO SQL A LA BASE
   ============================================================

   Corre un .sql contra la base de Supabase usando la cadena de conexión
   que está en el .env (SUPABASE_DB_URL). Sirve para migraciones y
   semillas sin depender de pegar texto en el editor del navegador,
   que se atraganta con archivos grandes.

     node scripts/aplicar-sql.mjs supabase/seed/catalogo.sql

   Corre todo dentro de una transacción: si algo falla, no queda nada
   a medio aplicar.
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const archivo = process.argv[2];
if (!archivo) {
  console.error("Falta el archivo. Ej: node scripts/aplicar-sql.mjs supabase/seed/catalogo.sql");
  process.exit(1);
}

/* Se lee el .env a mano para no sumar una dependencia por esto. */
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const cadena = env.SUPABASE_DB_URL;
if (!cadena) {
  console.error(
    "Falta SUPABASE_DB_URL en el .env.\n" +
    "Se saca del panel de Supabase, botón Connect → Session pooler."
  );
  process.exit(1);
}

const sql = readFileSync(archivo, "utf8");
const cliente = new pg.Client({ connectionString: cadena });

/* Los avisos del servidor (raise notice) son la única forma de saber si
   una semilla hizo algo o se salteó porque ya estaba cargada. */
cliente.on("notice", (n) => console.log("  " + (n.message || "").trim()));

try {
  await cliente.connect();
  console.log(`Aplicando ${archivo} (${(sql.length / 1024).toFixed(0)} KB)…`);

  await cliente.query("begin");
  await cliente.query(sql);
  await cliente.query("commit");

  console.log("Listo.");
} catch (e) {
  try { await cliente.query("rollback"); } catch { /* la conexión ya puede estar caída */ }
  console.error("\nFalló. No se aplicó nada.\n");
  console.error(e.message);
  if (e.position) {
    const hasta = sql.slice(0, Number(e.position));
    const linea = hasta.split("\n").length;
    console.error(`Línea ${linea} del archivo.`);
  }
  process.exitCode = 1;
} finally {
  await cliente.end();
}
