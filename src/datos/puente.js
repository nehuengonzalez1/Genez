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

   De las mismas operaciones salen, sin otra consulta, las ventas por
   hora y por día de la semana y las de cada vendedor (quien cobró:
   operaciones.usuario_id). La hora y el día son los de Buenos Aires.

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

/* Hora (0–23) y día de la semana (0 = lunes) en Buenos Aires. */
const enBuenosAires = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23", weekday: "short" });
const DIA = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function cuando(fecha) {
  const partes = Object.fromEntries(enBuenosAires.formatToParts(new Date(fecha)).map((p) => [p.type, p.value]));
  return { hora: Number(partes.hour) % 24, dia: DIA[partes.weekday] ?? 0 };
}

export async function cargarPuente({ empresaId, desde, hasta, sucursal = null }) {
  if (!empresaId) throw new Error("cargarPuente necesita la empresa.");
  const { d, h } = limites(desde, hasta);
  const conSucursal = (q, col = "sucursal_id") => (sucursal ? q.eq(col, sucursal) : q);

  const [ops, pagos, mermas] = await Promise.all([
    /* Dos claves unen operaciones con perfiles (quien vendió y quien la
       actualizó): hay que nombrar cuál. */
    traerTodo("operaciones", "tipo, total, descuento, fecha, usuario_id, perfiles!operaciones_usuario_id_fkey ( nombre )",
      (q) => conSucursal(q.eq("empresa_id", empresaId).in("tipo", ["venta", "comanda", "devolucion"]).eq("estado", "confirmada")
        .gte("fecha", d).lt("fecha", h))),
    traerTodo("pagos", "medio, monto, operaciones!inner ( tipo, estado, fecha, sucursal_id )",
      (q) => conSucursal(q.eq("empresa_id", empresaId).eq("operaciones.estado", "confirmada").in("operaciones.tipo", ["venta", "comanda"])
        .gte("operaciones.fecha", d).lt("operaciones.fecha", h), "operaciones.sucursal_id")),
    traerTodo("movimientos_stock", "cantidad, items ( costo )",
      (q) => conSucursal(q.eq("empresa_id", empresaId).eq("tipo", "merma").gte("fecha", d).lt("fecha", h))),
  ]);

  let descuentos = 0, devoluciones = 0;
  const porHora = Array.from({ length: 24 }, (_, i) => ({ hora: i, ventas: 0, tickets: 0 }));
  const porDia = Array.from({ length: 7 }, (_, i) => ({ dia: i, ventas: 0, tickets: 0 }));
  const vendedores = {};
  for (const o of ops) {
    const total = Number(o.total) || 0;
    if (o.tipo === "devolucion") { devoluciones += total; continue; }
    const desc = Number(o.descuento) || 0;
    descuentos += desc;
    const { hora, dia } = cuando(o.fecha);
    porHora[hora].ventas += total; porHora[hora].tickets += 1;
    porDia[dia].ventas += total; porDia[dia].tickets += 1;
    const k = o.usuario_id || "sin";
    const v = vendedores[k] || (vendedores[k] = { id: o.usuario_id, nombre: (o.perfiles && o.perfiles.nombre) || "Sin usuario", ventas: 0, tickets: 0, descuentos: 0 });
    v.ventas += total; v.tickets += 1; v.descuentos += desc;
  }
  const cobradoPorMedio = {};
  for (const p of pagos) cobradoPorMedio[p.medio] = (cobradoPorMedio[p.medio] || 0) + (Number(p.monto) || 0);
  const mermasAlCosto = mermas.reduce((s, m) => s + Math.abs(Number(m.cantidad) || 0) * (m.items ? Number(m.items.costo) || 0 : 0), 0);

  return {
    descuentos: Math.round(descuentos), devoluciones: Math.round(devoluciones), cobradoPorMedio, mermas: Math.round(mermasAlCosto),
    porHora, porDia,
    /* El descuento promedio es sobre lo que se hubiera cobrado sin él. */
    vendedores: Object.values(vendedores)
      .map((v) => ({ ...v, ticketPromedio: v.tickets ? v.ventas / v.tickets : 0, descuentoPromedio: v.ventas + v.descuentos ? v.descuentos / (v.ventas + v.descuentos) : 0 }))
      .sort((a, b) => b.ventas - a.ventas),
  };
}
