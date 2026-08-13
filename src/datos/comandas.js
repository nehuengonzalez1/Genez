/* ============================================================
   COMANDAS · salón, pedido y cocina
   ============================================================

   El segundo comportamiento de venta. El cobro directo abre y cierra la
   operación en el mismo acto; acá la mesa queda abierta y va sumando
   consumos durante toda la atención.

   Casi todo lo pesado vive en la base: la vista del salón calcula
   totales y tiempos, y cerrar la comanda es una función que hace el
   mismo trabajo que cobrar en el mostrador. Este archivo traduce, no
   decide.
   ============================================================ */

import { supabase } from "./supabase.js";
import { cargarCanales } from "./pedidos.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

function aMesa(f) {
  return {
    id: f.id,
    tipo: f.tipo,
    nombre: f.nombre,
    piso: f.piso || "Planta baja",
    sector: f.sector || "",
    capacidad: f.capacidad,
    orden: f.orden,
    activo: f.activo !== false,
    x: n(f.x), y: n(f.y),
    ancho: n(f.ancho) || 2, alto: n(f.alto) || 2,
    forma: f.forma || "rectangulo",
    /* La vista ya trae con quién está unida y para cuánta gente quedó.
       Sin exponerlo acá, la pantalla tenía que pedir los recursos otra
       vez para saberlo: una consulta de más en cada refresco del salón. */
    unidaA: f.unida_a || null,
    unidas: n(f.unidas),
    capacidadTotal: n(f.capacidad_total) || n(f.capacidad),

    comandaId: f.comanda_id,
    ocupada: !!f.comanda_id,
    abiertaEn: f.abierta_en ? new Date(f.abierta_en) : null,
    minutos: f.minutos == null ? null : Number(f.minutos),
    comensales: f.comensales == null ? null : Number(f.comensales),
    consumido: n(f.consumido),
    items: n(f.items),
    sinEnviar: n(f.sin_enviar),
    enCocina: n(f.en_cocina),
    listos: n(f.listos),
  };
}

function aLinea(f) {
  return {
    id: f.id,
    itemId: f.item_id,
    nombre: f.descripcion,
    cantidad: n(f.cantidad),
    precio: n(f.precio_unitario),
    costo: n(f.costo_unitario),
    total: n(f.total),
    estado: f.estado,
    notas: f.notas || "",
    destino: f.destino || null,
    modificadores: f.modificadores || [],
    enviadaEn: f.enviada_en ? new Date(f.enviada_en) : null,
  };
}

export async function cargarSalon(empresaId) {
  const { data, error } = await supabase
    .from("salon_vista")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("orden");

  if (error) throw error;
  return (data || []).map(aMesa);
}

export async function cargarRecursos(empresaId) {
  const { data, error } = await supabase
    .from("recursos").select("*").eq("empresa_id", empresaId).order("orden");
  if (error) throw error;
  return data || [];
}

/* Si la mesa ya estaba ocupada devuelve la comanda que ya existe: tocar
   dos veces la misma mesa es lo más normal del mundo y no puede terminar
   en dos cuentas paralelas. Eso lo resuelve la base. */
export async function abrirComanda({ empresaId, sucursalId = null, recursoId, clienteId = null }) {
  const { data, error } = await supabase.rpc("abrir_comanda", {
    datos: {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      recurso_id: recursoId,
      cliente_id: clienteId,
    },
  });
  if (error) throw error;
  return data;
}

/* Un pedido que no ocupa mesa: mostrador, para llevar, o el que entró por
   una aplicación. Es la misma comanda con la misma carta; lo único
   distinto es de dónde vino.

   A diferencia de una mesa, cada llamada abre un pedido nuevo: dos
   personas en el mostrador son dos pedidos aunque lleguen juntas. */
export async function abrirPedido({ empresaId, sucursalId = null, canal = "mostrador", referencia = null, cliente = null }) {
  const { data, error } = await supabase.rpc("abrir_comanda", {
    datos: {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      recurso_id: null,
      canal,
      referencia,
      campos_extra: cliente ? { cliente } : {},
    },
  });
  if (error) throw error;
  return data;
}

/* El canal se decide al comandar y no antes: quien está parado en el
   mostrador todavía no sabe si le van a pedir para llevar, o si lo que
   suena es un pedido de aplicación. Por eso un pedido nace como
   'mostrador' y se corrige mientras se carga. */
