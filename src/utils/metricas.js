/* ============================================================
   MÉTRICAS · una sola definición para cada número (06/10)
   ============================================================

   "Margen", "ticket promedio", "venta neta" tienen que dar lo mismo en
   Inicio, Reportes, Finanzas y el asistente. Hasta ahora cada pantalla
   hacía su cuenta: Inicio calcula el margen a valores de hoy (precios y
   costos actuales sobre lo vendido) y Reportes el margen real de lo que
   se vendió, con el costo de ese momento. Las dos están bien y están
   rotuladas, pero son dos fórmulas escritas en dos lugares. Desde acá,
   cada número nuevo se calcula con estas funciones, y si una definición
   cambia, cambia en un solo lugar.

   Las definiciones:
   - Venta neta: lo cobrado, con los descuentos ya restados y menos lo
     devuelto (es lo que da ventas_diarias en la base).
   - Venta bruta: la neta más los descuentos y lo devuelto.
   - Ganancia bruta: venta neta menos el costo de lo vendido (el costo
     unitario guardado en cada renglón al venderse).
   - Margen: ganancia bruta sobre venta neta.
   - Ticket promedio: venta neta sobre cantidad de ventas (sin contar las
     devoluciones como ventas).
   - Lo que queda: ganancia bruta menos comisiones de los medios de pago
     (con su IVA si lo tienen) y menos las mermas al costo. No incluye
     gastos fijos (alquiler, sueldos): Genez todavía no los conoce.
   ============================================================ */

export const margen = (ventas, costo) => (ventas ? (ventas - costo) / ventas : 0);
export const ganancia = (ventas, costo) => ventas - costo;
export const ticketPromedio = (ventas, tickets) => (tickets ? ventas / tickets : 0);
export const porTicket = (unidades, tickets) => (tickets ? unidades / tickets : 0);

/* La variación contra el período anterior. null cuando no hay con qué
   comparar: "+∞%" no le dice nada a nadie. */
export const variacion = (actual, anterior) => (anterior ? (actual - anterior) / Math.abs(anterior) : null);

/* La diferencia de dos porcentajes, en puntos (0,03 = 3 puntos). */
export const puntos = (actual, anterior) => (anterior == null ? null : actual - anterior);

/* El puente: de lo que se hubiera cobrado sin descuentos a lo que queda.
   `ventasNetas` y `costo` salen de la serie diaria; lo demás, de
   cargarPuente (src/datos/puente.js). Devuelve los escalones en orden. */
export function puenteDeRentabilidad({ ventasNetas, costo, descuentos, devoluciones, comisiones, mermas }) {
  const bruta = ventasNetas + descuentos + devoluciones;
  const bruto = ganancia(ventasNetas, costo);
  const queda = bruto - comisiones - mermas;
  return {
    pasos: [
      { k: "bruta", n: "Ventas sin descuentos", valor: bruta, tipo: "total" },
      { k: "descuentos", n: "Descuentos", valor: -descuentos },
      { k: "devoluciones", n: "Devoluciones", valor: -devoluciones },
      { k: "netas", n: "Ventas netas", valor: ventasNetas, tipo: "subtotal" },
      { k: "costo", n: "Costo de lo vendido", valor: -costo },
      { k: "bruto", n: "Ganancia bruta", valor: bruto, tipo: "subtotal" },
      { k: "comisiones", n: "Comisiones de cobro", valor: -comisiones },
      { k: "mermas", n: "Mermas", valor: -mermas },
      { k: "queda", n: "Lo que queda", valor: queda, tipo: "total" },
    ],
    queda,
    margenFinal: margen(ventasNetas, ventasNetas - queda),
  };
}

/* La matriz de productos: cuánto se vende contra cuánto deja. El corte de
   venta es la mediana de los que vendieron algo (la mitad de arriba es
   "vende mucho"); el de margen, el margen de todo el período (arriba de
   eso, "deja mucho"). Con referencias del propio comercio y no números
   fijos: un 30% es mucho para un almacén y poco para una ferretería. */
export const CUADRANTES = [
  { k: "estrella", n: "Estrellas", d: "Venden mucho y dejan mucho: cuidar el stock y el precio." },
  { k: "volumen", n: "Volumen", d: "Venden mucho y dejan poco: revisar el precio o el costo." },
  { k: "rentable", n: "Rentables", d: "Venden poco y dejan mucho: darles más lugar o promoción." },
  { k: "problema", n: "Problema", d: "Venden poco y dejan poco: pensar si vale la pena tenerlos." },
];

export function matrizDeProductos(items, margenDelPeriodo) {
  const conVenta = items.filter((p) => p.venta > 0);
  if (!conVenta.length) return { corteVenta: 0, corteMargen: margenDelPeriodo, grupos: Object.fromEntries(CUADRANTES.map((c) => [c.k, []])) };
  const ordenadas = conVenta.map((p) => p.venta).sort((a, b) => a - b);
  const medio = Math.floor(ordenadas.length / 2);
  const corteVenta = ordenadas.length % 2 ? ordenadas[medio] : (ordenadas[medio - 1] + ordenadas[medio]) / 2;
  const grupos = Object.fromEntries(CUADRANTES.map((c) => [c.k, []]));
  for (const p of conVenta) {
    const mucho = p.venta >= corteVenta;
    const deja = p.margen >= margenDelPeriodo;
    grupos[mucho ? (deja ? "estrella" : "volumen") : (deja ? "rentable" : "problema")].push(p);
  }
  for (const k of Object.keys(grupos)) grupos[k].sort((a, b) => b.venta - a.venta);
  return { corteVenta, corteMargen: margenDelPeriodo, grupos };
}
