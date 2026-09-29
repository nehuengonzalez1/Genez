/**
 * El CAEA: facturar cuando ARCA no contesta (RG 5782/2025, vigente desde
 * el 01/08/2026). Lo usan `_arca.js` (emitir) y `api/arca/caea.js` (la
 * tarea diaria: pedir, informar, cerrar la quincena). Ver 0100.
 *
 * CUÁNDO SE EMITE CON CAEA
 * ------------------------
 * Solo si ARCA no contesta ANTES de que se le haya pedido nada: la
 * primera pregunta de `facturarVenta` es el último número, que no emite.
 * Si esa pregunta no vuelve, es seguro que esta venta no tiene CAE en
 * ARCA, y se puede emitir con CAEA sin facturar dos veces. Si ARCA se cae
 * DESPUÉS de mandar el pedido del CAE, no se sabe si lo autorizó: esa
 * venta queda pendiente como siempre, y nunca pasa al CAEA.
 *
 * Tampoco si ARCA contestó que no (un error con código): eso es un dato
 * mal cargado, no una caída, y con CAEA se informaría igual de mal.
 *
 * LA NUMERACIÓN
 * -------------
 * El punto de venta CAEA es de Genez solo, así que el último número lo
 * sabe la base y no hace falta preguntarle a ARCA (que está caído). El
 * índice `comprobantes_numero_autorizado` (0082) impide que dos cajas
 * tomen el mismo: la segunda choca y reintenta con el siguiente.
 */

/* Import circular con _arca.js a propósito: las dos se usan solo adentro
   de funciones, nunca al cargar el módulo. */
import { hoyEnArgentina } from "./_arca.js";

/* La quincena de una fecha aaaammdd: período aaaamm y orden 1 (del 1 al
   15) o 2 (del 16 a fin de mes). */
export function quincenaDe(aaaammdd) {
  const s = String(aaaammdd);
  return { periodo: Number(s.slice(0, 6)), orden: Number(s.slice(6, 8)) <= 15 ? 1 : 2 };
}

/* La quincena siguiente a una dada. */
export function siguiente({ periodo, orden }) {
  if (orden === 1) return { periodo, orden: 2 };
  const anio = Math.floor(periodo / 100), mes = periodo % 100;
  return mes === 12 ? { periodo: (anio + 1) * 100 + 1, orden: 1 } : { periodo: periodo + 1, orden: 1 };
}

/* El primer día de una quincena, aaaammdd. */
export const inicioDe = ({ periodo, orden }) => `${periodo}${orden === 1 ? "01" : "16"}`;

const comoFecha = (aaaammdd) => `${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6, 8)}`;

/* Días entre dos fechas aaaammdd (b − a). */
function diasEntre(a, b) {
  const d = (x) => Date.UTC(Number(x.slice(0, 4)), Number(x.slice(4, 6)) - 1, Number(x.slice(6, 8)));
  return Math.round((d(b) - d(a)) / 86400000);
}

/* ¿Es una caída de ARCA, o ARCA contestó? Un error de ARCA trae un código
   numérico (el de WSFE) o uno de WSAA (`codigoArca`: certificado,
   permisos). Todo lo demás —se cortó, tardó, 5xx, sin red— es que ARCA no
   está, que es para lo que existe el CAEA. */
export const esCaida = (e) => !!e && typeof e.code !== "number" && !e.codigoArca && e.estado === undefined;
/* `estado` lo traen los ErrorArca de Genez (falta el certificado, el
   token, el CUIT no coincide): son de configuración, no una caída. */

/* La hora de Argentina como la pide CbteFchHsGen: aaaammddhhmmss. */
export function ahoraEnArgentina(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}

/* El CAEA guardado para hoy, o null. */
export async function caeaDeHoy(admin, conexion, cuit, hoy = hoyEnArgentina()) {
  const { periodo, orden } = quincenaDe(hoy);
  const { data, error } = await admin.from("arca_caea").select("*")
    .match({ empresa_id: conexion.empresa_id, modo: conexion.modo, cuit, periodo, orden }).maybeSingle();
  if (error) throw error;
  return data;
}

/* Pide (o consulta, si ya se pidió) el CAEA de una quincena y lo guarda.
   Devuelve la fila. Si ya estaba guardado, no molesta a ARCA. */
