/* ============================================================
   PRESENCIA ONLINE (0140)
   ============================================================

   La página del comercio en internet: `slug.genez.com.ar`. Existía desde
   0052, pero el comercio no podía tocar nada de ella —el lema, la
   descripción, la portada se cargaban a mano en la base— y para un súper
   o un bar mostraba solo el nombre y un botón para entrar.

   Acá el comercio decide qué ve la gente: cómo se ve (portada, frase,
   colores), cuándo abre, cómo encontrarlo, cómo se compra y un aviso del
   momento. A la derecha, el teléfono con la página tal como queda: la
   misma Vidriera que dibuja la página de verdad, con los mismos datos
   que devuelve `presencia_de` (`presenciaDesdeConfig`).

   De fábrica no está publicada. Cargar el teléfono para el ticket no lo
   pone en internet: cada dato de contacto se marca para mostrar.

   Dónde se guarda cada cosa (todo en la config del comercio):
     marca     lema, bajada, portada, tema    (los lee marca_de)
     contacto  los datos, compartidos con el ticket y Datos del negocio
     publico   publicada, horarios, qué se muestra, mapa, pagos,
               entrega, aviso                  (los lee presencia_de)
   ============================================================ */

import React, { useRef, useState } from "react";
import { Copy, ExternalLink, Download, ImagePlus, Trash2, Plus, X, Globe } from "lucide-react";
import { Card, Boton, CodigoQR } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { useLogos } from "../ui/logos.js";
import { Vidriera } from "../cliente/Vidriera.jsx";
import { DIAS, presenciaDesdeConfig } from "../cliente/vidriera.js";

const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold text-texto-tenue";

function Interruptor({ prendido, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} onClick={onCambiar}
      className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 ${prendido ? "bg-acento border-acento" : "bg-superficie-3 border-borde"}`}>
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-superficie shadow-sm transition-all ${prendido ? "left-[19px]" : "left-0.5"}`} />
    </button>
  );
}

