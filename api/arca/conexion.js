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
import { clienteDeProduccion, ErrorArca } from "./_arca.js";

const error = (res, estado, message) => res.status(estado).json({ error: { message } });

const TIPO_C = 11;
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
    const acciones = { estado, generar, certificado, probar, activar };
    const hacer = acciones[cuerpo.accion];
    if (!hacer) return error(res, 400, "Acción desconocida.");
    return res.status(200).json(await hacer({ admin, empresaId, cuerpo }));
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

async function certificado({ admin, empresaId, cuerpo }) {
  const { cred, con } = await leer(admin, empresaId);
  if (!cred || !cred.pedido_csr) throw new ErrorArca("Primero generá el pedido de certificado en Genez.", 409);

  const c = leerCertificado(cuerpo.pem, descifrar(cred.pedido_clave_cifrada));
  if (c.cuit !== cred.pedido_cuit) {
    throw new ErrorArca(`El certificado es del CUIT ${c.cuit} y el pedido se hizo para ${cred.pedido_cuit}.`, 400);
  }
  /* Renovar no puede cambiar de dueño: un comercio que ya factura de
     verdad sigue facturando con el mismo CUIT. Cambiar de CUIT es otra
     conexión, y se hace a propósito, no subiendo un archivo. */
  if (con && con.modo === "produccion" && c.cuit !== con.cuit) {
    throw new ErrorArca(`Este comercio factura con el CUIT ${con.cuit} y el certificado es del ${c.cuit}.`, 409);
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
  const { con } = await leer(admin, empresaId);
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
    paso("puntos", "Punto de venta", false, `El ${puntoVenta} no es un punto de venta de web service de este CUIT. Los habilitados son: ${lista}. En ARCA se crea en "Administración de puntos de venta y domicilios", eligiendo "Factura electrónica - Monotributo - Web Services".`);
    return terminar();
  }
  if (elegido.bloqueado || elegido.baja) {
    paso("puntos", "Punto de venta", false, `El ${puntoVenta} está ${elegido.baja ? "dado de baja" : "bloqueado"} en ARCA.`);
    return terminar();
  }
  paso("puntos", "Punto de venta", true, `El ${puntoVenta} está habilitado para web service.`);

  try {
    const ultimo = await cliente.ElectronicBilling.getLastVoucher(puntoVenta, TIPO_C);
    paso("numeracion", "Numeración", true, `La última factura C del punto ${puntoVenta} es la ${ultimo}; la próxima va a ser la ${ultimo + 1}.`);
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

  /* Solo factura C, por ahora (ver `_arca.js`). Activar a un
     responsable inscripto lo dejaría "conectado" sin poder facturar nada. */
  if (!["MONOTRIBUTO", "EXENTO"].includes(f.condicion)) {
    throw new ErrorArca("Por ahora Genez emite solo factura C, para monotributistas y exentos.", 409);
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

/* Para scripts/probar-arca.mjs: las acciones sin el HTTP ni la sesión. */
export { estado, generar, certificado, probar, activar };
