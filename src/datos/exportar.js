/* ============================================================
   EXPORTAR · "Descargar mis datos" (Ajustes → Mi cuenta)
   ============================================================

   Los términos dicen que los datos son del comercio y que puede pedir
   una copia (punto 9). Con esto la baja él mismo, sin escribirle a nadie.

   Tres hojas: productos, clientes y ventas de los últimos 12 meses. Los
   productos salen de lo que el sistema ya tiene en memoria (con el stock
   calculado, que en la base vive en una vista); clientes y ventas se leen
   de la base con la identidad de quien pide: RLS no deja leer más que lo
   del propio comercio.
   ============================================================ */

import { traerTodo } from "./items.js";

const fecha = (v) => (v ? new Date(v).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "");
const NOMBRE_TIPO = { venta: "Venta", comanda: "Venta (salón)", devolucion: "Devolución" };

export async function datosParaDescargar(empresaId, productos = []) {
  if (!empresaId) throw new Error("Falta el comercio.");
  const desde = new Date(Date.now() - 365 * 86400000).toISOString();

  const [clientes, ventas] = await Promise.all([
    traerTodo("clientes", "razon_social, tipo_doc, doc, condicion, domicilio, email, tel, limite_credito, activo, creado_en",
      (q) => q.eq("empresa_id", empresaId).order("razon_social")),
    traerTodo("operaciones", "fecha, numero, tipo, total, descuento, clientes ( razon_social ), pagos ( medio, monto )",
      (q) => q.eq("empresa_id", empresaId).in("tipo", ["venta", "comanda", "devolucion"]).eq("estado", "confirmada")
        .gte("fecha", desde).order("fecha", { ascending: false })),
  ]);

  return [
    {
      nombre: "Productos",
      anchos: [36, 14, 16, 20, 12, 12, 10, 8, 8],
      filas: [
        ["Nombre", "SKU", "Código de barras", "Categoría", "Costo", "Precio", "Stock", "Unidad", "Activo"],
        ...productos.map((p) => [p.nombre, p.sku || "", p.barcode || "", p.categoria || "", Number(p.costo) || 0, Number(p.precio) || 0,
          Number(p.stock) || 0, p.unidad || "", p.activo === false ? "No" : "Sí"]),
      ],
    },
    {
      nombre: "Clientes",
      anchos: [32, 8, 14, 14, 30, 28, 16, 12, 8, 18],
      filas: [
        ["Nombre", "Doc.", "Número", "Condición", "Domicilio", "Mail", "Teléfono", "Límite de crédito", "Activo", "Alta"],
        ...clientes.map((c) => [c.razon_social || "", c.tipo_doc || "", c.doc || "", c.condicion || "", c.domicilio || "", c.email || "",
          c.tel || "", Number(c.limite_credito) || 0, c.activo === false ? "No" : "Sí", fecha(c.creado_en)]),
      ],
    },
    {
      nombre: "Ventas (12 meses)",
      anchos: [20, 10, 14, 12, 12, 28, 30],
      filas: [
        ["Fecha", "Número", "Tipo", "Total", "Descuento", "Cliente", "Medios de pago"],
        ...ventas.map((v) => [fecha(v.fecha), v.numero || "", NOMBRE_TIPO[v.tipo] || v.tipo, Number(v.total) || 0, Number(v.descuento) || 0,
          v.clientes ? v.clientes.razon_social : "", (v.pagos || []).map((p) => `${p.medio} ${Number(p.monto)}`).join(", ")]),
      ],
    },
  ];
}
