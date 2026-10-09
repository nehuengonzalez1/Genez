/* ============================================================
   AUTOSERVICIO · registrarse, probar 10 días y contratar (0127)
   ============================================================

   El orden de las cosas, que es lo que no se ve en el código:

   1. La landing llama a `registrarse`: Supabase crea el usuario y manda
      el mail de confirmación. Lo que la persona contó en el formulario
      viaja en los metadatos del usuario (`registro`), porque todavía no
      hay comercio donde guardarlo y no hay sesión para crearlo.
   2. Confirma el mail y entra. `cargarSesion` ve un usuario sin perfil
      que trae `registro` y llama a `crear_comercio_de_prueba`, que arma
      todo en la base. No se crea al registrarse porque un mail sin
      confirmar no es de nadie: cualquiera podía registrar el de otro.
   3. Vencida la prueba la base deja de devolverle datos (empresa_actual);
      `miCuenta` es lo único que contesta, para la pantalla de contratar.

   Los metadatos los escribe el navegador, así que la base no les cree
   nada: recorta los módulos al rubro, valida el plan y pone el plazo.
   ============================================================ */

import { supabase } from "./supabase.js";

/* Lo de Supabase en castellano. Los que no están acá salen con el texto
   original, que es mejor que un "algo falló". */
function traducir(error) {
  const m = (error && error.message) || "";
  if (/rate limit|too many/i.test(m)) return "Hay muchas altas en este momento. Probá de nuevo en un rato.";
  if (/password.*(short|least|characters)|weak/i.test(m)) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (/invalid.*email|email.*invalid/i.test(m)) return "Ese email no parece válido.";
  if (/signups? not allowed|disabled/i.test(m)) return "Las altas están cerradas por ahora. Escribinos por WhatsApp.";
  return m || "No se pudo crear la cuenta. Probá de nuevo.";
}

/* Crea el usuario y manda el mail. Si el mail ya tenía cuenta, Supabase
   contesta igual que si fuera nuevo —para no contarle a nadie qué mails
   están registrados— y no manda nada: quien llama muestra el mismo
   mensaje en los dos casos. */
export async function registrarse({ email, clave, registro }) {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password: clave,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { registro },
    },
  });
  if (error) throw new Error(traducir(error));
}

export async function crearComercioDePrueba(registro) {
  const { data, error } = await supabase.rpc("crear_comercio_de_prueba", { p: registro });
  if (error) throw new Error(error.message || "No pudimos crear tu comercio.");
  return data;
}

/* Lo que la base deja saber de la propia cuenta aunque esté vencida o
   suspendida. */
export async function miCuenta() {
  const { data, error } = await supabase.rpc("mi_cuenta");
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    rubro: data.rubro,
    plan: data.plan,
    modulos: data.modulos || [],
    activo: data.activa,
    pruebaHasta: data.prueba_hasta || null,
    hoy: data.hoy,
    pagoAvisado: data.pago_avisado_en || null,
    ejemplos: !!data.ejemplos,
    planElegido: data.plan_elegido || null,
    /* 0130: quién soy en el comercio (solo el dueño cambia el plan) y si el
       comercio se dio de alta solo (los de antes no tienen Mi plan). */
    miRol: data.mi_rol || null,
    autoservicio: !!data.autoservicio,
    /* La de Mercado Pago (0128), o null si nunca contrató. Las fechas
       quedan como texto AAAA-MM-DD, igual que pruebaHasta. */
    suscripcion: data.suscripcion ? {
      plan: data.suscripcion.plan,
      periodo: data.suscripcion.periodo,
      monto: Number(data.suscripcion.monto),
      estado: data.suscripcion.estado,
      pagoFallidoDesde: data.suscripcion.pago_fallido_desde || null,
      proximoCobro: data.suscripcion.proximo_cobro || null,
      autorizadaEn: data.suscripcion.autorizada_en || null,
      proximoAjuste: data.suscripcion.proximo_ajuste || null,
      montoAnterior: data.suscripcion.monto_anterior == null ? null : Number(data.suscripcion.monto_anterior),
      ajustadoEn: data.suscripcion.ajustado_en || null,
      bajaCodigo: data.suscripcion.baja_codigo || null,
      bajaPedidaEn: data.suscripcion.baja_pedida_en || null,
      cambio: data.suscripcion.cambio_plan ? {
        plan: data.suscripcion.cambio_plan, periodo: data.suscripcion.cambio_periodo, monto: Number(data.suscripcion.cambio_monto),
      } : null,
    } : null,
  };
}

/* Contratar (0128): el servidor crea la suscripción en Mercado Pago con el
   precio de `tarifas` y devuelve el link para autorizarla. El precio no lo
   manda el navegador: solo el plan, el período y el mail de la cuenta de
   Mercado Pago de quien paga. */
export async function contratarSuscripcion({ plan, periodo, email }) {
  const respuesta = await alServidor({ accion: "contratar", plan, periodo, email }, "No se pudo armar el pago. Probá de nuevo.");
  if (!respuesta.link) throw new Error("No se pudo armar el pago. Probá de nuevo.");
  return respuesta;
}

/* Lo que le pide a api/founder.js el dueño (o la plataforma), con su token. */
export async function alServidor(cuerpo, siFalla) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");
  let r;
  try {
    r = await fetch("/api/founder", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("No se pudo hablar con el servidor. Revisá la conexión.");
  }
  let respuesta = null;
  try { respuesta = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok || !respuesta) throw new Error((respuesta && respuesta.error && respuesta.error.message) || siFalla);
  return respuesta;
}

