/* ============================================================
   LA CUENTA DE LAS PROMOCIONES (0102)
   ============================================================

   La hace el mostrador y no la base: se cobra sin internet y el ticket
   sale en el momento, con la promo ya descontada. Funciones puras, sin
   imports: se prueban sin base (scripts/probar-promociones.mjs).

   REGLAS, PARA QUE NO HAYA SORPRESAS EN LA CAJA
   ---------------------------------------------
   - Un renglón con el precio puesto a mano, o con precio por cantidad
     (las listas), no entra en promos: ya tiene su descuento, y dos
     descuentos sobre lo mismo es regalar mercadería.
   - Cada unidad entra en UNA sola promo. Se aplican en este orden: NxM,
     pack, segunda unidad, porcentaje; y dentro de cada clase, en el
     orden en que se crearon. Lo que una promo no usó (el cuarto producto
     de un 3x2) queda para la siguiente.
   - En un NxM o una segunda unidad, lo gratis o lo rebajado es lo más
     barato del grupo: con una Coca de $2.000 y una Sprite de $1.800 en
     un 2x1, se paga la Coca. Es como lo cobran todos.
   - NxM, segunda y pack van por unidades enteras: no aplican a lo que se
     vende por peso. El porcentaje sí.
   - El descuento de cada renglón se redondea a pesos, como toda la plata
     del sistema.
   ============================================================ */

const ORDEN = { nxm: 0, pack: 1, segunda: 2, porcentaje: 3 };

/* aaaa-mm-dd de una fecha, en la hora de este equipo (el mostrador). */
const diaDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function vigente(p, fecha = new Date()) {
  if (!p || p.activa === false) return false;
  const hoy = diaDe(fecha);
  if (p.desde && hoy < p.desde) return false;
  if (p.hasta && hoy > p.hasta) return false;
  const dias = p.dias || [];
  if (dias.length && !dias.includes(fecha.getDay())) return false;
  return true;
}

export function abarca(p, linea) {
  const a = p.alcance || {};
  return (a.productos || []).includes(linea.pid) || (!!linea.categoria && (a.rubros || []).includes(linea.categoria));
}

/* Lo que la promo le cuesta al comercio con tantas unidades, para
   mostrarlo en pantalla ("3x2: llevás 3, pagás 2"). */
export function describir(p) {
  const x = p.parametros || {};
  if (p.tipo === "nxm") return `${x.lleva}x${x.paga}`;
  if (p.tipo === "segunda") return `2da al ${x.pct}%`;
  if (p.tipo === "porcentaje") return `${x.pct}% off`;
  if (p.tipo === "pack") return `${x.cantidad} x ${Number(x.precio).toLocaleString("es-AR")}`;
  if (p.tipo === "medio") return `${x.pct}% pagando con ${x.medio}`;
  return p.nombre;
}

/* lineas: [{ lid, pid, qty, unit, categoria, unidad, elegible }]
   `unit` es el precio por unidad que se cobra hoy; `elegible` es false si
   tiene precio a mano o de lista.
   Devuelve { porLinea: { [lid]: { descuento, promos: [nombre] } },
              aplicadas: [{ id, nombre, descuento }], total } */
