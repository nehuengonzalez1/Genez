/* ============================================================
   GENERADOR DE LA SEMILLA DEL CATÁLOGO
   ============================================================

   Toma el catálogo simulado que ya usaba el prototipo y lo convierte en
   SQL para cargarlo en Super 25. Es para desarrollo: da con qué trabajar
   mientras no esté el catálogo real del comercio.

   No inserta historial de ventas. Las pantallas que dependen de eso
   (inicio, informes, diagnóstico) van a quedar vacías hasta que
   migremos las operaciones.

     node scripts/generar-semilla-catalogo.mjs

   Escribe supabase/seed/catalogo.sql
   ============================================================ */

import { writeFileSync, mkdirSync } from "node:fs";
import { DATA, PROV_INFO } from "../src/datos/generador.js";

const EMPRESA = "Super 25";

const txt = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "null" : String(Number(v)));
const fecha = (d) => (d instanceof Date && !isNaN(d) ? `'${d.toISOString()}'` : "null");

const lineas = [];
const w = (s = "") => lineas.push(s);

w("/* ============================================================");
w("   SEMILLA · catálogo de desarrollo para Super 25");
w("   ============================================================");
w("");
w("   Generado por scripts/generar-semilla-catalogo.mjs · no editar a mano.");
w("   Datos simulados: sirven para desarrollar, no son del comercio real.");
w("");
w("   Se puede correr más de una vez sin duplicar: si el catálogo ya");
w("   está cargado, no hace nada.");
w("   ============================================================ */");
w("");
w("do $$");
w("begin");
w(`  if not exists (select 1 from empresas where nombre = ${txt(EMPRESA)}) then`);
w(`    raise exception 'No existe la empresa ${EMPRESA}. Corré 0003_semilla.sql primero.';`);
w("  end if;");
w("  if exists (");
w("    select 1 from items i join empresas e on e.id = i.empresa_id");
w(`    where e.nombre = ${txt(EMPRESA)}`);
w("  ) then");
w("    raise notice 'El catálogo ya estaba cargado. No se hizo nada.';");
w("    return;");
w("  end if;");
w("");

/* ---- Proveedores ---- */
const provs = Object.entries(PROV_INFO);
w("  /* Proveedores */");
w("  insert into proveedores (empresa_id, nombre, cuit, tel, condicion_pago, dias_entrega)");
w("  select e.id, v.nombre, v.cuit, v.tel, v.pago, v.entrega");
w(`  from empresas e cross join (values`);
w(provs.map(([n, i]) => `    (${txt(n)}, ${txt(i.cuit)}, ${txt(i.tel)}, ${txt(i.pago)}, ${txt(i.entrega)})`).join(",\n"));
w("  ) as v(nombre, cuit, tel, pago, entrega)");
w(`  where e.nombre = ${txt(EMPRESA)};`);
w("");

/* ---- Items ---- */
const ps = DATA.productos;
w(`  /* Catálogo · ${ps.length} productos */`);
w("  insert into items (");
w("    empresa_id, tipo, nombre, categoria, marca, sku, barcode, unidad,");
w("    costo, precio, iva, controla_stock, stock_min, bulto, proveedor_id, activo");
w("  )");
w("  select");
w("    e.id, 'producto', v.nombre, v.categoria, v.marca, v.sku, v.barcode, v.unidad,");
w("    v.costo, v.precio, v.iva, true, v.stock_min, v.bulto, p.id, true");
w("  from empresas e");
w("  cross join (values");
w(ps.map((p) => "    (" + [
  txt(p.nombre), txt(p.categoria), txt(p.marca), txt(p.sku), txt(p.barcode), txt(p.unidad),
  num(p.costo), num(p.precio), num(p.iva), num(p.stockMin), num(p.bulto), txt(p.proveedor),
].join(", ") + ")").join(",\n"));
w("  ) as v(nombre, categoria, marca, sku, barcode, unidad, costo, precio, iva, stock_min, bulto, proveedor)");
w("  left join proveedores p on p.empresa_id = e.id and p.nombre = v.proveedor");
w(`  where e.nombre = ${txt(EMPRESA)};`);
w("");

/* ---- Historial de costos ----
   El motor de diagnóstico compara el costo de hoy contra el de antes
   para detectar subas y caída de margen. Sin esto no tiene con qué. */
const hist = [];
for (const p of ps) for (const h of p.historial || []) hist.push([p.sku, h.costo, h.fecha]);

w(`  /* Historial de costos · ${hist.length} registros */`);
w("  insert into historial_costos (empresa_id, item_id, costo, fecha, origen)");
w("  select i.empresa_id, i.id, v.costo, v.fecha, 'semilla'");
w("  from items i");
w("  join empresas e on e.id = i.empresa_id");
w("  join (values");
w(hist.map(([sku, c, f]) => `    (${txt(sku)}, ${num(c)}, ${fecha(f)}::timestamptz)`).join(",\n"));
w("  ) as v(sku, costo, fecha) on v.sku = i.sku");
w(`  where e.nombre = ${txt(EMPRESA)};`);
w("");

/* ---- Stock inicial ----
   Como asiento de apertura, no como número suelto: el stock del sistema
   es la suma de sus movimientos. */
const conStock = ps.filter((p) => Number(p.stock) > 0);
w(`  /* Stock de apertura · ${conStock.length} productos */`);
w("  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, motivo, vence)");
w("  select i.empresa_id, s.id, i.id, v.cantidad, 'inicial', 'Carga inicial del catálogo', v.vence");
w("  from items i");
w("  join empresas e on e.id = i.empresa_id");
w("  left join sucursales s on s.empresa_id = e.id");
w("  join (values");
w(conStock.map((p) => `    (${txt(p.sku)}, ${num(p.stock)}, ${p.vence ? `'${p.vence.toISOString().slice(0, 10)}'` : "null"}::date)`).join(",\n"));
w("  ) as v(sku, cantidad, vence) on v.sku = i.sku");
w(`  where e.nombre = ${txt(EMPRESA)};`);
w("");
w(`  raise notice 'Catálogo cargado: ${ps.length} productos, ${provs.length} proveedores.';`);
w("end $$;");
w("");

mkdirSync("supabase/seed", { recursive: true });
const sql = lineas.join("\n");
writeFileSync("supabase/seed/catalogo.sql", sql, "utf8");

console.log(`supabase/seed/catalogo.sql`);
console.log(`  ${ps.length} productos`);
console.log(`  ${provs.length} proveedores`);
console.log(`  ${hist.length} registros de costo`);
console.log(`  ${conStock.length} movimientos de stock`);
console.log(`  ${(sql.length / 1024).toFixed(0)} KB`);
