/* ============================================================
   CRM · a quién conviene escribirle esta semana
   ============================================================

   No es una base de contactos —eso ya es `clientes`— ni una casilla de
   mensajes. Es una lista de trabajo: cinco motivos concretos por los que
   vale la pena escribirle a alguien, con la persona ya elegida y el
   mensaje ya escrito.

   Los segmentos los arma `crm_segmentos` en la base. Ver la migración
   0043 para por qué se derivan y no se guardan.

   NADA SE MANDA SOLO
   ------------------
   El encargo lo dice y acá se respeta: la única integración de mensajería
   es abrir WhatsApp con el texto ya cargado. La persona lee, corrige si
   quiere y aprieta enviar. Un sistema que manda mensajes en nombre de un
   negocio sin que nadie los lea es una forma rápida de perder clientes.

   Por eso el texto es editable antes de abrir el chat, y por eso lo que
   queda registrado es lo que se mandó y no lo que la plantilla decía.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";
import { voz } from "./rubros.js";

const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";

/* ------------------------------------------------------------
   Los cinco motivos

   Cada uno trae su texto por defecto. No son plantillas guardadas —eso
   es de Comunicaciones— son el punto de partida, y están escritos como
   los escribiría alguien del mostrador: cortos, en primera persona y sin
   una sola palabra de sistema.

   `palabras` es lo que cambia por rubro: un estudio de pilates dice
   "clases" y un consultorio dice "sesiones". Sale de `rubros.voces`, el
   mismo mecanismo que VOZ_MESA en la comanda.
   ------------------------------------------------------------ */

export const SEGMENTOS = [
  {
    k: "se_van",
    n: "Hace rato que no vienen",
    d: "Venían seguido y dejaron de aparecer. Todavía se acuerdan del lugar.",
    tono: "mal",
    texto: (c, v) =>
      `Hola ${primerNombre(c.cliente)}! ¿Cómo va? Te escribo del estudio, ` +
      `hace un tiempo que no te vemos y queríamos saber cómo andás. ` +
      `Si querés retomar, decime qué días te quedan cómodos y te busco un lugar. ¡Un abrazo!`,
  },
  {
    k: "sin_segunda",
    n: "Vinieron una sola vez",
    d: "Probaron y no volvieron. Es donde se pierde un cliente y donde más barato sale recuperarlo.",
    tono: "ojo",
    texto: (c, v) =>
      `Hola ${primerNombre(c.cliente)}! ¿Cómo estás? Te escribo del estudio. ` +
      `Viniste una vez y quería saber qué te pareció, si hubo algo que no te cerró ` +
      `nos sirve un montón que nos lo digas. Y si querés volver, avisame y te reservo lugar.`,
  },
  {
    k: "abono_por_vencer",
    n: "Se les termina el abono",
    d: "Renovar antes de que se corte la rutina es mucho más fácil que después.",
    tono: "info",
    texto: (c, v) =>
      `Hola ${primerNombre(c.cliente)}! Te aviso que se te está por terminar el ${v.plan}. ` +
      `Si querés seguir con los mismos días lo renovamos y no perdés el lugar. ¿Lo dejo listo?`,
  },
  {
    k: "abono_vencido",
    n: "Se les venció y no renovaron",
    d: "Hace poco que se cortó. Todavía tienen la rutina fresca.",
    tono: "ojo",
    texto: (c, v) =>
      `Hola ${primerNombre(c.cliente)}! ¿Cómo va? Se te venció el ${v.plan} y no te vimos más por acá. ` +
      `¿Querés que te lo renueve y seguimos con los mismos horarios?`,
  },
  {
    k: "falta_seguido",
    n: "Reservan y no vienen",
    d: "Acá no hay nada que vender: hay algo que preguntar. Si nadie pregunta, el que se va es él.",
    tono: "tenue",
    texto: (c, v) =>
      `Hola ${primerNombre(c.cliente)}! ¿Cómo andás? Vi que se te complicó venir a varios ${v.turnos} ` +
      `de los últimos. ¿Te sirven los horarios que tenés o te busco otros? Así no perdés las ${v.clases}.`,
  },
];

export const segmentoPorK = (k) => SEGMENTOS.find((s) => s.k === k) || { k, n: k, d: "", tono: "tenue" };

export const RESULTADOS = [
  { k: "enviado", n: "Enviado", tono: "info" },
  { k: "respondio", n: "Contestó", tono: "acento" },
  { k: "volvio", n: "Volvió", tono: "bien" },
  { k: "sin_respuesta", n: "Sin respuesta", tono: "tenue" },
];

/* Las palabras del rubro, resueltas una vez. Sin rubro cargado devuelve
   las de fábrica, así una pantalla nueva anda desde el primer día. */