export async function cambiarCanal(comandaId, { canal, referencia = null, cliente = null }) {
  const fila = { canal, referencia };
  if (cliente !== undefined) fila.campos_extra = cliente ? { cliente } : {};

  const { error } = await supabase
    .from("operaciones").update(fila).eq("id", comandaId).eq("estado", "abierta");
  if (error) throw error;
}

/* Los canales ya no viven acá: son filas de la tabla `canales` y se leen
   con `cargarCanales` de src/datos/pedidos.js. Los pedidos que no ocupan
   mesa, con su estado y sus tiempos, también salen de ahí. */

/* ------------------------------------------------------------
   EL PLANO
   ------------------------------------------------------------ */

export async function cargarElementosPlano(empresaId) {
  const { data, error } = await supabase
    .from("plano_elementos").select("*").eq("empresa_id", empresaId);
  if (error) throw error;
  return data || [];
}

/* Guarda el plano entero de una sola vez. No se usa un upsert desde acá
   porque un upsert intenta insertar primero, y entonces Postgres exige
   las columnas obligatorias aunque la fila ya exista: fallaba por
   empresa_id nulo. Además, acomodar diez mesas de a una deja el plano
   mitad viejo y mitad nuevo si algo se corta en el medio. */
export async function guardarPlano(recursos) {
  const cambios = (recursos || []).map((r) => ({
    id: r.id,
    x: Math.round(r.x), y: Math.round(r.y),
    ancho: Math.round(r.ancho), alto: Math.round(r.alto),
    forma: r.forma,
    piso: r.piso,
    sector: r.sector || null,
    nombre: r.nombre,
    capacidad: r.capacidad == null ? null : Math.round(r.capacidad),
  }));
  if (!cambios.length) return 0;

  const { data, error } = await supabase.rpc("guardar_plano", { datos: { recursos: cambios } });
  if (error) throw error;
  return data;
}

export async function borrarElemento(id) {
  const { error } = await supabase.from("plano_elementos").delete().eq("id", id);
  if (error) throw error;
}

export async function guardarElementos(empresaId, elementos) {
  const { error } = await supabase.from("plano_elementos").upsert(
    elementos.map((e) => ({ ...e, empresa_id: empresaId })), { onConflict: "id" });
  if (error) throw error;
}

export async function crearRecurso({ empresaId, sucursalId = null, nombre, tipo = "mesa", piso = "Planta baja", sector = null, capacidad = 4, x = 0, y = 0, forma = "rectangulo" }) {
  const { data, error } = await supabase
    .from("recursos")
    .insert({ empresa_id: empresaId, sucursal_id: sucursalId, nombre, tipo, piso, sector, capacidad, x, y, forma })
    .select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay un lugar con ese nombre.");
    throw error;
  }
  return data;
}

/* Juntar la 3 y la 4 cuando llegan seis y no hay mesa de seis. La unida
   no abre cuenta propia: apunta a la que manda, y tocarla abre esa. */
export async function unirMesas(principalId, secundariaId) {
  const { error } = await supabase.rpc("unir_mesas", {
    principal: principalId, secundaria: secundariaId,
  });
  if (error) {
    const dicho = {
      P0005: "Una mesa no se puede unir a sí misma.",
      P0006: "Esa mesa ya está unida a otra. Uní a la principal.",
      P0007: "Esta mesa tiene otras unidas. Separalas primero.",
      P0008: "Esta mesa tiene una cuenta abierta. Cobrala antes de unirla.",
    }[error.code];
    throw new Error(dicho || error.message);
  }
}

export async function separarMesa(mesaId) {
  const { error } = await supabase.rpc("separar_mesa", { mesa: mesaId });
  if (error) throw error;
}

export async function borrarRecurso(id) {
  const { error } = await supabase.from("recursos").delete().eq("id", id);
  if (error) throw error;
}

