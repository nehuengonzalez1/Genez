/* ============================================================
   CLIENTES · leer y guardar
   ============================================================

   La base guarda `razon_social` y `tipo_doc`; la aplicación viene hablando
   de `razonSocial` y `tipoDoc` desde el prototipo. La traducción vive acá y
   en ningún otro lado: los módulos siguen sin saber cómo se llaman las
   columnas.
   ============================================================ */

import { supabase } from "./supabase.js";

const COLUMNA = {
  razonSocial: "razon_social",
  tipoDoc: "tipo_doc",
  doc: "doc",
  condicion: "condicion",
  domicilio: "domicilio",
  email: "email",
  tel: "tel",
  camposExtra: "campos_extra",
  activo: "activo",
};

const SELECT =
  "id, razon_social, tipo_doc, doc, condicion, domicilio, email, tel, campos_extra, activo, creado_en";

function aCliente(f) {
  return {
    id: f.id,
    razonSocial: f.razon_social,
    tipoDoc: f.tipo_doc || "CUIT",
    doc: f.doc || "",
    condicion: f.condicion || "CF",
    domicilio: f.domicilio || "",
    email: f.email || "",
    tel: f.tel || "",
    camposExtra: f.campos_extra || {},
    activo: f.activo,
    alta: f.creado_en ? new Date(f.creado_en) : null,
  };
}

/* Solo viajan a la base los campos que existen como columna. El formulario
   arrastra cosas que no lo son —el id, banderas de la pantalla— y mandarlas
   haría fallar el insert entero. */
function aFila(datos) {
  const fila = {};
  for (const [campo, valor] of Object.entries(datos)) {
    if (COLUMNA[campo] !== undefined) fila[COLUMNA[campo]] = valor;
  }
  return fila;
}

/* Supabase corta en 1.000 filas por consulta. Una cartera de clientes real
   pasa ese número sin ser grande, así que se pagina siempre. */
const PAGINA = 1000;

/* El filtro por empresa va explícito, igual que en el catálogo: RLS
   contesta si podés ver algo, no de qué comercio es. El dueño de
   plataforma ve todo, así que sin este filtro entraba a un comercio y se
   le mezclaba la cartera de los otros. */
export async function cargarClientes(empresaId) {
  if (!empresaId) throw new Error("cargarClientes necesita saber de qué comercio.");

  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("clientes")
      .select(SELECT)
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("razon_social")
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA) return filas.map(aCliente);
  }
}

export async function crearCliente(empresaId, datos) {
  const fila = { ...aFila(datos), empresa_id: empresaId };
  if (!fila.razon_social) throw new Error("El cliente necesita un nombre.");

  const { data, error } = await supabase
    .from("clientes")
    .insert(fila)
    .select(SELECT)
    .single();
  if (error) throw error;
  return aCliente(data);
}

export async function guardarCliente(id, cambios) {
  const fila = aFila(cambios);
  if (!Object.keys(fila).length) return null;

  const { data, error } = await supabase
    .from("clientes")
    .update(fila)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return aCliente(data);
}

/* Un cliente no se borra: se desactiva. Puede tener ventas atrás, y
   borrarlo dejaría comprobantes emitidos sin a quién apuntar. */
export async function desactivarCliente(id) {
  const { error } = await supabase.from("clientes").update({ activo: false }).eq("id", id);
  if (error) throw error;
}

/* ============================================================
   LA FICHA
   ============================================================

   En una estética la ficha es la mitad del valor del sistema: qué se le
   hizo, cuándo, con qué y si hay algo que no se le puede hacer. Ver la
   migración 0040 para por qué las notas son un cuaderno fechado y no un
   campo que se pisa.
   ============================================================ */

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

function conCuentas(f) {
  return {
    ...aCliente(f),
    turnos: num(f.turnos),
    asistio: num(f.asistio),
    ausencias: num(f.ausencias),
    cancelados: num(f.cancelados),
    asistencia: f.asistencia === null || f.asistencia === undefined ? null : Number(f.asistencia),
    ultima: f.ultima ? new Date(f.ultima) : null,
    proxima: f.proxima ? new Date(f.proxima) : null,
    gastado: num(f.gastado),
    compras: num(f.compras),
    abonosActivos: num(f.abonos_activos),
    notas: num(f.notas),
    alertas: num(f.alertas),
    /* Si tiene la app y desde cuándo. No sale la cuenta: para la ficha
       alcanza con si tiene acceso. Ver 0062. */
    tieneApp: !!f.usuario_id,
    enlazadaEn: f.enlazado_en ? new Date(f.enlazado_en) : null,
  };
}

/* La lista con las cuentas hechas. Es la misma consulta que la de arriba
   pero contra la vista: se usa donde importa el resumen y no solo el
   nombre, como la pantalla de clientes. */
export async function cargarClientesConCuentas(empresaId) {
  if (!empresaId) throw new Error("cargarClientesConCuentas necesita saber de qué comercio.");

  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("clientes_vista")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("razon_social")
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA) return filas.map(conCuentas);
  }
}

/* Todo lo de una persona, de una. Son cinco consultas y no una sola con
   joins a propósito: cada cosa tiene su orden y su límite, y un join las
   multiplicaría entre sí. */
