/* ============================================================
   REPORTES A MEDIDA (0135)
   ============================================================

   El constructor de Informes: agrupar las ventas por hasta tres cosas,
   filtrar, y guardar el cuadro con un nombre. La cuenta la hace la base
   (reporte_a_medida), que solo acepta las dimensiones de su lista fija.

   Cada dimensión devuelve una clave que se ordena sola (AAAA-MM-DD,
   AAAA-MM, la hora con dos dígitos, el día de la semana 1 a 7). `etiqueta`
   la pone linda, y los filtros viajan con la clave, no con la etiqueta.
   ============================================================ */

import { supabase } from "./supabase.js";
import { diaISO } from "./ventas.js";

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/* `tiempo`: se ordena por la clave y no por la venta, y se grafica como
   una línea en el tiempo. `sigue`: a qué se baja al abrir una fila. */
export const DIMENSIONES = [
  { k: "mes", n: "Mes", tiempo: true, sigue: "semana" },
  { k: "semana", n: "Semana", tiempo: true, sigue: "dia" },
  { k: "dia", n: "Día", tiempo: true, sigue: "ticket" },
  { k: "dia_semana", n: "Día de la semana", tiempo: true, sigue: "hora" },
  { k: "hora", n: "Hora", tiempo: true, sigue: "ticket" },
  { k: "sucursal", n: "Sucursal", sigue: "categoria" },
  { k: "vendedor", n: "Vendedor", sigue: "ticket" },
  { k: "canal", n: "Canal", sigue: "categoria" },
  { k: "categoria", n: "Rubro", sigue: "producto" },
  { k: "marca", n: "Marca", sigue: "producto" },
  { k: "proveedor", n: "Proveedor", sigue: "producto" },
  { k: "producto", n: "Producto", sigue: "ticket" },
  { k: "cliente", n: "Cliente", sigue: "ticket" },
  { k: "ticket", n: "Ticket", sigue: null },
];
export const dimension = (k) => DIMENSIONES.find((d) => d.k === k) || { k, n: k };

export const METRICAS = [
  { k: "ventas", n: "Ventas", plata: true },
  { k: "ganancia", n: "Ganancia", plata: true },
  { k: "margen", n: "Margen", pct: true },
  { k: "unidades", n: "Unidades" },
  { k: "tickets", n: "Tickets" },
  { k: "ticketPromedio", n: "Ticket promedio", plata: true },
];

export function etiqueta(dim, clave) {
  if (clave == null) return "";
  if (dim === "dia") return `${DIAS[new Date(`${clave}T12:00:00`).getDay() || 7].slice(0, 3)} ${ddmm(clave)}`;
  if (dim === "semana") return `Semana del ${ddmm(clave)}`;
  if (dim === "mes") return `${MESES[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}`;
  if (dim === "dia_semana") return DIAS[Number(clave)] || clave;
  if (dim === "hora") return `${clave} h`;
  if (dim === "canal") return clave.charAt(0).toUpperCase() + clave.slice(1);
  return clave;
}

export async function correrReporte(empresaId, { desde, hasta, dims, filtros = {} }) {
  const { data, error } = await supabase.rpc("reporte_a_medida", {
    p_empresa: empresaId, p_desde: diaISO(desde), p_hasta: diaISO(hasta), p_dims: dims, p_filtros: filtros,
  });
  if (error) throw new Error(error.message || "No se pudo armar el reporte.");
  return (data || []).map((f) => {
    const ventas = Number(f.ventas) || 0, costo = Number(f.costo) || 0, tickets = Number(f.tickets) || 0;
    return {
      claves: [f.d1, f.d2, f.d3].slice(0, dims.length),
      ventas, costo, ganancia: ventas - costo, margen: ventas ? (ventas - costo) / ventas : 0,
      unidades: Number(f.unidades) || 0, tickets, ticketPromedio: tickets ? ventas / tickets : 0,
    };
  });
}

const aGuardado = (f) => ({ id: f.id, nombre: f.nombre, definicion: f.definicion || {}, usuarioId: f.usuario_id });

export async function cargarGuardados(empresaId) {
  const { data, error } = await supabase.from("reportes_guardados").select("id, nombre, definicion, usuario_id").eq("empresa_id", empresaId).order("nombre");
  if (error) throw error;
  return (data || []).map(aGuardado);
}

export async function guardarReporte(empresaId, nombre, definicion) {
  const { error } = await supabase.from("reportes_guardados").insert({ empresa_id: empresaId, nombre: nombre.trim(), definicion });
  if (error) throw new Error(error.message || "No se pudo guardar.");
}

export async function borrarReporte(id) {
  const { data, error } = await supabase.from("reportes_guardados").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message || "No se pudo borrar.");
  if (!data || !data.length) throw new Error("Solo lo puede borrar quien lo guardó, o quien configura el comercio.");
}