export async function cargarComanda(comandaId) {
  /* Lo pagado va junto con la comanda y no en una lectura aparte: la
     pantalla lo necesita en el mismo momento en que muestra el total
     —para saber si la cuenta ya está saldada— y pedirlo después dejaba
     un parpadeo con el saldo equivocado. */
  const cobrado = supabase
    .from("cuenta_vista").select("pagado, saldo").eq("id", comandaId).maybeSingle();

  const { data, error } = await supabase
    .from("operaciones")
    .select(`
      id, numero, estado, fecha, abierta_en, recurso_id, cliente_id,
      comensales, descuento, descuento_pct, canal, referencia, campos_extra, observacion,
      recursos ( nombre, sector ),
      operacion_lineas (
        id, item_id, descripcion, cantidad, precio_unitario, costo_unitario,
        total, estado, notas, destino, modificadores, enviada_en
      )
    `)
    .eq("id", comandaId)
    .single();

  if (error) throw error;

  const { data: pagos } = await cobrado;

  const todas = (data.operacion_lineas || []).map(aLinea);
  /* Las anuladas viajan aparte. En la comanda no van: quien está tomando
     el pedido necesita ver lo que la mesa va a pagar, no un historial
     tachado. Pero no se pierden, porque alguien las pidió y capaz se
     cocinaron. */
  const lineas = todas.filter((l) => l.estado !== "anulada");
  const subtotal = lineas.reduce((s, l) => s + l.total, 0);

  return {
    id: data.id,
    numero: data.numero,
    estado: data.estado,
    recursoId: data.recurso_id,
    mesa: data.recursos ? data.recursos.nombre : "",
    sector: data.recursos ? data.recursos.sector : "",
    clienteId: data.cliente_id,
    abiertaEn: data.abierta_en ? new Date(data.abierta_en) : null,
    lineas,
    anuladas: todas.filter((l) => l.estado === "anulada"),
    comensales: data.comensales,
    canal: data.canal,
    referencia: data.referencia,
    observacion: data.observacion || "",
    pagado: n(pagos && pagos.pagado),
    saldo: n(pagos && pagos.saldo),

    /* El descuento por porcentaje se recalcula acá contra el subtotal de
       ahora y no se lee el monto guardado: si la mesa pidió algo más
       después de pactarlo, el guardado quedó viejo. La base hace la misma
       cuenta al cerrar, así que el número que se ve es el que se cobra. */
    subtotal,
    descuentoPct: data.descuento_pct == null ? null : Number(data.descuento_pct),
    descuento: data.descuento_pct != null
      ? Math.round(subtotal * Number(data.descuento_pct) / 100)
      : n(data.descuento),
    total: subtotal - (data.descuento_pct != null
      ? Math.round(subtotal * Number(data.descuento_pct) / 100)
      : n(data.descuento)),
  };
}

/* Los modificadores con precio suman al total de la línea: "extra queso"
   no es una aclaración, es plata. */
/* Dos líneas son la misma cosa si es el mismo producto pedido igual. El
   orden de los modificadores no cuenta: "sin cebolla, extra queso" y
   "extra queso, sin cebolla" son el mismo plato. */
const firma = (itemId, modificadores, notas) => JSON.stringify([
  itemId,
  (modificadores || []).map((m) => `${m.nombre}:${n(m.precio)}`).sort(),
  (notas || "").trim(),
]);

export async function agregarLinea({ comandaId, empresaId, item, cantidad = 1, modificadores = [], notas = "", destino = null }) {
  const extra = (modificadores || []).reduce((s, m) => s + n(m.precio), 0);
  const unitario = n(item.precio) + extra;

  /* Cuatro cocas son un renglón que dice 4, no cuatro renglones. Pero
     solo se agrupa con lo que todavía no salió: si la cocina ya recibió
     una, sumarle al mismo renglón esconde que hay otra por hacer. */
  const { data: previas } = await supabase
    .from("operacion_lineas")
    .select("id, item_id, cantidad, precio_unitario, modificadores, notas")
    .eq("operacion_id", comandaId)
    .eq("estado", "borrador")
    .eq("item_id", item.id);

  const igual = (previas || []).find(
    (l) => firma(l.item_id, l.modificadores, l.notas) === firma(item.id, modificadores, notas)
  );

  if (igual) {
    const total = n(igual.cantidad) + cantidad;
    const { data, error } = await supabase
      .from("operacion_lineas")
      .update({ cantidad: total, total: Math.round(n(igual.precio_unitario) * total) })
      .eq("id", igual.id)
      .select("id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, total, estado, notas, destino, modificadores, enviada_en")
      .single();
    if (error) throw error;
    return aLinea(data);
  }

  const { data, error } = await supabase
    .from("operacion_lineas")
    .insert({
      operacion_id: comandaId,
      empresa_id: empresaId,
      item_id: item.id,
      descripcion: item.nombre,
      cantidad,
      precio_unitario: unitario,
      costo_unitario: n(item.costo),
      iva: n(item.iva) || 21,
      total: Math.round(unitario * cantidad),
      modificadores,
      notas,
      destino: destino || (item.campos_extra && item.campos_extra.destino) || null,
    })
    .select("id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, total, estado, notas, destino, modificadores, enviada_en")
    .single();

  if (error) throw error;
  return aLinea(data);
}

