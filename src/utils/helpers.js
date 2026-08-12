/* ============================================================
   2. HELPERS
   ============================================================ */

import { HOY, dayMs, addDays } from "../datos/generador.js";

export const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v) => "$" + nf.format(Math.round(v || 0));
export const moneyk = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1000000) return "$" + (v / 1000000).toFixed(1).replace(".", ",") + "M";
  if (a >= 1000) return "$" + Math.round(v / 1000) + "k";
  return "$" + Math.round(v || 0);
};
export const pct = (v, dec = 1) => (v * 100).toFixed(dec).replace(".", ",") + "%";
export const diasDesde = (d) => Math.floor((HOY - d) / dayMs);
export const diasHasta = (d) => Math.ceil((d - HOY) / dayMs);

export const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "https://api.anthropic.com";
export const API_MODELO = (typeof window !== "undefined" && window.__API_MODELO__) || "claude-sonnet-4-6";

/* Lista 2: se activa sola cuando el renglón llega a la cantidad mínima, y
   solo en ese renglón. Tres fideos iguales pagan lista 2; el aceite que va
   solo en el mismo ticket sigue en lista 1.                                 */
/* Un código de barras tiene 6 dígitos o más; una cantidad, 4 o menos (y puede
   llevar decimales para los pesables). Con esa frontera se puede escribir la
   cantidad en el mismo campo donde se escanea, sin ambigüedad.              */
/* La síntesis de voz lee "24.500" de forma irregular según el navegador, así
   que el monto se convierte a palabras antes de mandarlo a hablar.          */
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menosDeMil(n) {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  let out = CENTENAS[c];
  if (r) {
    let resto;
    if (r < 20) resto = UNIDADES[r];
    else if (r < 30) resto = r === 20 ? "veinte" : "veinti" + UNIDADES[r - 20];
    else {
      const d = Math.floor(r / 10), u = r % 10;
      resto = DECENAS[d] + (u ? " y " + UNIDADES[u] : "");
    }
    out = out ? out + " " + resto : resto;
  }
  return out;
}

export function numeroALetras(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones === 1) partes.push("un millón");
  else if (millones > 1) partes.push(menosDeMil(millones) + " millones");
  if (miles === 1) partes.push("mil");
  else if (miles > 1) partes.push(menosDeMil(miles) + " mil");
  if (resto) partes.push(menosDeMil(resto));
  return partes.join(" ").replace("uno mil", "un mil").trim();
}

export function esCantidad(t) {
  return /^\d{1,4}([.,]\d{1,3})?$/.test(String(t).trim());
}
export const aNumero = (t) => Number(String(t).trim().replace(",", "."));

export function precioAplicado(prod, cantidad, ajustes) {
  const base = { precio: prod ? prod.precio : 0, lista: null, nombre: "" };
  if (!prod || !ajustes || !ajustes.listas) return base;
  const precios = prod.precios || {};
  // Gana la lista más exigente que el renglón alcance: si un producto tiene
  // precio desde 3 y desde 12 unidades, con 12 se cobra la de 12.
  const candidatas = ajustes.listas
    .filter((l) => l.activa !== false && precios[l.id] > 0 && cantidad >= l.umbral)
    .sort((a, b) => b.umbral - a.umbral);
  if (!candidatas.length) return base;
  const l = candidatas[0];
  return { precio: precios[l.id], lista: l.id, nombre: l.nombre };
}

/* Próxima lista que el renglón podría alcanzar, para poder ofrecerla en el
   mostrador: "si llevás uno más te sale más barato". */
export function proximaLista(prod, cantidad, ajustes) {
  if (!prod || !ajustes || !ajustes.listas) return null;
  const precios = prod.precios || {};
  const faltantes = ajustes.listas
    .filter((l) => l.activa !== false && precios[l.id] > 0 && cantidad < l.umbral)
    .sort((a, b) => a.umbral - b.umbral);
  return faltantes.length ? { ...faltantes[0], precio: precios[faltantes[0].id] } : null;
}

export const LISTAS_INICIALES = [{ id: "l2", nombre: "Por cantidad", umbral: 3, activa: true }];

export function listaPorId(ajustes, id) {
  return (ajustes.listas || []).find((l) => l.id === id) || null;
}

export function faltantesProducto(p) {
  const f = [];
  if (!p.precio) f.push("precio de venta");
  if (!p.costo) f.push("costo");
  if (!p.categoria) f.push("rubro");
  if (!p.proveedor) f.push("proveedor");
  if (!p.barcode) f.push("código de barras");
  if (!p.stockMin) f.push("stock mínimo");
  return f;
}

export function faltantesProveedor(v) {
  const f = [];
  if (!v || !v.cuit) f.push("CUIT");
  if (!v || !v.tel) f.push("teléfono");
  if (!v || !v.pago) f.push("condición de pago");
  if (!v || !v.entrega) f.push("día de entrega");
  return f;
}

/* Ficha nueva con lo mínimo para operar. Lo que no se sabe queda vacío y el
   sistema lo reclama después, en vez de inventar un valor por defecto que
   después nadie revisa.                                                     */
