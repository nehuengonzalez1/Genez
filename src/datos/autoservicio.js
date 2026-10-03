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
  };
}

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
