/* ============================================================
   TICKET Y FACTURA: LO QUE SALE EN EL PAPEL (08/10)
   ============================================================

   Nehuen: "ver qué sale en el ticket, elegir todo como en Vendi, y que
   puedan ver el ticket y/o la factura para diseñarla". Vendi tiene la
   elección con una vista previa al lado; Genez tenía solo el texto del
   pie, y para ver cómo quedaba había que vender algo.

   Acá se elige y al lado se ve, renglón por renglón, lo mismo que sale
   por la impresora: la vista usa `ticketVenta` y el mismo mapa de puntos
   del logo que se imprime, no un dibujo aparte que se pueda desfasar.

   Lo que pide ARCA no se elige: en una factura el nombre fiscal, el
   domicilio, el CUIT, la condición, el cliente, el CAE y su QR van
   siempre. La pantalla lo dice en vez de esconder las opciones.

   Las opciones viven en `ajustes.ticket` (config del comercio). De
   fábrica sale todo como antes (`TICKET_DE_FABRICA`, en Base.jsx).
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Printer, ImageOff, Info } from "lucide-react";
import { Card, Boton, Comandera, ticketVenta, qrDelTicket, opcionesTicket, imprimirTicket } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { prepararLogoTicket } from "../ui/logoTicket.js";
import { fdatel } from "../datos/generador.js";
import { letraComprobante, FISCAL_INICIAL } from "../utils/helpers.js";

const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold text-texto-tenue";

function Interruptor({ prendido, onCambiar, etiqueta, apagado = false }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} onClick={onCambiar} disabled={apagado}
      className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 disabled:opacity-40 ${prendido ? "bg-acento border-acento" : "bg-superficie-3 border-borde"}`}>
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-superficie shadow-sm transition-all ${prendido ? "left-[19px]" : "left-0.5"}`} />
    </button>
  );
}

/* Un renglón de opción: qué es, una línea de para qué, y el interruptor. */
function Opcion({ n, d, prendido, onCambiar, apagado, children }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${apagado ? "text-texto-tenue" : ""}`}>{n}</div>
          {d && <div className="text-xs text-texto-tenue mt-0.5 leading-relaxed">{d}</div>}
        </div>
        {onCambiar && <Interruptor prendido={prendido} onCambiar={onCambiar} etiqueta={n} apagado={apagado} />}
      </div>
      {children}
    </div>
  );
}

function Bloque({ titulo, d, children }) {
  return (
    <Card className="p-5">
      <div className={rotulo}>{titulo}</div>
      {d && <p className="text-xs text-texto-tenue mt-1">{d}</p>}
      <div className="mt-4 divide-y divide-borde">{children}</div>
    </Card>
  );
}

/* La venta de ejemplo: con productos del comercio si tiene, para que el
   ancho de los nombres sea el de verdad. */
function ventaDeEjemplo(productos, ajustes, quien) {
  const reales = (productos || []).filter((p) => p.precio > 0 && p.nombre).slice(0, 3);
  const base = reales.length >= 2
    ? reales.map((p, i) => ({ nombre: p.nombre, precio: p.precio, qty: i === 0 ? 2 : 1, unidad: p.unidad === "kg" ? "kg" : "u", iva: 21, ivaCondicion: "gravado" }))
    : [
        { nombre: "Leche entera 1 L", precio: 1400, qty: 2, unidad: "u", iva: 21, ivaCondicion: "gravado" },
        { nombre: "Pan lactal grande", precio: 2900, qty: 1, unidad: "u", iva: 21, ivaCondicion: "gravado" },
        { nombre: "Yerba mate 1 kg", precio: 4800, qty: 1, unidad: "u", iva: 21, ivaCondicion: "gravado" },
      ];
  const sub = base.reduce((s, l) => s + Math.round(l.precio * l.qty), 0);
  const medio = ((ajustes.medios || [])[0] || { k: "efectivo" }).k;
  const ahora = new Date();
  return {
    nro: 128, fecha: fdatel(ahora), hora: `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`,
    items: base, sub, desc: 0, total: sub, medio, pagos: [{ medio, monto: sub }], recargo: 0,
    cajero: quien || "Caja", cliente: { nombre: "Juan Pérez", razonSocial: "Juan Pérez" },
  };
}

/* Una factura de mentira, con todo lo que lleva una de verdad. Solo para
   ver: no se imprime desde acá. */
function facturaDeEjemplo(venta, ajustes, letra) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const neto = Math.round((venta.total / 1.21) * 100) / 100;
  const iva = Math.round((venta.total - neto) * 100) / 100;
  const vence = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const clienteA = { razonSocial: "Distribuidora Ejemplo SA", tipoDoc: "CUIT", doc: "30-71234567-8", condicion: "RI" };
  return {
    ...venta,
    fiscal: true,
    cliente: letra === "A" ? clienteA : null,
    factura: {
      letra, puntoVenta: Number(f.puntoVenta) || 1, numero: 128, cae: "75123456789012", vencimiento: vence, autorizacion: "CAE",
      fecha: new Date().toISOString().slice(0, 10), cuit: String(f.cuit || "20000000001").replace(/\D/g, ""),
      tipo: letra === "A" ? 1 : letra === "B" ? 6 : 11, total: venta.total, docTipo: letra === "A" ? 80 : 99, docNro: letra === "A" ? 30712345678 : 0,
      detalleIva: letra === "C" ? null : { neto, exento: 0, noGravado: 0, iva, alicuotas: [{ alicuota: 21, base: neto, importe: iva }] },
    },
  };
}

export function DisenoTicket({ ajustes, setAjustes, productos, quien, toast, onIr }) {
  const op = opcionesTicket(ajustes);
  const set = (k, v) => setAjustes({ ...ajustes, ticket: { ...(ajustes.ticket || {}), [k]: v } });
  const c = ajustes.contacto || {};
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const [ancho, setAncho] = useState(ajustes.ancho === 58 ? 58 : 80);
  const [ver, setVer] = useState("ticket");

  /* El logo, como mapa de puntos. Mientras se arma (o si no hay), la
     vista muestra el ticket sin logo, igual que la impresión. */
  const [mapas, setMapas] = useState(null);
  const [sinLogo, setSinLogo] = useState(false);
  const marcaClave = JSON.stringify(ajustes.marca || {});
  useEffect(() => {
    let vivo = true;
    prepararLogoTicket(ajustes.marca)
      .then((m) => { if (vivo) { setMapas(m); setSinLogo(!m || !m[80]); } })
      .catch(() => { if (vivo) { setMapas(null); setSinLogo(true); } });
    return () => { vivo = false; };
  }, [marcaClave]);

  /* Qué factura emite: un monotributista, la C; un inscripto, la B a un
     consumidor final y la A a otro inscripto. */
  const letraB = letraComprobante(f.condicion, "CF", f.claseInscripto);
  const emiteA = f.condicion === "RI";
  const opciones = [["ticket", "Ticket"], ["factura", `Factura ${letraB}`], ...(emiteA ? [["facturaA", "Factura A"]] : [])];

  const venta = useMemo(() => ventaDeEjemplo(productos, ajustes, quien), [productos, quien, ajustes.medios]);
  const papel = ver === "ticket" ? venta : facturaDeEjemplo(venta, ajustes, ver === "facturaA" ? "A" : letraB);
  const conAncho = { ...ajustes, ancho };
  const W = ancho === 58 ? 32 : 48;
  const lineas = ticketVenta(papel, conAncho, W);
  const logo = op.logo && mapas ? mapas[ancho] : null;

  const dato = (v) => (v ? <span className="text-texto-suave">{v}</span> : <span className="italic">sin cargar</span>);
  const sugerencias = [
    c.instagram && ["Instagram", `https://instagram.com/${String(c.instagram).trim().replace(/^@/, "")}`],
    c.whatsapp && ["WhatsApp", `https://wa.me/${String(c.whatsapp).replace(/\D/g, "")}`],
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(320px,380px)] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Bloque titulo="Arriba" d="El encabezado: lo primero que se lee.">
          <Opcion n="Logo" prendido={op.logo} onCambiar={() => set("logo", !op.logo)} apagado={sinLogo && !op.logo}
            d={sinLogo
              ? "Todavía no cargaste tu logo."
              : "Se imprime en blanco y negro, que es lo que hace la térmica. Un logo de trazos sale bien; una foto con degradés, manchada."}>
            {sinLogo && onIr && (
              <button type="button" onClick={() => onIr("negocio")} className="mt-2 text-xs font-semibold text-acento hover:underline">Cargar el logo en Datos del negocio</button>
            )}
          </Opcion>
          <Opcion n="Nombre" d="El que va en letras grandes. En la factura va siempre el de la factura.">
            <div className="mt-2.5 grid sm:grid-cols-2 gap-2">
              {[["comercio", "El del comercio", ajustes.negocio], ["fiscal", "El de la factura", f.nombreFactura || f.razonSocial || ajustes.negocio]].map(([k, n, v]) => (
                <button key={k} type="button" onClick={() => set("nombre", k)}
                  className={`text-left rounded-md border px-3 py-2 ${op.nombre === k ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                  <div className="text-xs font-semibold">{n}</div>
                  <div className="text-xs text-texto-tenue truncate mt-0.5">{v || "sin cargar"}</div>
                </button>
              ))}
            </div>
          </Opcion>
          <Opcion n="Dirección" d="El domicilio de los datos fiscales. En la factura va siempre." prendido={op.domicilio} onCambiar={() => set("domicilio", !op.domicilio)} />
          <Opcion n="Una frase debajo del nombre" d="Hasta 2 renglones: lo que hacen, desde cuándo, un lema.">
            <textarea value={op.lema} onChange={(e) => set("lema", e.target.value.split("\n").slice(0, 2).join("\n"))}
              rows={2} maxLength={90} placeholder={"Almacén de barrio desde 1998"} className={`${inputCls} resize-none mt-2`} />
          </Opcion>
        </Bloque>

        <Bloque titulo="En el medio" d="Los datos de la venta. Los productos, los importes y cómo se pagó van siempre.">
          <Opcion n="Quién atendió" d="El nombre de quien cobró, debajo del número." prendido={op.cajero} onCambiar={() => set("cajero", !op.cajero)} />
          <Opcion n="El cliente" d="Si se eligió uno al cobrar. En la factura va siempre, con sus datos." prendido={op.cliente} onCambiar={() => set("cliente", !op.cliente)} />
          <Opcion n="Cantidad de productos" d={'El "3 items" del final.'} prendido={op.cantidad} onCambiar={() => set("cantidad", !op.cantidad)} />
        </Bloque>

        <Bloque titulo="Abajo" d="El cierre: cómo los encuentran y qué querés que hagan.">
          <Opcion n="Mensaje" d={'Hasta 4 renglones. Vacío, dice "Gracias por su compra".'}>
            <textarea value={op.pie} onChange={(e) => set("pie", e.target.value.split("\n").slice(0, 4).join("\n"))}
              rows={3} maxLength={200} placeholder={"Gracias por su compra\nCambios dentro de los 30 días con este ticket"} className={`${inputCls} resize-none mt-2`} />
          </Opcion>
          <Opcion n="Cómo contactarte" d="Los datos de Datos del negocio. Elegí cuáles salen." prendido={op.contacto} onCambiar={() => set("contacto", !op.contacto)}>
            {op.contacto && (
              <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-2">
                {[["telefono", "Teléfono", c.telefono], ["whatsapp", "WhatsApp", c.whatsapp], ["instagram", "Instagram", c.instagram], ["email", "Mail", c.email], ["horarios", "Horarios", c.horarios]].map(([k, n, v]) => (
                  <label key={k} className={`flex items-center gap-2 text-sm ${v ? "" : "opacity-60"}`}>
                    <input type="checkbox" checked={!!op[k]} onChange={(e) => set(k, e.target.checked)} />
                    <span className="min-w-0 truncate">{n} <span className="text-xs">· {dato(v)}</span></span>
                  </label>
                ))}
              </div>
            )}
          </Opcion>
          <Opcion n="Un QR tuyo" d="Para que te sigan, te escriban o te califiquen. Solo en el ticket: en la factura va el de ARCA." prendido={op.qr} onCambiar={() => set("qr", !op.qr)}>
            {op.qr && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs font-semibold text-texto-suave">A dónde lleva</span>
                  <input value={op.qrUrl} onChange={(e) => set("qrUrl", e.target.value)} placeholder="https://instagram.com/tucomercio" className={inputCls} />
                </label>
                {sugerencias.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sugerencias.map(([n, u]) => (
                      <button key={n} type="button" onClick={() => set("qrUrl", u)} className="text-xs rounded-md border border-borde px-2 py-1 hover:bg-superficie-2">Tu {n}</button>
                    ))}
                  </div>
                )}
                <label className="block">
                  <span className="text-xs font-semibold text-texto-suave">Texto arriba del QR</span>
                  <input value={op.qrTexto} onChange={(e) => set("qrTexto", e.target.value.slice(0, 40))} placeholder="Seguinos en Instagram" className={inputCls} />
                </label>
              </div>
            )}
          </Opcion>
        </Bloque>

        <Card className="p-5">
          <div className="flex items-start gap-3 text-sm text-texto-suave leading-relaxed">
            <Info size={16} className="text-acento shrink-0 mt-0.5" />
            <p>
              En la factura, lo que pide ARCA va siempre y no se puede sacar: la razón social, el domicilio, el CUIT,
              Ingresos Brutos, la condición frente al IVA, el cliente, el CAE y su QR. Lo demás de esta pantalla
              (el logo, la frase, el mensaje, el contacto) sale en las dos.
            </p>
          </div>
        </Card>
      </div>

      {/* La vista previa: queda a la vista mientras se eligen las opciones. */}
      <div className="xl:sticky xl:top-4 min-w-0">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className={rotulo}>Así sale</div>
            <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
              {[58, 80].map((a) => (
                <button key={a} type="button" onClick={() => setAncho(a)} className={`px-2.5 py-1 ${ancho === a ? "bg-acento-suave text-texto" : "text-texto-tenue hover:bg-superficie-2"}`}>{a} mm</button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-1.5 flex-wrap" role="tablist">
            {opciones.map(([k, n]) => (
              <button key={k} type="button" role="tab" aria-selected={ver === k} onClick={() => setVer(k)}
                className={`text-xs font-semibold rounded-md border px-3 py-1.5 ${ver === k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>{n}</button>
            ))}
          </div>
          <div className="mt-4 bg-superficie-2 rounded-lg p-4 overflow-auto max-h-[70vh]">
            <Comandera lineas={lineas} ancho={ancho} qr={qrDelTicket(papel, conAncho)} logo={logo} className="py-2 shadow-sm" />
          </div>
          {op.logo && sinLogo && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-texto-tenue"><ImageOff size={13} /> No se pudo leer el logo: el ticket sale sin él.</p>
          )}
          {ver === "ticket" ? (
            <Boton variant="ghost" className="w-full mt-3" onClick={() => imprimirTicket(venta, conAncho, toast)}>
              <Printer size={15} /> Imprimir un ticket de prueba
            </Boton>
          ) : (
            <p className="mt-3 text-xs text-texto-tenue">Es un ejemplo, con un CAE inventado: no se imprime desde acá.</p>
          )}
          {ancho !== (ajustes.ancho === 58 ? 58 : 80) && (
            <p className="mt-2 text-xs text-texto-tenue">Tu impresora está en {ajustes.ancho === 58 ? 58 : 80} mm. El ancho se cambia en Equipos.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
