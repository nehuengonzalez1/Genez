/* ============================================================
   Los indicadores financieros de Genez (Founder, 0118)
   ============================================================

   Puros, sin pantalla ni base: se prueban en node
   (scripts/probar-indicadores-genez.mjs). Todas las fechas son días
   "AAAA-MM-DD" de Buenos Aires y los meses, "AAAA-MM".

   Solo pesos. Lo que está en dólares no se convierte (no hay una
   cotización que sea "la" correcta): se informa aparte.

   LAS DEFINICIONES (las mismas que muestra la pantalla)
   ------------------------------------------------------
   Ingresos del mes     lo devengado: ingresos cuyo período es ese mes, sin anulados.
   Cobrado del mes      ingresos pagados con fecha de pago en ese mes. Es plata.
   Gastos del mes       lo devengado: gastos cuyo período es ese mes, sin anulados.
   Pagado del mes       gastos pagados con fecha de pago en ese mes.
   Flujo de caja        cobrado menos pagado del mes.
   Resultado            ingresos del mes menos gastos del mes (devengado).
   Por cobrar / pagar   todo lo pendiente, de cualquier mes; aparte, lo vencido.
   MRR                  la suma de las suscripciones activas en pesos a una fecha,
                        armada con su historial de cambios. Es lo contratado, no lo cobrado.
   Nuevas / bajas       suscripciones que empezaron o se dieron de baja en el mes, y su MRR.
   Expansión            lo que subieron en el mes las suscripciones que siguieron activas;
                        contracción, lo que bajaron.
   Costos fijos         gastos marcados como fijos, devengados en el mes.
   Punto de equilibrio  cuántas suscripciones al precio promedio de hoy pagan los costos
                        fijos del último mes completo. No incluye costos variables.
   Proyección           para cada uno de los próximos meses: el MRR de hoy (sin las que
                        ya tienen fecha de baja antes) más lo pendiente que vence ese mes
                        y no es de una suscripción. Supone que nada cambia.
   ============================================================ */

const suma = (xs, f = (x) => x) => xs.reduce((s, x) => s + Number(f(x) || 0), 0);
export const mesDe = (dia) => (dia ? String(dia).slice(0, 7) : null);
export const primerDia = (mes) => `${mes}-01`;
export function ultimoDia(mes) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
export function mesMas(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const vivos = (movs) => movs.filter((m) => m.estado !== "anulado" && m.moneda !== "USD");

/* El estado de cada suscripción a un día, según su historial: el último
   cambio con fecha menor o igual. Sin cambios hasta ese día, no existía. */
export function suscripcionesAl(dia, cambios) {
  const ultimo = {};
  for (const c of [...cambios].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))) {
    if (c.fecha <= dia) ultimo[c.suscripcionId] = c;
  }
  return ultimo;
}
export function mrrAl(dia, cambios, suscripciones) {
  const monedas = Object.fromEntries(suscripciones.map((s) => [s.id, s.moneda]));
  return suma(Object.values(suscripcionesAl(dia, cambios)).filter((c) => c.estadoDespues === "activa" && monedas[c.suscripcionId] !== "USD"), (c) => c.importeDespues);
}

