/**
 * Lo común a api/mp/pagos.js y api/mp/conexion.js: de qué comercio es
 * quien llama, y el token de Mercado Pago de ese comercio (0091).
 *
 * El comercio sale del perfil de quien llama, preguntado con su propia
 * identidad. La plataforma no tiene comercio: nombra uno (el que está
 * "entrando como"), y se verifica que exista.
 */

import { createClient } from "@supabase/supabase-js";
import { descifrar } from "../arca/_cifrado.js";

export class ErrorMP extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

export async function comercioDe(req, empresaNombrada, { pideConfigurar = false } = {}) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !maestra) throw new ErrorMP("Faltan las variables de Supabase en el servidor.", 503);

  const token = (req.headers.authorization || "").replace(/^Bearer /i, "").trim();
  if (!token) throw new ErrorMP("Necesitás una sesión abierta.", 401);

  const admin = createClient(url, maestra, { auth: { persistSession: false, autoRefreshToken: false } });
  const suyo = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: sesion } = await admin.auth.getUser(token);
  if (!sesion || !sesion.user) throw new ErrorMP("La sesión no es válida o venció.", 401);
  const { data: yo } = await suyo.from("perfiles").select("id, empresa_id, es_plataforma, activo").eq("id", sesion.user.id).single();
  if (!yo || !yo.activo) throw new ErrorMP("No se encontró tu perfil.", 403);

  let empresaId;
  if (yo.es_plataforma) {
    const { data: emp } = empresaNombrada
      ? await suyo.from("empresas").select("id").eq("id", empresaNombrada).maybeSingle()
      : { data: null };
    if (!emp) throw new ErrorMP("Falta decir en qué comercio.", 400);
    empresaId = emp.id;
  } else {
    empresaId = yo.empresa_id;
    if (pideConfigurar) {
      const { data: puede } = await suyo.rpc("permiso", { p_clave: "configurar" });
      if (puede !== true) throw new ErrorMP("Conectar Mercado Pago necesita el permiso de configurar el comercio.", 403);
    }
  }
  return { admin, empresaId, yo };
}

/* El token del comercio, descifrado, y el id de su cuenta. null si no
   conectó ninguna. */
export async function credencialDe(admin, empresaId) {
  const { data, error } = await admin.from("mp_credenciales").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { token: descifrar(data.token_cifrado), cuentaId: data.cuenta_id, fila: data };
}

/* Le pregunta a Mercado Pago de quién es un token. Es la prueba de que
   anda: un token mal copiado o vencido contesta 401. */
export async function cuentaDe(token) {
  const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) throw new ErrorMP("Mercado Pago no aceptó ese token. Revisá que sea el Access Token de producción, completo.", 400);
  if (!r.ok) throw new ErrorMP(`Mercado Pago no contestó (${r.status}). Probá de nuevo en un rato.`, 502);
  const d = await r.json();
  const nombre = [d.first_name, d.last_name].filter(Boolean).join(" ") || d.nickname || null;
  return { id: String(d.id), nombre, email: d.email || null, apodo: d.nickname || null };
}
