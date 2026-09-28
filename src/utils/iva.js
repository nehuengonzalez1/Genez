/* ============================================================
   EL IVA DE UN COMPROBANTE, POR ALÍCUOTA
   ============================================================

   Paso 2 de la factura A y B. Una función pura: recibe los renglones de
   una venta (o de una devolución, o de una nota) y el total cobrado, y
   devuelve cuánto es neto, cuánto IVA, cuánto exento y cuánto no gravado,
   separado por alícuota como lo pide ARCA. No habla con la base ni con
   ARCA: la usa el servidor para armar el pedido y la va a usar el papel
   para imprimir lo mismo que se informó.

   Sin imports a propósito: la importa una función de Vercel, y
   helpers.js arrastra el generador del prototipo.

   LOS PRECIOS YA TRAEN EL IVA
   ---------------------------
   En Genez el precio de góndola es el final, así que el IVA se saca de
   adentro: neto = importe ÷ (1 + alícuota). No se suma arriba.

   EL DESCUENTO Y EL RECARGO, REPARTIDOS EN PROPORCIÓN
   ---------------------------------------------------
   Viven en la operación, no en el renglón (el recargo de la tarjeta, el
   10% de toda la compra). Se reparten entre las alícuotas en proporción a
   lo que suma cada una, con el mismo criterio que la devolución (0089:
   total ÷ subtotal), para que una nota de crédito calcule igual que su
   factura. PENDIENTE: que lo confirme un contador. Es lo habitual, pero
   es la única decisión fiscal de este archivo.

   TODO EN CENTAVOS ENTEROS, Y QUE CIERRE EXACTO
   ---------------------------------------------
   ARCA rechaza un comprobante cuyo total no sea exactamente la suma de
   sus partes. Con decimales de JavaScript, 0,1 + 0,2 no da 0,3. Así que
   se trabaja en centavos enteros y cada reparto deja el resto en quien
   tenga el mayor decimal (método del mayor resto): la suma siempre es el
   total, al centavo. Y el IVA de cada alícuota es su importe menos su
   neto, no neto × alícuota redondeado: así neto + IVA es el importe
   exacto, y el IVA queda a menos de un centavo de neto × alícuota.
   ============================================================ */

/* Los códigos de alícuota de ARCA (tabla "Alícuotas de IVA" de WSFEv1). */
export const ID_ALICUOTA = { 0: 3, 2.5: 9, 5: 8, 10.5: 4, 21: 5, 27: 6 };

const CONDICIONES = ["gravado", "exento", "no_gravado"];

const aCentavos = (x) => Math.round(Number(x) * 100);
const aPesos = (c) => c / 100;

export class ErrorIva extends Error {}

/* Reparte `total` centavos en proporción a `pesos`, sin perder ni
   inventar un centavo. */
function repartir(total, pesos) {
  const suma = pesos.reduce((s, p) => s + p, 0);
  if (!suma) return pesos.map(() => 0);
  const exactos = pesos.map((p) => (total * p) / suma);
  const partes = exactos.map((x) => Math.floor(x));
  let falta = total - partes.reduce((s, p) => s + p, 0);
  const orden = exactos.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; falta > 0; k = (k + 1) % orden.length, falta--) partes[orden[k][1]]++;
  return partes;
}

/* renglones: [{ total, iva, ivaCondicion }] — `total` es lo cobrado por
   el renglón, IVA incluido, antes del descuento o recargo de la operación.
   total: lo que se cobró por la operación entera.

   Devuelve pesos con dos decimales:
   { total, neto, iva, exento, noGravado,
     alicuotas: [{ id, alicuota, base, importe }] }
   `neto` es la suma de las bases gravadas (incluida la del 0%), que es el
   ImpNeto de ARCA. */
export function desglosarIva(renglones, total) {
  const totalC = aCentavos(total);
  if (!Number.isFinite(totalC) || totalC < 0) throw new ErrorIva("El total del comprobante no es válido.");

  /* Agrupados por condición y alícuota, que es como los informa ARCA. */
  const grupos = new Map();
  for (const r of renglones || []) {
    const condicion = r.ivaCondicion || "gravado";
    if (!CONDICIONES.includes(condicion)) throw new ErrorIva(`Condición de IVA desconocida: ${condicion}.`);
    const alicuota = condicion === "gravado" ? Number(r.iva) : 0;
    if (condicion === "gravado" && ID_ALICUOTA[alicuota] === undefined) {
      throw new ErrorIva(`La alícuota ${r.iva}% no existe en ARCA.`);
    }
    const importe = aCentavos(r.total);
    if (!Number.isFinite(importe) || importe < 0) throw new ErrorIva("Un renglón tiene un importe que no es válido.");
    const clave = `${condicion}:${alicuota}`;
    const g = grupos.get(clave) || { condicion, alicuota, importe: 0 };
    g.importe += importe;
    grupos.set(clave, g);
  }

  const lista = [...grupos.values()];
  const subtotal = lista.reduce((s, g) => s + g.importe, 0);
  if (!subtotal && totalC) throw new ErrorIva("El comprobante tiene importe pero ningún renglón con importe.");

  /* El descuento y el recargo de la operación, repartidos. */
  const finales = repartir(totalC, lista.map((g) => g.importe));

  let neto = 0, iva = 0, exento = 0, noGravado = 0;
  const alicuotas = [];
  lista.forEach((g, i) => {
    const importe = finales[i];
    if (g.condicion === "exento") { exento += importe; return; }
    if (g.condicion === "no_gravado") { noGravado += importe; return; }
    const base = Math.round(importe / (1 + g.alicuota / 100));
    const impuesto = importe - base;
    neto += base;
    iva += impuesto;
    alicuotas.push({ id: ID_ALICUOTA[g.alicuota], alicuota: g.alicuota, base: aPesos(base), importe: aPesos(impuesto) });
  });
  alicuotas.sort((a, b) => a.alicuota - b.alicuota);

  return {
    total: aPesos(totalC),
    neto: aPesos(neto),
    iva: aPesos(iva),
    exento: aPesos(exento),
    noGravado: aPesos(noGravado),
    alicuotas,
  };
}

/* Los importes del pedido a WSFEv1 (FECAESolicitar) según la letra.

   En la C no se informa IVA: todo es neto, porque quien la emite no lo
   discrimina (monotributo, exento). Es lo que ya mandaba _arca.js.
   En la A y la B se manda el detalle por alícuota (`Iva`) aunque la B no
   lo muestre discriminado en el papel: ARCA lo pide igual. `Iva` va solo
   si hay algo gravado; con todo exento, ARCA rechaza un arreglo vacío. */
export function importesParaArca(desglose, letra) {
  const d = desglose;
  if (letra === "C") {
    return { ImpTotal: d.total, ImpTotConc: 0, ImpNeto: d.total, ImpOpEx: 0, ImpIVA: 0, ImpTrib: 0 };
  }
  return {
    ImpTotal: d.total,
    ImpTotConc: d.noGravado,
    ImpNeto: d.neto,
    ImpOpEx: d.exento,
    ImpIVA: d.iva,
    ImpTrib: 0,
    ...(d.alicuotas.length ? {
      Iva: d.alicuotas.map((a) => ({ Id: a.id, BaseImp: a.base, Importe: a.importe })),
    } : {}),
  };
}
