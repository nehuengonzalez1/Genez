/**
 * La conexión de un comercio con ARCA: el certificado, la prueba y el
 * paso a facturar de verdad. Lo usa Ajustes → Factura electrónica.
 *
 * Acciones (en `accion`):
 *   estado        en qué paso está, sin nada secreto
 *   generar       clave privada nueva y su pedido de certificado (CSR)
 *   certificado   el .crt que devolvió ARCA para ese pedido
 *   probar        habla con ARCA de producción y dice qué anda y qué no;
 *                 no emite nada
 *   activar       desde acá, las facturas son de verdad
 *
 * QUIÉN
 * -----
 * El que tenga `configurar` en el comercio, preguntado a la base con su
 * propia identidad como en `api/usuarios.js`, o la plataforma nombrando el
 * comercio. La clave privada nunca sale de acá: ninguna acción la
 * devuelve.
 *
 * EL CUIT NO SE ESCRIBE, SE DEMUESTRA
 * -----------------------------------
 * 0082 dejó `arca_conexiones` en manos de la plataforma porque el CUIT
 * con el que se factura es la identidad fiscal de alguien. Acá el
 * comercio se conecta solo, y eso es posible porque el CUIT de la conexión
 * no lo tipea nadie: sale del certificado, que ARCA emite solo a quien
 * tiene la Clave Fiscal de ese CUIT, y que solo sirve con la clave que
 * generó Genez.
 */

import { createClient } from "@supabase/supabase-js";
import { origenValido } from "../_comun.js";
import { generarPedido, leerCertificado, aliasDe } from "./_certificados.js";
import { cifrar, descifrar } from "./_cifrado.js";
import { clienteDeProduccion, clienteArca, cuitDe, ErrorArca } from "./_arca.js";
import { ponerAlDia, caeaDeHoy } from "./_caea.js";

const error = (res, estado, message) => res.status(estado).json({ error: { message } });

/* Qué numeraciones se miran al probar, según quién factura: un
   monotributista o exento emite C; un responsable inscripto, A y B. */
const TIPOS_DE = { C: [[11, "factura C"]], AB: [[1, "factura A"], [6, "factura B"]] };
/* Una prueba vieja no vale para activar: en un día el dueño puede haber
   dado de baja el punto de venta o revocado la autorización. */
const PRUEBA_VIGENTE_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (!origenValido(req)) return error(res, 403, "Origen no permitido.");
  if (req.method !== "POST") return error(res, 405, "Método no permitido.");

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !maestra) return error(res, 503, "Faltan las variables de Supabase en el servidor.");

  const token = (req.headers.authorization || "").replace(/^Bearer /i, "").trim();
  if (!token) return error(res, 401, "Falta la sesión.");

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  const admin = createClient(url, maestra, { auth: { persistSession: false, autoRefreshToken: false } });
  const suyo = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  /* Quién y de qué comercio: mismo criterio que api/usuarios.js. */
  const { data: sesion } = await admin.auth.getUser(token);
  if (!sesion || !sesion.user) return error(res, 401, "La sesión no es válida o venció.");
  const { data: yo } = await suyo.from("perfiles").select("empresa_id, es_plataforma, activo").eq("id", sesion.user.id).single();
  if (!yo || !yo.activo) return error(res, 403, "No se encontró tu perfil.");

  let empresaId;
  if (yo.es_plataforma) {
    const { data: emp } = cuerpo.empresaId
      ? await suyo.from("empresas").select("id").eq("id", cuerpo.empresaId).single()
      : { data: null };
    if (!emp) return error(res, 400, "Falta decir en qué comercio.");
    empresaId = emp.id;
  } else {
    empresaId = yo.empresa_id;
    const { data: puede } = await suyo.rpc("permiso", { p_clave: "configurar" });
    if (puede !== true) return error(res, 403, "Conectar con ARCA necesita el permiso de configurar el comercio.");
  }

  try {
    const acciones = { estado, generar, certificado, probar, activar, caea };
    const hacer = acciones[cuerpo.accion];
    if (!hacer) return error(res, 400, "Acción desconocida.");
    return res.status(200).json(await hacer({ admin, empresaId, cuerpo, quien: { id: sesion.user.id, plataforma: !!yo.es_plataforma } }));
  } catch (e) {
    return error(res, e.estado || (e instanceof ErrorArca ? e.estado : 502), e.message || "No se pudo completar.");
  }
}

