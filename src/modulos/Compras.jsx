/* ============================================================
   9. COMPRAS + 9 bis. PREPARAR PEDIDOS (picking con pistola)
   ============================================================ */

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ScanLine, Camera, Upload, FileImage, Plus, X, Check, Trash2,
  Loader2, ChevronLeft, ChevronRight, Barcode, Bike, PackageCheck,
  Phone, MessageCircle, Boxes, Search, ArrowRight, Store, Minus, Printer
} from "lucide-react";
import { uid, HOY, addDays, fdatel } from "../datos/generador.js";
import {
  money, moneyk, nf, pct, hora, esCantidad, aNumero,
  precioAplicado, mediosDe, productoNuevo, faltantesProveedor
} from "../utils/helpers.js";
import {
  useScanHandler, beep, Comandera, Kpi, Card, Modal, Boton, Vacio, Tabs,
  imprimirComandera, comandaPicking, TablaSimple
} from "../ui/Base.jsx";
import { preguntarAlModelo } from "../datos/modelo.js";
import { EscanerCamara, TicketModal, FormProveedor } from "./Vender.jsx";
import { palabras, emparejar } from "./Stock.jsx";

// Camera importada como Cam para los usos que la usan con ese nombre
const Cam = Camera;

export function CargarCompra({ productos, setProductos, movCaja, toast, provs, setProvs }) {
  const [lineas, setLineas] = useState([]);
  const [prov, setProv] = useState(Object.keys(provs)[0]);
  const [comprobante, setComprobante] = useState("");
  const [pagado, setPagado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [buscando, setBuscando] = useState(null);
  const [avisoProv, setAvisoProv] = useState(null);
  const [q, setQ] = useState("");
  const archivo = useRef(null);

  const agregar = (p, cant = 1, costoLeido = null, origen = "pistola", desc = null, conf = 1) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.pid === p.id);
      if (i >= 0 && origen === "pistola") return ls.map((l, j) => (j === i ? { ...l, cant: +(l.cant + cant).toFixed(2) } : l));
      const margen = (p.precio - p.costo) / p.precio;
      const costo = costoLeido != null ? Math.round(costoLeido) : p.costo;
      return [...ls, {
        uid: uid(), pid: p.id, nombre: p.nombre, barcode: p.barcode, unidad: p.unidad,
        cant, costo, costoAnterior: p.costo, precioAnterior: p.precio,
        precio: p.precio, margenAnterior: margen, origen, desc, conf,
      }];
    });
  };

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) {
      beep(false, true);
      setLineas((ls) => [...ls, { uid: uid(), pid: null, cant: 1, costo: null, desc: `Código ${cod}`, origen: "pistola", conf: 0,
        crear: { nombre: "", precio: "", barcode: cod, categoria: "" } }]);
      return toast(`Código ${cod} nuevo: completá el nombre y el precio en el renglón.`, "mal");
    }
    beep(true, true);
    agregar(p, 1);
    if (p.proveedor !== prov) setProv(p.proveedor);
  }, !buscando);

  const set = (u, campo, val) => setLineas((ls) => ls.map((l) => (l.uid === u ? { ...l, [campo]: val } : l)));
  const setCrear = (u, campo, val) => setLineas((ls) => ls.map((l) => (l.uid === u ? { ...l, crear: { ...l.crear, [campo]: val } } : l)));
  const marcarAlta = (l) => setLineas((ls) => ls.map((x) => (x.uid === l.uid
    ? { ...x, crear: { nombre: (x.desc || "").replace(/\s+/g, " ").trim(), precio: "", barcode: "", categoria: "" } } : x)));
  const altaTodos = () => setLineas((ls) => ls.map((x) => (!x.pid && !x.crear
    ? { ...x, crear: { nombre: (x.desc || "").replace(/\s+/g, " ").trim(), precio: "", barcode: "", categoria: "" } } : x)));
  const quitar = (u) => setLineas((ls) => ls.filter((l) => l.uid !== u));
  const sugerido = (l) => Math.round(Number(l.costo) / (1 - l.margenAnterior) / 10) * 10;

  const total = lineas.reduce((s2, l) => s2 + Number(l.cant) * Number(l.costo), 0);
  const sinResolver = lineas.filter((l) => !l.pid && !l.crear).length;
  const porCrear = lineas.filter((l) => !l.pid && l.crear);

  const leerFoto = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      return setErrorFoto("El archivo tiene que ser una foto (jpg, png o webp).");
    }
    setLeyendo(true); setErrorFoto(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = () => rej(new Error("No se pudo leer el archivo"));
        r.readAsDataURL(file);
      });
      const crudo = await preguntarAlModelo({
        maxTokens: 2000,
        system: "Leés remitos y facturas de compra de comercios argentinos y devolvés únicamente JSON válido, sin markdown ni explicaciones. Nunca inventás renglones: si algo no se lee, ponés null.",
        mensajes: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: file.type, data: b64 } },
          { type: "text", text: 'Devolvé exactamente este formato: {"proveedor": string|null, "cuit": string|null, "comprobante": string|null, "items": [{"descripcion": string, "codigo": string|null, "cantidad": number, "costoUnitario": number|null}]}. costoUnitario es el precio unitario de compra tal como figura. Si el remito no trae precios, dejá costoUnitario en null.' },
        ] }],
      });
      const txt = crudo.replace(/```json|```/g, "").trim();
      const leido = JSON.parse(txt);
      const items = Array.isArray(leido.items) ? leido.items : [];
      if (!items.length) throw new Error("No se reconoció ningún renglón en la foto.");
      if (leido.comprobante) setComprobante(String(leido.comprobante));

      // Proveedor: si no lo tenemos, se crea con lo que traiga el remito.
      const nomProv = String(leido.proveedor || "").trim();
      let provNuevo = null;
      if (nomProv) {
        const clave = (t) => palabras(t).join(" ");
        const existente = Object.keys(provs).find((x) => clave(x) === clave(nomProv));
        if (existente) setProv(existente);
        else {
          setProvs((v) => ({ ...v, [nomProv]: { pago: "", entrega: "", tel: "", cuit: leido.cuit || "" } }));
          setProv(nomProv);
          provNuevo = nomProv;
        }
      }
      setAvisoProv(provNuevo);
      const nuevas = items.map((it) => {
        const { p, conf } = emparejar(it.descripcion, it.codigo, productos);
        const cant = Number(it.cantidad) || 1;
        const costo = it.costoUnitario != null ? Math.round(Number(it.costoUnitario)) : null;
        if (p && conf >= 0.5) {
          const margen = (p.precio - p.costo) / p.precio;
          return { uid: uid(), pid: p.id, nombre: p.nombre, barcode: p.barcode, unidad: p.unidad,
            cant, costo: costo != null ? costo : p.costo, costoAnterior: p.costo, precioAnterior: p.precio,
            precio: p.precio, margenAnterior: margen, origen: "foto", desc: it.descripcion, conf };
        }
        return { uid: uid(), pid: null, nombre: null, cant, costo, desc: it.descripcion, origen: "foto", conf, sugerencia: p };
      });
      setLineas((ls) => [...ls, ...nuevas]);
      const ok = nuevas.filter((l) => l.pid).length;
      toast(`Leí ${items.length} renglones: ${ok} reconocidos, ${items.length - ok} para dar de alta.`);
    } catch (e) {
      setErrorFoto(`No pude leer el remito: ${e.message}. Podés cargarlo con la pistola mientras tanto.`);
    }
    setLeyendo(false);
  };

  const confirmar = () => {
    const validas = lineas.filter((l) => (l.pid || l.crear) && Number(l.cant) > 0);
    if (!validas.length) return;
    const altas = validas.filter((l) => !l.pid && l.crear);

    setProductos((ps) => {
      let acc = [...ps];
      const mapa = {};
      for (const l of altas) {
        const p = productoNuevo({
          nombre: l.crear.nombre, costo: l.costo, precio: l.crear.precio,
          categoria: l.crear.categoria, barcode: l.crear.barcode, proveedor: prov, bulto: 1,
        });
        acc = [...acc, p];
        mapa[l.uid] = p.id;
      }
      return acc.map((p) => {
        const l = validas.find((x) => (x.pid || mapa[x.uid]) === p.id);
        if (!l) return p;
        const costo = Number(l.costo) || p.costo;
        const precio = Number(l.pid ? l.precio : l.crear.precio) || p.precio;
        return {
          ...p,
          stock: +(p.stock + Number(l.cant)).toFixed(3),
          costo, precio,
          historial: costo !== p.costo ? [...p.historial, { fecha: HOY, costo }] : p.historial,
        };
      });
    });

    if (pagado) movCaja({ tipo: "egreso", medio: "efectivo", monto: total, detalle: `Compra ${comprobante || "s/nro"} · ${prov}` });
    const incompletas = altas.filter((l) => !Number(l.crear.precio)).length;
    const partes = [`${validas.length} productos ingresados por ${money(total)}`];
    if (altas.length) partes.push(`${altas.length} dados de alta`);
    if (incompletas) partes.push(`${incompletas} sin precio de venta`);
    toast(partes.join(" · ") + ".", incompletas ? "mal" : "ok");
    setLineas([]); setComprobante(""); setPagado(false); setAvisoProv(null);
  };

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const candidatos = q.trim().length >= 2
    ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || p.barcode.includes(q.trim())).slice(0, 8) : [];

  return (
    <div className="p-4 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-borde rounded-xl p-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><ScanLine size={16} className="text-acento" /> Con la pistola</div>
          <p className="text-sm text-texto-suave mt-1">Disparale a cada producto del bulto. Trae el costo que tenía cargado y lo podés corregir si el proveedor aumentó.</p>
          <p className="f-m text-[11px] text-texto-tenue mt-2">Lector activo · esperando disparo</p>
        </div>
        <div className="border border-borde rounded-xl p-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><Camera size={16} className="text-acento" /> Desde una foto del remito</div>
          <p className="text-sm text-texto-suave mt-1">Sacale una foto al remito o la factura. Se leen los renglones y quedan acá abajo para que los revises antes de aplicar nada.</p>
          <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={(e) => { leerFoto(e.target.files[0]); e.target.value = ""; }} />
          <Boton variant="ghost" size="sm" className="mt-2" onClick={() => archivo.current && archivo.current.click()} disabled={leyendo}>
            {leyendo ? <><Loader2 size={15} className="animate-spin" /> Leyendo el remito…</> : <><Upload size={15} /> Subir foto</>}
          </Boton>
        </div>
      </div>

      {errorFoto && <div className="text-sm text-mal bg-mal-suave border border-mal rounded-xl p-3">{errorFoto}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <select value={prov} onChange={(e) => setProv(e.target.value)} className="text-sm border border-borde rounded-xl px-3 py-2 bg-superficie outline-none focus:border-acento">
          {Object.keys(provs).map((p) => <option key={p}>{p}</option>)}
        </select>
        <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="Nº de remito o factura"
          className="text-sm border border-borde rounded-xl px-3 py-2 outline-none focus:border-acento" />
        <span className="text-xs text-texto-tenue">{(provs[prov] || {}).pago}</span>
      </div>

      {lineas.length === 0 ? (
        <div className="border-2 border-dashed border-borde rounded-2xl py-12 text-center">
          <FileImage size={26} className="mx-auto text-texto-tenue" />
          <p className="text-sm text-texto-tenue mt-2">Escaneá el primer producto o subí la foto del remito</p>
        </div>
      ) : (
        <>
          {avisoProv && (
            <div className="text-sm text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3">
              <strong>{avisoProv}</strong> no estaba cargado y lo di de alta con lo que traía el remito.
              Le faltan <strong>{faltantesProveedor(provs[avisoProv]).join(", ")}</strong>: completalo en la pestaña Proveedores.
            </div>
          )}
          {sinResolver > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3">
              <span className="flex-1">
                {sinResolver} renglones no están en el catálogo. Podés darlos de alta con los datos del remito, buscarlos a mano o quitarlos.
                No se aplica nada hasta que confirmes.
              </span>
              <Boton size="sm" onClick={altaTodos}><Plus size={14} /> Dar de alta los {sinResolver}</Boton>
            </div>
          )}
          {porCrear.length > 0 && (
            <div className="text-sm text-texto-suave bg-superficie-2 border border-borde rounded-xl p-3">
              {porCrear.length} productos nuevos se van a crear al confirmar. Los que queden sin precio de venta no se van a poder cobrar
              y van a aparecer en el aviso de fichas incompletas.
            </div>
          )}
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
                  <th className="py-2 font-semibold">Producto</th>
                  <th className="py-2 font-semibold text-right w-20">Cant.</th>
                  <th className="py-2 font-semibold text-right w-28">Costo</th>
                  <th className="py-2 font-semibold text-right w-32">Precio de venta</th>
                  <th className="py-2 font-semibold text-right w-28">Margen</th>
                  <th className="py-2 font-semibold text-right w-24">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lineas.map((l) => {
                  if (!l.pid && l.crear) return (
                    <tr key={l.uid} className="bg-acento-suave/40">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-acento-suave text-acento border-acento">nuevo</span>
                          <input value={l.crear.nombre} onChange={(e) => setCrear(l.uid, "nombre", e.target.value)}
                            className="flex-1 border border-borde rounded-lg px-2 py-1 text-sm outline-none focus:border-acento" />
                        </div>
                        <div className="flex gap-1.5 mt-1">
                          <input value={l.crear.barcode} onChange={(e) => setCrear(l.uid, "barcode", e.target.value.replace(/\D/g, ""))}
                            placeholder="código (opcional)" className="f-m w-40 border border-borde rounded-lg px-2 py-0.5 text-[11px] outline-none focus:border-acento" />
                          <input value={l.crear.categoria} onChange={(e) => setCrear(l.uid, "categoria", e.target.value)}
                            placeholder="rubro" className="w-32 border border-borde rounded-lg px-2 py-0.5 text-[11px] outline-none focus:border-acento" />
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.cant} onChange={(e) => set(l.uid, "cant", e.target.value.replace(/[^\d.]/g, ""))}
                          className="f-m w-14 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.costo || ""} onChange={(e) => set(l.uid, "costo", e.target.value.replace(/\D/g, ""))}
                          className="f-m w-24 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.crear.precio} onChange={(e) => setCrear(l.uid, "precio", e.target.value.replace(/\D/g, ""))}
                          placeholder="sin precio" className="f-m w-24 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                        {Number(l.costo) > 0 && !Number(l.crear.precio) && (
                          <button onClick={() => setCrear(l.uid, "precio", String(Math.round(Number(l.costo) / 0.7 / 10) * 10))}
                            className="block ml-auto text-[10px] font-semibold text-acento hover:underline mt-0.5">
                            poner {money(Math.round(Number(l.costo) / 0.7 / 10) * 10)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right f-m text-xs">
                        {Number(l.crear.precio) > 0
                          ? <span className="text-bien">{pct((Number(l.crear.precio) - Number(l.costo)) / Number(l.crear.precio), 0)}</span>
                          : <span className="text-ojo">falta precio</span>}
                      </td>
                      <td className="py-2 text-right f-m">{money(Number(l.cant) * Number(l.costo || 0))}</td>
                      <td className="py-2 text-right"><button onClick={() => quitar(l.uid)} className="text-texto-tenue hover:text-mal"><Trash2 size={15} /></button></td>
                    </tr>
                  );
                  if (!l.pid) return (
                    <tr key={l.uid} className="bg-ojo-suave/50">
                      <td className="py-2 pr-2" colSpan={5}>
                        <div className="text-xs text-texto-suave">Del remito: <span className="f-m text-texto">{l.desc}</span> · {l.cant} u {l.costo ? `· ${money(l.costo)}` : ""}</div>
                        <div className="flex gap-1.5 mt-1.5">
                          <Boton size="sm" variant="ghost" onClick={() => { setBuscando(l.uid); setQ(l.sugerencia ? l.sugerencia.nombre.split(" ").slice(0, 2).join(" ") : ""); }}>
                            <Search size={13} /> Buscarlo en el catálogo
                          </Boton>
                          <Boton size="sm" onClick={() => marcarAlta(l)}><Plus size={13} /> Darlo de alta</Boton>
                        </div>
                      </td>
                      <td className="py-2 text-right f-m text-texto-tenue">—</td>
                      <td className="py-2 text-right"><button onClick={() => quitar(l.uid)} className="text-texto-tenue hover:text-mal"><Trash2 size={15} /></button></td>
                    </tr>
                  );
                  const dif = Number(l.costo) / l.costoAnterior - 1;
                  const mNuevo = (Number(l.precio) - Number(l.costo)) / Number(l.precio);
                  const sug = sugerido(l);
                  return (
                    <tr key={l.uid} className="hover:bg-superficie-2">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{l.nombre}</div>
                        {l.origen === "foto" && <div className="text-[10px] text-texto-tenue">Remito: {l.desc} · coincidencia {pct(l.conf, 0)}</div>}
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.cant} onChange={(e) => set(l.uid, "cant", e.target.value.replace(/[^\d.]/g, ""))}
                          className="f-m w-14 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.costo} onChange={(e) => set(l.uid, "costo", e.target.value.replace(/\D/g, ""))}
                          className="f-m w-24 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                        {Math.abs(dif) > 0.005 && <div className={`text-[10px] ${dif > 0 ? "text-mal" : "text-bien"}`}>{dif > 0 ? "+" : ""}{pct(dif, 0)} vs. {money(l.costoAnterior)}</div>}
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.precio} onChange={(e) => set(l.uid, "precio", e.target.value.replace(/\D/g, ""))}
                          className="f-m w-24 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                        {sug !== Number(l.precio) && (
                          <button onClick={() => set(l.uid, "precio", sug)} className="block ml-auto text-[10px] font-semibold text-acento hover:underline mt-0.5">
                            poner {money(sug)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right f-m text-xs">
                        <span className="text-texto-tenue">{pct(l.margenAnterior, 0)}</span>
                        <span className="text-texto-tenue mx-1">→</span>
                        <span className={mNuevo < l.margenAnterior - 0.005 ? "text-mal font-semibold" : "text-bien"}>{pct(mNuevo, 0)}</span>
                      </td>
                      <td className="py-2 text-right f-m">{money(Number(l.cant) * Number(l.costo))}</td>
                      <td className="py-2 text-right"><button onClick={() => quitar(l.uid)} className="text-texto-tenue hover:text-mal"><Trash2 size={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-borde">
            <label className="flex items-center gap-2 text-sm text-texto-suave">
              <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} className="w-4 h-4 accent-orange-500" />
              Lo pagué en efectivo · {money(total)} sale de caja
            </label>
            <div className="flex items-center gap-3">
              <div className="text-right"><div className="text-[11px] text-texto-tenue">Total de la compra</div><div className="f-d text-xl">{money(total)}</div></div>
              <Boton onClick={confirmar} disabled={!lineas.some((l) => l.pid || l.crear)}><Check size={16} /> Confirmar compra</Boton>
            </div>
          </div>
        </>
      )}

      <Modal open={!!buscando} onClose={() => setBuscando(null)} ancho="max-w-md">
        <div className="p-5">
          <h3 className="f-d text-lg">¿A qué producto corresponde?</h3>
          <p className="text-sm text-texto-suave mt-0.5">
            {buscando && lineas.find((l) => l.uid === buscando) ? lineas.find((l) => l.uid === buscando).desc : ""}
          </p>
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Buscar en el catálogo"
            className="w-full border border-borde rounded-xl px-3 py-2 text-sm mt-3 outline-none focus:border-acento" />
          <ul className="mt-2 border border-borde rounded-xl divide-y divide-borde max-h-72 overflow-auto">
            {candidatos.map((p) => (
              <li key={p.id}>
                <button className="w-full text-left px-3 py-2 hover:bg-superficie-2" onClick={() => {
                  const l = lineas.find((x) => x.uid === buscando);
                  const margen = (p.precio - p.costo) / p.precio;
                  setLineas((ls) => ls.map((x) => (x.uid === buscando ? {
                    ...x, pid: p.id, nombre: p.nombre, barcode: p.barcode, unidad: p.unidad,
                    costo: x.costo != null ? x.costo : p.costo, costoAnterior: p.costo,
                    precio: p.precio, precioAnterior: p.precio, margenAnterior: margen, conf: 1,
                  } : x)));
                  setBuscando(null); setQ("");
                }}>
                  <div className="text-sm">{p.nombre}</div>
                  <div className="f-m text-[11px] text-texto-tenue">{p.barcode} · costo {money(p.costo)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}

export function Compras({ productos, setProductos, k, pedidos, setPedidos, movCaja, toast, cobertura, provs, setProvs }) {
  const [altaProv, setAltaProv] = useState(null);
  const [prov, setProv] = useState(Object.keys(provs)[0]);
  const [sel, setSel] = useState({});
  const [recibiendo, setRecibiendo] = useState(null);
  const [tab, setTab] = useState("cargar");

  const sugeridos = useMemo(() => k.sugeridos.filter((s) => s.p.proveedor === prov), [k.sugeridos, prov]);
  const forzar = useRef(null);
  useEffect(() => {
    const inicial = {};
    sugeridos.forEach((s) => { if (s.cobertura < 10) inicial[s.p.id] = s.cant; });
    if (forzar.current) { inicial[forzar.current.pid] = forzar.current.cant; forzar.current = null; }
    setSel(inicial);
  }, [prov]);

  useScanHandler((cod) => {
    const item = k.sugeridos.find((x) => x.p.barcode === cod);
    if (!item) {
      const p = productos.find((x) => x.barcode === cod);
      beep(false, true);
      return toast(p ? `${p.nombre} está cubierto: no hace falta pedirlo.` : `El código ${cod} no está en el catálogo.`, "mal");
    }
    beep(true, true);
    if (item.p.proveedor !== prov) {
      forzar.current = { pid: item.p.id, cant: item.cant };
      setProv(item.p.proveedor);
      toast(`${item.p.nombre} · cambié al pedido de ${item.p.proveedor}.`);
    } else {
      setSel((x) => ({ ...x, [item.p.id]: (x[item.p.id] || 0) + item.p.bulto }));
    }
  }, tab === "sugerido");

  const totalPedido = sugeridos.reduce((s, x) => s + (sel[x.p.id] ? sel[x.p.id] * x.p.costo : 0), 0);
  const lineas = sugeridos.filter((s) => sel[s.p.id] > 0);

  const generar = () => {
    if (!lineas.length) return;
    const ped = {
      id: uid(), nro: `OC-${String(1200 + pedidos.length + 1)}`, prov, fecha: HOY, estado: "pendiente",
      items: lineas.map((l) => ({ pid: l.p.id, nombre: l.p.nombre, barcode: l.p.barcode, cant: sel[l.p.id], costo: l.p.costo })),
      total: totalPedido,
    };
    setPedidos((ps) => [ped, ...ps]);
    setSel({}); setTab("pedidos");
    toast(`Pedido ${ped.nro} generado para ${prov}.`);
  };

  const recibir = (ped, lineasRec) => {
    setProductos((ps) => ps.map((p) => {
      const l = lineasRec.find((x) => x.pid === p.id);
      if (!l) return p;
      const nuevoCosto = Number(l.costo) || p.costo;
      const hist = nuevoCosto !== p.costo ? [...p.historial, { fecha: HOY, costo: nuevoCosto }] : p.historial;
      return { ...p, stock: +(p.stock + Number(l.cant)).toFixed(2), costo: nuevoCosto, historial: hist };
    }));
    const total = lineasRec.reduce((s, l) => s + Number(l.cant) * Number(l.costo), 0);
    const contado = (provs[ped.prov] || {}).pago === "Contado";
    if (contado) movCaja({ tipo: "egreso", medio: "efectivo", monto: total, detalle: `Compra ${ped.nro} · ${ped.prov}` });
    setPedidos((ps) => ps.map((x) => (x.id === ped.id ? { ...x, estado: "recibido", total } : x)));
    setRecibiendo(null);
    toast(contado ? `Mercadería recibida y ${money(total)} pagados de caja.` : `Mercadería recibida. ${money(total)} quedan en cuenta corriente.`);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-4 pt-2">
          <Tabs items={[{ k: "cargar", n: "Cargar compra" }, { k: "sugerido", n: "Pedido sugerido" }, { k: "pedidos", n: "Órdenes de compra", badge: pedidos.length }, { k: "prov", n: "Proveedores" }]} value={tab} onChange={setTab} />
        </div>

        {tab === "cargar" && <CargarCompra productos={productos} setProductos={setProductos} movCaja={movCaja} toast={toast} provs={provs} setProvs={setProvs} />}

        {tab === "sugerido" && (
          <div>
            <div className="p-4 flex flex-wrap items-center gap-3 border-b border-borde">
              <select value={prov} onChange={(e) => setProv(e.target.value)} className="text-sm border border-borde rounded-xl px-3 py-2 bg-superficie outline-none focus:border-acento">
                {Object.keys(provs).map((p) => <option key={p}>{p}</option>)}
              </select>
              <span className="text-xs text-texto-suave">
                {(provs[prov] || {}).pago} · entrega {(provs[prov] || {}).entrega} · {(provs[prov] || {}).tel}
              </span>
              <span className="text-xs text-texto-tenue ml-auto">Cobertura objetivo: {cobertura} días</span>
            </div>
            {sugeridos.length === 0 ? (
              <Vacio>Con este proveedor estás cubierto. No hace falta pedir nada.</Vacio>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
                        <th className="pl-4 py-2.5 w-8"></th>
                        <th className="px-2 py-2.5 font-semibold">Producto</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Tenés</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Vende/día</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Alcanza</th>
                        <th className="px-2 py-2.5 font-semibold text-right w-28">Pedir</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {sugeridos.slice(0, 40).map(({ p, cant, cobertura: cob }) => (
                        <tr key={p.id} className={sel[p.id] ? "bg-acento-suave/40" : "hover:bg-superficie-2"}>
                          <td className="pl-4 py-2">
                            <input type="checkbox" checked={!!sel[p.id]} onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked ? cant : 0 }))}
                              className="w-4 h-4 accent-orange-500" />
                          </td>
                          <td className="px-2 py-2"><div className="font-medium">{p.nombre}</div><div className="text-[11px] text-texto-tenue">bulto de {p.bulto}</div></td>
                          <td className="px-2 py-2 text-right f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</td>
                          <td className="px-2 py-2 text-right f-m text-texto-suave">{p.vel.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right f-m"><span className={cob < 4 ? "text-mal font-semibold" : "text-texto-suave"}>{Math.round(cob)} d</span></td>
                          <td className="px-2 py-2 text-right">
                            <input value={sel[p.id] || ""} onChange={(e) => setSel((s) => ({ ...s, [p.id]: Number(e.target.value.replace(/\D/g, "")) }))}
                              placeholder={String(cant)} className="f-m w-20 text-right border border-borde rounded-lg px-2 py-1 text-sm outline-none focus:border-acento" />
                          </td>
                          <td className="px-4 py-2 text-right f-m">{money((sel[p.id] || 0) * p.costo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-borde bg-superficie-2">
                  <div className="text-sm">
                    <span className="text-texto-suave">{lineas.length} productos · </span>
                    <span className="f-d text-xl">{money(totalPedido)}</span>
                  </div>
                  <Boton onClick={generar} disabled={!lineas.length}>Generar orden de compra <ArrowRight size={15} /></Boton>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "pedidos" && (
          pedidos.length === 0 ? <Vacio>Todavía no generaste ninguna orden. Empezá por el pedido sugerido.</Vacio> : (
            <ul className="divide-y divide-borde">
              {pedidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{p.nro} · {p.prov}</div>
                    <div className="text-xs text-texto-suave">{p.items.length} productos · {fdatel(p.fecha)} · {(provs[p.prov] || {}).pago}</div>
                  </div>
                  <span className="f-m text-sm">{money(p.total)}</span>
                  {p.estado === "pendiente"
                    ? <Boton size="sm" onClick={() => setRecibiendo(p)}>Recibir mercadería</Boton>
                    : <span className="text-xs font-semibold text-bien bg-bien-suave border border-bien rounded-full px-2.5 py-1">Recibido</span>}
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "prov" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-texto-suave">
                {Object.entries(provs).filter(([, i]) => faltantesProveedor(i).length).length} de {Object.keys(provs).length} fichas necesitan datos.
              </p>
              <Boton size="sm" onClick={() => setAltaProv({})}><Plus size={14} /> Nuevo proveedor</Boton>
            </div>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(provs).map(([n, i]) => {
              const ps = productos.filter((p) => p.proveedor === n);
              const subas = ps.filter((p) => p.costo > p.costoPrev * 1.005);
              const impacto = subas.reduce((s, p) => s + (p.costo - p.costoPrev) * p.u30, 0);
              const subaProm = subas.length ? subas.reduce((s, p) => s + (p.costo / p.costoPrev - 1), 0) / subas.length : 0;
              const faltan = faltantesProveedor(i);
                return (
                <div key={n} className={`border rounded-xl p-4 ${faltan.length ? "border-amber-300 bg-ojo-suave/40" : "border-borde"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {n}
                        {faltan.length > 0 && <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300">incompleta</span>}
                      </div>
                      <div className="text-xs text-texto-suave mt-0.5">{[i.pago, i.entrega && `entrega ${i.entrega}`, i.tel, i.cuit].filter(Boolean).join(" · ") || "Sin datos cargados"}</div>
                    </div>
                    <Boton size="sm" variant="quiet" onClick={() => setAltaProv({ ...i, nombre: n, nombreOriginal: n })}>Editar</Boton>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div><div className="f-m text-base">{ps.length}</div><div className="text-[10px] uppercase tracking-wider text-texto-tenue">Productos</div></div>
                    <div><div className="f-m text-base">{moneyk(ps.reduce((s, p) => s + p.costo * p.u30, 0))}</div><div className="text-[10px] uppercase tracking-wider text-texto-tenue">Compra/mes</div></div>
                    <div><div className={`f-m text-base ${subaProm > 0.06 ? "text-mal" : ""}`}>{subaProm ? "+" + pct(subaProm, 0) : "—"}</div><div className="text-[10px] uppercase tracking-wider text-texto-tenue">Suba prom.</div></div>
                  </div>
                  {subas.length > 0 && (
                    <p className="text-xs text-texto-suave mt-3 border-t border-borde pt-2.5">
                      Aumentó {subas.length} productos en los últimos 30 días. Te cuesta <strong>{money(impacto)}</strong> al mes si no tocás precios.
                    </p>
                  )}
                  {faltan.length > 0 && (
                    <p className="text-xs text-amber-800 mt-3 border-t border-ojo pt-2.5">Falta cargar: <strong>{faltan.join(", ")}</strong>.</p>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}
      </Card>

      <FormProveedor abierto={!!altaProv} inicial={altaProv} onClose={() => setAltaProv(null)}
        onGuardar={(d) => {
          const nombre = d.nombre.trim();
          setProvs((v) => {
            const n = { ...v };
            if (d.nombreOriginal && d.nombreOriginal !== nombre) delete n[d.nombreOriginal];
            n[nombre] = { pago: d.pago || "", entrega: d.entrega || "", tel: d.tel || "", cuit: d.cuit || "" };
            return n;
          });
          if (d.nombreOriginal && d.nombreOriginal !== nombre) {
            setProductos((ps) => ps.map((p) => (p.proveedor === d.nombreOriginal ? { ...p, proveedor: nombre } : p)));
          }
          setAltaProv(null);
          const f = faltantesProveedor(d);
          toast(f.length ? `${nombre} guardado. Falta ${f.join(", ")}.` : `${nombre} guardado.`);
        }} />

      {recibiendo && <RecepcionModal ped={recibiendo} onClose={() => setRecibiendo(null)} onConfirm={recibir} provs={provs} />}
    </div>
  );
}

function RecepcionModal({ ped, onClose, onConfirm, provs }) {
  const [lineas, setLineas] = useState(ped.items.map((i) => ({ ...i, cant: i.cant, costo: i.costo, ver: 0 })));
  const set = (pid, campo, val) => setLineas((ls) => ls.map((l) => (l.pid === pid ? { ...l, [campo]: val } : l)));
  useScanHandler((cod) => {
    const i = lineas.findIndex((l) => l.barcode === cod);
    if (i === -1) return beep(false, true);
    beep(true, true);
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ver: l.ver + 1 } : l)));
  }, true);
  const controlados = lineas.filter((l) => l.ver >= Number(l.cant)).length;
  const total = lineas.reduce((s, l) => s + Number(l.cant) * Number(l.costo), 0);
  const cambios = lineas.filter((l) => Number(l.costo) !== ped.items.find((i) => i.pid === l.pid).costo);

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">Recibir {ped.nro}</h3>
          <p className="text-xs text-texto-suave">Disparale a cada bulto con la pistola: {controlados} de {lineas.length} renglones controlados.</p>
        </div>
        <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>
      <div className="p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
              <th className="py-2 font-semibold">Producto</th>
              <th className="py-2 font-semibold text-right w-28">Llegaron</th>
              <th className="py-2 font-semibold text-right w-28">Costo unit.</th>
              <th className="py-2 font-semibold text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {lineas.map((l) => {
              const orig = ped.items.find((i) => i.pid === l.pid).costo;
              const dif = Number(l.costo) / orig - 1;
              return (
                <tr key={l.pid}>
                  <td className="py-2 pr-2">
                    <span className={`inline-flex items-center gap-1.5 ${l.ver >= Number(l.cant) ? "text-bien font-medium" : ""}`}>
                      {l.ver >= Number(l.cant) ? <Check size={14} /> : <span className="w-3.5" />}{l.nombre}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <input value={l.cant} onChange={(e) => set(l.pid, "cant", e.target.value.replace(/\D/g, ""))}
                      className="f-m w-16 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                    {l.ver > 0 && <div className="text-[10px] text-texto-tenue">{l.ver} leídos</div>}
                  </td>
                  <td className="py-2 text-right">
                    <input value={l.costo} onChange={(e) => set(l.pid, "costo", e.target.value.replace(/\D/g, ""))}
                      className="f-m w-24 text-right border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" />
                    {Math.abs(dif) > 0.005 && <div className={`text-[10px] ${dif > 0 ? "text-mal" : "text-bien"}`}>{dif > 0 ? "+" : ""}{pct(dif, 0)}</div>}
                  </td>
                  <td className="py-2 text-right f-m">{money(Number(l.cant) * Number(l.costo))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cambios.length > 0 && (
          <p className="text-xs text-ojo bg-ojo-suave border border-ojo rounded-xl p-3 mt-4">
            {cambios.length} productos llegan con otro costo. Al confirmar se actualiza el costo, el historial y el margen — y vas a ver el aviso de precios a revisar.
          </p>
        )}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-borde">
          <div><span className="text-sm text-texto-suave">Total a pagar </span><span className="f-d text-xl">{money(total)}</span>
            <div className="text-xs text-texto-tenue">{(provs[ped.prov] || {}).pago === "Contado" ? "Sale de caja al confirmar" : "Queda en cuenta corriente"}</div>
          </div>
          <Boton onClick={() => onConfirm(ped, lineas)}><Check size={15} /> Confirmar recepción</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   9 bis. PREPARAR PEDIDOS (picking con pistola)
   ============================================================ */

export function Picking({ pedidos, setPedidos, productos, setProductos, cobrar, ajustes, toast }) {
  const [abierto, setAbierto] = useState(null);
  const ped = pedidos.find((p) => p.id === abierto);
  if (ped) {
    return <PrepararPedido ped={ped} setPedidos={setPedidos} productos={productos} setProductos={setProductos}
      cobrar={cobrar} ajustes={ajustes} toast={toast} volver={() => setAbierto(null)} />;
  }

  const nuevaVenta = () => {
    const nro = `V-${String(pedidos.filter((p) => p.libre).length + 1).padStart(3, "0")}`;
    const p = {
      id: uid(), nro, cliente: "Venta en el salón", tel: "", dir: "Retira en el local",
      canal: "Mostrador", entrega: "Retira",
      hora: hora(new Date()),
      nota: "", estado: "preparando", libre: true, items: [],
    };
    setPedidos((ps) => [p, ...ps]);
    setAbierto(p.id);
  };

  const chip = { pendiente: "bg-ojo-suave text-ojo border-ojo", preparando: "bg-blue-50 text-blue-700 border-blue-200", listo: "bg-bien-suave text-bien border-bien", entregado: "bg-superficie-2 text-texto-suave border-borde" };
  const pend = pedidos.filter((p) => p.estado !== "entregado");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Pedidos por preparar" valor={nf.format(pedidos.filter((p) => p.estado === "pendiente").length)} />
        <Kpi label="En preparación" valor={nf.format(pedidos.filter((p) => p.estado === "preparando").length)} />
        <Kpi label="Listos para entregar" valor={nf.format(pedidos.filter((p) => p.estado === "listo").length)} tono="bien" />
        <Kpi label="A facturar" valor={money(pend.reduce((s, p) => s + p.items.reduce((a, l) => a + l.precio * l.pedido, 0), 0))} />
      </div>

      <Card className="p-4 border-acento bg-acento-suave/60">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-acento text-sobre-acento flex items-center justify-center shrink-0"><ScanLine size={20} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="f-d text-base">Armar una venta con la pistola</h3>
            <p className="text-sm text-texto-suave">Recorré el salón cargando el changuito: escaneás, se arma la lista sola y cobrás al final. Sirve para pedidos por teléfono o para el cliente que espera en el mostrador.</p>
          </div>
          <Boton onClick={nuevaVenta}><Plus size={16} /> Empezar</Boton>
        </div>
      </Card>

      {pedidos.length === 0 ? <Vacio>No hay pedidos cargados.</Vacio> : (
        <div className="grid md:grid-cols-2 gap-3">
          {pedidos.map((p) => {
            const total = p.items.reduce((s, l) => s + l.precio * l.pedido, 0);
            const unid = p.items.reduce((s, l) => s + l.pedido, 0);
            const listas = p.items.filter((l) => l.preparado >= l.pedido || l.faltante > 0).length;
            return (
              <Card key={p.id} className="p-4 hover:border-borde-fuerte transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="f-m text-xs text-texto-tenue">{p.nro}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${chip[p.estado]}`}>{p.estado}</span>
                    </div>
                    <h3 className="f-d text-base mt-1 truncate">{p.cliente}</h3>
                    <div className="text-xs text-texto-suave flex items-center gap-1.5 mt-0.5">
                      {p.canal === "Teléfono" ? <Phone size={12} /> : <MessageCircle size={12} />} {p.canal} · {p.hora}
                      <span className="text-texto-tenue">·</span>
                      {p.entrega === "Envío" ? <Bike size={12} /> : <Store size={12} />} {p.entrega}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="f-d text-lg">{money(total)}</div>
                    <div className="text-[11px] text-texto-tenue">{p.items.length} productos · {nf.format(Math.round(unid))} u</div>
                  </div>
                </div>
                {p.nota && <p className="text-xs text-texto-suave bg-superficie-2 rounded-lg px-2.5 py-1.5 mt-2.5">{p.nota}</p>}
                {p.estado !== "pendiente" && (
                  <div className="h-1.5 bg-superficie-2 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-bien rounded-full" style={{ width: `${(listas / p.items.length) * 100}%` }} />
                  </div>
                )}
                <Boton className="w-full mt-3" variant={p.estado === "listo" ? "ghost" : "primary"} onClick={() => setAbierto(p.id)}>
                  <ScanLine size={15} /> {p.estado === "pendiente" ? "Preparar con pistola" : p.estado === "preparando" ? "Seguir preparando" : "Ver y cobrar"}
                </Boton>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PrepararPedido({ ped, setPedidos, productos, setProductos, cobrar, ajustes, toast, volver }) {
  const [items, setItems] = useState(ped.items.map((l) => ({ ...l })));
  const [ultimo, setUltimo] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [camara, setCamara] = useState(false);
  const libre = !!ped.libre;

  useEffect(() => {
    if (ped.estado === "pendiente") setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, estado: "preparando" } : p)));
  }, []);

  const guardar = (nuevos, estado) => {
    setItems(nuevos);
    setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, items: nuevos, ...(estado ? { estado } : {}) } : p)));
  };

  const registrar = (codigo) => {
    setError(null);
    const i = items.findIndex((l) => l.barcode === codigo);

    // Venta libre: la lista no existe de antemano, se arma con cada disparo.
    if (libre) {
      const p = productos.find((x) => x.barcode === codigo);
      if (!p) {
        beep(false, ajustes.sonido);
        setError({ msg: `Código ${codigo} desconocido.` });
        setUltimo(null);
        return;
      }
      const paso = p.unidad === "kg" ? 0.25 : 1;
      const nuevos = i === -1
        ? [...items, { pid: p.id, nombre: p.nombre, barcode: p.barcode, precio: p.precio, unidad: p.unidad, pedido: paso, preparado: paso, faltante: 0 }]
        : items.map((l, j) => (j === i ? { ...l, pedido: +(l.pedido + paso).toFixed(3), preparado: +(l.preparado + paso).toFixed(3) } : l));
      const linea = i === -1 ? nuevos[nuevos.length - 1] : nuevos[i];
      beep(true, ajustes.sonido);
      guardar(nuevos);
      setUltimo({
        pid: p.id, nombre: p.nombre, preparado: linea.preparado, pedido: linea.preparado, unidad: p.unidad,
        precio: p.precio,
        aviso: linea.preparado > p.stock ? `En sistema figuran ${p.unidad === "kg" ? p.stock.toFixed(1) : p.stock} ${p.unidad}` : null,
      });
      return;
    }

    if (i === -1) {
      const p = productos.find((x) => x.barcode === codigo);
      beep(false, ajustes.sonido);
      setError(p ? { msg: `${p.nombre} no está en este pedido.`, extra: p } : { msg: `Código ${codigo} desconocido.` });
      setUltimo(null);
      return;
    }
    const l = items[i];
    const paso = l.unidad === "kg" ? 0.25 : 1;
    if (l.preparado + paso > l.pedido + 0.001) {
      beep(false, ajustes.sonido);
      setError({ msg: `${l.nombre}: ya escaneaste las ${l.unidad === "kg" ? l.pedido.toFixed(2) + " kg" : l.pedido + " unidades"} del pedido.` });
      return;
    }
    const nuevos = [...items];
    nuevos[i] = { ...l, preparado: +(l.preparado + paso).toFixed(3), faltante: 0 };
    beep(true, ajustes.sonido);
    guardar(nuevos);
    setUltimo({ pid: l.pid, nombre: l.nombre, preparado: nuevos[i].preparado, pedido: l.pedido, unidad: l.unidad });
  };

  useScanHandler(registrar, !cerrando && !ticket && !camara);

  const agregarExtra = (p) => {
    const nuevos = [...items, { pid: p.id, nombre: p.nombre, barcode: p.barcode, precio: p.precio, unidad: p.unidad, pedido: 1, preparado: 1, faltante: 0, extra: true }];
    guardar(nuevos); setError(null); setUltimo({ pid: p.id, nombre: p.nombre, preparado: 1, pedido: 1, unidad: p.unidad });
    beep(true, ajustes.sonido);
    toast(`${p.nombre} agregado al pedido.`);
  };

  const setCant = (pid, v) => {
    const n = Math.max(0, +v.toFixed(3));
    if (libre && n === 0) return guardar(items.filter((l) => l.pid !== pid));
    guardar(items.map((l) => (l.pid === pid ? { ...l, preparado: n, faltante: 0, ...(libre ? { pedido: n } : {}) } : l)));
  };
  const quitar = (pid) => guardar(items.filter((l) => l.pid !== pid));
  const marcarFaltante = (pid) => guardar(items.map((l) => (l.pid === pid ? { ...l, faltante: +(l.pedido - l.preparado).toFixed(3) } : l)));

  const conPrecio = items.map((l) => {
    const p = productos.find((x) => x.id === l.pid);
    const { precio, lista, nombre } = precioAplicado(p ? { ...p, precio: l.precio } : { precio: l.precio, precios: {} }, l.preparado, ajustes);
    return { ...l, unit: precio, lista, listaNombre: nombre };
  });
  const totalPedido = items.reduce((s, l) => s + l.pedido, 0);
  const totalPrep = items.reduce((s, l) => s + l.preparado, 0);
  const resueltos = items.filter((l) => l.preparado >= l.pedido - 0.001 || l.faltante > 0).length;
  const monto = conPrecio.reduce((s, l) => s + l.unit * l.preparado, 0);
  const faltantes = items.filter((l) => l.faltante > 0);
  const completo = resueltos === items.length;

  const cantidadPendiente = ultimo && ultimo.pid && items.some((l) => l.pid === ultimo.pid) && esCantidad(q) && q.trim() !== "";

  const aplicarCantidad = () => {
    const n = aNumero(q);
    const l = items.find((x) => x.pid === ultimo.pid);
    if (!(n > 0) || !l) return;
    setCant(ultimo.pid, libre ? n : Math.min(n, l.pedido));
    setUltimo({ ...ultimo, preparado: libre ? n : Math.min(n, l.pedido) });
    beep(true, ajustes.sonido);
    setQ("");
  };

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const busq = !cantidadPendiente && q.trim().length >= 2 ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || p.barcode.includes(q.trim())).slice(0, 6) : [];

  const cobrarPedido = (medio) => {
    const lineas = conPrecio.filter((l) => l.preparado > 0).map((l) => {
      const p = productos.find((x) => x.id === l.pid);
      return { pid: l.pid, qty: l.preparado, precio: l.unit, costo: p ? p.costo : 0, nombre: l.nombre, unidad: l.unidad, lista: l.lista, listaNombre: l.listaNombre };
    });
    const t = cobrar({ items: lineas, sub: monto, desc: 0, total: monto, medio, fiscal: !!ajustes.arca,
      ganancia: monto - lineas.reduce((s, l) => s + l.costo * l.qty, 0) });
    /* Sin caja abierta el pedido queda como estaba, listo para cobrarse
       de nuevo cuando se abra. */
    if (!t) { setCerrando(false); return; }
    setProductos((ps) => ps.map((p) => {
      const l = lineas.find((x) => x.pid === p.id);
      return l ? { ...p, stock: +(p.stock - l.qty).toFixed(3), ultimaVenta: HOY, u30: p.u30 + l.qty } : p;
    }));
    setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, items, estado: "entregado" } : p)));
    setCerrando(false);
    setTicket(t);
  };

  const W = ajustes.ancho === 58 ? 32 : 48;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton variant="quiet" size="sm" onClick={volver}><ChevronLeft size={15} /> Todos los pedidos</Boton>
        <div className="flex-1 min-w-0">
          {libre ? (
            <>
              <div className="f-d text-lg">{ped.nro} · Venta con pistola</div>
              <input value={ped.cliente === "Venta en el salón" ? "" : ped.cliente}
                onChange={(e) => setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, cliente: e.target.value || "Venta en el salón" } : p)))}
                placeholder="Cliente (opcional)"
                className="text-xs text-texto-suave border border-borde rounded-lg px-2 py-1 mt-1 outline-none focus:border-acento w-56" />
            </>
          ) : (
            <>
              <div className="f-d text-lg">{ped.nro} · {ped.cliente}</div>
              <div className="text-xs text-texto-suave">{ped.entrega} · {ped.dir} · {ped.tel}</div>
            </>
          )}
        </div>
        <div className="text-right">
          <div className="f-d text-xl">{money(monto)}</div>
          <div className="text-[11px] text-texto-tenue">{libre ? `${items.length} renglones · ${nf.format(Math.round(totalPrep))} u` : `${resueltos} de ${items.length} renglones`}</div>
        </div>
      </div>

      {/* Zona de escaneo */}
      <div className={`rounded-2xl p-5 text-center transition-colors ${error ? "bg-red-600" : ultimo ? "bg-emerald-600" : "bg-superficie-3"}`}>
        <div className="flex items-center justify-center gap-2 text-texto/70 text-[11px] uppercase tracking-widest font-semibold">
          <ScanLine size={14} /> {libre ? "Pistola activa · cargá el changuito" : "Pistola activa · dispará sobre el producto"}
        </div>
        <button onClick={() => setCamara(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-texto bg-superficie/15 active:bg-superficie/25 border border-white/25 rounded-xl px-3 py-1.5">
          <Cam size={14} /> Usar la cámara
        </button>
        {error ? (
          <>
            <div className="f-d text-texto text-xl mt-2">{error.msg}</div>
            {error.extra && <Boton size="sm" variant="ghost" className="mt-3" onClick={() => agregarExtra(error.extra)}>Agregarlo igual al pedido</Boton>}
          </>
        ) : ultimo ? (
          <>
            <div className="f-d text-texto text-xl mt-2">{ultimo.nombre}</div>
            <div className="f-m text-texto/80 text-sm mt-1">
              {libre
                ? `${ultimo.unidad === "kg" ? ultimo.preparado.toFixed(2) + " kg" : ultimo.preparado + " u"} · ${money(ultimo.precio * ultimo.preparado)}`
                : ultimo.unidad === "kg" ? `${ultimo.preparado.toFixed(2)} de ${ultimo.pedido.toFixed(2)} kg` : `${ultimo.preparado} de ${ultimo.pedido} unidades`}
            </div>
            {ultimo.aviso && <div className="text-texto/70 text-xs mt-1">{ultimo.aviso}</div>}
          </>
        ) : (
          <div className="f-d text-texto text-xl mt-2">{libre ? "Escaneá el primer producto" : "Esperando el primer disparo"}</div>
        )}
        {libre ? (
          <div className="f-m text-texto/70 text-sm mt-4">{nf.format(Math.round(totalPrep))} unidades · {money(monto)}</div>
        ) : (
          <>
            <div className="mt-4 h-2 bg-superficie/20 rounded-full overflow-hidden max-w-md mx-auto">
              <div className="h-full bg-superficie rounded-full transition-all" style={{ width: `${totalPedido ? (totalPrep / totalPedido) * 100 : 0}%` }} />
            </div>
            <div className="f-m text-texto/70 text-xs mt-1.5">{Math.round(totalPrep)} de {Math.round(totalPedido)} unidades</div>
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {libre && items.length === 0 && <Vacio>El changuito está vacío. Disparale al primer producto o buscalo abajo.</Vacio>}
        <ul className="divide-y divide-borde">
          {items.map((l) => {
            const ok = l.preparado >= l.pedido - 0.001;
            const falt = l.faltante > 0;
            return (
              <li key={l.pid} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${ok ? "bg-bien-suave/40" : falt ? "bg-mal-suave/40" : ""}`}>
                <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${libre ? "bg-superficie-3 text-texto" : ok ? "bg-bien text-texto" : falt ? "bg-mal text-texto" : "bg-superficie-2 text-texto-tenue"}`}>
                  {libre ? <span className="f-m text-[11px]">{l.unidad === "kg" ? l.preparado.toFixed(1) : l.preparado}</span>
                    : ok ? <Check size={15} /> : falt ? <X size={15} /> : <span className="f-m text-[11px]">{l.unidad === "kg" ? l.pedido.toFixed(1) : l.pedido}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-texto truncate">{l.nombre} {l.extra && <span className="text-[10px] text-acento font-bold">AGREGADO</span>}</div>
                  <div className="f-m text-[11px] text-texto-tenue">{l.barcode} · {money(l.precio)}{l.unidad === "kg" ? "/kg" : ""}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCant(l.pid, l.preparado - (l.unidad === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-lg border border-borde hover:bg-superficie-2 flex items-center justify-center"><Minus size={13} /></button>
                  <span className="f-m w-16 text-center text-sm">
                    {l.unidad === "kg" ? l.preparado.toFixed(2) : l.preparado}
                    {!libre && <span className="text-texto-tenue">/{l.unidad === "kg" ? l.pedido.toFixed(2) : l.pedido}</span>}
                  </span>
                  <button onClick={() => setCant(l.pid, libre ? l.preparado + (l.unidad === "kg" ? 0.25 : 1) : Math.min(l.pedido, l.preparado + (l.unidad === "kg" ? 0.25 : 1)))} className="w-7 h-7 rounded-lg border border-borde hover:bg-superficie-2 flex items-center justify-center"><Plus size={13} /></button>
                </div>
                {libre
                  ? <><span className="f-m text-sm w-24 text-right">
                      {money((conPrecio.find((x) => x.pid === l.pid) || l).unit * l.preparado)}
                      {(conPrecio.find((x) => x.pid === l.pid) || {}).lista && <span className="block text-[9px] text-bien font-bold uppercase">{(conPrecio.find((x) => x.pid === l.pid) || {}).listaNombre}</span>}
                    </span>
                      <button onClick={() => quitar(l.pid)} className="text-texto-tenue hover:text-mal"><Trash2 size={15} /></button></>
                  : <Boton size="sm" variant={falt ? "danger" : "quiet"} onClick={() => marcarFaltante(l.pid)} title="No hay stock en góndola">Sin stock</Boton>}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-borde p-4 bg-superficie-2">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Buscar a mano, o escribir la cantidad del último escaneado</div>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && cantidadPendiente) { e.preventDefault(); aplicarCantidad(); } }}
            placeholder="Nombre, código, o una cantidad para el último"
            className="w-full border border-borde rounded-xl px-3 py-2 text-sm outline-none focus:border-acento bg-superficie" />
          {cantidadPendiente && (
            <p className="text-sm text-emerald-800 bg-bien-suave border border-bien rounded-xl px-3 py-2 mt-2">
              <strong className="f-d text-lg">{aNumero(q)}</strong> {ultimo.unidad === "kg" ? "kg" : "unidades"} de <strong>{ultimo.nombre}</strong> · Enter para aplicar
            </p>
          )}
          {busq.length > 0 && (
            <ul className="mt-2 bg-superficie border border-borde rounded-xl divide-y divide-borde max-h-56 overflow-auto">
              {busq.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { registrar(p.barcode); setQ(""); }} className="w-full text-left px-3 py-2 hover:bg-superficie-2 flex justify-between gap-3">
                    <span className="text-sm truncate">{p.nombre}</span>
                    <span className="f-m text-xs text-texto-tenue shrink-0">{p.barcode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 sticky bottom-24 md:bottom-4 bg-superficie border border-borde rounded-2xl p-3 shadow-sm z-30">
        <div className="text-sm">
          <span className="text-texto-suave">{libre ? "Total " : "Preparado "}</span><span className="f-d text-xl">{money(monto)}</span>
          {faltantes.length > 0 && <span className="text-mal text-xs font-semibold ml-2">{faltantes.length} sin stock</span>}
        </div>
        <Boton onClick={() => setCerrando(true)} disabled={totalPrep === 0} variant={libre || completo ? "primary" : "dark"}>
          <PackageCheck size={16} /> {libre ? "Cobrar" : completo ? "Cerrar preparación" : "Cerrar igual"}
        </Boton>
      </div>

      {/* Cierre: comanda + cobro */}
      <Modal open={cerrando} onClose={() => setCerrando(false)} ancho="max-w-md">
        <div className="p-5">
          <h3 className="f-d text-lg">{libre ? `Cobrar ${ped.nro}` : `Pedido ${ped.nro} preparado`}</h3>
          <p className="text-sm text-texto-suave mt-0.5">
            {libre ? `${items.length} productos, ${nf.format(Math.round(totalPrep))} unidades. Al cobrar se emite el ticket, se descuenta el stock y entra en caja.`
              : "Esta es la comanda que sale por la impresora para el bolsón."}
          </p>
          {libre ? (
            <ul className="mt-4 border border-borde rounded-xl divide-y divide-borde max-h-56 overflow-auto text-sm">
              {items.map((l) => (
                <li key={l.pid} className="flex justify-between gap-3 px-3 py-2">
                  <span className="truncate">
                    {l.unidad === "kg" ? l.preparado.toFixed(2) + " kg" : l.preparado + " ×"} {l.nombre}
                    {(conPrecio.find((x) => x.pid === l.pid) || {}).lista && <span className="ml-1.5 text-[9px] font-bold text-bien uppercase">{(conPrecio.find((x) => x.pid === l.pid) || {}).listaNombre}</span>}
                  </span>
                  <span className="f-m shrink-0">{money((conPrecio.find((x) => x.pid === l.pid) || l).unit * l.preparado)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-superficie-2 rounded-xl p-3 mt-4 overflow-auto">
              <Comandera lineas={comandaPicking({ ...ped, items }, W)} ancho={ajustes.ancho} className="py-2 shadow-sm" />
            </div>
          )}
          {faltantes.length > 0 && (
            <div className="text-xs text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3 mt-3">
              Faltaron {faltantes.length} productos. Conviene avisarle a {ped.cliente.split(" ")[0]} antes de cobrar.
            </div>
          )}
          {!libre && (
            <div className="grid grid-cols-2 gap-1.5 mt-4">
              <Boton variant="ghost" onClick={() => imprimirComandera(comandaPicking({ ...ped, items }, W), ajustes.ancho, null, toast)}><Printer size={15} /> Imprimir comanda</Boton>
              <Boton variant="ghost" onClick={() => toast(`Aviso enviado a ${ped.cliente} por WhatsApp.`)}><MessageCircle size={15} /> Avisar al cliente</Boton>
            </div>
          )}
          <div className="border-t border-borde mt-4 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-texto-suave">Total a cobrar</span>
              <span className="f-d text-2xl">{money(monto)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              {mediosDe(ajustes).map((m) => <Boton key={m.k} size="sm" variant="ghost" onClick={() => cobrarPedido(m.k)}>{m.n}</Boton>)}
            </div>
            <Boton variant="quiet" className="w-full mt-2" onClick={() => {
              setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, items, estado: "listo" } : p)));
              setCerrando(false); volver();
              toast(libre ? "Queda apartado. Se cobra cuando lo pasan a buscar." : "Pedido listo para retirar. Se cobra cuando lo pasan a buscar.");
            }}>{libre ? "Dejar apartado sin cobrar" : "Dejar listo y cobrar después"}</Boton>
          </div>
        </div>
      </Modal>

      <EscanerCamara abierto={camara} onCerrar={() => setCamara(false)}
        titulo={libre ? "Cargá el changuito" : `Preparando ${ped.nro}`}
        onLeer={(cod) => registrar(cod)} />

      <TicketModal t={ticket} onClose={() => { setTicket(null); volver(); }} ajustes={ajustes} toast={toast} />
    </div>
  );
}
