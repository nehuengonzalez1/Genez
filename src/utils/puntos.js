/* ============================================================
   PUNTOS · las cuentas del mostrador (0112)
   ============================================================

   La base es la que suma y resta (el disparador de 0112). Acá está lo
   que el mostrador necesita saber antes: cuántos puntos se pueden usar
   en esta venta, cuánto descuentan, y cuántos va a sumar, para el
   ticket. Puro, sin base.
   ============================================================ */

export const PUNTOS_DE_FABRICA = { activo: false, pesosPorPunto: 1000, valorPunto: 10, minimo: 100, vencenMeses: 12 };

export const reglaDePuntos = (ajustes) => ({ ...PUNTOS_DE_FABRICA, ...((ajustes && ajustes.puntos) || {}) });

/* Lo que suma una compra: lo mismo que calcula la base. */
export const puntosGanados = (total, regla) =>
  regla.activo ? Math.floor(Math.max(0, Number(total) || 0) / Math.max(1, Number(regla.pesosPorPunto) || 1)) : 0;

/* Cuántos puntos se pueden usar en una venta: los que tiene, sin pasar lo
   que se puede descontar (un punto no se parte y la venta no queda en
   negativo). Por debajo del mínimo, ninguno. */
export function canjeMaximo(saldo, descontable, regla) {
  const valor = Number(regla.valorPunto) || 0;
  if (!regla.activo || !valor || !(saldo > 0) || saldo < (Number(regla.minimo) || 0)) return 0;
  return Math.max(0, Math.min(saldo, Math.floor(Math.max(0, descontable) / valor)));
}

export const valorDePuntos = (puntos, regla) => Math.round((Number(puntos) || 0) * (Number(regla.valorPunto) || 0));