/* Anular no borra. Una línea que se pidió y se dio de baja es información
   del servicio: alguien la cargó, quizá se cocinó, y el encargado tiene
   derecho a verla. Los totales y el stock ya la ignoran. */
export async function anularLinea(lineaId) {
  const { error } = await supabase
    .from("operacion_lineas").update({ estado: "anulada" }).eq("id", lineaId);
  if (error) throw error;
}

/* Manda a la cocina lo que todavía no salió, y solo eso. Si a las nueve
   se pidieron dos hamburguesas y a las diez una porción de papas, la
   cocina recibe las papas: repetir las hamburguesas es cómo se arruina
   un servicio. Devuelve cuántas salieron. */
export async function enviarACocina(comandaId) {
  const { data, error } = await supabase.rpc("enviar_a_cocina", { comanda: comandaId });
  if (error) throw error;
  return data || 0;
}

/* Cambiar la cantidad de algo que ya salió a la cocina no se puede: allá
   ya lo están haciendo. Se anula y se pide de nuevo, que además deja
   asiento de lo que pasó. */
export async function cambiarCantidad(lineaId, cantidad) {
  if (cantidad <= 0) return anularLinea(lineaId);

  const { data: l, error: e1 } = await supabase
    .from("operacion_lineas").select("precio_unitario, estado").eq("id", lineaId).single();
  if (e1) throw e1;
  if (l.estado !== "borrador") throw new Error("Ya salió a la cocina. Anulalo y pedilo de nuevo.");

  const { error } = await supabase
    .from("operacion_lineas")
    .update({ cantidad, total: Math.round(n(l.precio_unitario) * cantidad) })
    .eq("id", lineaId);
  if (error) throw error;
}

export async function cambiarEstadoLinea(lineaId, estado) {
  const campos = { estado };
  if (estado === "preparando") campos.enviada_en = new Date().toISOString();
  if (estado === "listo") campos.lista_en = new Date().toISOString();

  const { error } = await supabase
    .from("operacion_lineas").update(campos).eq("id", lineaId);
  if (error) throw error;
}

/* Lo que la cocina tiene que hacer, agrupado por comanda.

   Agrupado y no en líneas sueltas porque la unidad de trabajo del que
   cocina es el pedido entero: dos hamburguesas de la mesa 4 salen juntas
   y en plato, las mismas dos para llevar van en packaging, y si entraron
   por una aplicación van en la bolsa de esa aplicación. Con las líneas
   cayendo sueltas eso no se puede saber, y se arma mal.

   La etapa del pedido es la de lo menos avanzado que tenga: mientras
   quede algo sin empezar, el pedido no está en preparación. */
export async function cargarCocina(empresaId, destino = null) {
  const lineas = await cargarPendientes(empresaId, destino);

  const porComanda = new Map();
  for (const l of lineas) {
    if (!porComanda.has(l.comandaId)) {
      porComanda.set(l.comandaId, {
        id: l.comandaId,
        canal: l.canal,
        canalNombre: l.canalNombre,
        familia: l.familia,
        color: l.color,
        icono: l.icono,
        referencia: l.referencia,
        mesa: l.mesa,
        sector: l.sector,
        desde: l.desde,
        lineas: [],
      });
    }
    porComanda.get(l.comandaId).lineas.push(l);
  }

  const orden = { pedido: 0, preparando: 1, listo: 2 };
  return [...porComanda.values()]
    .map((c) => ({
      ...c,
      etapa: c.lineas.reduce((peor, l) => (orden[l.estado] < orden[peor] ? l.estado : peor), "listo"),
      items: c.lineas.reduce((s, l) => s + l.cantidad, 0),
    }))
    /* El que espera hace más tiempo va primero: es el orden en que la
       cocina tiene que resolverlo. */
    .sort((a, b) => (a.desde || 0) - (b.desde || 0));
}

