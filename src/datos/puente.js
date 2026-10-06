/* ============================================================
   PUENTE · lo que falta para ir de "vendí" a "me quedó" (06/10)
   ============================================================

   La venta neta y el costo ya los trae ventas_diarias_rango. Para el
   puente de Reportes faltan cuatro cosas del mismo período, y todas
   estaban guardadas:
   - descuentos: operaciones.descuento de las ventas confirmadas;
   - devoluciones: el total de las operaciones de tipo devolución;
   - cobrado por medio de pago: pagos de esas ventas, para calcular las
     comisiones con la configuración de hoy (comisionDe, con su IVA);
   - mermas: los movimientos de tipo merma, al costo de hoy.

   Las fechas se cortan en el día de Buenos Aires (-03:00), igual que la
   serie de la base. Con sucursal, todo se filtra por la sucursal de la
   operación (o del movimiento).
   ============================================================ */

import { traerTodo } from "./items.js";
import { diaISO } from "./ventas.js";

const limites = (desde, hasta) => {
  const fin = new Date(hasta); fin.setDate(fin.getDate() + 1);
  return { d: `${diaISO(desde)}T00:00:00-03:00`, h: `${diaISO(fin)}T00:00:00-03:00` };
};

export async function cargarPuente({ empresaId, desde, hasta, sucursal = null }) {
  if (!empresaId) throw new Error("cargarPuente necesita la empresa.");
  const { d, h } = limites(desde, hasta);
  const conSucursal = (q, col = "sucursal_id") => (sucursal ? q.eq(col, sucursal) : q);

  const [ops, pagos, mermas] = await Promise.all([
    traerTodo("operaciones", "tipo, total, descuento",
      (q) => conSucursal(q.eq("empresa_id", empresaId).in("tipo", ["venta", "comanda", "devolucion"]).eq("estado", "confirmada")
        .gte("fecha", d).lt("fecha", h))),
    traerTodo("pagos", "medio, monto, operaciones!inner ( tipo, estado, fecha, sucursal_id )",
      (q) => conSucursal(q.eq("empresa_id", empresaId).eq("operaciones.estado", "confirmada").in("operaciones.tipo", ["venta", "comanda"])
        .gte("operaciones.fecha", d).lt("operaciones.fecha", h), "operaciones.sucursal_id")),
    traerTodo("movimientos_stock", "cantidad, items ( costo )",
      (q) => conSucursal(q.eq("empresa_id", empresaId).eq("tipo", "merma").gte("fecha", d).lt("fecha", h))),
  ]);

  let descuentos = 0, devoluciones = 0;
  for (const o of ops) {
    if (o.tipo === "devolucion") devoluciones += Number(o.total) || 0;
    else descuentos += Number(o.descuento) || 0;
  }
  const cobradoPorMedio = {};
  for (const p of pagos) cobradoPorMedio[p.medio] = (cobradoPorMedio[p.medio] || 0) + (Number(p.monto) || 0);
  const mermasAlCosto = mermas.reduce((s, m) => s + Math.abs(Number(m.cantidad) || 0) * (m.items ? Number(m.items.costo) || 0 : 0), 0);

  return { descuentos: Math.round(descuentos), devoluciones: Math.round(devoluciones), cobradoPorMedio, mermas: Math.round(mermasAlCosto) };
}