/* ------------------------------------------------------------ */

async function leer(admin, empresaId) {
  const [cred, con, emp] = await Promise.all([
    admin.from("arca_credenciales").select("*").eq("empresa_id", empresaId).maybeSingle(),
    admin.from("arca_conexiones").select("*").eq("empresa_id", empresaId).maybeSingle(),
    admin.from("empresas").select("nombre, config").eq("id", empresaId).single(),
  ]);
  for (const r of [cred, con, emp]) if (r.error) throw r.error;
  return { cred: cred.data, con: con.data, emp: emp.data };
}

const fiscalDe = (emp) => (emp && emp.config && emp.config.fiscal) || {};
const soloNumeros = (s) => String(s || "").replace(/\D/g, "");

/* Lo que se puede mostrar. Ni la clave ni el pase de ARCA salen de acá. */
async function estado({ admin, empresaId }) {
  const { cred, con, emp } = await leer(admin, empresaId);
  const { count } = await admin.from("facturas_vista").select("operacion_id", { count: "exact", head: true })
    .eq("empresa_id", empresaId).neq("estado", "autorizada");
  const f = fiscalDe(emp);
  return {
    comercio: { nombre: emp.nombre, cuit: soloNumeros(f.cuit), razonSocial: f.razonSocial || "", condicion: f.condicion || "" },
    conexion: con && { modo: con.modo, cuit: con.cuit, puntoVenta: con.punto_venta, verificadaEn: con.verificada_en, ultimoError: con.ultimo_error },
    certificado: cred && cred.certificado
      ? { cuit: cred.cert_cuit, alias: cred.cert_alias, emisor: cred.cert_emisor, desde: cred.cert_desde, vence: cred.cert_vence, cargadoEn: cred.certificado_en }
      : null,
    pedido: cred && cred.pedido_csr
      ? { cuit: cred.pedido_cuit, alias: cred.pedido_alias, en: cred.pedido_en, csr: cred.pedido_csr }
      : null,
    prueba: cred ? cred.prueba : null,
    sinCAE: count || 0,
    caea: con && con.punto_venta_caea ? await estadoCAEA(admin, con) : null,
  };
}

/* Cómo va el CAEA (0100): el de hoy, lo que falta informar y la última
   vuelta de la tarea diaria. Es lo que Ajustes muestra para que un
   incumplimiento no pase callado. */
async function estadoCAEA(admin, con) {
  const hoy = await caeaDeHoy(admin, con, cuitDe(con));
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data } = await admin.from("comprobantes").select("id, caea_informes ( informado_en, error )")
    .eq("empresa_id", con.empresa_id).eq("autorizacion", "CAEA").eq("estado", "autorizado").gte("creado_en", desde);
  const informe = (c) => (Array.isArray(c.caea_informes) ? c.caea_informes[0] : c.caea_informes) || {};
  const faltan = (data || []).filter((c) => !informe(c).informado_en);
  return {
    puntoVenta: con.punto_venta_caea,
    hoy: hoy ? { caea: hoy.caea, desde: hoy.vig_desde, hasta: hoy.vig_hasta, informarHasta: hoy.tope_informar } : null,
    emitidos: (data || []).length,
    sinInformar: faltan.length,
    errorInforme: (faltan.find((c) => informe(c).error) && informe(faltan.find((c) => informe(c).error)).error) || null,
    tarea: con.caea_estado || null,
  };
}