function Bloque({ titulo, d, children, accion }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={rotulo}>{titulo}</div>
          {d && <p className="text-xs text-texto-tenue mt-1 leading-relaxed">{d}</p>}
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/* La portada se achica antes de guardarla: va en la config del comercio
   y viaja en cada carga de la página. 1200 px de ancho alcanzan para
   cualquier teléfono. */
function achicar(archivo) {
  return new Promise((resolver, fallar) => {
    const lector = new FileReader();
    lector.onerror = () => fallar(new Error("No se pudo leer la imagen."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => fallar(new Error("Esa imagen no se puede usar."));
      img.onload = () => {
        const w = Math.min(1200, img.naturalWidth);
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = Math.min(h, 900);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, (c.height - h) / 2, w, h);
        resolver(c.toDataURL("image/jpeg", 0.8));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

/* El QR de la página como PNG, para imprimirlo en la vidriera del local
   o en un cartel. */
function bajarQR(contenedor, nombre) {
  const svg = contenedor && contenedor.querySelector("svg");
  if (!svg) return;
  const lado = 1024;
  const datos = new XMLSerializer().serializeToString(svg).replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" fill="#000"`);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = lado + 80;
    c.height = lado + 80;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 40, 40, lado, lado);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qr-${nombre}.png`;
    a.click();
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(datos)}`;
}

export function PresenciaOnline({ ajustes, setAjustes, slug, toast, onIr }) {
  const marca = ajustes.marca || {};
  const contacto = ajustes.contacto || {};
  const pub = ajustes.publico || {};
  const setMarca = (k, v) => setAjustes({ ...ajustes, marca: { ...marca, [k]: v } });
  const setContacto = (k, v) => setAjustes({ ...ajustes, contacto: { ...contacto, [k]: v } });
  const setPub = (k, v) => setAjustes({ ...ajustes, publico: { ...pub, [k]: v } });
  const mostrar = pub.mostrar || {};
  const horarios = pub.horarios || {};
  const entrega = pub.entrega || {};
  const qrRef = useRef(null);
  const archivo = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const logos = useLogos(marca);

  const url = slug ? `https://${slug}.genez.com.ar` : null;
  const presencia = presenciaDesdeConfig(ajustes);

  const setFranjas = (dia, franjas) => setPub("horarios", { ...horarios, [dia]: franjas });
  const copiarATodos = (dia) => {
    const f = horarios[dia] || [];
    setPub("horarios", { ...horarios, ...Object.fromEntries(["lun", "mar", "mie", "jue", "vie"].map((k) => [k, f.map((x) => ({ ...x }))])) });
  };

  const medios = (ajustes.medios || []).filter((m) => m.activo !== false && m.k !== "cuenta_corriente");
  const pagos = pub.pagos || [];

  async function subirPortada(e) {
    const a = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!a) return;
    setSubiendo(true);
    try { setMarca("portada", await achicar(a)); } catch (err) { toast && toast(err.message, "mal"); }
    setSubiendo(false);
  }

  const CAMPOS = [
    ["direccion", "Dirección", "Av. Rivadavia 1234, CABA", contacto],
    ["mapa", "Link de Google Maps", "Opcional: si no, se arma con la dirección", pub],
    ["whatsapp", "WhatsApp", "11 5555-6666", contacto],
    ["telefono", "Teléfono", "11 4444-5555", contacto],
    ["email", "Mail", "hola@tucomercio.com", contacto],
    ["instagram", "Instagram", "@tucomercio", contacto],
    ["facebook", "Facebook", "tucomercio o el link", contacto],
    ["tiktok", "TikTok", "@tucomercio", contacto],
    ["web", "Web", "tucomercio.com.ar", contacto],
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Bloque titulo="Tu página" d="Tu dirección en internet. Compartila en tus redes, en WhatsApp o imprimí el QR para la puerta del local."
          accion={<div className="flex items-center gap-2.5"><span className="text-xs text-texto-suave">{pub.publicada ? "Publicada" : "Sin publicar"}</span><Interruptor prendido={!!pub.publicada} onCambiar={() => setPub("publicada", !pub.publicada)} etiqueta="Publicar mi información" /></div>}>
          {url ? (
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div ref={qrRef} className="bg-papel text-tinta rounded-lg p-2 w-fit shrink-0"><CodigoQR semilla={url} size={96} /></div>
              <div className="min-w-0 flex-1">
                <div className="f-m text-sm font-semibold truncate">{url.replace("https://", "")}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Boton variant="ghost" size="sm" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(url).then(() => toast && toast("Copiado")); }}><Copy size={14} /> Copiar</Boton>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-md border border-borde px-3 py-1.5 hover:bg-superficie-2"><ExternalLink size={14} /> Abrir</a>
                  <Boton variant="ghost" size="sm" onClick={() => bajarQR(qrRef.current, slug)}><Download size={14} /> Bajar el QR</Boton>
                </div>
                {!pub.publicada && <p className="text-xs text-texto-tenue mt-3">Sin publicar, la página muestra solo tu nombre y tu logo. Prendela cuando tengas cargado lo de abajo.</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-texto-suave">Tu comercio todavía no tiene dirección. Escribinos y te la armamos.</p>
          )}
        </Bloque>

        <Bloque titulo="Cómo se ve" d="Lo primero que ve quien entra. El logo es el de Datos del negocio.">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-texto-suave">Foto de portada</span>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="w-40 h-20 rounded-lg border border-borde bg-superficie-2 overflow-hidden shrink-0 flex items-center justify-center">
                  {marca.portada ? <img src={marca.portada} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={20} className="text-texto-tenue" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Boton variant="ghost" size="sm" onClick={() => archivo.current && archivo.current.click()} disabled={subiendo}>{subiendo ? "Subiendo…" : marca.portada ? "Cambiar" : "Subir"}</Boton>
                  {marca.portada && <Boton variant="ghost" size="sm" onClick={() => setMarca("portada", null)}><Trash2 size={14} /> Sacar</Boton>}
                </div>
                <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={subirPortada} />
              </div>
              <p className="text-xs text-texto-tenue mt-1.5">El frente del local, tus productos, tu equipo. Horizontal se ve mejor.</p>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-texto-suave">Una frase</span>
              <input value={marca.lema || ""} onChange={(e) => setMarca("lema", e.target.value.slice(0, 60))} placeholder="El almacén del barrio" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-texto-suave">Quiénes son</span>
              <textarea value={marca.bajada || ""} onChange={(e) => setMarca("bajada", e.target.value.slice(0, 220))} rows={3}
                placeholder="Todo lo de todos los días, a dos cuadras de tu casa. Desde 1998." className={`${inputCls} resize-none`} />
            </label>
            <div>
              <span className="text-xs font-semibold text-texto-suave">Colores</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[["auto", "Los del teléfono"], ["claro", "Claro"], ["oscuro", "Oscuro"]].map(([k, n]) => (
                  <button key={k} type="button" onClick={() => setMarca("tema", k)}
                    className={`text-xs font-semibold rounded-md border px-3 py-1.5 ${(marca.tema || "auto") === k || (k === "claro" && marca.tema === "calido") ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </Bloque>

        <Bloque titulo="Horarios" d="Con esto la página dice sola si estás abierto ahora. Hasta dos franjas por día; una que termina después de medianoche también va.">
          <ul className="divide-y divide-borde">
            {DIAS.map((d) => {
              const fs = horarios[d.k] || [];
              const abierto = fs.length > 0;
              return (
                <li key={d.k} data-dia={d.k} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="w-28 flex items-center gap-2.5">
                    <Interruptor prendido={abierto} onCambiar={() => setFranjas(d.k, abierto ? [] : [{ d: "09:00", h: "18:00" }])} etiqueta={`Abre el ${d.n}`} />
                    <span className="text-sm font-semibold">{d.n.slice(0, 3)}</span>
                  </div>
                  {abierto ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      {fs.map((f, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <input type="time" value={f.d} onChange={(e) => setFranjas(d.k, fs.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)))} className={`${inputCls} !mt-0 w-[104px] f-m`} />
                          <span className="text-xs text-texto-tenue">a</span>
                          <input type="time" value={f.h} onChange={(e) => setFranjas(d.k, fs.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)))} className={`${inputCls} !mt-0 w-[104px] f-m`} />
                          {fs.length > 1 && <button type="button" aria-label="Sacar esta franja" onClick={() => setFranjas(d.k, fs.filter((_, j) => j !== i))} className="p-1 text-texto-tenue hover:text-texto"><X size={14} /></button>}
                        </span>
                      ))}
                      {fs.length < 2 && <button type="button" onClick={() => setFranjas(d.k, [...fs, { d: "17:00", h: "21:00" }])} className="text-xs font-semibold text-acento hover:underline flex items-center gap-1"><Plus size={13} /> otra franja</button>}
                      {d.k === "lun" && <button type="button" onClick={() => copiarATodos("lun")} className="text-xs text-texto-tenue hover:text-texto underline">igual de lunes a viernes</button>}
                    </div>
                  ) : <span className="text-sm text-texto-tenue">Cerrado</span>}
                </li>
              );
            })}
          </ul>
        </Bloque>

        <Bloque titulo="Dónde y cómo te encuentran" d="Marcá lo que querés mostrar. Son los mismos datos del ticket y de Datos del negocio: si cambiás uno acá, cambia allá.">
          <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
            {CAMPOS.map(([k, n, ph, origen]) => (
              <div key={k}>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-texto-suave">{n}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-texto-tenue">
                    <input type="checkbox" checked={!!mostrar[k]} onChange={(e) => setPub("mostrar", { ...mostrar, [k]: e.target.checked })} /> mostrar
                  </span>
                </label>
                <input value={origen[k] || ""} placeholder={ph}
                  onChange={(e) => (origen === pub ? setPub(k, e.target.value) : setContacto(k, e.target.value))} className={inputCls} />
              </div>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Cómo se compra" d="Para que nadie vaya hasta el local a preguntar.">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-texto-suave">Medios de pago</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {medios.map((m) => {
                  const esta = pagos.includes(m.n);
                  return (
                    <button key={m.k} type="button" onClick={() => setPub("pagos", esta ? pagos.filter((x) => x !== m.n) : [...pagos, m.n])}
                      className={`text-xs font-semibold rounded-md border px-3 py-1.5 ${esta ? "border-acento bg-acento-suave" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>{m.n}</button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!entrega.retiro} onChange={(e) => setPub("entrega", { ...entrega, retiro: e.target.checked })} /> Retiro en el local</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!entrega.envio} onChange={(e) => setPub("entrega", { ...entrega, envio: e.target.checked })} /> Hacemos envíos</label>
            </div>
            {entrega.envio && (
              <label className="block">
                <span className="text-xs font-semibold text-texto-suave">Hasta dónde</span>
                <input value={entrega.zona || ""} onChange={(e) => setPub("entrega", { ...entrega, zona: e.target.value.slice(0, 120) })} placeholder="Hasta 15 cuadras · Gratis desde $20.000" className={inputCls} />
              </label>
            )}
          </div>
        </Bloque>

        <Bloque titulo="Un aviso" d="Algo del momento, arriba de todo: un feriado, vacaciones, una promo. Sacalo cuando pase."
          accion={pub.aviso ? <button type="button" onClick={() => setPub("aviso", "")} className="text-xs font-semibold text-acento hover:underline">Sacar</button> : null}>
          <input value={pub.aviso || ""} onChange={(e) => setPub("aviso", e.target.value.slice(0, 200))} placeholder="Este lunes feriado abrimos de 9 a 13" className={inputCls} />
        </Bloque>
      </div>

      {/* El teléfono: la página como la va a ver la gente. */}
      <div className="xl:sticky xl:top-4">
        <div className={rotulo}>Así se ve</div>
        <div className={`mt-3 mx-auto w-full max-w-[340px] rounded-[28px] border-[6px] border-superficie-3 overflow-hidden shadow-sm ${marca.tema === "oscuro" ? "" : "tema-claro"}`}>
          <div className="bg-fondo text-texto h-[640px] overflow-y-auto">
            {marca.portada && <div className="h-36 overflow-hidden"><img src={marca.portada} alt="" className="w-full h-full object-cover" /></div>}
            <div className="px-5 py-6">
              <div className="flex items-center gap-3">
                {(marca.tema === "oscuro" ? logos.paraOscuro : logos.paraClaro)
                  ? <img src={marca.tema === "oscuro" ? logos.paraOscuro : logos.paraClaro} alt="" className="h-10 max-w-[120px] object-contain" />
                  : <span className="w-10 h-10 rounded-lg bg-superficie-2 flex items-center justify-center"><Globe size={18} className="text-texto-tenue" /></span>}
                <div className="f-d text-lg leading-tight">{ajustes.negocio}</div>
              </div>
              {marca.lema && <div className="f-d text-xl mt-5 leading-snug">{marca.lema}</div>}
              {marca.bajada && <p className="text-sm text-texto-suave mt-2 leading-relaxed">{marca.bajada}</p>}
              {presencia
                ? <div className="mt-6"><Vidriera nombre={ajustes.negocio} presencia={presencia} enlaces={false} /></div>
                : <p className="mt-6 text-xs text-texto-tenue border border-dashed border-borde rounded-lg p-3">Sin publicar: la gente ve solo esto y el botón para entrar.</p>}
              <div className="mt-7 pt-5 border-t border-borde">
                <div className="rounded-lg bg-acento text-sobre-acento text-center text-sm font-bold py-2.5">Ingresar</div>
              </div>
            </div>
          </div>
        </div>
        {onIr && <button type="button" onClick={() => onIr("negocio")} className="mt-3 w-full text-xs text-texto-tenue hover:text-texto underline">Cambiar el logo o el nombre en Datos del negocio</button>}
      </div>
    </div>
  );
}