export function aplicarPromociones(lineas, promos, fecha = new Date()) {
  /* La de medio de pago no va por renglón: se aplica al cobrar
     (descuentoPorMedio), sobre el total. */
  const activas = (promos || []).filter((p) => p.tipo !== "medio" && vigente(p, fecha))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (ORDEN[a.p.tipo] - ORDEN[b.p.tipo]) || (a.i - b.i))
    .map((x) => x.p);

  /* Cada unidad entera, por separado. Lo que se vende por peso o la parte
     fraccionaria queda como "resto", que solo el porcentaje toca. */
  const unidades = [], restos = [];
  for (const l of lineas || []) {
    if (!l.elegible || !(l.unit > 0) || !(l.qty > 0)) continue;
    const porPeso = l.unidad === "kg" || !Number.isInteger(l.qty);
    if (porPeso) { restos.push({ l, cant: l.qty, usada: false }); continue; }
    for (let k = 0; k < l.qty; k++) unidades.push({ l, precio: l.unit, usada: false });
  }

  const porLinea = {}, aplicadas = [];
  const anotar = (l, monto, p) => {
    const x = (porLinea[l.lid] ||= { centavos: 0, promos: [] });
    x.centavos += Math.round(monto * 100);
    if (!x.promos.includes(p.nombre)) x.promos.push(p.nombre);
  };

  for (const p of activas) {
    const x = p.parametros || {};
    const libres = unidades.filter((u) => !u.usada && abarca(p, u.l)).sort((a, b) => b.precio - a.precio);
    let total = 0;
    const tomar = (u, monto) => { u.usada = true; if (monto > 0) { anotar(u.l, monto, p); total += monto; } };

    if (p.tipo === "nxm" || p.tipo === "segunda") {
      const n = p.tipo === "nxm" ? Number(x.lleva) : 2;
      for (let i = 0; i + n <= libres.length; i += n) {
        const grupo = libres.slice(i, i + n);           // de la más cara a la más barata
        grupo.forEach((u, j) => {
          if (p.tipo === "nxm") tomar(u, j >= Number(x.paga) ? u.precio : 0);
          else tomar(u, j === 1 ? u.precio * Number(x.pct) / 100 : 0);
        });
      }
    } else if (p.tipo === "pack") {
      const n = Number(x.cantidad);
      for (let i = 0; i + n <= libres.length; i += n) {
        const grupo = libres.slice(i, i + n);
        const suma = grupo.reduce((s, u) => s + u.precio, 0);
        const ahorro = suma - Number(x.precio);
        /* Un pack más caro que comprar suelto no se aplica. */
        if (ahorro <= 0) break;
        /* El ahorro, repartido en proporción al precio de cada unidad. */
        grupo.forEach((u) => tomar(u, ahorro * u.precio / suma));
      }
    } else if (p.tipo === "porcentaje") {
      for (const u of libres) tomar(u, u.precio * Number(x.pct) / 100);
      for (const r of restos) {
        if (r.usada || !abarca(p, r.l)) continue;
        r.usada = true;
        const monto = r.l.unit * r.cant * Number(x.pct) / 100;
        anotar(r.l, monto, p); total += monto;
      }
    }
    if (total > 0) aplicadas.push({ id: p.id, nombre: p.nombre, descuento: Math.round(total) });
  }

  const salida = {};
  let suma = 0;
  for (const [lid, v] of Object.entries(porLinea)) {
    const descuento = Math.round(v.centavos / 100);
    if (descuento > 0) { salida[lid] = { descuento, promos: v.promos }; suma += descuento; }
  }
  return { porLinea: salida, aplicadas, total: suma };
}

/* DESCUENTO POR MEDIO DE PAGO (0103)
   "10% pagando con débito los miércoles". Va sobre el total de la venta,
   después de las promos de producto y del descuento a mano, y antes del
   recargo del medio (que se calcula sobre lo que queda). Con varias que
   valgan para el mismo medio, la de mayor porcentaje: no se suman. No
   aplica a un pago combinado: con dos medios no hay uno solo al que
   hacerle el descuento. Devuelve { promo, pct, monto } o null. */
export function descuentoPorMedio(promos, medioK, base, fecha = new Date()) {
  if (!medioK || !(base > 0)) return null;
  const candidatas = (promos || []).filter((p) => p.tipo === "medio" && vigente(p, fecha) && (p.parametros || {}).medio === medioK);
  if (!candidatas.length) return null;
  const p = candidatas.sort((a, b) => Number(b.parametros.pct) - Number(a.parametros.pct))[0];
  const monto = Math.round(base * Number(p.parametros.pct) / 100);
  return monto > 0 ? { promo: p, pct: Number(p.parametros.pct), monto } : null;
}
