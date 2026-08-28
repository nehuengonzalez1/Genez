/* ============================================================
   PERMISOS · qué puede hacer cada rol, y quién cambió qué
   ============================================================

   Hasta acá los roles eran una constante de JavaScript. Ahora salen de
   la base, que es donde tienen que estar por una razón concreta: **las
   políticas de RLS los tienen que poder leer**. Un permiso que solo
   existe en el navegador no protege nada —está escrito en `CLAUDE.md` y
   es la regla que este módulo no puede romper.

   `roles_base` son los cuatro de fábrica y `roles` guarda solo lo que
   cada comercio cambió. Ver la migración 0045 para por qué son dos
   tablas y por qué las dos políticas que nombraban roles a mano dan
   exactamente el mismo resultado que antes.

   SE GUARDA LA DIFERENCIA, NO LA FOTO
   -----------------------------------
   Al guardar se compara contra el valor de fábrica y se escribe
   únicamente lo que difiere. Guardar el objeto entero funcionaría igual
   hoy y rompería mañana: el día que un valor de fábrica cambie, el
   comercio que nunca lo tocó tiene que llevarse el cambio, y con la foto
   guardada se quedaría con el viejo para siempre sin que nadie lo note.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

/* Las banderas finas, en el orden en que se leen en pantalla. La
   descripción no es decorativa: "anular" a secas no le dice nada a quien
   tiene que decidir si dárselo al cajero. */
export const BANDERAS = [
  { k: "verCostos", n: "Ver costos y ganancias", d: "Cuánto costó cada cosa y cuánto deja." },
  { k: "descuentos", n: "Hacer descuentos", d: "Bajar el precio de una venta o una cuenta." },
  { k: "anular", n: "Anular ventas", d: "Dar de baja algo ya cobrado. Queda en la bitácora." },
  { k: "cerrarCaja", n: "Cerrar la caja", d: "Hacer el arqueo y cerrar el día." },
  { k: "cambiarPrecios", n: "Cambiar precios", d: "Editar el precio de venta del catálogo." },
  { k: "ajustes", n: "Entrar a Ajustes", d: "La configuración del negocio y del sistema." },
  { k: "verBitacora", n: "Ver la auditoría", d: "Leer lo que hicieron los demás." },
  {
    k: "configurar",
    n: "Configurar el comercio",
    d: "Cambiar la ficha del negocio y estos mismos permisos.",
    pesado: true,
  },
  /* Separado de `darAccesos` en 0061, por el mismo razonamiento con el que
     0049 separó aquel de `configurar`: dar de alta un acceso al sistema es
     habilitar a alguien a ver la caja, los costos y la agenda entera;
     habilitar a una clienta a ver sus propios turnos no se le parece. Si
     colgara del mismo permiso, un comercio que quiere que recepción invite
     clientas tendría que darle a recepción el alta de empleados. */
  {
    k: "darAppClientes",
    n: "Dar de alta clientes en la app",
    d: "Invitar a un cliente a la app donde ve sus turnos, y quitarle el acceso.",
  },
  /* Separado de `configurar` en 0049. No es lo mismo cambiar la ficha del
     negocio que habilitar a una persona a entrar, y de fábrica lo tenían
     los dos roles de arriba por igual. Ahora arranca solo en el dueño. */
  {
    k: "darAccesos",
    n: "Dar de alta accesos",
    d: "Crear usuarios, cambiarles el rol y darlos de baja. Es el más pesado de todos.",
    pesado: true,
  },
];

export const banderaPorK = (k) => BANDERAS.find((b) => b.k === k) || { k, n: k, d: "" };

/* Qué se registra en la bitácora, traducido. Lo que no esté acá se
   muestra tal cual: es preferible un `pedido.estado` crudo a esconder un
   acto porque nadie escribió su nombre. */
const ACCIONES = {
  "permisos.cambiar": "Cambió los permisos de un rol",
  "permisos.restaurar": "Volvió un rol a los valores de fábrica",
  "acceso.crear": "Dio de alta un acceso",
  "acceso.permisos": "Cambió el rol o los permisos de una persona",
  "acceso.baja": "Le quitó el acceso a una persona",
  "acceso.alta": "Le devolvió el acceso a una persona",
  "acceso.borrar": "Borró un acceso",
  "venta.anular": "Anuló una venta",
  "linea.anular": "Anuló una línea",
  "linea.cantidad": "Cambió una cantidad",
  "descuento.aplicar": "Aplicó un descuento",
  "caja.abrir": "Abrió la caja",
  "caja.cerrar": "Cerró la caja",
  "caja.egreso": "Registró un egreso",
  "reserva.crear": "Tomó un turno",
  "pedido.estado": "Movió un pedido",
  "item.precio": "Cambió un precio",
};

export const nombreAccion = (k) => ACCIONES[k] || k;

/* Los actos que se pueden filtrar. Se arma de lo que hay registrado y no
   de esta lista: un comercio de servicios no tiene pedidos y no tiene por
   qué ver ese filtro. */
