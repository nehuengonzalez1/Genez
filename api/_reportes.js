/**
 * Los reportes programados por mail (0136): cada mañana lo de ayer, los
 * lunes la semana pasada, el 1 el mes pasado. Salen del cron diario que
 * entra por founder.js (`?tarea=pruebas`): Hobby deja dos crons y los dos
 * están usados, y ninguno corre más de una vez por día.
 *
 * Cada programación manda el período cerrado más reciente que todavía no
 * mandó (`ultimo_periodo`). Si el cron no corre un lunes, la semana sale
 * el martes; nunca dos veces, porque se anota recién después de que
 * Resend lo aceptó. Un día sin ventas no manda un mail en cero: se anota
 * como hecho y listo.
 *
 * Los números salen de las mismas funciones que Informes
 * (ventas_diarias_rango, ventas_por_item_rango, reporte_a_medida), así el
 * mail dice lo mismo que la pantalla. El cron lee con la service_role,
 * siempre filtrando por la empresa de la programación; "Mandarme uno
 * ahora" lee con la sesión de quien lo pide, con sus permisos, y le llega
 * solo a su mail.
 *
 * Sin RESEND_API_KEY no manda ni anota nada.
 */

import { mandar, escapar } from "./_pruebas.js";

const SITIO = () => process.env.SITIO_URL || "https://genez.com.ar";
const error = (res, codigo, mensaje) => res.status(codigo).json({ error: { message: mensaje } });

/* ---------- Fechas, en días de Buenos Aires como texto AAAA-MM-DD ---------- */

