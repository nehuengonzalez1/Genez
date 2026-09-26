/* ============================================================
   PRODUCTOS · ETIQUETAS DE GÓNDOLA
   ============================================================

   Las etiquetas de precio que van en el riel de la góndola: el nombre,
   el precio grande, el precio por kilo o litro, el código de barras, y
   una franja con el logo del comercio (el de Ajustes; si no cargó
   ninguno, su nombre), la fecha del precio y Genez.

   Se imprimen las de los productos que cambiaron de precio (o se dieron
   de alta) desde una fecha: después de actualizar precios, eso es lo que
   hay que cambiar en la góndola. Sale del historial de precios, que lo
   escribe la base sola (0005), así que no depende de acordarse.

   Hoja A4 de 12 etiquetas (2 × 6) de 100 × 47 mm, con líneas para
   recortar. Empezaron de 67 × 40 y 21 por hoja, y se veían apretadas:
   Nehuen las quiso con la proporción y el aire de la maqueta, con la
   franja oscura más ancha y el logo de Genez al lado de su nombre.

   El precio por kilo o litro es obligatorio en la góndola. Sale del
   contenido del envase, que se lee del nombre ("500g", "2l") o que el
   comercio corrige acá y queda en el producto (src/utils/contenido.js).
   ============================================================ */

import React, { useState, useEffect, useMemo } from "react";
import { Printer, Loader2 } from "lucide-react";
import { money } from "../utils/helpers.js";
import { contenidoDe, leerContenido, precioPorMedida } from "../utils/contenido.js";
import { cargarCambiosDePrecio, guardarProducto } from "../datos/items.js";
import { svgCodigo, formatoDe } from "../ui/codigoBarras.js";
import { GENEZ_CLARO, PALABRA_CLARO } from "../ui/Logo.jsx";
import { useLogos } from "../ui/logos.js";
import { imprimirDocumento } from "./Etiquetas.jsx";
import { Boton, Vacio, escaparHTML } from "../ui/Base.jsx";

const POR_HOJA = 12;
const paraInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const haceDias = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const ddmm = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const esHoy = (d) => paraInput(d) === paraInput(new Date());

/* "$ 4.590", con el espacio de la maqueta: a ese tamaño, pegado se lee
   como un 5. */
const precioGrande = (n) => money(n).replace("$", "$ ");

/* Una etiqueta, igual en la vista previa y en el papel. */
function htmlEtiqueta(e, comercio, logo) {
  const codigo = e.barcode && formatoDe(e.barcode) ? svgCodigo(e.barcode, { anchoMM: 40, altoMM: 7 }) : "";
  return `<div class="gon">
    <div class="izq">
      <div class="nom">${escaparHTML(e.nombre)}</div>
      ${e.contenido ? `<div class="cont">${escaparHTML(e.contenido)}</div>` : ""}
      <div class="pre${precioGrande(e.precio).length > 8 ? " largo" : ""}">${escaparHTML(precioGrande(e.precio))}</div>
      <div class="pie">
        ${codigo ? `<div class="cod">${codigo}</div>` : ""}
        ${e.porMedida ? `<div class="med">Precio por ${e.porMedida.por}: ${escaparHTML(money(e.porMedida.precio))}</div>` : ""}
      </div>
    </div>
    <div class="der">
      ${logo
        ? `<div class="logo"><img src="${logo}" alt=""></div>`
        : `<div class="com">${escaparHTML(comercio)}</div>`}
      <div class="fec">Precio actualizado<br>${e.fecha ? (esHoy(e.fecha) ? "hoy." : `el ${ddmm(e.fecha)}.`) : ""}</div>
      <div class="gz"><img src="${GENEZ_CLARO}" class="iso" alt=""><img src="${PALABRA_CLARO}" class="pal" alt=""></div>
    </div>
  </div>`;
}

/* Todo en mm y pt: es papel. `print-color-adjust` para que la franja
   oscura salga impresa; sin eso Chrome se saltea los fondos. */
const CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #fff; }
  .hoja { width: 210mm; height: 297mm; padding: 7.5mm 5mm; display: grid;
          grid-template-columns: repeat(2, 100mm); grid-auto-rows: 47mm; align-content: start;
          page-break-after: always; break-after: page; }
  .hoja:last-child { page-break-after: auto; break-after: auto; }
  .gon { display: flex; width: 100mm; height: 47mm; overflow: hidden; outline: 0.2mm dashed #bbb; outline-offset: -0.1mm;
         font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .izq { flex: 1; min-width: 0; padding: 4mm 4.5mm 3.2mm; display: flex; flex-direction: column; }
  /* Nada se achica para hacerle lugar a otra cosa: en una columna flex,
     un nombre de dos líneas quedaba tapado por el contenido. Con todo a
     su tamaño, dos líneas de nombre entran justo en los 47 mm. */
  .izq > * { flex-shrink: 0; }
  .nom { font-size: 11pt; font-weight: 700; text-transform: uppercase; line-height: 1.18;
         max-height: 2.36em; overflow: hidden; }
  .cont { font-size: 10pt; font-weight: 700; text-transform: uppercase; margin-top: 1mm; }
  .pre { font-size: 34pt; font-weight: 800; letter-spacing: -0.4pt; line-height: 1; margin-top: auto; padding: 1.2mm 0 1.4mm; white-space: nowrap; }
  .pre.largo { font-size: 28pt; }
  .pie { line-height: 1; }
  .cod svg { display: block; }
  .med { font-size: 7.5pt; color: #222; margin-top: 1.2mm; }
  .der { width: 36mm; background: #111; color: #fff; padding: 4mm 3.5mm 3.5mm; display: flex; flex-direction: column; }
  /* El logo para fondo oscuro, sin recuadro: sin fondo se ve solo, y una
     foto con fondo, con el suyo (src/ui/logos.js). */
  .logo { height: 13mm; display: flex; align-items: center; }
  .logo img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 0.8mm; }
  .com { font-size: 15pt; font-weight: 800; text-transform: uppercase; line-height: 1.1; overflow-wrap: anywhere; }
  .fec { font-size: 9pt; line-height: 1.35; margin-top: 3mm; color: #eee; }
  /* El isotipo y la palabra, uno al lado del otro, como en la marca. */
  .gz { margin-top: auto; display: flex; align-items: center; gap: 1.6mm; }
  .gz .iso { width: 7mm; height: 7mm; }
  .gz .pal { width: 20mm; height: auto; }
`;

export function documento(etiquetas, comercio, logo = null) {
  const hojas = [];
  for (let i = 0; i < etiquetas.length; i += POR_HOJA) {
    hojas.push(`<div class="hoja">${etiquetas.slice(i, i + POR_HOJA).map((e) => htmlEtiqueta(e, comercio, logo)).join("")}</div>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: A4; margin: 0; } ${CSS}</style></head><body>${hojas.join("")}</body></html>`;
}

export function EtiquetasGondola({ productos, empresaId, ajustes, toast }) {
  const [desde, setDesde] = useState(() => paraInput(haceDias(7)));
  const [cambios, setCambios] = useState(null);      // id → fecha del último cambio de precio
  const [error, setError] = useState(null);
  const [fuera, setFuera] = useState(() => new Set());   // los que no se imprimen
  /* El contenido que se corrigió acá, mientras la lista de productos de
     Sistema no se relea: id → texto. */
  const [corregidos, setCorregidos] = useState({});
  const comercio = ajustes.negocio || "";
  /* El logo que el comercio cargó en Ajustes, el de fondo oscuro: la
     franja es negra. Sin logo, va el nombre. */
  const logo = useLogos(ajustes.marca).paraOscuro;

  useEffect(() => {
    let vivo = true;
    setCambios(null);
    setError(null);
    cargarCambiosDePrecio(empresaId, new Date(`${desde}T00:00:00`))
      .then((m) => { if (vivo) { setCambios(m); setFuera(new Set()); } })
      .catch((e) => { if (vivo) setError(e.message || "No se pudo leer el historial de precios."); });
    return () => { vivo = false; };
  }, [empresaId, desde]);

  /* Los que cambiaron de precio desde la fecha, con precio y que no se
     cobran a precio abierto: sin precio no hay etiqueta que poner. */
  const { lista, sinPrecio } = useMemo(() => {
    if (!cambios) return { lista: [], sinPrecio: 0 };
    let sinPrecio = 0;
    const lista = [];
    for (const p of productos) {
      if (!cambios.has(p.id) || p.activo === false) continue;
      if (!(p.precio > 0) || p.precioAbierto) { sinPrecio++; continue; }
      const q = corregidos[p.id] !== undefined ? { ...p, camposExtra: { ...p.camposExtra, contenido: corregidos[p.id] } } : p;
      const c = contenidoDe(q);
      lista.push({
        id: p.id, producto: q, nombre: p.nombre, precio: p.precio, barcode: p.barcode, unidad: p.unidad,
        contenido: p.unidad === "kg" ? "Por kilo" : c ? c.texto : "",
        contenidoPropio: (q.camposExtra && q.camposExtra.contenido) || "",
        porMedida: precioPorMedida(q), fecha: cambios.get(p.id),
      });
    }
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return { lista, sinPrecio };
  }, [productos, cambios, corregidos]);

  const elegidas = lista.filter((e) => !fuera.has(e.id));
  const sinMedida = elegidas.filter((e) => !e.porMedida).length;
  const hojas = Math.ceil(elegidas.length / POR_HOJA);

  const alternar = (id) => setFuera((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* El contenido corregido queda en el producto: la próxima vez no hay
     que volver a cargarlo. Vacío borra la corrección y vuelve al nombre. */
  const guardarContenido = async (e, texto) => {
    const limpio = texto.trim();
    if (limpio === e.contenidoPropio) return;
    if (limpio && !leerContenido(limpio)) {
      toast(`"${limpio}" no se entiende como contenido. Probá con "500 g", "1,5 l" o "750 ml".`, "mal");
      return;
    }
    const extra = { ...(e.producto.camposExtra || {}) };
    if (limpio) extra.contenido = limpio; else delete extra.contenido;
    try {
      await guardarProducto(e.id, { camposExtra: extra });
      setCorregidos((c) => ({ ...c, [e.id]: limpio }));
    } catch (err) {
      toast(err.message || "No se pudo guardar el contenido.", "mal");
    }
  };

  const imprimir = () => {
    if (!elegidas.length) return;
    imprimirDocumento(documento(elegidas, comercio, logo));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="f-d text-lg">Etiquetas de góndola</h3>
          <p className="text-sm text-texto-suave mt-1">Las de los productos que cambiaron de precio, o se dieron de alta, desde una fecha. Hoja A4 de 12, con líneas para recortar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm flex items-center gap-2">
            <span className="text-texto-suave">Cambiaron desde</span>
            <input type="date" value={desde} max={paraInput(new Date())} onChange={(e) => e.target.value && setDesde(e.target.value)}
              className="f-m border border-borde rounded-md px-2.5 py-1.5 text-sm bg-superficie outline-none focus:border-acento" />
          </label>
          <Boton onClick={imprimir} disabled={!elegidas.length}>
            <Printer size={15} /> Imprimir {elegidas.length} {elegidas.length === 1 ? "etiqueta" : "etiquetas"}{hojas > 1 ? ` · ${hojas} hojas` : ""}
          </Boton>
        </div>
      </div>

      {error ? <p className="text-sm text-mal">{error}</p> : !cambios ? (
        <p className="text-sm text-texto-tenue inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Buscando los cambios de precio…</p>
      ) : !lista.length ? (
        <Vacio>Ningún producto cambió de precio desde esa fecha.</Vacio>
      ) : (
        <div className="grid xl:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="border border-borde rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-borde text-xs text-texto-suave">
              <span>
                {lista.length} {lista.length === 1 ? "producto" : "productos"}
                {sinPrecio > 0 && ` · ${sinPrecio} sin precio no van`}
                {sinMedida > 0 && ` · ${sinMedida} sin precio por kilo o litro: cargá el contenido`}
              </span>
              <span className="flex gap-3">
                <button onClick={() => setFuera(new Set())} className="font-semibold text-acento hover:underline">Todos</button>
                <button onClick={() => setFuera(new Set(lista.map((e) => e.id)))} className="font-semibold text-acento hover:underline">Ninguno</button>
              </span>
            </div>
            <ul className="divide-y divide-borde max-h-[620px] overflow-auto">
              {lista.map((e) => (
                <li key={e.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${fuera.has(e.id) ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={!fuera.has(e.id)} onChange={() => alternar(e.id)} className="accent-acento shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{e.nombre}</span>
                    <span className="block text-xs text-texto-tenue">
                      {e.porMedida ? `${money(e.porMedida.precio)} por ${e.porMedida.por}` : "Sin precio por kilo o litro"} · cambió el {ddmm(e.fecha)}
                    </span>
                  </span>
                  {e.unidad === "kg" ? (
                    <span className="text-xs text-texto-tenue w-24 text-right">Por kilo</span>
                  ) : (
                    <input defaultValue={e.contenidoPropio} placeholder={e.contenido || "Contenido"} title="Lo que trae el envase: 500 g, 1,5 l, 750 ml"
                      onBlur={(ev) => guardarContenido(e, ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === "Enter") ev.target.blur(); }}
                      className={`f-m w-24 text-right border rounded-md px-2 py-1 text-xs bg-superficie outline-none focus:border-acento ${e.contenido ? "border-borde" : "border-ojo"}`} />
                  )}
                  <span className="f-m w-20 text-right">{money(e.precio)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cómo sale: el mismo HTML que se imprime, en su propia página
              para que los estilos sean los del papel y no los de acá. */}
          {elegidas.length > 0 && (
            <div className="border border-borde rounded-lg p-3 bg-superficie-2">
              <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mb-2">Cómo sale</div>
              <iframe title="Vista de las etiquetas" srcDoc={documento(elegidas.slice(0, 4), comercio, logo).replace(/height: 297mm;/, "height: auto;")}
                className="bg-muestra-clara rounded" style={{ width: "215mm", height: "104mm", border: 0, transform: "scale(0.55)", transformOrigin: "top left", marginBottom: "-47mm", marginRight: "-97mm" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