/* Mover el pedido entero. El que cocina termina la comanda de la mesa 4,
   no la tercera línea de la mesa 4. */
export async function moverComanda(comandaId, estado, destino = null) {
  const campos = { estado };
  if (estado === "preparando") campos.enviada_en = new Date().toISOString();
  if (estado === "listo") campos.lista_en = new Date().toISOString();

  let q = supabase.from("operacion_lineas").update(campos)
    .eq("operacion_id", comandaId)
    .in("estado", ["pedido", "preparando", "listo"].filter((e) => e !== estado));

  if (destino) q = q.eq("destino", destino);

  const { error } = await q;
  if (error) throw error;
}

/* Lo que está esperando en cocina, línea por línea. El destino separa la
   pantalla de la cocina de la de la barra: al que hace los tragos no le
   sirve ver las hamburguesas. */
export async function cargarPendientes(empresaId, destino = null) {
  const canales = await cargarCanales(empresaId, { conSalon: true });
  const porClave = new Map(canales.map((c) => [c.clave, c]));

  let q = supabase
    .from("operacion_lineas")
    .select(`
      id, descripcion, cantidad, estado, notas, destino, modificadores, enviada_en,
      operaciones!inner ( id, estado, abierta_en, canal, referencia, campos_extra, recursos ( nombre, sector ) )
    `)
    .eq("empresa_id", empresaId)
    .in("estado", ["pedido", "preparando", "listo"])
    .eq("operaciones.estado", "abierta");

  if (destino) q = q.eq("destino", destino);

  const { data, error } = await q;
  if (error) throw error;

  return (data || [])
    .map((f) => {
      const o = f.operaciones;
      /* La cocina necesita saber para dónde va el plato, no solo qué es.
         Un pedido sin mesa llegaba con el título vacío y el que cocina no
         podía distinguir un delivery de una mesa del salón. El nombre lo
         pone el canal, así una aplicación nueva se lee bien sin que nadie
         toque este archivo. */
      const canal = porClave.get(o.canal) || { nombre: "Pedido", familia: "mostrador", color: "app" };
      return {
        ...aLinea(f),
        comandaId: o.id,
        canal: o.canal || "salon",
        canalNombre: canal.nombre,
        familia: canal.familia,
        color: canal.color,
        icono: canal.icono,
        referencia: o.referencia || null,
        mesa: o.recursos ? o.recursos.nombre : canal.nombre,
        sector: o.recursos ? o.recursos.sector : (o.referencia ? `#${o.referencia}` : ""),
        desde: o.abierta_en ? new Date(o.abierta_en) : null,
      };
    })
    /* Lo que espera hace más tiempo va primero: es el orden en que la
       cocina tiene que resolverlo. */
    .sort((a, b) => (a.desde || 0) - (b.desde || 0));
}

/* Un porcentaje se guarda como porcentaje y sigue al subtotal: si la mesa
   pide el postre después de pactar el diez por ciento, el descuento
   acompaña. Un importe fijo se guarda como importe y no se mueve.
   Devuelve el monto que quedó, para que la pantalla no lo recalcule por
   su cuenta y termine mostrando otro número que la base. */
export async function aplicarDescuento(comandaId, { pct = null, monto = null }) {
  const { data, error } = await supabase.rpc("aplicar_descuento", {
    p_comanda: comandaId,
    p_pct: pct,
    p_monto: monto,
  });
  if (error) {
    if (error.code === "P0009") throw new Error("El descuento no puede ser mayor que la cuenta.");
    throw error;
  }
  return n(data);
}

export async function quitarDescuento(comandaId) {
  return aplicarDescuento(comandaId, { monto: 0 });
}

/* Lo que hay que saber de este pedido entero: "cliente alérgico",
   "enviar separado". Lo de un plato en particular va en la línea. */
export async function guardarObservacion(comandaId, texto) {
  const { error } = await supabase
    .from("operaciones")
    .update({ observacion: (texto || "").trim() || null })
    .eq("id", comandaId).eq("estado", "abierta");
  if (error) throw error;
}

/* ------------------------------------------------------------
   LA CUENTA

   Cuánto va, cuánto se pagó y cuánto falta. Los números salen de la base
   y no se recalculan acá: la pantalla no puede mostrar un total distinto
   del que se va a cobrar.
   ------------------------------------------------------------ */

