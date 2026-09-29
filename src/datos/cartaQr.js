/* ============================================================
   LA CARTA QR (0104)
   ============================================================

   La página pública de la mesa habla con la base solo por dos
   funciones: leer la carta y pedir. Ninguna tabla está abierta a quien
   escanea el QR. El precio no viaja desde el teléfono: la base lo pone.
   ============================================================ */

import { supabase } from "./supabase.js";

/* null si el código no es de ninguna mesa (o el comercio está
   suspendido). */
export async function cargarCartaDeMesa(token) {
  const { data, error } = await supabase.rpc("carta_de_la_mesa", { p_token: token });
  if (error) throw error;
  if (!data) return null;
  const porCategoria = new Map();
  for (const i of data.items || []) {
    if (!porCategoria.has(i.categoria)) porCategoria.set(i.categoria, []);
    porCategoria.get(i.categoria).push({ ...i, precio: Number(i.precio) });
  }
  return { comercio: data.comercio, mesa: data.mesa, secciones: [...porCategoria.entries()].map(([categoria, items]) => ({ categoria, items })) };
}

/* lineas: [{ itemId, cantidad, notas }] */
export async function pedirDesdeLaMesa(token, lineas, nombre) {
  const { data, error } = await supabase.rpc("pedir_desde_la_mesa", {
    p_token: token,
    p_lineas: lineas.map((l) => ({ item_id: l.itemId, cantidad: l.cantidad, notas: l.notas || "" })),
    p_nombre: nombre || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/* Deja inservibles los QR impresos de esa mesa (pide configurar). */
export async function renovarQr(recursoId) {
  const { data, error } = await supabase.rpc("renovar_qr", { p_recurso: recursoId });
  if (error) throw new Error(error.message);
  return data;
}

/* El link que va en el QR. Sale del sistema de gestión, que es donde se
   imprimen, y apunta a la app del cliente (vercel.json: /cliente). */
export const linkDeMesa = (token, origen = window.location.origin) => `${origen}/cliente?mesa=${token}`;