async function generar({ admin, empresaId, cuerpo }) {
  const { cred, emp } = await leer(admin, empresaId);
  const f = fiscalDe(emp);
  const alias = aliasDe(emp.nombre);
  const p = generarPedido({ cuit: cuerpo.cuit || f.cuit, razonSocial: f.razonSocial || emp.nombre, alias });

  /* El pedido nuevo va al lado del certificado en uso, no encima: si hay
     uno andando, sigue andando hasta que llegue el que reemplaza. */
  const fila = {
    empresa_id: empresaId,
    pedido_clave_cifrada: cifrar(p.clavePem),
    pedido_csr: p.csrPem,
    pedido_cuit: p.cuit,
    pedido_alias: alias,
    pedido_en: new Date().toISOString(),
    actualizada_en: new Date().toISOString(),
  };
  const r = cred
    ? await admin.from("arca_credenciales").update(fila).eq("empresa_id", empresaId)
    : await admin.from("arca_credenciales").insert(fila);
  if (r.error) throw r.error;
  return estado({ admin, empresaId });
}

async function certificado({ admin, empresaId, cuerpo, quien = {} }) {
  const { cred, con } = await leer(admin, empresaId);
  if (!cred || !cred.pedido_csr) throw new ErrorArca("Primero generá el pedido de certificado en Genez.", 409);

  const c = leerCertificado(cuerpo.pem, descifrar(cred.pedido_clave_cifrada));
  if (c.cuit !== cred.pedido_cuit) {
    throw new ErrorArca(`El certificado es del CUIT ${c.cuit} y el pedido se hizo para ${cred.pedido_cuit}.`, 400);
  }

  /* Renovar no puede cambiar de dueño: un comercio que ya factura de
     verdad sigue facturando con el mismo CUIT. Cambiar de CUIT es otra
     conexión, y se hace a propósito, no subiendo un archivo.

     EL CAMBIO DE TITULAR (0093)
     ---------------------------
     "A propósito" es `cambiarTitular`, y solo desde la plataforma: el
     CUIT con que factura un comercio es la identidad fiscal de alguien, y
     el cambio lo decide Genez con el comercio, no un botón en la caja.
     Carga el certificado nuevo y BORRA la conexión: el comercio deja de
     facturar (el cobro deja de ofrecer "Factura") hasta que se pruebe y
     se active con el CUIT nuevo, como la primera vez. Activar exige que
     los datos fiscales ya digan ese CUIT.

     Nada puede quedar esperando CAE: se cobró con el titular anterior y,
     pedido después, saldría a nombre del nuevo. Y el certificado viejo
     se pierde —Genez no puede emitir nada más con ese CUIT—, que es lo
     que se quiere. */
  const cambiaTitular = con && con.modo === "produccion" && c.cuit !== con.cuit;
  if (cambiaTitular) {
    if (cuerpo.cambiarTitular !== true) {
      throw new ErrorArca(`Este comercio factura con el CUIT ${con.cuit} y el certificado es del ${c.cuit}. Cambiar de titular se hace a propósito, desde Genez.`, 409);
    }
    if (!quien.plataforma) {
      throw new ErrorArca("El cambio de titular fiscal lo hace Genez. Escribinos y lo hacemos con vos.", 403);
    }
    const { count, error: ec } = await admin.from("facturas_vista").select("operacion_id", { count: "exact", head: true })
      .eq("empresa_id", empresaId).neq("estado", "autorizada");
    if (ec) throw ec;
    if (count) throw new ErrorArca(`Hay ${count} factura(s) esperando CAE del CUIT ${con.cuit}. Resolvelas en Caja → Facturas antes de cambiar de titular.`, 409);
  }

  /* Primero se deja de facturar y después se cambia el certificado: si
     lo segundo fallara, el comercio queda sin conexión —que es seguro— y
     no con la conexión vieja y un certificado de otro CUIT. */
  if (cambiaTitular) {
    const { error: ed } = await admin.from("arca_conexiones").delete().eq("empresa_id", empresaId);
    if (ed) throw ed;
    await admin.from("bitacora").insert({
      empresa_id: empresaId,
      usuario_id: quien.id || null,
      accion: "arca.cambio_titular",
      entidad: "empresas",
      entidad_id: empresaId,
      detalle: { de: con.cuit, a: c.cuit, punto_venta_anterior: con.punto_venta, certificado_nuevo_vence: c.vence.toISOString() },
    });
  }

  /* El pedido pasa a ser el certificado en uso. El pase de ARCA se tira:
     es del certificado anterior y con este no sirve. La prueba también,
     porque probó otra cosa. */
  const { error: e } = await admin.from("arca_credenciales").update({
    clave_cifrada: cred.pedido_clave_cifrada,
    certificado: c.pem,
    cert_cuit: c.cuit,
    cert_alias: c.alias,
    cert_emisor: c.emisor,
    cert_desde: c.desde.toISOString(),
    cert_vence: c.vence.toISOString(),
    certificado_en: new Date().toISOString(),
    pedido_clave_cifrada: null,
    pedido_csr: null,
    pedido_cuit: null,
    pedido_alias: null,
    pedido_en: null,
    ta_cifrado: null,
    ta_vence: null,
    prueba: null,
    actualizada_en: new Date().toISOString(),
  }).eq("empresa_id", empresaId);
  if (e) throw e;
  return estado({ admin, empresaId });
}