export function indicadoresDelMes(mes, { movimientos, cambios, suscripciones, cuentas, hoy }) {
  const ini = primerDia(mes), fin = ultimoDia(mes);
  const v = vivos(movimientos);
  const ing = v.filter((m) => m.tipo === "ingreso"), gas = v.filter((m) => m.tipo === "gasto");
  const enMes = (d) => d && d >= ini && d <= fin;
  const monedas = Object.fromEntries(suscripciones.map((s) => [s.id, s.moneda]));
  const delMes = cambios.filter((c) => enMes(c.fecha) && monedas[c.suscripcionId] !== "USD");

  const ingresos = suma(ing.filter((m) => mesDe(m.periodo) === mes), (m) => m.importe);
  const cobrado = suma(ing.filter((m) => m.estado === "pagado" && enMes(m.fechaPago)), (m) => m.importe);
  const gastos = suma(gas.filter((m) => mesDe(m.periodo) === mes), (m) => m.importe);
  const pagado = suma(gas.filter((m) => m.estado === "pagado" && enMes(m.fechaPago)), (m) => m.importe);
  const pendIng = ing.filter((m) => m.estado === "pendiente"), pendGas = gas.filter((m) => m.estado === "pendiente");

  const nuevas = delMes.filter((c) => c.estadoAntes == null && c.estadoDespues === "activa");
  const bajas = delMes.filter((c) => c.estadoDespues === "baja" && c.estadoAntes !== "baja");
  const siguen = delMes.filter((c) => c.estadoAntes === "activa" && c.estadoDespues === "activa" && c.importeAntes != null);
  const expansion = suma(siguen.filter((c) => Number(c.importeDespues) > Number(c.importeAntes)), (c) => c.importeDespues - c.importeAntes);
  const contraccion = suma(siguen.filter((c) => Number(c.importeDespues) < Number(c.importeAntes)), (c) => c.importeAntes - c.importeDespues);

  return {
    ingresos, cobrado, gastos, pagado, flujo: cobrado - pagado, resultado: ingresos - gastos,
    porCobrar: suma(pendIng, (m) => m.importe), porCobrarVencido: suma(pendIng.filter((m) => m.vencimiento && m.vencimiento < hoy), (m) => m.importe),
    porPagar: suma(pendGas, (m) => m.importe), porPagarVencido: suma(pendGas.filter((m) => m.vencimiento && m.vencimiento < hoy), (m) => m.importe),
    mrrInicio: mrrAl(ini < hoy ? diaAntes(ini) : hoy, cambios, suscripciones), mrrFin: mrrAl(fin < hoy ? fin : hoy, cambios, suscripciones),
    nuevas: nuevas.length, mrrNuevo: suma(nuevas, (c) => c.importeDespues),
    bajas: bajas.length, mrrPerdido: suma(bajas, (c) => c.importeAntes), expansion, contraccion,
    costosFijos: suma(gas.filter((m) => m.fijo && mesDe(m.periodo) === mes), (m) => m.importe),
    saldo: suma(cuentas.filter((k) => k.activa && k.moneda !== "USD"), (k) => k.saldo),
    enDolares: movimientos.filter((m) => m.moneda === "USD" && m.estado !== "anulado" && mesDe(m.periodo) === mes).length,
  };
}
function diaAntes(dia) { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }

/* Cuántas suscripciones al precio promedio de hoy pagan los costos fijos. */
export function puntoDeEquilibrio(costosFijos, suscripciones) {
  const activas = suscripciones.filter((s) => s.estado === "activa" && s.moneda !== "USD" && Number(s.importeMensual) > 0);
  if (!costosFijos) return { costosFijos: 0, promedio: null, necesarias: 0, activas: activas.length };
  if (!activas.length) return { costosFijos, promedio: null, necesarias: null, activas: 0 };
  const promedio = suma(activas, (s) => s.importeMensual) / activas.length;
  return { costosFijos, promedio, necesarias: Math.ceil(costosFijos / promedio), activas: activas.length };
}

/* Los próximos meses si nada cambia. */
export function proyeccion(desdeMes, meses, { movimientos, suscripciones }) {
  return Array.from({ length: meses }, (_, i) => {
    const mes = mesMas(desdeMes, i + 1);
    const ini = primerDia(mes);
    const recurrente = suma(suscripciones.filter((s) => s.estado === "activa" && s.moneda !== "USD" && s.inicio <= ultimoDia(mes) && (!s.fin || s.fin >= ini)), (s) => s.importeMensual);
    const otros = suma(vivos(movimientos).filter((m) => m.tipo === "ingreso" && m.estado === "pendiente" && !m.suscripcionId && mesDe(m.vencimiento) === mes), (m) => m.importe);
    return { mes, recurrente, otros, total: recurrente + otros };
  });
}