const hoyBA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const aUTC = (f) => { const [a, m, d] = f.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const mas = (f, n) => { const x = aUTC(f); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/* El período cerrado más reciente para cada frecuencia, y el anterior del
   mismo largo para comparar. `clave` es lo que se anota como enviado. */
export function periodoDe(frecuencia, hoy = hoyBA()) {
  if (frecuencia === "diario") {
    const d = mas(hoy, -1);
    return { clave: d, desde: d, hasta: d, antes: { desde: mas(d, -7), hasta: mas(d, -7) },
      nombre: `el ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][aUTC(d).getUTCDay()]} ${ddmm(d)}`, vs: "el mismo día de la semana anterior" };
  }
  if (frecuencia === "semanal") {
    const dow = aUTC(hoy).getUTCDay() || 7;
    const desde = mas(hoy, -(dow - 1) - 7);
    return { clave: desde, desde, hasta: mas(desde, 6), antes: { desde: mas(desde, -7), hasta: mas(desde, -1) },
      nombre: `la semana del ${ddmm(desde)} al ${ddmm(mas(desde, 6))}`, vs: "la semana anterior" };
  }
  const [a, m] = hoy.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
  const fin = new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10);
  const iniAntes = new Date(Date.UTC(a, m - 3, 1)).toISOString().slice(0, 10);
  const finAntes = new Date(Date.UTC(a, m - 2, 0)).toISOString().slice(0, 10);
  return { clave: ini.slice(0, 7), desde: ini, hasta: fin, antes: { desde: iniAntes, hasta: finAntes },
    nombre: `${MESES[Number(ini.slice(5, 7)) - 1]} ${ini.slice(0, 4)}`, vs: "el mes anterior" };
}

/* ---------- Los números ---------- */

const plata = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;
const porc = (n) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
const variacion = (a, b) => (b ? (a - b) / Math.abs(b) : null);

async function serie(db, empresaId, p) {
  const { data, error: e } = await db.rpc("ventas_diarias_rango", { p_empresa: empresaId, p_desde: p.desde, p_hasta: p.hasta });
  if (e) throw new Error(e.message);
  return (data || []).reduce((s, d) => ({ ventas: s.ventas + Number(d.ventas || 0), costo: s.costo + Number(d.costo || 0), tickets: s.tickets + Number(d.tickets || 0) }), { ventas: 0, costo: 0, tickets: 0 });
}

export async function armarResumen(db, empresaId, p, reporte = null) {
  const [ahora, antes, prods, faltan, cuadro] = await Promise.all([
    serie(db, empresaId, p),
    serie(db, empresaId, p.antes),
    db.rpc("ventas_por_item_rango", { p_empresa: empresaId, p_desde: p.desde, p_hasta: p.hasta }),
    /* Lo que hoy está sin stock y se vende: lo que conviene reponer ya. */
    db.from("items_vista").select("nombre, vel").eq("empresa_id", empresaId).eq("activo", true).eq("controla_stock", true)
      .eq("stock_cargado", true).lte("stock", 0).gt("vel", 0).order("vel", { ascending: false }).limit(8),
    reporte && reporte.definicion && Array.isArray(reporte.definicion.dims) && reporte.definicion.dims.length
      ? db.rpc("reporte_a_medida", { p_empresa: empresaId, p_desde: p.desde, p_hasta: p.hasta, p_dims: reporte.definicion.dims.slice(0, 3), p_filtros: reporte.definicion.filtros || {} })
      : Promise.resolve({ data: null }),
  ]);
  /* Qué parte de lo vendido tiene costo cargado. Super 25 vende mucho sin
     costo, y la ganancia le daba 94%: en un mail que llega solo, un número
     así se cree. Debajo del 80%, el mail no la da como dato. */
  const lista = prods.data || [];
  const vendido = lista.reduce((s, x) => s + (Number(x.venta) || 0), 0);
  const conCosto = lista.reduce((s, x) => s + (Number(x.costo) > 0 ? Number(x.venta) || 0 : 0), 0);
  return {
    ahora, antes, conCosto: vendido ? conCosto / vendido : 1,
    top: (prods.data || []).slice(0, 5).map((x) => ({ nombre: x.nombre, venta: Number(x.venta) || 0, unidades: Number(x.unidades) || 0 })),
    sinStock: (faltan.data || []).map((x) => x.nombre),
    cuadro: cuadro && cuadro.data ? { nombre: reporte.nombre, dims: reporte.definicion.dims.slice(0, 3), filas: cuadro.data.slice(0, 10) } : null,
  };
}

/* ---------- El mail ---------- */

const ETIQUETA = { mes: "Mes", semana: "Semana", dia: "Día", dia_semana: "Día", hora: "Hora", sucursal: "Sucursal", vendedor: "Vendedor", canal: "Canal",
  categoria: "Rubro", marca: "Marca", proveedor: "Proveedor", producto: "Producto", cliente: "Cliente", ticket: "Ticket" };

export function armarMail({ comercio, p, r }) {
  const g = r.ahora.ventas - r.ahora.costo;
  const gAntes = r.antes.ventas - r.antes.costo;
  const tp = r.ahora.tickets ? r.ahora.ventas / r.ahora.tickets : 0;
  const tpAntes = r.antes.tickets ? r.antes.ventas / r.antes.tickets : 0;
  const gananciaFirme = r.conCosto >= 0.8;
  const filas = [
    ["Ventas", plata(r.ahora.ventas), variacion(r.ahora.ventas, r.antes.ventas)],
    ...(gananciaFirme ? [["Ganancia bruta", `${plata(g)}${r.ahora.ventas ? ` · ${porc(g / r.ahora.ventas)}` : ""}`, variacion(g, gAntes)]] : []),
    ["Tickets", r.ahora.tickets.toLocaleString("es-AR"), variacion(r.ahora.tickets, r.antes.tickets)],
    ["Ticket promedio", plata(tp), variacion(tp, tpAntes)],
  ];
  const flecha = (v) => (v == null ? "" : `${v >= 0 ? "▲" : "▼"} ${porc(Math.abs(v))}`);
  const color = (v) => (v == null ? "#78716c" : v >= 0 ? "#15803d" : "#b91c1c");
  const avisoCosto = `La ganancia no va: solo el ${porc(r.conCosto)} de lo vendido tiene el costo cargado, y daría de más. Cargando los costos en Productos, aparece.`;
  const asunto = `${comercio}: ${plata(r.ahora.ventas)} en ${p.nombre}`;
  const entrar = `${SITIO()}/login`;

  const texto = [
    `${comercio} · ${p.nombre}`,
    "",
    ...filas.map(([n, v, d]) => `${n}: ${v}${d == null ? "" : ` (${flecha(d)} vs ${p.vs})`}`),
    gananciaFirme ? "" : `
${avisoCosto}`,
    "",
    r.top.length ? `Lo que más se vendió:\n${r.top.map((x, i) => `${i + 1}. ${x.nombre} · ${plata(x.venta)}`).join("\n")}` : "",
    r.sinStock.length ? `\nSin stock ahora: ${r.sinStock.join(", ")}.` : "",
    r.cuadro ? `\n${r.cuadro.nombre}:\n${r.cuadro.filas.map((f) => `${[f.d1, f.d2, f.d3].filter((x) => x != null).join(" · ")}: ${plata(Number(f.ventas) || 0)}`).join("\n")}` : "",
    "",
    `Entrar a Genez: ${entrar}`,
    "Para dejar de recibirlo: Informes → Por mail.",
  ].filter((x) => x !== "").join("\n");

  const td = "padding:6px 0;border-bottom:1px solid #e7e5e4";
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1c1917;max-width:560px">
<p style="margin:0 0 2px;color:#78716c;font-size:13px">${escapar(comercio)}</p>
<h2 style="margin:0 0 14px;font-size:20px">Cómo te fue ${escapar(p.nombre)}</h2>
<table style="width:100%;border-collapse:collapse;font-size:15px">
${filas.map(([n, v, d]) => `<tr><td style="${td}">${n}</td><td style="${td};text-align:right;font-weight:600">${escapar(v)}</td><td style="${td};text-align:right;font-size:13px;color:${color(d)};white-space:nowrap;padding-left:10px">${flecha(d)}</td></tr>`).join("\n")}
</table>
<p style="margin:6px 0 0;color:#78716c;font-size:12px">Las flechas comparan con ${escapar(p.vs)}.</p>
${gananciaFirme ? "" : `<p style="margin:10px 0 0;font-size:13px;color:#57534e">${escapar(avisoCosto)}</p>`}
${r.top.length ? `<h3 style="font-size:15px;margin:20px 0 6px">Lo que más se vendió</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px">${r.top.map((x) => `<tr><td style="${td}">${escapar(x.nombre)}</td><td style="${td};text-align:right">${plata(x.venta)}</td></tr>`).join("")}</table>` : ""}
${r.sinStock.length ? `<p style="margin:18px 0 0;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:14px"><b>Sin stock ahora:</b> ${r.sinStock.map(escapar).join(", ")}.</p>` : ""}
${r.cuadro ? `<h3 style="font-size:15px;margin:20px 0 6px">${escapar(r.cuadro.nombre)}</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr style="color:#78716c;font-size:12px">${r.cuadro.dims.map((d) => `<td style="${td}">${ETIQUETA[d] || d}</td>`).join("")}<td style="${td};text-align:right">Ventas</td></tr>
${r.cuadro.filas.map((f) => `<tr>${r.cuadro.dims.map((_, i) => `<td style="${td}">${escapar([f.d1, f.d2, f.d3][i])}</td>`).join("")}<td style="${td};text-align:right">${plata(Number(f.ventas) || 0)}</td></tr>`).join("\n")}
</table>` : ""}
<p style="margin:22px 0"><a href="${entrar}" style="display:inline-block;background:#fd5204;color:#1c1917;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">Ver el detalle en Genez</a></p>
<p style="color:#78716c;font-size:12px">Te llega porque alguien de ${escapar(comercio)} lo programó en Informes → Por mail. Desde ahí se deja de mandar.</p>
</div>`;
  return { asunto, texto, html };
}

/* ---------- El cron ---------- */

export async function reportesProgramados(admin) {
  if (!process.env.RESEND_API_KEY) return { omitido: "Falta RESEND_API_KEY: no se mandó nada." };
  const { data, error: e } = await admin.from("reportes_programados")
    .select("id, empresa_id, frecuencia, para, ultimo_periodo, reporte_id, empresas!inner ( nombre, activa ), reportes_guardados ( nombre, definicion )")
    .eq("activo", true).eq("empresas.activa", true);
  if (e) throw e;

  const resultado = { enviados: [], sinVentas: [], errores: [] };
  for (const x of data || []) {
    const p = periodoDe(x.frecuencia);
    if (x.ultimo_periodo === p.clave) continue;
    try {
      const r = await armarResumen(admin, x.empresa_id, p, x.reportes_guardados);
      if (!r.ahora.tickets && !r.ahora.ventas) {
        await admin.from("reportes_programados").update({ ultimo_periodo: p.clave, ultimo_error: null }).eq("id", x.id);
        resultado.sinVentas.push({ comercio: x.empresas.nombre, frecuencia: x.frecuencia });
        continue;
      }
      await mandar({ para: x.para, ...armarMail({ comercio: x.empresas.nombre, p, r }) });
      await admin.from("reportes_programados").update({ ultimo_periodo: p.clave, ultimo_envio: new Date().toISOString(), ultimo_error: null }).eq("id", x.id);
      resultado.enviados.push({ comercio: x.empresas.nombre, frecuencia: x.frecuencia });
    } catch (err) {
      /* De a uno: un mail que rebota no deja sin reporte al resto. Queda
         anotado para que la pantalla lo muestre, y se reintenta mañana. */
      await admin.from("reportes_programados").update({ ultimo_error: String(err.message || err).slice(0, 300) }).eq("id", x.id);
      resultado.errores.push({ comercio: x.empresas.nombre, frecuencia: x.frecuencia, error: err.message });
    }
  }
  return resultado;
}

/* ---------- "Mandarme uno ahora" ---------- */
/* Con la sesión de quien lo pide (quien.suyo): lee con sus permisos, y le
   llega solo a su propio mail. Sirve para ver cómo queda antes de
   programarlo, y no se puede usar para mandarle mails a otro. */
export async function mandarmeUnReporte(res, quien, cuerpo) {
  if (!process.env.RESEND_API_KEY) return error(res, 503, "Todavía no está configurado el envío de mails.");
  if (!quien.empresa_id) return error(res, 403, "Tu usuario no tiene un comercio.");
  if (!quien.email) return error(res, 400, "Tu usuario no tiene mail.");
  const frecuencia = ["diario", "semanal", "mensual"].includes(cuerpo.frecuencia) ? cuerpo.frecuencia : "semanal";
  const db = quien.suyo;
  const [{ data: emp }, guardado] = await Promise.all([
    db.from("empresas").select("nombre").eq("id", quien.empresa_id).maybeSingle(),
    cuerpo.reporteId ? db.from("reportes_guardados").select("nombre, definicion").eq("id", cuerpo.reporteId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  try {
    const p = periodoDe(frecuencia);
    const r = await armarResumen(db, quien.empresa_id, p, guardado.data);
    await mandar({ para: quien.email, ...armarMail({ comercio: (emp && emp.nombre) || "Tu comercio", p, r }) });
    return res.status(200).json({ ok: true, para: quien.email });
  } catch (e) {
    return error(res, 502, `No se pudo mandar: ${e.message}`);
  }
}