/**
 * Prueba la conexión de producción paso por paso, sin emitir nada. Cada
 * paso dice qué se probó y, si falló, qué hacer. Se corta en el primero
 * que falla: los que siguen dependen de él.
 */
async function probar({ admin, empresaId, cuerpo }) {
  const { con, emp } = await leer(admin, empresaId);
  const inscripto = fiscalDe(emp).condicion === "RI";
  const puntoVenta = Number(cuerpo.puntoVenta) || (con && con.modo === "produccion" ? con.punto_venta : null);
  const pasos = [];
  const paso = (clave, nombre, ok, detalle) => pasos.push({ clave, nombre, ok, detalle });

  const terminar = async () => {
    const prueba = { ok: pasos.every((p) => p.ok), puntoVenta, pasos, en: new Date().toISOString() };
    await admin.from("arca_credenciales").update({ prueba }).eq("empresa_id", empresaId);
    /* Si ya factura de verdad, la prueba también actualiza la conexión:
       es lo que mira quien quiera saber si anda. */
    if (con && con.modo === "produccion") {
      await admin.from("arca_conexiones").update({
        verificada_en: prueba.ok ? prueba.en : con.verificada_en,
        ultimo_error: prueba.ok ? null : (pasos.find((p) => !p.ok) || {}).detalle,
        actualizada_en: prueba.en,
      }).eq("empresa_id", empresaId);
    }
    return { prueba, ...(await estado({ admin, empresaId })) };
  };

  let cliente;
  try {
    cliente = await clienteDeProduccion(admin, empresaId);
    paso("certificado", "Certificado", true, "Cargado y vigente.");
  } catch (e) {
    paso("certificado", "Certificado", false, e.message);
    return terminar();
  }

  try {
    const s = await cliente.servidores();
    const ok = s.app === "OK" && s.base === "OK" && s.auth === "OK";
    paso("servidores", "ARCA en línea", ok, ok ? "Los servidores de ARCA contestan." : `ARCA contesta con problemas: ${JSON.stringify(s)}. Probá en un rato.`);
    if (!ok) return terminar();
  } catch (e) {
    paso("servidores", "ARCA en línea", false, `No se pudo llegar a ARCA: ${e.message}`);
    return terminar();
  }

  try {
    await cliente.autenticar();
    paso("autenticacion", "Autorización para facturar", true, "ARCA reconoce el certificado y lo deja facturar.");
  } catch (e) {
    paso("autenticacion", "Autorización para facturar", false, e.message);
    return terminar();
  }

  let puntos;
  try {
    puntos = await cliente.ElectronicBilling.getSalesPoints();
  } catch (e) {
    paso("puntos", "Punto de venta", false, `ARCA no devolvió los puntos de venta: ${e.message}`);
    return terminar();
  }
  const usables = puntos.filter((p) => !p.bloqueado && !p.baja);
  const lista = usables.map((p) => p.numero).join(", ") || "ninguno";
  const elegido = puntoVenta ? puntos.find((p) => p.numero === puntoVenta) : null;
  if (!puntoVenta) {
    paso("puntos", "Punto de venta", false, `Elegí el punto de venta. Los de web service habilitados en ARCA son: ${lista}.`);
    return terminar();
  }
  if (!elegido) {
    paso("puntos", "Punto de venta", false, `El ${puntoVenta} no es un punto de venta de web service de este CUIT. Los habilitados son: ${lista}. En ARCA se crea en "Administración de puntos de venta y domicilios", eligiendo el sistema de web services ("Factura electrónica - Monotributo - Web Services" o, para un responsable inscripto, "RECE para aplicativo y web services").`);
    return terminar();
  }
  if (elegido.bloqueado || elegido.baja) {
    paso("puntos", "Punto de venta", false, `El ${puntoVenta} está ${elegido.baja ? "dado de baja" : "bloqueado"} en ARCA.`);
    return terminar();
  }
  paso("puntos", "Punto de venta", true, `El ${puntoVenta} está habilitado para web service.`);

  try {
    const partes = [];
    for (const [tipo, nombre] of TIPOS_DE[inscripto ? "AB" : "C"]) {
      const ultimo = await cliente.ElectronicBilling.getLastVoucher(puntoVenta, tipo);
      partes.push(`la última ${nombre} es la ${ultimo}`);
    }
    paso("numeracion", "Numeración", true, `En el punto ${puntoVenta}, ${partes.join(" y ")}.`);
  } catch (e) {
    paso("numeracion", "Numeración", false, e.message);
  }
  return terminar();
}

