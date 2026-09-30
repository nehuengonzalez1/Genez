/* ============================================================
   GENEZ FOUNDER · finanzas, ajustes y equipo (0118)
   ============================================================

   Las fechas de finanzas son días sin hora ("AAAA-MM-DD") y quedan como
   texto: los indicadores (utils/finanzasGenez.js) comparan días, y un
   Date caería en otro día al pasar por la zona horaria.
   ============================================================ */

import { supabase } from "./supabase.js";
import { conColumnas, aAppDia, traducir } from "./internoClientes.js";

const COLUMNAS = {
  interno_cuentas: ["nombre", "tipo", "moneda", "saldoInicial", "saldoInicialFecha", "activa"],
  interno_suscripciones: ["clienteId", "plan", "importeMensual", "moneda", "inicio", "fin", "estado", "motivoBaja", "diaCobro", "notas"],
  interno_movimientos: ["tipo", "concepto", "categoria", "importe", "moneda", "periodo", "emision", "vencimiento", "fechaPago", "estado", "facturado",
    "comprobante", "medioPago", "cuentaId", "referencia", "clienteId", "oportunidadId", "suscripcionId", "proveedor", "proyectoId", "area", "fijo", "notas"],
};
const DIAS = ["periodo", "emision", "vencimiento", "fechaPago", "inicio", "fin", "saldoInicialFecha", "fecha"];
/* Los días quedan como vinieron; los importes, como número. */
const aApp = (f) => {
  if (!f) return f;
  const o = aAppDia(f);
  for (const k of DIAS) { const s = f[k.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase())]; if (s && !String(s).includes("T")) o[k] = s; }
  for (const k of ["importe", "importeMensual", "saldoInicial", "saldo", "importeAntes", "importeDespues"]) if (o[k] != null) o[k] = Number(o[k]);
  return o;
};
const mas = (error) => {
  if (!error) return null;
  const m = error.message || "";
  if (/interno_movimientos_pago/.test(m)) return new Error("Pagado necesita la fecha de pago, y una fecha de pago necesita que esté pagado.");
  if (/interno_movimientos_importe|interno_suscripciones_importe/.test(m)) return new Error("El importe tiene que ser mayor que cero.");
  if (/interno_suscripciones_baja/.test(m)) return new Error("Para darla de baja, poné la fecha de baja.");
  if (/interno_suscripciones_fechas/.test(m)) return new Error("La baja no puede ser antes del inicio.");
  if (/interno_movimientos_un_cobro/.test(m)) return new Error("Esa suscripción ya tiene su cobro de ese mes.");
  if (/Solo el administrador/.test(m)) return new Error("Solo el administrador del equipo puede sumar gente.");
  return traducir(error);
};
const dato = ({ data, error }) => { if (error) throw mas(error); return data; };
const guardar = async (tabla, obj) => {
  const fila = conColumnas(COLUMNAS[tabla], obj);
  if (obj.id) return dato(await supabase.from(tabla).update(fila).eq("id", obj.id));
  return dato(await supabase.from(tabla).insert(fila).select("id").single());
};

export const ESTADO_MOVIMIENTO = { pendiente: "Pendiente", pagado: "Pagado", anulado: "Anulado" };
export const ESTADO_SUSCRIPCION = { activa: "Activa", pausada: "Pausada", baja: "Baja" };
export const TIPO_CUENTA = { banco: "Banco", billetera: "Billetera virtual", efectivo: "Efectivo", otra: "Otra" };

/* Todo lo de finanzas en una lectura: los indicadores cruzan las cuatro cosas. */
export async function cargarFinanzas() {
  const [movimientos, suscripciones, cambios, cuentas] = await Promise.all([
    supabase.from("interno_movimientos_vista").select("*").order("periodo", { ascending: false }).order("creado_en", { ascending: false }).limit(5000),
    supabase.from("interno_suscripciones_vista").select("*").order("inicio", { ascending: false }),
    supabase.from("interno_suscripciones_cambios").select("*").order("fecha"),
    supabase.from("interno_cuentas_vista").select("*").order("nombre"),
  ]);
  return { movimientos: (dato(movimientos) || []).map(aApp), suscripciones: (dato(suscripciones) || []).map(aApp),
    cambios: (dato(cambios) || []).map(aApp), cuentas: (dato(cuentas) || []).map(aApp) };
}
export const guardarMovimiento = (m) => guardar("interno_movimientos", m);
export const guardarSuscripcion = (s) => guardar("interno_suscripciones", s);
export const guardarCuenta = (k) => guardar("interno_cuentas", k);
export async function generarCobros(mes) {
  return dato(await supabase.rpc("interno_generar_cobros", { p_mes: `${mes}-01` }));
}

/* ---------- Ajustes ---------- */
export async function cargarAjustes() {
  const filas = dato(await supabase.from("interno_ajustes").select("clave, valor")) || [];
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor || {}]));
}
export async function guardarAjuste(clave, valor) {
  dato(await supabase.from("interno_ajustes").update({ valor }).eq("clave", clave));
}

/* ---------- El equipo ---------- */
export async function buscarPerfil(email) {
  const data = dato(await supabase.rpc("interno_buscar_perfil", { p_email: email }));
  return (data && data[0]) || null;
}
export async function sumarMiembro(perfilId, rol, areas) {
  dato(await supabase.from("interno_miembros").insert({ perfil_id: perfilId, rol, areas }));
}
export async function editarMiembro(perfilId, cambios) {
  dato(await supabase.from("interno_miembros").update(cambios).eq("perfil_id", perfilId));
}

/* Los comprobantes de un movimiento (interno_adjuntos, carpeta finanzas). */
export async function comprobantesDe(movimientoId) {
  return (dato(await supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_movimientos").eq("fila_id", movimientoId).is("archivado_en", null).order("creado_en")) || []).map(aApp);
}
