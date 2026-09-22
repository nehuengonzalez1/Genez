/* ============================================================
   RESTAURAR UNA COPIA DE UN COMERCIO
   ============================================================

   Devuelve a la base lo que guardó el respaldo de una carpeta de
   `respaldos/`. Existe por una razón puntual: el proyecto está en el
   plan Free de Supabase, que **no hace copias automáticas ni tiene
   point-in-time recovery**. Sin esto, vaciar un comercio para cargar
   datos reales es un camino de ida.

     node scripts/restaurar-respaldo.mjs respaldos/super25-2026-09-22

   POR QUÉ JSON Y NO UN .sql DE INSERTS
   ------------------------------------
   Porque el escapado lo hace Postgres y no nosotros. `jsonb_populate_recordset`
   toma el JSON tal cual y lo convierte a filas de la tabla respetando los
   tipos: fechas, numéricos, jsonb y arreglos vuelven como eran. Armar los
   INSERT a mano es donde aparecen las comillas mal cerradas y los jsonb
   que vuelven como texto.

   EL ORDEN IMPORTA
   ----------------
   Las tablas se insertan de la que no depende de nadie hacia la que
   depende de todas, porque las claves foráneas se validan en el momento.
   `_empresa.json` va primero por lo mismo: todo lo demás cuelga de ahí.

   Todo corre en una transacción: si una tabla falla, no queda nada a
   medio restaurar.
   ============================================================ */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import pg from "pg";

const carpeta = process.argv[2];
if (!carpeta) {
  console.error("Falta la carpeta. Ej: node scripts/restaurar-respaldo.mjs respaldos/super25-2026-09-22");
  process.exit(1);
}
if (!existsSync(carpeta)) {
  console.error(`No existe la carpeta ${carpeta}.`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

if (!env.SUPABASE_DB_URL) {
  console.error("Falta SUPABASE_DB_URL en el .env.");
  process.exit(1);
}

/* De padres a hijos. Lo que no esté acá se restaura después, en orden
   alfabético, que alcanza para las tablas sueltas sin dependencias. */
const ORDEN = [
  "sucursales", "proveedores", "canales", "roles", "perfiles", "personal",
  "clientes", "contactos", "cliente_notas", "items", "recursos",
  "historial_costos", "historial_precios", "recetas", "receta_insumos",
  "personal_servicios", "horarios", "excepciones", "plano_elementos",
  "sesiones_caja", "operaciones", "operacion_lineas", "pagos", "pedido_estados",
  "movimientos_stock", "movimientos_caja", "abonos", "reservas", "espera",
  "cuenta_corriente_pagos", "liquidaciones", "liquidacion_notas", "plantillas",
  "bitacora",
];

const archivos = readdirSync(carpeta).filter((f) => f.endsWith(".json"));
const tablas = archivos.map((f) => f.replace(/\.json$/, "")).filter((t) => t !== "_empresa");
tablas.sort((a, b) => {
  const ia = ORDEN.indexOf(a), ib = ORDEN.indexOf(b);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
});

const cliente = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await cliente.connect();

try {
  await cliente.query("begin");

  /* `on conflict do nothing` en todas: restaurar sobre una base que ya
     tiene parte de los datos tiene que poder correrse sin explotar. */
  if (existsSync(`${carpeta}/_empresa.json`)) {
    const filas = JSON.parse(readFileSync(`${carpeta}/_empresa.json`, "utf8"));
    await cliente.query(
      `insert into empresas select * from jsonb_populate_recordset(null::empresas, $1) on conflict (id) do nothing`,
      [JSON.stringify(filas)]
    );
    console.log(`empresas            ${String(filas.length).padStart(6)}`);
  }

  for (const t of tablas) {
    const filas = JSON.parse(readFileSync(`${carpeta}/${t}.json`, "utf8"));
    if (!filas.length) continue;
    await cliente.query(
      `insert into ${t} select * from jsonb_populate_recordset(null::${t}, $1) on conflict do nothing`,
      [JSON.stringify(filas)]
    );
    console.log(`${t.padEnd(20)}${String(filas.length).padStart(6)}`);
  }

  await cliente.query("commit");
  console.log("\nRestaurado.");
} catch (e) {
  await cliente.query("rollback");
  console.error("\nFalló y no se aplicó nada:", e.message);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