async function activar({ admin, empresaId, cuerpo }) {
  const { cred, con, emp } = await leer(admin, empresaId);
  const f = fiscalDe(emp);
  const puntoVenta = Number(cuerpo.puntoVenta);

  if (!cred || !cred.certificado) throw new ErrorArca("Falta cargar el certificado.", 409);
  const p = cred.prueba;
  if (!p || !p.ok || p.puntoVenta !== puntoVenta || Date.now() - new Date(p.en).getTime() > PRUEBA_VIGENTE_MS) {
    throw new ErrorArca("Probá la conexión con este punto de venta antes de activar.", 409);
  }

  /* Sin condición no hay letra: la factura saldría con cualquiera. Desde
     la A y la B (0098) se activa también un responsable inscripto. */
  if (!["MONOTRIBUTO", "EXENTO", "RI"].includes(f.condicion)) {
    throw new ErrorArca("Falta la condición frente al IVA en Ajustes → Datos fiscales: de ella sale la letra de cada factura.", 409);
  }

  /* El CUIT impreso en el ticket sale de los datos fiscales. Si no es el
     del certificado, la factura diría un CUIT y ARCA tendría otro. */
  if (soloNumeros(f.cuit) !== cred.cert_cuit) {
    throw new ErrorArca(`En Ajustes → Datos fiscales figura el CUIT ${f.cuit || "(vacío)"} y el certificado es del ${cred.cert_cuit}. Corregilo antes de activar: es el que va impreso en cada factura.`, 409);
  }

  /* Las facturas que esperan CAE se cobraron en el ambiente anterior. Si
     se activara con ellas adentro, al pedirles el CAE saldrían como
     facturas de verdad ventas que se hicieron probando. */
  const { count } = await admin.from("facturas_vista").select("operacion_id", { count: "exact", head: true })
    .eq("empresa_id", empresaId).neq("estado", "autorizada");
  if (count) throw new ErrorArca(`Hay ${count} factura(s) esperando CAE. Resolvelas en Caja → Facturas antes de pasar a producción.`, 409);

  const fila = {
    empresa_id: empresaId,
    modo: "produccion",
    cuit: cred.cert_cuit,
    punto_venta: puntoVenta,
    verificada_en: p.en,
    ultimo_error: null,
    actualizada_en: new Date().toISOString(),
  };
  const r = con
    ? await admin.from("arca_conexiones").update(fila).eq("empresa_id", empresaId)
    : await admin.from("arca_conexiones").insert(fila);
  if (r.error) throw r.error;
  return estado({ admin, empresaId });
}

