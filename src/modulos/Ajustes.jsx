/* ============================================================
   13. AJUSTES + 13 bis. FICHA RÁPIDA + 13 ter. AVISO DE COBRO
   ============================================================ */

import React, { useState, useEffect, useRef } from "react";
import {
  Plus, X, Check, Trash2, BellOff, Bell, Volume2, VolumeX,
  ScanLine, Barcode
} from "lucide-react";
import { uid, HOY, PROV_INFO } from "../datos/generador.js";
import {
  FISCAL_INICIAL, CONDICIONES, letraComprobante, discriminaIVA,
  condicionNombre, mediosDe, conRecargo, money, nf, nf2, pct,
  MEDIOS_INICIALES, LISTAS_INICIALES, condicionLegal
} from "../utils/helpers.js";
import { Card, Boton, Modal, Kpi, Vacio } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
const Vol2 = Volume2;

/* ============================================================
   13. AJUSTES
   ============================================================ */

export function Ajustes({ ajustes, setAjustes, productos, setProductos, toast, mp, setMp, simularCobro }) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const setFiscal = (cambios) => setAjustes({ ...ajustes, fiscal: { ...f, ...cambios } });
  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <h3 className="f-d text-lg">Datos fiscales</h3>
        <p className="text-sm text-texto-suave mt-1">
          Tu condición determina qué comprobantes podés emitir, y el sistema la aplica sola.
          Un monotributista emite siempre Factura C. Un responsable inscripto emite A cuando le vende a otro
          responsable inscripto, y B en los demás casos.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <Campo label="Nombre en la factura">
            <input value={f.nombreFactura || ""} onChange={(e) => setFiscal({ nombreFactura: e.target.value })} className={inputCls} />
          </Campo>
          <Campo label="Razón social">
            <input value={f.razonSocial || ""} onChange={(e) => setFiscal({ razonSocial: e.target.value })} className={inputCls} />
          </Campo>
          <Campo label="Condición frente al IVA">
            <select value={f.condicion} onChange={(e) => setFiscal({ condicion: e.target.value })} className={inputCls}>
              {CONDICIONES.filter((c) => c.k !== "CF").map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
            </select>
          </Campo>
          <Campo label="CUIT">
            <input value={f.cuit || ""} onChange={(e) => setFiscal({ cuit: e.target.value })} className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Ingresos Brutos">
            <input value={f.iibb || ""} onChange={(e) => setFiscal({ iibb: e.target.value })} className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Inicio de actividades">
            <input value={f.inicio || ""} onChange={(e) => setFiscal({ inicio: e.target.value })} placeholder="01/03/2019" className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Punto de venta">
            <input value={f.puntoVenta || ""} onChange={(e) => setFiscal({ puntoVenta: e.target.value })} className={`${inputCls} f-m`} />
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Domicilio comercial">
              <input value={f.domicilio || ""} onChange={(e) => setFiscal({ domicilio: e.target.value })} className={inputCls} />
            </Campo>
          </div>
          <div className="md:col-span-2">
            <Campo label="Nombre en pantalla (no sale en los comprobantes)">
              <input value={ajustes.negocio} onChange={(e) => setAjustes({ ...ajustes, negocio: e.target.value })} className={inputCls} />
            </Campo>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-borde bg-superficie-2 p-3 text-sm">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">Qué vas a emitir</div>
          <ul className="space-y-1 text-texto-suave">
            <li>A un <strong>responsable inscripto</strong>: Factura <strong>{letraComprobante(f.condicion, "RI")}</strong>
              {discriminaIVA(letraComprobante(f.condicion, "RI")) ? ", con IVA discriminado al pie." : ", con IVA incluido en el precio."}</li>
            <li>A un <strong>consumidor final</strong> o monotributista: Factura <strong>{letraComprobante(f.condicion, "CF")}</strong>, con IVA incluido.</li>
          </ul>
          {f.condicion !== "RI" && (
            <p className="text-xs text-texto-suave mt-2">
              Como {condicionNombre(f.condicion).toLowerCase()} no discriminás IVA, así que la Factura A no aplica
              aunque el cliente sea responsable inscripto.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Medios de pago</h3>
            <p className="text-sm text-texto-suave mt-1">
              El porcentaje puede funcionar de dos formas. Como <strong>comisión</strong>, lo absorbe el negocio: el cliente paga
              el mismo total y la diferencia sale de tu ganancia. Como <strong>recargo</strong>, se le suma al cliente y cambia el
              total de la venta.
            </p>
          </div>
          <Boton size="sm" className="shrink-0" onClick={() => setAjustes({ ...ajustes, medios: [...(ajustes.medios || []), { k: "m" + uid(), n: "Nuevo medio", tasa: 0, recargo: false, activo: true }] })}>
            <Plus size={14} /> Agregar
          </Boton>
        </div>

        <div className="mt-4 space-y-2">
          {(ajustes.medios || []).map((m, i) => {
            const cambiar = (campo, valor) => setAjustes({ ...ajustes, medios: ajustes.medios.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)) });
            return (
              <div key={m.k} className={`border rounded-xl p-3 ${m.activo === false ? "bg-superficie-2 opacity-70 border-borde" : "border-borde"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={m.n} onChange={(e) => cambiar("n", e.target.value)}
                    className="flex-1 min-w-[140px] border border-borde rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-acento" />
                  <label className="flex items-center gap-1.5 text-xs text-texto-suave">
                    <input value={m.tasa} onChange={(e) => cambiar("tasa", Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                      className="f-m w-16 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
                    %
                  </label>
                  <button onClick={() => cambiar("recargo", !m.recargo)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${m.recargo ? "border-amber-300 bg-ojo-suave text-amber-800" : "border-borde text-texto-suave"}`}>
                    {m.recargo ? "Lo paga el cliente" : "Lo absorbe el negocio"}
                  </button>
                  <button onClick={() => cambiar("activo", m.activo === false)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${m.activo === false ? "border-borde text-texto-tenue" : "border-bien bg-bien-suave text-bien"}`}>
                    {m.activo === false ? "Apagado" : "Activo"}
                  </button>
                  <button onClick={() => {
                    if (!window.confirm(`¿Eliminar "${m.n}"? Las ventas ya cobradas con este medio no se modifican.`)) return;
                    setAjustes({ ...ajustes, medios: ajustes.medios.filter((_, j) => j !== i) });
                  }} className="text-texto-tenue hover:text-mal p-1.5"><Trash2 size={16} /></button>
                </div>
                {m.tasa > 0 && (
                  <p className="text-[11px] text-texto-tenue mt-1.5">
                    {m.recargo
                      ? `Una venta de ${money(10000)} se cobra ${money(conRecargo(10000, m).total)}.`
                      : `Una venta de ${money(10000)} deja ${money(10000 - 10000 * m.tasa / 100)} después de la comisión.`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-texto-tenue mt-3">
          En el cobro, cada medio se elige con su número. Apagar uno lo saca de la caja sin borrar el historial.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Comprobantes</h3>
        <div className="mt-4 space-y-2">
          <button onClick={() => setAjustes({ ...ajustes, arca: false })}
            className={`w-full text-left border rounded-xl p-4 ${!ajustes.arca ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-texto-suave">Fase 1</span>
              <span className="font-semibold text-sm">Ticket no fiscal</span>
              {!ajustes.arca && <Check size={15} className="ml-auto text-acento" />}
            </div>
            <p className="text-sm text-texto-suave mt-1">Arrancás vendiendo hoy mismo. El sistema numera, imprime y envía comprobantes internos, y registra todo en ventas, stock y caja.</p>
          </button>
          <button onClick={() => setAjustes({ ...ajustes, arca: true })}
            className={`w-full text-left border rounded-xl p-4 ${ajustes.arca ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-texto-suave">Fase 2</span>
              <span className="font-semibold text-sm">Factura electrónica (ARCA)</span>
              {ajustes.arca && <Check size={15} className="ml-auto text-acento" />}
            </div>
            <p className="text-sm text-texto-suave mt-1">La misma venta emite Factura B con CAE. Se activa cuando cargamos el certificado fiscal y el punto de venta; el flujo de caja no cambia.</p>
          </button>
        </div>
        <p className="text-xs text-texto-tenue mt-3">
          Esto define con qué opción arranca cada venta. En la pantalla de cobro se puede cambiar venta por venta,
          con el selector Ticket / Factura. En esta demo el CAE es simulado: sirve para ver el flujo, no tiene validez fiscal.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Comandera y pistola</h3>
        <p className="text-sm text-texto-suave mt-1">Ancho del rollo térmico. El ticket se compone en texto de ancho fijo, igual que lo recibe la impresora.</p>
        <div className="flex gap-2 mt-3">
          {[58, 80].map((a) => (
            <button key={a} onClick={() => setAjustes({ ...ajustes, ancho: a })}
              className={`flex-1 border rounded-xl p-3 text-left ${ajustes.ancho === a ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
              <div className="font-semibold text-sm">{a} mm</div>
              <div className="text-xs text-texto-suave">{a === 58 ? "32 caracteres · comandera chica" : "48 caracteres · comandera estándar"}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setAjustes({ ...ajustes, sonido: !ajustes.sonido })}
          className="flex items-center gap-2 text-sm text-texto-suave mt-3 hover:text-texto">
          {ajustes.sonido ? <Volume2 size={16} className="text-acento" /> : <VolumeX size={16} />}
          Beep al escanear: <strong>{ajustes.sonido ? "activado" : "silenciado"}</strong>
        </button>
        <p className="text-xs text-texto-tenue mt-3">
          La pistola funciona como un teclado. El sistema reconoce la ráfaga de tecleo y el Enter final, así que se puede disparar sin clickear ningún campo.
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Avisos de Mercado Pago</h3>
            <p className="text-sm text-texto-suave mt-1">
              Cuando entra una transferencia o un pago por QR, salta un cartel, suena una campanita y una voz dice el monto en voz alta.
              El cobro queda registrado en caja solo.
            </p>
          </div>
          <button onClick={() => setMp({ ...mp, activo: !mp.activo })}
            className={`shrink-0 flex items-center gap-2 text-sm font-semibold ${mp.activo ? "text-bien" : "text-texto-tenue"}`}>
            {mp.activo ? <Bell size={16} /> : <BellOff size={16} />}
            {mp.activo ? "Activo" : "Apagado"}
          </button>
        </div>

        <div className={`mt-3 rounded-xl p-3 text-sm border ${
          mp.configurado === null ? "bg-superficie-2 border-borde text-texto-suave"
          : mp.configurado ? "bg-bien-suave border-bien text-emerald-800"
          : "bg-ojo-suave border-ojo text-amber-800"}`}>
          {mp.configurado === null ? "Consultando el estado de la conexión…"
            : mp.configurado
              ? <>Conectado a Mercado Pago. Consultando cada 6 segundos{mp.ultimoChequeo ? ` · último chequeo ${mp.ultimoChequeo.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}.</>
              : <>Todavía sin conectar: falta cargar <strong>MP_ACCESS_TOKEN</strong> en Vercel. El aviso se puede probar igual con el botón de abajo.</>}
          {mp.error && <div className="text-xs mt-1 opacity-80">{mp.error}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button onClick={() => setMp({ ...mp, voz: !mp.voz })}
            className="flex items-center gap-2 text-sm text-texto-suave hover:text-texto">
            {mp.voz ? <Vol2 size={16} className="text-acento" /> : <VolumeX size={16} />}
            Leer el monto en voz alta: <strong>{mp.voz ? "sí" : "no"}</strong>
          </button>
          <Boton size="sm" variant="ghost" className="ml-auto" onClick={simularCobro}>
            <Bell size={14} /> Probar el aviso
          </Boton>
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-texto-suave font-semibold">Cómo conectar la cuenta</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-texto-suave">
            <li>Entrá a <span className="f-m text-xs">mercadopago.com.ar/developers</span> con la cuenta del negocio y creá una aplicación.</li>
            <li>Copiá el <strong>Access Token de producción</strong> (empieza con APP_USR).</li>
            <li>En Vercel, Settings → Environment Variables, creá <span className="f-m text-xs">MP_ACCESS_TOKEN</span> en Production.</li>
            <li>Volvé a desplegar. Este panel va a pasar a "Conectado" solo.</li>
          </ol>
          <p className="text-xs text-texto-tenue mt-2">
            La API de Mercado Pago no tiene costo. El token nunca llega al navegador: se usa del lado del servidor.
          </p>
        </details>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Listas de precio</h3>
            <p className="text-sm text-texto-suave mt-1">
              Cada lista tiene una cantidad mínima y se activa sola cuando un renglón del ticket la alcanza, solo en ese renglón.
              Si un producto entra en varias, se cobra la de mayor cantidad que el cliente alcance.
            </p>
          </div>
          <Boton size="sm" className="shrink-0" onClick={() => {
            const n = (ajustes.listas || []).length + 2;
            setAjustes({ ...ajustes, listas: [...(ajustes.listas || []), { id: "l" + uid(), nombre: `Lista ${n}`, umbral: 6, activa: true }] });
          }}><Plus size={14} /> Nueva lista</Boton>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-superficie-2 border border-borde">
            <span className="text-sm font-semibold flex-1">Precio general</span>
            <span className="text-xs text-texto-suave">siempre · es el precio de la ficha</span>
          </div>

          {(ajustes.listas || []).length === 0 && (
            <p className="text-sm text-texto-tenue px-1">No hay listas adicionales. Todo se cobra al precio general.</p>
          )}

          {(ajustes.listas || []).map((l, i) => {
            const cuantos = productos.filter((p) => (p.precios || {})[l.id] > 0).length;
            const cambiar = (campo, valor) => setAjustes({
              ...ajustes,
              listas: ajustes.listas.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)),
            });
            return (
              <div key={l.id} className={`border rounded-xl p-3 ${l.activa === false ? "border-borde bg-superficie-2 opacity-70" : "border-borde"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={l.nombre} onChange={(e) => cambiar("nombre", e.target.value)}
                    className="flex-1 min-w-[140px] border border-borde rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-acento" />
                  <label className="flex items-center gap-1.5 text-xs text-texto-suave">
                    desde
                    <input value={l.umbral} onChange={(e) => cambiar("umbral", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                      className="f-m w-14 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
                    u
                  </label>
                  <button onClick={() => cambiar("activa", l.activa === false)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${l.activa === false ? "border-borde text-texto-tenue" : "border-bien bg-bien-suave text-bien"}`}>
                    {l.activa === false ? "Apagada" : "Activa"}
                  </button>
                  <button onClick={() => {
                    if (cuantos > 0 && !window.confirm(`"${l.nombre}" tiene precio en ${cuantos} productos. Al borrarla se pierden esos precios. ¿Seguro?`)) return;
                    setAjustes({ ...ajustes, listas: ajustes.listas.filter((_, j) => j !== i) });
                    setProductos((ps) => ps.map((p) => {
                      if (!(p.precios || {})[l.id]) return p;
                      const cp = { ...p.precios }; delete cp[l.id];
                      return { ...p, precios: cp };
                    }));
                    toast(`Lista "${l.nombre}" eliminada.`);
                  }} className="text-texto-tenue hover:text-mal p-1.5" title="Eliminar lista"><Trash2 size={16} /></button>
                </div>
                <p className="text-[11px] text-texto-tenue mt-1.5">
                  {cuantos > 0 ? `${nf.format(cuantos)} productos con precio en esta lista` : "Ningún producto tiene precio en esta lista todavía"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-borde">
          <span className="text-sm text-texto-suave shrink-0">Descuento sugerido al cargar</span>
          <input type="range" min="3" max="30" value={ajustes.desc2}
            onChange={(e) => setAjustes({ ...ajustes, desc2: Number(e.target.value) })} className="flex-1 accent-orange-500" />
          <span className="f-m text-lg w-16 text-right">{ajustes.desc2}%</span>
        </div>
        <p className="text-xs text-texto-tenue mt-2">
          Los precios de cada lista se cargan producto por producto, o de una vez con la planilla desde el catálogo.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Reposición</h3>
        <p className="text-sm text-texto-suave mt-1">Cuántos días de venta querés tener cubiertos cuando el sistema arma el pedido sugerido.</p>
        <div className="flex items-center gap-4 mt-3">
          <input type="range" min="7" max="30" value={ajustes.cobertura} onChange={(e) => setAjustes({ ...ajustes, cobertura: Number(e.target.value) })}
            className="flex-1 accent-orange-500" />
          <span className="f-m text-lg w-16 text-right">{ajustes.cobertura} d</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Datos de la demo</h3>
        <ul className="text-sm text-texto-suave mt-2 space-y-1">
          <li>{nf.format(productos.length)} productos con costo, precio, stock, proveedor y vencimiento</li>
          <li>90 días de historial de ventas y hasta 5 cambios de costo por producto</li>
          <li>{Object.keys(PROV_INFO).length} proveedores con condiciones de pago y día de entrega</li>
        </ul>
        <Boton variant="ghost" className="mt-4" onClick={() => { window.location.reload(); toast("Recargando…"); }}>Reiniciar la demo</Boton>
      </Card>
    </div>
  );
}

/* ============================================================
   13 bis. FICHA RÁPIDA (escaneo desde cualquier pantalla)
   ============================================================ */

export function FichaRapida({ p, onClose, setProductos, vender, verFicha, movCaja, toast }) {
  const [cant, setCant] = useState("");
  const [costo, setCosto] = useState("");
  const [precio, setPrecio] = useState("");
  const [pagar, setPagar] = useState(false);
  useEffect(() => { if (p) { setCant(String(p.bulto)); setCosto(String(p.costo)); setPrecio(String(p.precio)); setPagar(false); } }, [p && p.id]);
  if (!p) return null;

  const m = (p.precio - p.costo) / p.precio;
  const cobertura = p.vel > 0 ? p.stock / p.vel : 99;

  const sumarStock = () => {
    const n = Number(cant);
    if (!n) return;
    const c = Number(costo) || p.costo;
    setProductos((ps) => ps.map((x) => (x.id === p.id
      ? { ...x, stock: +(x.stock + n).toFixed(3), costo: c, historial: c !== x.costo ? [...x.historial, { fecha: HOY, costo: c }] : x.historial }
      : x)));
    if (pagar) movCaja({ tipo: "egreso", medio: "efectivo", monto: n * c, detalle: `Entrada de mercadería · ${p.nombre}` });
    toast(`+${n} ${p.unidad} de ${p.nombre}. Stock: ${+(p.stock + n).toFixed(2)}.`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} ancho="max-w-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-acento font-bold"><ScanLine size={12} /> Escaneado</div>
            <h3 className="f-d text-lg leading-tight mt-1">{p.nombre}</h3>
            <div className="f-m text-[11px] text-texto-tenue">{p.barcode} · {p.proveedor}</div>
          </div>
          <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[["Stock", p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)], ["Alcanza", cobertura > 90 ? "+90 d" : `${Math.round(cobertura)} d`],
            ["Precio", money(p.precio)], ["Margen", pct(m, 0)]].map(([l, v]) => (
            <div key={l} className="bg-superficie-2 rounded-xl p-2 text-center">
              <div className="text-[9px] uppercase tracking-widest text-texto-tenue font-bold">{l}</div>
              <div className="f-m text-sm mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <Boton className="w-full mt-4" size="lg" onClick={() => vender(p)}><Barcode size={17} /> Agregar al ticket y vender</Boton>

        <div className="border border-borde rounded-xl p-3 mt-3">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Sumar stock</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-texto-suave shrink-0">Cantidad</label>
            <input value={cant} onChange={(e) => setCant(e.target.value.replace(/[^\d.]/g, ""))}
              className="f-m w-20 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
            <label className="text-xs text-texto-suave shrink-0 ml-2">Costo</label>
            <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
              className="f-m flex-1 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
          </div>
          <label className="flex items-center gap-2 text-xs text-texto-suave mt-2">
            <input type="checkbox" checked={pagar} onChange={(e) => setPagar(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            Pagué {money((Number(cant) || 0) * (Number(costo) || p.costo))} en efectivo (sale de caja)
          </label>
          <Boton variant="ghost" className="w-full mt-2" onClick={sumarStock} disabled={!Number(cant)}>
            <Plus size={15} /> Sumar {cant || 0} al stock
          </Boton>
          {Number(costo) !== p.costo && Number(costo) > 0 && (
            <p className="text-[11px] text-ojo mt-2">
              El costo cambia de {money(p.costo)} a {money(Number(costo))}. Con el precio actual el margen queda en {pct((p.precio - Number(costo)) / p.precio, 0)}.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
            className="f-m w-28 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
          <Boton size="sm" variant="ghost" onClick={() => { setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, precio: Number(precio) || x.precio } : x))); toast("Precio actualizado."); onClose(); }}>
            Cambiar precio
          </Boton>
          <button onClick={() => verFicha(p)} className="text-xs font-semibold text-acento hover:underline ml-auto">Ficha completa</button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   13 ter. AVISO DE COBRO POR MERCADO PAGO
   ============================================================ */

/* Tarjeta chica, abajo a la derecha: avisa sin frenar la caja. El cajero
   puede seguir cobrando al cliente siguiente mientras aparece.             */
export function TarjetaCobro({ c, onCerrar }) {
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setSaliendo(true), 14000);
    const b = setTimeout(() => onCerrar(c.id), 14500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  return (
    <div className={`w-[calc(100vw-2.5rem)] max-w-xs md:w-72 bg-superficie border border-emerald-300 rounded-2xl shadow-xl overflow-hidden transition-all duration-500 ${saliendo ? "opacity-0 translate-x-6" : "opacity-100"}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-texto">
        <Bell size={14} className="shrink-0" />
        <span className="text-[10px] uppercase tracking-widest font-bold flex-1">Cobro recibido</span>
        <button onClick={() => onCerrar(c.id)} className="text-texto/70 hover:text-texto"><X size={14} /></button>
      </div>
      <div className="px-3 py-2.5">
        <div className="f-d text-3xl tabular-nums text-bien leading-none">{money(c.monto)}</div>
        <div className="text-[11px] text-texto-tenue mt-1.5">
          Mercado Pago · {new Date(c.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · ya está en caja
        </div>
      </div>
    </div>
  );
}

export function AvisoCobro({ cobros, onCerrar }) {
  if (!cobros.length) return null;
  return (
    <div className="fixed bottom-28 md:bottom-20 right-4 md:right-5 z-[60] flex flex-col gap-2 items-end pointer-events-none">
      {cobros.slice(-4).map((c) => (
        <div key={c.id} className="pointer-events-auto"><TarjetaCobro c={c} onCerrar={onCerrar} /></div>
      ))}
    </div>
  );
}
