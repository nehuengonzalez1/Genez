/* ============================================================
   LAS REGLAS DE LA LETRA, EN UN SOLO LUGAR
   ============================================================

   Qué comprobante corresponde no lo decide el cajero: sale de la
   condición del que vende, la del que compra y la clase que ARCA le
   asignó al vendedor. Hasta ahora la regla estaba copiada en dos lados
   (helpers.js para la pantalla y _arca.js para el servidor) y las dos
   decían lo mismo mal: un inscripto le hacía B a un monotributista.

   Sin imports a propósito, como iva.js: la importa una función de
   Vercel, y helpers.js arrastra el generador del prototipo.

   El análisis normativo de todo esto está en el doc "Genez: consulta
   fiscal sobre facturas A y B" (27/09/2026). Resumido:

   - Monotributista o exento emite C, a cualquiera.
   - Responsable inscripto a otro inscripto O A UN MONOTRIBUTISTA emite
     A (RG 5003/2021, art. 20, que cambió el art. 15 de la RG 1415).
     Al monotributista, con la leyenda de la Ley 27.618.
   - Pero "A" es la clase que ARCA le asigne: A, A con la leyenda
     "Operación sujeta a retención", o M (RG 1575; evaluación
     cuatrimestral desde la RG 5716/2025). Con M, lo que sería A es M.
   - A consumidor final o exento, B.
   ============================================================ */

/* La clase que ARCA le asignó a un responsable inscripto. Se consulta
   en ARCA: Regímenes de Facturación y Registración → Habilitación de
   Comprobantes → Resultado de la Evaluación Periódica. Puede cambiar en
   febrero, junio y octubre. */
export const CLASES_INSCRIPTO = [
  { k: "A", n: "A" },
  { k: "A_RETENCION", n: "A con leyenda \"Operación sujeta a retención\"" },
  /* El comprador tiene que pagar a la CBU que el vendedor informó en
     ARCA. En el web service es una A común (no hay dato opcional para
     esto: el 2101 es de la factura de crédito MiPyME); la diferencia va
     en el papel, con la leyenda y la CBU. */
  { k: "A_CBU", n: "A con leyenda \"Pago en CBU informada\"" },
  { k: "M", n: "M" },
];

/* Condiciones del comprador que reciben A (o M) de un inscripto. */
const RECIBEN_A = ["RI", "MONOTRIBUTO"];

export function letraDeComprobante(emisor, receptor, clase = "A") {
  if (emisor === "MONOTRIBUTO" || emisor === "EXENTO") return "C";
  if (RECIBEN_A.includes(receptor)) return clase === "M" ? "M" : "A";
  return "B";
}

/* A y M discriminan el IVA; B y C lo llevan incluido. */
export const discriminaIva = (letra) => letra === "A" || letra === "M";

/* A y M identifican al comprador por su CUIT: ARCA las rechaza con un
   DNI o sin documento. */
export const pideCuit = (letra) => letra === "A" || letra === "M";

/* Desde este total hay que identificar al consumidor final, en la B y
   también en la C: RG 5700/2025, art. 1 (vigente desde el 29/05/2025).
   Sacó el ajuste semestral por IPC, así que es fijo hasta otra RG. */
export const MONTO_IDENTIFICAR_CONSUMIDOR = 10000000;

/* Las leyendas que van impresas. */
export const LEYENDA_MONOTRIBUTO =
  "El crédito fiscal discriminado en el presente comprobante, sólo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618";
export const LEYENDA_RETENCION = "OPERACIÓN SUJETA A RETENCIÓN";
export const LEYENDA_CBU = "PAGO EN CBU INFORMADA";