/* El punto de venta CAEA (0100). Cargarlo activa el CAEA en el comercio:
   desde ese momento, si ARCA no contesta, se emite con CAEA, y la tarea
   diaria pide el de cada quincena e informa. Vacío lo apaga (lo ya
   emitido se sigue informando: la tarea mira los comprobantes, no esto).

   En producción se verifica contra ARCA que el punto exista, sea de este
   CUIT y sea de tipo CAEA (RG 5782, art. 5: tiene que ser uno propio). Y
   al cargarlo se pide ya el CAEA de la quincena, para no quedar sin
   cobertura hasta la próxima vuelta de la tarea. */
async function caea({ admin, empresaId, cuerpo }) {
  const { con } = await leer(admin, empresaId);
  if (!con) throw new ErrorArca("Primero conectá el comercio con ARCA.", 409);

  const valor = cuerpo.puntoVentaCaea;
  if (valor === null || valor === undefined || valor === "") {
    const r = await admin.from("arca_conexiones").update({ punto_venta_caea: null }).eq("empresa_id", empresaId);
    if (r.error) throw r.error;
    return estado({ admin, empresaId });
  }
  const pv = Number(valor);
  if (!Number.isInteger(pv) || pv < 1 || pv > 99998) throw new ErrorArca("El punto de venta es un número entre 1 y 99998.");
  if (pv === con.punto_venta) throw new ErrorArca(`El ${pv} es el punto de venta del CAE. El CAEA necesita uno propio, de tipo CAEA.`);

  const afip = await clienteArca(admin, con);
  if (con.modo === "produccion") {
    const puntos = await afip.ElectronicBilling.getSalesPoints();
    const p = puntos.find((x) => x.numero === pv);
    if (!p) throw new ErrorArca(`El ${pv} no es un punto de venta de web service de este CUIT. En ARCA se crea en "Administración de puntos de venta y domicilios", eligiendo el sistema CAEA.`);
    if (!/CAEA/i.test(p.tipo)) throw new ErrorArca(`El ${pv} es de tipo ${p.tipo}, no CAEA. El CAEA necesita un punto de venta propio de ese tipo.`);
    if (p.bloqueado || p.baja) throw new ErrorArca(`El ${pv} está ${p.baja ? "dado de baja" : "bloqueado"} en ARCA.`);
    /* La numeración del punto CAEA la lleva la base, sin preguntarle a
       ARCA (que cuando se usa está caído). Si ese punto ya tuviera
       comprobantes de otro sistema, Genez empezaría en el 1 y ARCA
       rechazaría los informes. Tiene que estar sin estrenar. */
    const { emp } = await leer(admin, empresaId);
    const inscripto = fiscalDe(emp).condicion === "RI";
    for (const tipo of inscripto ? [1, 6] : [11]) {
      const ultimo = await afip.ElectronicBilling.getLastVoucher(pv, tipo);
      if (Number(ultimo) > 0) throw new ErrorArca(`El punto ${pv} ya tiene comprobantes (tipo ${tipo}, último ${ultimo}). El CAEA necesita un punto de venta nuevo, sin usar.`);
    }
  }

  const r = await admin.from("arca_conexiones").update({ punto_venta_caea: pv }).eq("empresa_id", empresaId);
  if (r.error) throw r.error;
  await ponerAlDia({ admin, afip, conexion: { ...con, punto_venta_caea: pv }, cuit: cuitDe(con) });
  return estado({ admin, empresaId });
}

/* Para scripts/probar-arca.mjs: las acciones sin el HTTP ni la sesión. */
export { estado, generar, certificado, probar, activar, caea };