export function productoNuevo(datos, productos) {
  const id = productos.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  const costo = Number(datos.costo) || 0;
  return {
    id,
    nombre: (datos.nombre || "Producto sin nombre").trim(),
    categoria: datos.categoria || "",
    marca: datos.marca || "",
    sku: `NUE-${String(id).padStart(4, "0")}`,
    barcode: (datos.barcode || "").replace(/\D/g, ""),
    costo, costoPrev: costo,
    precio: Number(datos.precio) || 0,
    precioPrev: Number(datos.precio) || 0,
    precios: datos.precios && typeof datos.precios === "object"
      ? Object.fromEntries(Object.entries(datos.precios).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]))
      : {},
    iva: Number(datos.iva) || 21,
    stock: Number(datos.stock) || 0,
    stockMin: Number(datos.stockMin) || 0,
    bulto: Number(datos.bulto) || 1,
    unidad: datos.unidad || "un",
    proveedor: datos.proveedor || "",
    vel: 0, u30: 0, u30p: 0,
    ultimaVenta: HOY, vence: null,
    historial: costo ? [{ fecha: HOY, costo }] : [],
    activo: true, nuevo: true, creado: HOY,
  };
}

/* Medios de pago editables. `tasa` es el porcentaje del medio y `recargo`
   define quién lo paga: si está en false lo absorbe el negocio (comisión que
   descuenta ganancia); si está en true se le suma al cliente y cambia el
   total de la venta. */
export const MEDIOS_INICIALES = [
  { k: "efectivo", n: "Efectivo", tasa: 0, recargo: false, activo: true },
  { k: "debito", n: "Débito", tasa: 1.2, recargo: false, activo: true },
  { k: "credito", n: "Crédito", tasa: 3.1, recargo: false, activo: true },
  { k: "mp", n: "QR / Mercado Pago", tasa: 0.8, recargo: false, activo: true },
  { k: "transferencia", n: "Transferencia", tasa: 0, recargo: false, activo: true },
];

/* --- Régimen fiscal ----------------------------------------------------
   Qué comprobante se puede emitir no lo decide el cajero: lo determina la
   condición del que vende cruzada con la del que compra.
   Un monotributista siempre emite C. Un responsable inscripto emite A si le
   vende a otro responsable inscripto, y B en los demás casos.              */
export const CONDICIONES = [
  { k: "RI", n: "Responsable Inscripto", corto: "Resp. Inscripto", legal: "IVA RESPONSABLE INSCRIPTO" },
  { k: "MONOTRIBUTO", n: "Monotributista", corto: "Monotributo", legal: "RESPONSABLE MONOTRIBUTO" },
  { k: "EXENTO", n: "IVA Exento", corto: "Exento", legal: "IVA EXENTO" },
  { k: "CF", n: "Consumidor Final", corto: "Cons. Final", legal: "CONSUMIDOR FINAL" },
];

export const condicionLegal = (k) => (CONDICIONES.find((c) => c.k === k) || {}).legal || String(k || "").toUpperCase();

export const condicionNombre = (k) => (CONDICIONES.find((c) => c.k === k) || { n: k || "—" }).n;

export function letraComprobante(emisor, cliente) {
  if (emisor === "MONOTRIBUTO" || emisor === "EXENTO") return "C";
  return cliente === "RI" ? "A" : "B";
}

/* La factura A discrimina el IVA; en B y C va incluido en el precio. */
export function discriminaIVA(letra) {
  return letra === "A";
}

export const FISCAL_INICIAL = {
  // El nombre de fantasía es el que ve el cliente arriba del comprobante;
  // la razón social y el CUIT van debajo, que es lo que exige ARCA.
  nombreFactura: "Super 25",
  razonSocial: "Axel Gonzalez",
  cuit: "20-41564841-0",
  condicion: "MONOTRIBUTO",
  iibb: "901-234567-8",
  inicio: "01/03/2019",
  puntoVenta: "0001",
  domicilio: "Av. San Martín 1204 · Caseros",
};

export const CLIENTES_INICIALES = [
  { id: "c1", razonSocial: "Almacén de Vicky", doc: "27-31456789-4", tipoDoc: "CUIT", condicion: "RI", domicilio: "Sarmiento 88", email: "", tel: "11 4478-9032" },
  { id: "c2", razonSocial: "Rotisería Don Luis", doc: "20-28765432-1", tipoDoc: "CUIT", condicion: "MONOTRIBUTO", domicilio: "Belgrano 415", email: "", tel: "" },
  { id: "c3", razonSocial: "Marta Gómez", doc: "27.345.678", tipoDoc: "DNI", condicion: "CF", domicilio: "Rivadavia 2140", email: "", tel: "11 5031-7742" },
];

export function mediosDe(ajustes) {
  const ms = (ajustes && ajustes.medios) || MEDIOS_INICIALES;
  return ms.filter((m) => m.activo !== false);
}

export function medioPorK(ajustes, k) {
  const ms = (ajustes && ajustes.medios) || MEDIOS_INICIALES;
  return ms.find((m) => m.k === k) || { k, n: k, tasa: 0, recargo: false };
}

/* Total que paga el cliente con ese medio. Solo cambia si el recargo se
   traslada; si no, el total es el mismo y la tasa sale de la ganancia. */
export function conRecargo(base, medio) {
  if (!medio || !medio.recargo || !medio.tasa) return { total: base, recargo: 0 };
  const r = Math.round(base * (medio.tasa / 100));
  return { total: base + r, recargo: r };
}