export async function cargarCuenta(comandaId) {
  const [cuenta, pagos] = await Promise.all([
    supabase.from("cuenta_vista")
      .select("subtotal, descuento, recargo, total, pagado, saldo, observacion")
      .eq("id", comandaId).single(),
    supabase.from("pagos")
      .select("id, medio, monto, recargo, referencia, fecha")
      .eq("operacion_id", comandaId).order("fecha"),
  ]);

  if (cuenta.error) throw cuenta.error;
  if (pagos.error) throw pagos.error;

  const c = cuenta.data;
  return {
    subtotal: n(c.subtotal), descuento: n(c.descuento), recargo: n(c.recargo),
    total: n(c.total), pagado: n(c.pagado), saldo: n(c.saldo),
    observacion: c.observacion || "",
    pagos: (pagos.data || []).map((p) => ({
      id: p.id, medio: p.medio, monto: n(p.monto),
      referencia: p.referencia || "", fecha: new Date(p.fecha),
    })),
  };
}

/* Un pago sobre una cuenta que sigue abierta: la mesa paga una parte y
   puede seguir pidiendo. Dividir la cuenta es esto, varias veces. */
export async function registrarPago({ comandaId, sesionId, medio, monto, referencia = null, detalle = null }) {
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_comanda: comandaId, p_sesion: sesionId, p_medio: medio,
    p_monto: Math.round(monto), p_referencia: referencia, p_detalle: detalle,
  });
  if (error) {
    const dicho = {
      P0001: "Abrí la caja antes de cobrar.",
      P0002: "La caja de este pago ya fue cerrada.",
      P0003: "Esa cuenta ya está cerrada.",
      P0010: "No encontramos esa comanda.",
      P0014: "Ese pago supera lo que falta de la cuenta.",
    }[error.code];
    throw new Error(dicho || error.message);
  }
  return n(data);
}

/* Cuánta gente hay en la mesa. Sirve para el ticket por persona y para
   ver de un vistazo cuánta gente hay en el salón. */
export async function guardarComensales(comandaId, comensales) {
  const { error } = await supabase
    .from("operaciones")
    .update({ comensales: comensales > 0 ? Math.round(comensales) : null })
    .eq("id", comandaId).eq("estado", "abierta");
  if (error) throw error;
}

/* Cobrar la mesa. Los totales los calcula la base a partir de las líneas
   guardadas y no de lo que informe esta pantalla, que puede estar
   mirando una comanda de hace media hora. */
/* El descuento va en null y no en cero cuando nadie lo manda. La base
   trata lo que llega como pisada de lo guardado, así que mandar cero
   borraba el descuento que la mesa tenía pactado: se cobraba de más y
   sin que nadie se enterara. */
export async function cerrarComanda({ comandaId, sesionId, pagos, numero = null, descuento = null, recargo = 0 }) {
  const { data, error } = await supabase.rpc("cerrar_comanda", {
    p_comanda: comandaId,
    p_sesion: sesionId,
    p_pagos: pagos,
    p_numero: numero,
    p_descuento: descuento == null ? null : Math.round(descuento),
    p_recargo: Math.round(recargo || 0),
  });

  if (error) {
    if (error.code === "P0001") throw new Error("Abrí la caja antes de cobrar la mesa.");
    if (error.code === "P0003") throw new Error("Esa mesa ya fue cobrada.");
    if (error.code === "P0009") throw new Error("El descuento no puede ser mayor que la cuenta.");
    throw error;
  }
  return data;
}

/* La carta agrupada por categoría, que es como se busca un plato cuando
   hay gente esperando. */
export async function cargarCarta(empresaId) {
  const { data, error } = await supabase
    .from("items")
    .select("id, nombre, descripcion, categoria, precio, costo, iva, campos_extra, controla_stock, imagen")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("categoria")
    .order("nombre");

  if (error) throw error;

  const porCategoria = new Map();
  for (const i of data || []) {
    const cat = i.categoria || "Sin categoría";
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat).push({
      ...i,
      precio: n(i.precio),
      costo: n(i.costo),
      destino: (i.campos_extra && i.campos_extra.destino) || null,
    });
  }
  return [...porCategoria.entries()].map(([categoria, items]) => ({ categoria, items }));
}