export async function asegurarCAEA({ admin, afip, conexion, cuit, periodo, orden }) {
  const clave = { empresa_id: conexion.empresa_id, modo: conexion.modo, cuit, periodo, orden };
  const { data: ya } = await admin.from("arca_caea").select("*").match(clave).maybeSingle();
  if (ya) return ya;

  let g;
  try {
    g = await afip.ElectronicBilling.solicitarCAEA(periodo, orden);
  } catch (e) {
    /* Ya lo había pedido (este comercio u otro sistema del mismo CUIT):
       ARCA no da otro, pero lo devuelve si se lo consulta. */
    if (typeof e.code !== "number") throw e;
    g = await afip.ElectronicBilling.consultarCAEA(periodo, orden);
  }
  const fila = {
    ...clave,
    caea: String(g.CAEA),
    vig_desde: comoFecha(String(g.FchVigDesde)),
    vig_hasta: comoFecha(String(g.FchVigHasta)),
    tope_informar: comoFecha(String(g.FchTopeInf)),
  };
  const { data, error } = await admin.from("arca_caea").upsert(fila, { onConflict: "empresa_id,modo,cuit,periodo,orden" }).select().single();
  if (error) throw error;
  return data;
}

/* Emite un comprobante con el CAEA de hoy. `pedido` es el que se habría
   mandado para el CAE (sin número). `fila` es lo que se guarda en
   `comprobantes` (sin número, sin CAE). Devuelve el comprobante. */
export async function emitirConCAEA({ admin, conexion, cuit, tipo, pedido, fila }) {
  const caea = await caeaDeHoy(admin, conexion, cuit);
  if (!caea) return null;
  const pv = conexion.punto_venta_caea;

  for (let intento = 0; intento < 5; intento++) {
    const { data: ultimo, error: e1 } = await admin.from("comprobantes").select("numero")
      .match({ modo: conexion.modo, cuit, punto_venta: pv, tipo, estado: "autorizado" })
      .order("numero", { ascending: false }).limit(1).maybeSingle();
    if (e1) throw e1;
    const numero = (ultimo ? Number(ultimo.numero) : 0) + 1;
    const generado = ahoraEnArgentina();
    const completo = {
      ...pedido, PtoVta: pv, CbteDesde: numero, CbteHasta: numero,
      CAEA: caea.caea, CbteFchHsGen: generado,
    };

    const { data, error } = await admin.from("comprobantes").insert({
      ...fila,
      punto_venta: pv,
      numero,
      estado: "autorizado",
      autorizacion: "CAEA",
      cae: caea.caea,
      cae_vto: caea.vig_hasta,
      pedido: completo,
    }).select().single();

    if (!error) {
      await admin.from("caea_informes").insert({ comprobante_id: data.id, empresa_id: conexion.empresa_id });
      return data;
    }
    /* Otra caja tomó ese número, o esta venta ya tiene comprobante. */
    if (error.code !== "23505") throw error;
    const { data: propio } = await admin.from("comprobantes").select("*")
      .eq("operacion_id", fila.operacion_id).neq("estado", "rechazado").maybeSingle();
    if (propio) return propio;
  }
  throw new Error("No se pudo tomar un número del punto de venta CAEA: demasiadas cajas a la vez.");
}

/* Informa a ARCA lo emitido con CAEA que falta informar, en orden de
   número por tipo. Corta un tipo en su primer error: ARCA espera los
   números seguidos. Devuelve { informados, errores }.

   Parte de `comprobantes` y no de `caea_informes`: si la función se
   cortó entre guardar el comprobante y anotar su informe, el comprobante
   igual aparece acá. Mira 60 días, que cubre de sobra el plazo de 8 días
   después de la quincena. */