export async function cargarFicha(empresaId, clienteId) {
  if (!empresaId || !clienteId) throw new Error("cargarFicha necesita el comercio y el cliente.");

  const [cli, turnos, abonos, ventas, notas] = await Promise.all([
    supabase.from("clientes_vista").select("*").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle(),

    supabase.from("agenda_vista")
      .select("id, desde, duracion_min, estado, servicio, profesional, sala, precio, forma, abono_id")
      .eq("empresa_id", empresaId).eq("cliente_id", clienteId)
      .order("desde", { ascending: false }).limit(200),

    supabase.from("abonos_vista")
      .select("*").eq("empresa_id", empresaId).eq("cliente_id", clienteId)
      .order("creado_en", { ascending: false }).limit(50),

    supabase.from("operaciones")
      .select("id, fecha, numero, total, tipo, pagos(monto)")
      .eq("empresa_id", empresaId).eq("cliente_id", clienteId).eq("estado", "confirmada")
      .order("fecha", { ascending: false }).limit(100),

    supabase.from("cliente_notas")
      .select("id, texto, destacada, creada_en")
      .eq("empresa_id", empresaId).eq("cliente_id", clienteId)
      .order("creada_en", { ascending: false }).limit(100),
  ]);

  for (const r of [cli, turnos, abonos, ventas, notas]) if (r.error) throw r.error;
  if (!cli.data) throw new Error("No encontramos ese cliente.");

  return {
    cliente: conCuentas(cli.data),

    turnos: (turnos.data || []).map((t) => ({
      id: t.id,
      desde: new Date(t.desde),
      duracion: t.duracion_min,
      estado: t.estado,
      servicio: t.servicio || "",
      profesional: t.profesional || "",
      sala: t.sala || "",
      precio: num(t.precio),
      forma: t.forma,
      conAbono: !!t.abono_id,
    })),

    abonos: (abonos.data || []).map((a) => ({
      id: a.id,
      nombre: a.nombre,
      clases: a.clases,
      usadas: num(a.usadas),
      restantes: a.restantes === null || a.restantes === undefined ? null : num(a.restantes),
      vence: a.vence ? new Date(`${a.vence}T12:00:00`) : null,
      estado: a.estado,
    })),

    ventas: (ventas.data || []).map((o) => {
      const pagado = (o.pagos || []).reduce((s, p) => s + num(p.monto), 0);
      return {
        id: o.id,
        fecha: new Date(o.fecha),
        numero: o.numero || "",
        total: num(o.total),
        pagado,
        falta: num(o.total) - pagado,
      };
    }),

    notas: (notas.data || []).map((x) => ({
      id: x.id,
      texto: x.texto,
      destacada: x.destacada,
      fecha: new Date(x.creada_en),
    })),
  };
}

export async function anotarEnFicha(empresaId, clienteId, texto, destacada = false) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("cliente_notas").insert({
    empresa_id: empresaId, cliente_id: clienteId,
    texto, destacada, usuario_id: user ? user.id : null,
  });
  if (error) throw error;
}

export async function borrarNota(id) {
  const { error } = await supabase.from("cliente_notas").delete().eq("id", id);
  if (error) throw error;
}

/* Las alertas de una persona: lo que hay que ver antes de atenderla. Lo
   usa la agenda al elegir un cliente, no solo la ficha. */
export async function alertasDe(empresaId, clienteId) {
  if (!empresaId || !clienteId) return [];
  const { data, error } = await supabase
    .from("cliente_notas")
    .select("id, texto")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("destacada", true)
    .order("creada_en", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data || [];
}

/* ------------------------------------------------------------
   Darle la app, y quitársela

   Lo único de esta pantalla que no va contra la base: crear una cuenta en
   Auth y averiguar si un correo ya tiene una necesitan la `service_role`,
   que no puede estar en el navegador. Es la misma división que Permisos
   → Personas hace con `api/usuarios.js`.

   El enlace en sí sí es un `update` sobre `clientes`, y lo hace el
   servidor con el token de quien llama para que lo miren RLS y los tres
   disparadores de 0050. Ver `api/clientes-acceso.js`.
   ------------------------------------------------------------ */

async function llamarAcceso(cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  let r;
  try {
    r = await fetch("/api/clientes-acceso", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("No se pudo hablar con el servidor. Revisá la conexión.");
  }

  let respuesta = null;
  try {
    respuesta = await r.json();
  } catch {
    /* Un 404 de Vercel o de Vite no viene en JSON. */
    throw new Error(
      r.status === 404
        ? "La función no está publicada. En desarrollo tiene que estar corriendo `npm run dev`."
        : "El servidor contestó algo que no se entiende."
    );
  }

  if (!r.ok) {
    throw new Error((respuesta && respuesta.error && respuesta.error.message) || "No se pudo completar.");
  }
  return respuesta;
}

/* `email` es opcional: sin él se usa el de la ficha. Va como parámetro
   porque la pantalla deja corregirlo antes de mandar, que es el momento
   en que alguien mira si está bien escrito.

   El `empresaId` viaja siempre aunque el servidor lo ignore para un
   usuario de comercio —ahí sale del token, que es lo único confiable—.
   Lo usa la plataforma, que no tiene comercio propio y es el único caso
   donde el parámetro decide. Es la misma división que hace
   `api/usuarios.js`. */
export async function invitarALaApp(empresaId, fichaId, email) {
  return llamarAcceso({ accion: "invitar", empresaId, fichaId, email: email || undefined });
}

export async function quitarLaApp(empresaId, fichaId) {
  return llamarAcceso({ accion: "quitar", empresaId, fichaId });
}
