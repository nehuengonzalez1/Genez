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

/* ------------------------------------------------------------
   Objetivos del mes (06/10)

   El comercio fija uno por mes en Ajustes (ventas, margen, ticket). La
   proyección es el ritmo del mes hasta hoy llevado al mes entero: si en
   10 días de 30 se vendió $1M, al cierre serían $3M. No es una promesa,
   es "a este ritmo".
   ------------------------------------------------------------ */
export function proyeccionDelMes(acumulado, diaDelMes, diasDelMes) {
  return diaDelMes ? (acumulado / diaDelMes) * diasDelMes : 0;
}

/* ------------------------------------------------------------
   Clientes por cuándo compran, cuántas veces y cuánto (RFM, 06/10)

   Sobre el último año. Las reglas, en orden (gana la primera que cumple):
   - Sin compras: nunca compró identificado.
   - Perdido: no compra hace más de 120 días.
   - Nuevo: su primera compra fue en los últimos 30 días y compró una o
     dos veces. Si el comercio tiene menos de 60 días de historia no hay
     nuevos: para el sistema todos compraron por primera vez hace poco
     (lo que pasó con Super 25, que empezó en septiembre).
   - En riesgo: compraba (2 o más veces) y hace entre 45 y 120 días que no.
   - VIP: está entre el 20% que más gastó y compró en los últimos 45 días.
   - Fiel: compró 3 o más veces y la última hace 45 días o menos.
   - Ocasional: el resto.
   Días fijos y no relativos: "hace 4 meses que no viene" quiere decir lo
   mismo en cualquier comercio. El corte de VIP sí es del comercio.
   ------------------------------------------------------------ */
export const SEGMENTOS = [
  { k: "vip", n: "VIP", uno: "VIP", d: "Los que más gastan y siguen viniendo", tono: "acento" },
  { k: "fiel", n: "Fieles", uno: "Fiel", d: "Compran seguido", tono: "bien" },
  { k: "nuevo", n: "Nuevos", uno: "Nuevo", d: "Primera compra este mes", tono: "info" },
  { k: "riesgo", n: "En riesgo", uno: "En riesgo", d: "Compraban y hace más de 45 días que no", tono: "ojo" },
  { k: "perdido", n: "Perdidos", uno: "Perdido", d: "Más de 120 días sin comprar", tono: "mal" },
  { k: "ocasional", n: "Ocasionales", uno: "Ocasional", d: "Compran de vez en cuando", tono: "tenue" },
  { k: "sin", n: "Sin compras", uno: "Sin compras", d: "Nunca compraron identificados", tono: "tenue" },
];

export function corteVip(gastos) {
  const ordenados = gastos.filter((g) => g > 0).sort((a, b) => b - a);
  if (!ordenados.length) return Infinity;
  return ordenados[Math.max(0, Math.ceil(ordenados.length * 0.2) - 1)];
}

/* `dias`: desde la última compra (o turno); null si nunca. `diasPrimera`:
   desde la primera del año. */
export function segmentoRfm({ dias, diasPrimera, compras, gastado }, vip, hayHistoria = true) {
  if (dias == null || !compras) return "sin";
  if (dias > 120) return "perdido";
  if (hayHistoria && diasPrimera != null && diasPrimera <= 30 && compras <= 2) return "nuevo";
  if (dias > 45 && compras >= 2) return "riesgo";
  if (gastado >= vip && dias <= 45) return "vip";
  if (compras >= 3 && dias <= 45) return "fiel";
  return "ocasional";
}
