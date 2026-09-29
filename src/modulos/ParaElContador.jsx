/* ============================================================
   CAJA · PARA EL CONTADOR
   ============================================================

   Tres planillas de un mes, para mandarle al contador. Por qué estas y
   no el archivo del Libro IVA Digital: ver src/utils/planillasContador.js
   (desde noviembre de 2025 lo reemplaza IVA Simple, que ARCA precarga
   con las facturas electrónicas).

   Solo la ve quien puede ver costos: son las ventas de todo el mes y lo
   que se le pagó a cada proveedor, no algo para cualquier caja.
   ============================================================ */

import React, { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, Boton } from "../ui/Base.jsx";
import { medioPorK } from "../utils/helpers.js";
import { bajarExcel } from "../utils/planilla.js";
import { hojaComprobantes, hojasVentas, hojaCompras } from "../utils/planillasContador.js";
import { cargarComprobantesDelMes, cargarVentasDelMes, cargarDoceMeses, cargarComprasDelMes } from "../datos/contador.js";

const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/* Los últimos 13 meses, del más nuevo al más viejo: "aaaa-mm". El mes en
   curso primero, aunque esté a medias, porque es el que se mira para ir
   controlando. */
function mesesParaElegir() {
  const hoy = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}
const nombreDelMes = (mes) => { const [a, m] = mes.split("-"); return `${NOMBRE_MES[Number(m) - 1]} ${a}`; };

export function ParaElContador({ empresaId, ajustes, toast, modo }) {
  const meses = mesesParaElegir();
  /* De fábrica, el mes pasado: el que el contador está cerrando. */
  const [mes, setMes] = useState(meses[1]);
  const [bajando, setBajando] = useState(null);

  const bajar = async (cual) => {
    setBajando(cual);
    try {
      let hojas, nombre;
      if (cual === "comprobantes") {
        const lista = await cargarComprobantesDelMes(empresaId, mes, modo);
        if (!lista.length) return toast(`No hay comprobantes autorizados en ${nombreDelMes(mes)}.`, "mal");
        hojas = [hojaComprobantes(lista)];
        nombre = `comprobantes-emitidos-${mes}`;
      } else if (cual === "ventas") {
        const [v, doce] = await Promise.all([cargarVentasDelMes(empresaId, mes, modo), cargarDoceMeses(empresaId, mes, modo)]);
        hojas = hojasVentas({ ...v, meses: doce, nombreMedio: (k) => medioPorK(ajustes, k).n });
        nombre = `ventas-${mes}`;
      } else {
        const lista = await cargarComprasDelMes(empresaId, mes);
        if (!lista.length) return toast(`No hay compras cargadas en ${nombreDelMes(mes)}.`, "mal");
        hojas = [hojaCompras(lista)];
        nombre = `compras-${mes}`;
      }
      const formato = await bajarExcel(nombre, hojas);
      toast(formato === "xlsx" ? "Planilla descargada." : "Planilla descargada en CSV (Excel la abre igual).");
    } catch (e) {
      toast(e.message || "No se pudo armar la planilla.", "mal");
    } finally {
      setBajando(null);
    }
  };

  const boton = (cual, titulo, detalle) => (
    <li className="flex items-center gap-3 py-3">
      <FileSpreadsheet size={18} className="text-texto-tenue shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{titulo}</div>
        <div className="text-xs text-texto-tenue">{detalle}</div>
      </div>
      <Boton size="sm" variant="ghost" onClick={() => bajar(cual)} disabled={!!bajando}>
        {bajando === cual ? <Loader2 size={14} className="animate-spin" /> : "Bajar"}
      </Boton>
    </li>
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-borde">
        <div className="min-w-0">
          <h3 className="f-d text-lg">Para el contador</h3>
          <p className="text-xs text-texto-tenue mt-0.5">
            Las facturas electrónicas ya le llegan a ARCA solas (IVA Simple). Esto es para controlarlas y para lo que ARCA no ve.
          </p>
        </div>
        <select value={mes} onChange={(e) => setMes(e.target.value)}
          className="text-sm border border-borde rounded-lg px-2 py-1.5 bg-superficie outline-none focus:border-acento capitalize">
          {meses.map((m, i) => <option key={m} value={m}>{nombreDelMes(m)}{i === 0 ? " (en curso)" : ""}</option>)}
        </select>
      </div>
      <ul className="px-5 divide-y divide-borde">
        {boton("comprobantes", "Comprobantes emitidos", "Facturas y notas con su CAE o CAEA, y el IVA por alícuota. Para cruzar con lo que precargó ARCA.")}
        {boton("ventas", "Ventas totales", "Todo lo vendido por día, con los tickets, y los últimos 12 meses. Para el monotributo, es lo que define la categoría.")}
        {boton("compras", "Compras cargadas", "Lo que entró de cada proveedor. No es un libro de compras fiscal: no tiene letra, IVA ni percepciones.")}
      </ul>
    </Card>
  );
}