export function palabrasDe(rubro) {
  return {
    cliente: voz(rubro, "cliente", "cliente").toLowerCase(),
    turnos: voz(rubro, "turnos", "turnos").toLowerCase(),
    clases: voz(rubro, "clases", "clases").toLowerCase(),
    plan: "plan",
  };
}

/* El texto que se le propone a quien va a escribir. `plan` sale del
   motivo, que es donde está el nombre del abono: "Pack 8 clases · le
   quedan 2 clases". */
export function mensajeDe(segmento, fila, rubro) {
  const s = segmentoPorK(segmento);
  if (!s.texto) return "";
  const palabras = palabrasDe(rubro);
  const plan = String(fila.motivo || "").split("·")[0].trim() || palabras.plan;
  return s.texto(fila, { ...palabras, plan });
}

/* ------------------------------------------------------------
   Las lecturas
   ------------------------------------------------------------ */

export async function cargarSegmentos(empresaId) {
  if (!empresaId) throw new Error("cargarSegmentos necesita saber de qué comercio.");

  const { data, error } = await supabase.rpc("crm_segmentos", { p_empresa: empresaId });
  if (error) throw error;

  const filas = (data || []).map((f) => ({
    segmento: f.segmento,
    clienteId: f.cliente_id,
    cliente: f.cliente,
    tel: f.tel || "",
    motivo: f.motivo,
    dias: f.dias === null ? null : Number(f.dias),
    valor: Number(f.valor || 0),
    ultimoContacto: f.ultimo_contacto ? new Date(f.ultimo_contacto) : null,
  }));

  /* Se devuelve en el orden de SEGMENTOS y no en el que vino: el orden es
     una decisión —primero el que se está yendo, último el que falta— y no
     puede depender de cómo la base junte los UNION. */
  return SEGMENTOS.map((s) => ({
    ...s,
    gente: filas
      .filter((f) => f.segmento === s.k)
      .sort((a, b) => b.valor - a.valor),
  }));
}

/* Lo que se mandó, para poder decir si esto sirvió de algo. Sin la
   columna `resultado` marcada a mano el módulo no se puede evaluar: se
   sabe a cuántos se les escribió y a ninguno cuántos volvieron. */
export async function cargarContactos(empresaId, { clienteId = null, dias = 90 } = {}) {
  if (!empresaId) throw new Error("cargarContactos necesita saber de qué comercio.");

  let q = supabase
    .from("contactos")
    .select("id, cliente_id, motivo, canal, texto, resultado, fecha, clientes(razon_social)")
    .eq("empresa_id", empresaId)
    .gte("fecha", new Date(Date.now() - dias * 86400000).toISOString())
    .order("fecha", { ascending: false })
    .limit(500);

  if (clienteId) q = q.eq("cliente_id", clienteId);

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((f) => ({
    id: f.id,
    clienteId: f.cliente_id,
    cliente: (f.clientes && f.clientes.razon_social) || "",
    motivo: f.motivo,
    canal: f.canal,
    texto: f.texto || "",
    resultado: f.resultado,
    fecha: new Date(f.fecha),
  }));
}

/* ------------------------------------------------------------
   Las escrituras
   ------------------------------------------------------------ */

export async function anotarContacto({ empresaId, clienteId, motivo, canal = "whatsapp", texto = null }) {
  if (!empresaId) throw new Error("anotarContacto necesita saber de qué comercio.");

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("contactos").insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    motivo,
    canal,
    /* Se guarda lo que se mandó y no lo que decía la plantilla: si
       alguien lo reescribió entero, eso es lo que la persona leyó. */
    texto,
    usuario_id: user ? user.id : null,
  });
  if (error) throw error;
}

export async function marcarResultado(id, resultado) {
  const { error } = await supabase.from("contactos").update({ resultado }).eq("id", id);
  if (error) throw error;
}

/* "No molestar" vive en `campos_extra` del cliente y no en una tabla
   propia: es una marca que se pone cinco veces por año. Se lee entera y
   se reescribe entera para no pisar lo que haya guardado otro módulo. */
export async function noContactar(empresaId, clienteId, valor) {
  if (!empresaId) throw new Error("noContactar necesita saber de qué comercio.");

  const { data, error } = await supabase
    .from("clientes")
    .select("campos_extra")
    .eq("empresa_id", empresaId)
    .eq("id", clienteId)
    .single();
  if (error) throw error;

  const extra = { ...(data.campos_extra || {}) };
  if (valor) extra.noContactar = true;
  else delete extra.noContactar;

  const { error: e2 } = await supabase
    .from("clientes")
    .update({ campos_extra: extra })
    .eq("empresa_id", empresaId)
    .eq("id", clienteId);
  if (e2) throw e2;
}