/* Mi plan (0130). Cambiar en el mismo período contesta { ok }; a otro
   período contesta { link } para autorizar la suscripción nueva en MP. */
export const cambiarPlan = ({ plan, periodo }) =>
  alServidor({ accion: "cambiarPlan", plan, periodo }, "No se pudo cambiar el plan.");

/* Que Vercel tenga el subdominio del comercio (0142). Devuelve
   { host, estado, detalle }. Lo pide cualquiera del comercio al entrar. */
export const pedirSubdominio = () => alServidor({ accion: "subdominio" }, "No se pudo preparar la dirección del sitio.");

/* Devuelve { codigo, hasta }: el código de baja y el último día de uso. */
export const darDeBaja = () => alServidor({ accion: "baja" }, "No se pudo dar de baja. Escribinos por WhatsApp.");

/* Los pedidos del botón de arrepentimiento, para la plataforma. */
export async function cargarArrepentimientos() {
  const { data, error } = await supabase.from("arrepentimientos")
    .select("id, codigo, nombre, email, comercio, telefono, motivo, empresa_id, estado, creado_en, resuelto_en, nota, empresas(nombre)")
    .order("creado_en", { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []).map((a) => ({
    id: a.id, codigo: a.codigo, nombre: a.nombre, email: a.email, comercioDicho: a.comercio, telefono: a.telefono,
    motivo: a.motivo, empresaId: a.empresa_id, comercio: a.empresas ? a.empresas.nombre : null,
    estado: a.estado, creadoEn: a.creado_en, resueltoEn: a.resuelto_en, nota: a.nota,
  }));
}

export const resolverArrepentimiento = (id, decision = "resolver") =>
  alServidor({ accion: "arrepentimiento", id, decision }, "No se pudo resolver.");

/* Donde el que paga administra su suscripción: cambiar la tarjeta o darla
   de baja es de Mercado Pago, no de Genez. */
export const MP_MIS_SUSCRIPCIONES = "https://www.mercadopago.com.ar/subscriptions";

/* Días que le quedan contando hoy: el último día también se usa. Las
   fechas van como texto AAAA-MM-DD; como Date caen al día anterior en
   Buenos Aires. */
export function diasDePrueba(pruebaHasta, hoy) {
  if (!pruebaHasta) return null;
  const a = Date.UTC(...pruebaHasta.split("-").map((n, i) => (i === 1 ? n - 1 : +n)));
  const b = Date.UTC(...hoy.split("-").map((n, i) => (i === 1 ? n - 1 : +n)));
  return Math.round((a - b) / 86400000) + 1;
}

export async function borrarEjemplos() {
  const { error } = await supabase.rpc("borrar_ejemplos");
  if (error) throw new Error(error.message || "No se pudieron borrar los ejemplos.");
}

export async function avisarPago() {
  const { error } = await supabase.rpc("avisar_pago");
  if (error) throw new Error(error.message || "No se pudo avisar. Escribinos por WhatsApp.");
}

/* ---------- Del lado de Genez ---------- */

export async function cargarPruebas() {
  const { data, error } = await supabase
    .from("pruebas")
    .select("empresa_id, creada_en, email, nombre, telefono, plan, negocio, provincia, sucursales, problema, aviso_por_vencer_en, aviso_vencida_en, pago_avisado_en, ejemplos_borrados_en, empresas(nombre, rubro, activa, prueba_hasta)")
    .order("creada_en", { ascending: false });
  if (error) throw error;
  return (data || []).map((f) => ({
    id: f.empresa_id,
    comercio: f.empresas ? f.empresas.nombre : "(borrado)",
    rubro: f.empresas ? f.empresas.rubro : null,
    activo: f.empresas ? f.empresas.activa : false,
    pruebaHasta: f.empresas ? f.empresas.prueba_hasta : null,
    alta: f.creada_en,
    email: f.email,
    nombre: f.nombre,
    telefono: f.telefono,
    plan: f.plan,
    negocio: f.negocio,
    provincia: f.provincia,
    sucursales: f.sucursales,
    problema: f.problema,
    avisoPorVencer: f.aviso_por_vencer_en,
    avisoVencida: f.aviso_vencida_en,
    pagoAvisado: f.pago_avisado_en,
    ejemplosBorrados: f.ejemplos_borrados_en,
  }));
}

/* Activar es sacarle el plazo: queda como cualquier comercio contratado. */
export async function decidirPrueba(empresaId, accion, dias = 7) {
  let cambios;
  if (accion === "activar") cambios = { prueba_hasta: null, activa: true };
  else if (accion === "suspender") cambios = { activa: false };
  else if (accion === "reactivar") cambios = { activa: true };
  else if (accion === "extender") {
    const { data, error } = await supabase.from("empresas").select("prueba_hasta").eq("id", empresaId).single();
    if (error) throw error;
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    const desde = data.prueba_hasta && data.prueba_hasta > hoy ? data.prueba_hasta : hoy;
    const [a, m, d] = desde.split("-").map(Number);
    const nueva = new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
    cambios = { prueba_hasta: nueva, activa: true };
  } else throw new Error(`Acción desconocida: ${accion}`);
  const { error } = await supabase.from("empresas").update(cambios).eq("id", empresaId);
  if (error) throw error;
}