export async function informarPendientes({ admin, afip, empresaId }) {
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await admin.from("comprobantes")
    .select("id, tipo, numero, pedido, caea_informes ( informado_en, intentos )")
    .eq("empresa_id", empresaId).eq("autorizacion", "CAEA").eq("estado", "autorizado").gte("creado_en", desde);
  if (error) throw error;

  const porTipo = new Map();
  for (const c of data || []) {
    const inf = Array.isArray(c.caea_informes) ? c.caea_informes[0] : c.caea_informes;
    if (inf && inf.informado_en) continue;
    if (!porTipo.has(c.tipo)) porTipo.set(c.tipo, []);
    porTipo.get(c.tipo).push({ comprobante_id: c.id, intentos: (inf && inf.intentos) || 0, c });
  }

  let informados = 0;
  const errores = [];
  for (const lista of porTipo.values()) {
    lista.sort((a, b) => a.c.numero - b.c.numero);
    for (const f of lista) {
      try {
        const r = await afip.ElectronicBilling.informarCAEA(f.c.pedido);
        await admin.from("caea_informes").upsert({ comprobante_id: f.comprobante_id, empresa_id: empresaId, informado_en: new Date().toISOString(), error: null, intentos: f.intentos + 1, respuesta: r, actualizado_en: new Date().toISOString() });
        informados++;
      } catch (e) {
        await admin.from("caea_informes").upsert({ comprobante_id: f.comprobante_id, empresa_id: empresaId, error: e.message, intentos: f.intentos + 1, actualizado_en: new Date().toISOString() });
        errores.push(`${f.c.tipo}-${f.c.numero}: ${e.message}`);
        break;
      }
    }
  }
  return { informados, errores };
}

/* Cierra las quincenas terminadas en las que no se emitió nada con CAEA:
   se le informa a ARCA "sin movimiento". */
export async function cerrarSinMovimiento({ admin, afip, conexion, cuit, hoy = hoyEnArgentina() }) {
  const hoyFecha = comoFecha(hoy);
  const { data, error } = await admin.from("arca_caea").select("*")
    .match({ empresa_id: conexion.empresa_id, modo: conexion.modo, cuit })
    .lt("vig_hasta", hoyFecha).is("sin_movimiento_en", null);
  if (error) throw error;

  const hechos = [], errores = [];
  for (const q of data || []) {
    const { count } = await admin.from("comprobantes").select("id", { count: "exact", head: true })
      .match({ modo: conexion.modo, cuit, autorizacion: "CAEA", cae: q.caea });
    if (count) {
      /* Se usó: lo que corresponde es informar cada comprobante, no el
         "sin movimiento". Se marca para no volver a mirarla. */
      await admin.from("arca_caea").update({ sin_movimiento_en: new Date().toISOString(), sin_movimiento_error: "con movimiento: se informa cada comprobante" }).eq("id", q.id);
      continue;
    }
    try {
      await afip.ElectronicBilling.sinMovimientoCAEA(conexion.punto_venta_caea, q.caea);
      await admin.from("arca_caea").update({ sin_movimiento_en: new Date().toISOString(), sin_movimiento_error: null }).eq("id", q.id);
      hechos.push(q.caea);
    } catch (e) {
      await admin.from("arca_caea").update({ sin_movimiento_error: e.message }).eq("id", q.id);
      errores.push(`sin movimiento ${q.periodo}/${q.orden}: ${e.message}`);
    }
  }
  return { hechos, errores };
}

/* Lo que hace la tarea diaria con un comercio: tener el CAEA de esta
   quincena y, desde 5 días antes, el de la siguiente; informar lo emitido;
   cerrar las quincenas vencidas sin uso. Nada de esto emite. */
export async function ponerAlDia({ admin, afip, conexion, cuit, hoy = hoyEnArgentina() }) {
  const errores = [];
  const actual = quincenaDe(hoy);
  const prox = siguiente(actual);
  const quincenas = [actual];
  if (diasEntre(hoy, inicioDe(prox)) <= 5) quincenas.push(prox);

  const caeas = [];
  for (const q of quincenas) {
    try {
      const f = await asegurarCAEA({ admin, afip, conexion, cuit, ...q });
      caeas.push(`${f.periodo}/${f.orden}`);
    } catch (e) {
      errores.push(`pedir el CAEA ${q.periodo}/${q.orden}: ${e.message}`);
    }
  }
  let informe = { informados: 0, errores: [] };
  try { informe = await informarPendientes({ admin, afip, empresaId: conexion.empresa_id }); } catch (e) { errores.push(`informar: ${e.message}`); }
  let cierre = { hechos: [], errores: [] };
  try { cierre = await cerrarSinMovimiento({ admin, afip, conexion, cuit, hoy }); } catch (e) { errores.push(`sin movimiento: ${e.message}`); }

  const estado = {
    corrio: new Date().toISOString(),
    caeas,
    informados: informe.informados,
    sinMovimiento: cierre.hechos.length,
    errores: [...errores, ...informe.errores, ...cierre.errores],
  };
  await admin.from("arca_conexiones").update({ caea_estado: estado }).eq("empresa_id", conexion.empresa_id);
  return estado;
}
