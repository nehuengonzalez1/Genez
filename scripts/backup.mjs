/* ============================================================
   BACKUP · una copia completa de la base, en esta computadora
   ============================================================

   Supabase está en plan Free y no tiene backups: si algo se borra o la
   base se pierde, no hay de dónde recuperarlo. Esto copia cada tabla del
   esquema `public` —y los usuarios de Auth— a archivos JSON, uno por
   tabla, en una carpeta fechada.

     node scripts/backup.mjs                  → C:\Users\<vos>\Genez-backups\AAAA-MM-DD_HHMM
     node scripts/backup.mjs D:\otra\carpeta  → ahí

   Solo lee: corre en una transacción de solo lectura, así que no puede
   modificar nada aunque algo salga mal. Y todas las tablas se leen en la
   misma foto, sin que una venta que entra en el medio quede a medias.

   La carpeta va FUERA del repositorio a propósito: tiene los datos de los
   comercios (clientes, ventas, CUIT, emails de los usuarios) y no puede
   terminar en git.

   Qué NO guarda: la estructura de la base (está en supabase/migrations/),
   las contraseñas de Auth (Supabase no las expone) ni los secretos de
   Vercel. Para volver a cargar una tabla, cada archivo es un arreglo de
   filas con los nombres de columna de la base.
   ============================================================ */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const ahora = new Date();
const sello = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}_${String(ahora.getHours()).padStart(2, "0")}${String(ahora.getMinutes()).padStart(2, "0")}`;
const destino = process.argv[2] || join(homedir(), "Genez-backups", sello);
mkdirSync(destino, { recursive: true });

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
await c.query("begin isolation level repeatable read read only");

const tablas = (await c.query(
  `select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
)).rows.map((r) => r.table_name);

const resumen = { fecha: ahora.toISOString(), tablas: {} };
let total = 0;

for (const t of tablas) {
  const filas = (await c.query(`select * from public."${t}"`)).rows;
  writeFileSync(join(destino, `${t}.json`), JSON.stringify(filas));
  resumen.tablas[t] = filas.length;
  total += filas.length;
}

/* Los usuarios, sin nada que sirva para entrar: quién es cada uno y de
   qué comercio, para poder recrearlos si hiciera falta. */
const usuarios = (await c.query(
  "select id, email, created_at, last_sign_in_at, email_confirmed_at from auth.users order by created_at"
)).rows;
writeFileSync(join(destino, "auth_users.json"), JSON.stringify(usuarios));
resumen.tablas["auth.users"] = usuarios.length;

await c.query("rollback");
await c.end();

writeFileSync(join(destino, "_resumen.json"), JSON.stringify(resumen, null, 2));
console.log(`Backup en ${destino}`);
console.log(`${tablas.length} tablas, ${total.toLocaleString("es-AR")} filas, ${usuarios.length} usuarios.`);