export const FAMILIAS = [
  { k: "permisos", n: "Permisos" },
  { k: "acceso", n: "Accesos" },
  { k: "caja", n: "Caja" },
  { k: "venta", n: "Ventas" },
  { k: "linea", n: "Líneas" },
  { k: "descuento", n: "Descuentos" },
  { k: "reserva", n: "Turnos" },
  { k: "item", n: "Catálogo" },
  { k: "pedido", n: "Pedidos" },
];

/* ------------------------------------------------------------
   Los roles
   ------------------------------------------------------------ */

export async function cargarRoles(empresaId) {
  if (!empresaId) throw new Error("cargarRoles necesita saber de qué comercio.");

  const [base, propios] = await Promise.all([
    supabase.from("roles_base").select("clave, nombre, descripcion, modulos, permisos, orden").order("orden"),
    supabase.from("roles").select("clave, nombre, modulos, permisos, actualizado").eq("empresa_id", empresaId),
  ]);
  if (base.error) throw base.error;
  if (propios.error) throw propios.error;

  const mios = new Map((propios.data || []).map((r) => [r.clave, r]));

  return (base.data || []).map((b) => {
    const mio = mios.get(b.clave);
    return {
      k: b.clave,
      n: (mio && mio.nombre) || b.nombre,
      d: b.descripcion || "",
      /* `todos` es null en la base: el rol alcanza todo lo que el
         comercio haya contratado, sea lo que sea mañana. */
      modulos: mio && mio.modulos ? mio.modulos : b.modulos,
      todos: !(mio && mio.modulos) && b.modulos === null,
      permisos: { ...(b.permisos || {}), ...((mio && mio.permisos) || {}) },
      base: { modulos: b.modulos, permisos: b.permisos || {} },
      propio: !!mio,
      actualizado: mio && mio.actualizado ? new Date(mio.actualizado) : null,
    };
  });
}

/* Se escribe la diferencia contra el valor de fábrica. Si no quedó
   ninguna, la fila se borra: un rol sin cambios no tiene por qué existir
   en la tabla de cambios. */
export async function guardarRol(empresaId, rol, { modulos, permisos }) {
  if (!empresaId) throw new Error("guardarRol necesita saber de qué comercio.");

  const diff = {};
  for (const b of BANDERAS) {
    const nuevo = !!permisos[b.k];
    if (nuevo !== !!rol.base.permisos[b.k]) diff[b.k] = nuevo;
  }

  const mismos = (a, b) =>
    (a === null && b === null) ||
    (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x) => b.includes(x)));

  const modulosCambiaron = !mismos(modulos, rol.base.modulos);

  if (!Object.keys(diff).length && !modulosCambiaron) {
    return restaurarRol(empresaId, rol.k);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("roles").upsert({
    empresa_id: empresaId,
    clave: rol.k,
    modulos: modulosCambiaron ? modulos : null,
    permisos: diff,
    actualizado: new Date().toISOString(),
    usuario_id: user ? user.id : null,
  }, { onConflict: "empresa_id,clave" });

  if (error) throw traducir(error);
}

export async function restaurarRol(empresaId, clave) {
  if (!empresaId) throw new Error("restaurarRol necesita saber de qué comercio.");

  const { error } = await supabase
    .from("roles").delete().eq("empresa_id", empresaId).eq("clave", clave);
  if (error) throw traducir(error);
}

/* El error del disparador llega con su código; se traduce acá para que
   la pantalla no tenga que saber de códigos de Postgres. */
function traducir(error) {
  if (error && error.code === "P0070") {
    return new Error("No podés sacarle a tu propio rol el permiso de configurar: te quedarías afuera.");
  }
  /* De 0049. El mensaje de la base ya nombra la bandera, así que se
     aprovecha en vez de escribir uno genérico: saber cuál es lo que
     resuelve la duda de quien está mirando la pantalla. */
  if (error && error.code === "P0075") {
    return new Error(error.message || "No podés dar un permiso que vos no tenés.");
  }
  return new Error((error && error.message) || "No se pudo guardar.");
}

/* ------------------------------------------------------------
   La auditoría

   `bitacora` existía desde el principio y nunca tuvo pantalla: se
   escribía y no la leía nadie. Solo admite insertar y leer, así que lo
   que está ahí no se puede corregir ni borrar, que es la única forma de
   que sirva para algo.
   ------------------------------------------------------------ */

export async function cargarBitacora(empresaId, { familia = null, dias = 30 } = {}) {
  if (!empresaId) throw new Error("cargarBitacora necesita saber de qué comercio.");

  let q = supabase
    .from("bitacora")
    .select("id, accion, entidad, entidad_id, detalle, fecha, usuario_id, perfiles(nombre)")
    .eq("empresa_id", empresaId)
    .gte("fecha", new Date(Date.now() - dias * 86400000).toISOString())
    .order("fecha", { ascending: false })
    .limit(400);

  if (familia) q = q.like("accion", `${familia}.%`);

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((f) => ({
    id: f.id,
    accion: f.accion,
    entidad: f.entidad || "",
    detalle: f.detalle || {},
    fecha: new Date(f.fecha),
    usuario: (f.perfiles && f.perfiles.nombre) || "—",
  }));
}
