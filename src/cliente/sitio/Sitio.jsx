/* ============================================================
   EL SITIO DEL COMERCIO (0141)
   ============================================================

   Nehuen, 09/10: "tiene que ser igual a Tienda Nube". La estructura es
   la de cualquier tienda que la gente ya sabe usar:

     encabezado   anuncio, logo, menú de categorías, buscador, carrito
     inicio       banner, destacados, categorías, productos, el local
                  (horarios, cómo llegar), fotos, video: en el orden que
                  elija el comercio
     catálogo     /productos, /categoria/x, /buscar/x, con orden
     producto     fotos, precio, variantes (talle, color), cantidad,
                  agregar o comprar ya, descripción, compartir, parecidos
     carrito      al costado, sin salir de lo que se estaba mirando
     checkout     contacto → entrega → pago → confirmar, con el resumen
     pie          contacto, horarios, redes, medios de pago

   Sin tienda (el comercio no tiene el módulo o la tiene apagada) es el
   mismo sitio con la información del local y sin productos.

   Tres plantillas (clásica, moderna, mínima) cambian la forma —dónde va
   el logo, cómo es una tarjeta, cómo se ve el banner— y no la
   estructura: así cada comercio se ve distinto sin que haya tres sitios
   que mantener.

   Se diseña con los breakpoints de siempre (sm, md, lg). La vista previa
   de la gestión lo dibuja adentro de un iframe del ancho de un celular o
   de una computadora, así ve exactamente lo mismo que el cliente.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, ShoppingBag, Menu, X, Plus, Minus, ChevronLeft, ChevronRight, MessageCircle, Phone, MapPin, Mail,
  Instagram, Facebook, Globe, Clock, Store, Truck, Check, Share2, Copy, ImageOff, ArrowRight, Banknote, Landmark,
} from "lucide-react";
import { ProveedorRuta, useRuta, Enlace, rutaProducto, rutaCategoria, slugDe, FUENTES, usarFuente, variablesDeColor, useCarrito, plata, sinAcentos } from "./nucleo.jsx";
import { Vidriera } from "../Vidriera.jsx";
import { DIAS, horarioDelDia, estadoAhora, linksDeContacto, numeroWhatsApp, videoEmbebido, hayHorarios } from "../vidriera.js";

const SECCIONES_DE_FABRICA = ["banner", "destacados", "categorias", "productos", "local", "galeria", "video"];
const atributosTexto = (a) => Object.values(a || {}).join(" · ");

/* ============================================================
   LA RAÍZ
   ============================================================ */

export function Sitio({ sitio, marca, slug, memoria = false, onPedir = null, onIngresar = null }) {
  return (
    <ProveedorRuta memoria={memoria}>
      <SitioAdentro sitio={sitio} marca={marca} slug={slug} memoria={memoria} onPedir={onPedir} onIngresar={onIngresar} />
    </ProveedorRuta>
  );
}

function SitioAdentro({ sitio, marca, slug, memoria, onPedir, onIngresar }) {
  const d = sitio.diseno || {};
  const oscuro = d.fondo === "oscuro";
  const raiz = useRef(null);
  const [doc, setDoc] = useState(null);
  useEffect(() => { if (raiz.current) setDoc(raiz.current.ownerDocument); }, []);
  usarFuente(d.fuente || "inter", doc);
  const { ruta, ir } = useRuta();
  const carrito = useCarrito(slug || marca.slug || "sitio", !memoria);
  const [abierto, setAbierto] = useState(false);
  const items = (sitio.tienda && sitio.tienda.items) || [];
  const categorias = useMemo(() => [...new Set(items.map((i) => i.categoria))], [items]);
  const ctx = { sitio, marca, d, items, categorias, carrito, abrirCarrito: () => setAbierto(true), onPedir, memoria, tienda: sitio.tienda, info: sitio.info, onIngresar };

  const estilo = {
    ...variablesDeColor(d.color, oscuro),
    fontFamily: `"${(FUENTES[d.fuente] || FUENTES.inter).n}", system-ui, sans-serif`,
  };

  let pagina;
  let titulo = null;
  const [, base, resto] = ruta.match(/^\/([^/]*)\/?(.*)$/) || [];
  if (base === "producto") {
    /* La dirección es "nombre-del-producto-3f2a91c0": se busca por el
       nombre y el pedazo de id desempata (dos productos con el mismo
       nombre). El pedazo solo no alcanza: ocho caracteres pueden
       repetirse en un catálogo grande. */
    const [, nombre, id] = resto.match(/^(.*)-([0-9a-f]{8})$/) || [null, resto, null];
    const p = items.find((x) => slugDe(x.nombre) === nombre && id && String(x.id).startsWith(id))
      || items.find((x) => slugDe(x.nombre) === nombre)
      || (id && items.find((x) => String(x.id).startsWith(id)));
    pagina = p ? <PaginaProducto ctx={ctx} p={p} /> : <NoEsta ctx={ctx} />;
    titulo = p ? p.nombre : null;
  } else if (base === "productos") { pagina = <Catalogo ctx={ctx} titulo="Todos los productos" lista={items} />; titulo = "Productos"; }
  else if (base === "categoria") {
    const c = categorias.find((x) => slugDe(x) === resto);
    pagina = c ? <Catalogo ctx={ctx} titulo={c} lista={items.filter((i) => i.categoria === c)} categoria={c} /> : <NoEsta ctx={ctx} />;
    titulo = c || null;
  } else if (base === "buscar") {
    const q = decodeURIComponent(resto || "");
    pagina = <Catalogo ctx={ctx} titulo={`Resultados para “${q}”`} lista={items.filter((i) => sinAcentos(`${i.nombre} ${i.categoria} ${i.marca || ""}`).includes(sinAcentos(q)))} />;
    titulo = `Buscar “${q}”`;
  } else if (base === "checkout") { pagina = <Checkout ctx={ctx} />; titulo = "Finalizar compra"; }
  else if (base === "pedido") { pagina = <Confirmacion ctx={ctx} numero={resto} />; titulo = `Pedido #${resto}`; }
  else if (base === "contacto") { pagina = <Contacto ctx={ctx} />; titulo = "Contacto"; }
  else pagina = <Inicio ctx={ctx} />;

  /* El título de la pestaña: "Remera lisa · Super 25", y en el inicio el
     nombre solo. En la vista previa de la gestión no se toca: le
     cambiaría el título a la gestión. */
  const tituloPestana = titulo ? `${titulo} · ${marca.nombre}` : marca.nombre;
  useEffect(() => {
    if (!memoria && tituloPestana) document.title = tituloPestana;
  }, [tituloPestana, memoria]);

  return (
    <div ref={raiz} className={`${oscuro ? "tema-noche" : "tema-calido"} bg-fondo text-texto min-h-screen flex flex-col`} style={estilo} data-sitio data-plantilla={d.plantilla}>
      <Encabezado ctx={ctx} />
      <main className="flex-1">{pagina}</main>
      <Pie ctx={ctx} />
      {ctx.info && ctx.info.contacto && ctx.info.contacto.whatsapp && base !== "checkout" && (
        <a href={memoria ? undefined : `https://wa.me/${numeroWhatsApp(ctx.info.contacto.whatsapp)}`} target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp"
          className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
          <MessageCircle size={26} />
        </a>
      )}
      {abierto && <CarritoLateral ctx={ctx} onCerrar={() => setAbierto(false)} onComprar={() => { setAbierto(false); ir("/checkout"); }} />}
    </div>
  );
}

/* ============================================================
   ENCABEZADO Y PIE
   ============================================================ */

function Logo({ ctx, chico }) {
  const { marca } = ctx;
  return (
    <Enlace a="/" className="flex items-center gap-2.5 min-w-0">
      {marca.logo
        ? <img src={marca.logo} alt={marca.nombre} className={`${chico ? "h-8" : "h-10 md:h-12"} max-w-[180px] object-contain`} />
        : <span className={`font-bold tracking-tight truncate ${chico ? "text-lg" : "text-xl md:text-2xl"}`}>{marca.nombre}</span>}
    </Enlace>
  );
}

function Encabezado({ ctx }) {
  const { d, categorias, carrito, abrirCarrito, tienda, info } = ctx;
  const { ir } = useRuta();
  const [menu, setMenu] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const anuncio = (info && info.aviso) || d.anuncio;
  const buscar = (e) => { e.preventDefault(); if (q.trim()) { ir(`/buscar/${encodeURIComponent(q.trim())}`); setBuscando(false); setMenu(false); } };
  const clasica = d.plantilla === "clasica";
  const minima = d.plantilla === "minima";
  const nav = [["/", "Inicio"], ...(tienda ? [["/productos", "Productos"]] : []), ...(tienda ? categorias.slice(0, 4).map((c) => [rutaCategoria(c), c]) : []), ["/contacto", "Contacto"]];

  const iconos = (
    <div className="flex items-center gap-1">
      {tienda && <button type="button" aria-label="Buscar" onClick={() => setBuscando((b) => !b)} className="p-2 rounded-full hover:bg-superficie-2"><Search size={20} /></button>}
      {tienda && (
        <button type="button" aria-label="Carrito" onClick={abrirCarrito} data-abrir-carrito className="relative p-2 rounded-full hover:bg-superficie-2">
          <ShoppingBag size={21} />
          {carrito.unidades > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-acento text-sobre-acento text-[10px] font-bold flex items-center justify-center">{carrito.unidades}</span>}
        </button>
      )}
    </div>
  );
  const linkNav = `${minima ? "text-[11px] uppercase tracking-[0.18em]" : "text-sm"} font-medium text-texto-suave hover:text-texto whitespace-nowrap`;

  return (
    <header className="sticky top-0 z-30 bg-fondo/95 backdrop-blur border-b border-borde">
      {anuncio && <div className="bg-acento text-sobre-acento text-center text-xs sm:text-sm font-medium px-4 py-2">{anuncio}</div>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`flex items-center gap-3 ${clasica ? "py-4 md:py-5" : "py-3"}`}>
          <button type="button" aria-label="Menú" onClick={() => setMenu(true)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-superficie-2"><Menu size={22} /></button>
          {clasica
            ? <div className="flex-1 flex justify-center md:justify-center"><Logo ctx={ctx} /></div>
            : <><Logo ctx={ctx} chico={minima} /><nav className="hidden md:flex items-center gap-6 mx-auto">{nav.map(([a, n]) => <Enlace key={a} a={a} className={linkNav}>{n}</Enlace>)}</nav></>}
          {clasica ? <div className="md:absolute md:right-6">{iconos}</div> : <div className="ml-auto md:ml-0">{iconos}</div>}
        </div>
        {clasica && <nav className="hidden md:flex justify-center gap-7 pb-3">{nav.map(([a, n]) => <Enlace key={a} a={a} className={linkNav}>{n}</Enlace>)}</nav>}
        {buscando && (
          <form onSubmit={buscar} className="pb-3">
            <div className="relative max-w-xl mx-auto">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué estás buscando?"
                className="w-full rounded-full border border-borde bg-superficie pl-10 pr-4 py-2.5 text-sm outline-none focus:border-acento" />
            </div>
          </form>
        )}
      </div>

      {menu && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-fondo flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-borde">
              <Logo ctx={ctx} chico />
              <button type="button" aria-label="Cerrar" onClick={() => setMenu(false)} className="p-1.5"><X size={22} /></button>
            </div>
            {tienda && (
              <form onSubmit={buscar} className="p-4">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full rounded-full border border-borde bg-superficie px-4 py-2.5 text-sm outline-none focus:border-acento" />
              </form>
            )}
            <nav className="flex flex-col px-2">
              {[["/", "Inicio"], ...(tienda ? [["/productos", "Todos los productos"], ...categorias.map((c) => [rutaCategoria(c), c])] : []), ["/contacto", "Contacto"]].map(([a, n]) => (
                <Enlace key={a} a={a} onClick={() => setMenu(false)} className="px-3 py-3 text-[15px] border-b border-borde last:border-0">{n}</Enlace>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function Pie({ ctx }) {
  const { marca, info, tienda, memoria, onIngresar } = ctx;
  const links = info ? linksDeContacto(info.contacto || {}, marca.nombre) : [];
  const ICO = { whatsapp: MessageCircle, telefono: Phone, mapa: MapPin, email: Mail, instagram: Instagram, facebook: Facebook, tiktok: Globe, web: Globe };
  const pagos = [
    ...(info && info.pagos ? info.pagos : []),
    ...(tienda ? [tienda.config.efectivo !== false && "Efectivo", tienda.config.transferencia && "Transferencia"].filter(Boolean) : []),
  ].filter((x, i, a) => a.indexOf(x) === i);
  return (
    <footer className="border-t border-borde bg-superficie mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo ctx={ctx} chico />
          {marca.bajada && <p className="text-sm text-texto-suave mt-3 leading-relaxed">{marca.bajada}</p>}
        </div>
        {links.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-texto-tenue mb-3">Contacto</div>
            <ul className="space-y-2 text-sm">
              {links.map((l) => { const I = ICO[l.k] || Globe; return <li key={l.k}><a href={memoria ? undefined : l.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-texto-suave hover:text-texto"><I size={15} /> <span className="truncate">{l.v}</span></a></li>; })}
            </ul>
          </div>
        )}
        {info && hayHorarios(info.horarios) && (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-texto-tenue mb-3">Horarios</div>
            <ul className="space-y-1 text-sm text-texto-suave">
              {DIAS.map((x) => <li key={x.k} className="flex justify-between gap-3"><span>{x.n.slice(0, 3)}</span><span>{horarioDelDia(info.horarios, x.k)}</span></li>)}
            </ul>
          </div>
        )}
        {pagos.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-texto-tenue mb-3">Medios de pago</div>
            <div className="flex flex-wrap gap-1.5">{pagos.map((p) => <span key={p} className="text-xs rounded-md border border-borde px-2 py-1 text-texto-suave">{p}</span>)}</div>
          </div>
        )}
      </div>
      <div className="border-t border-borde">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-texto-tenue">
          <span>© {new Date().getFullYear()} {marca.nombre}</span>
          <span className="flex items-center gap-4">
            {onIngresar && <button type="button" onClick={onIngresar} className="hover:text-texto underline">Mi cuenta</button>}
            <span>Hecho con Genez</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   PIEZAS
   ============================================================ */

function Contenedor({ children, className = "" }) {
  return <div className={`max-w-7xl mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Titulo({ children, ver }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{children}</h2>
      {ver && <Enlace a={ver} className="text-sm font-semibold text-acento hover:underline flex items-center gap-1 shrink-0">Ver todo <ArrowRight size={15} /></Enlace>}
    </div>
  );
}

function Foto({ src, className = "" }) {
  return src
    ? <img src={src} alt="" loading="lazy" className={`w-full h-full object-cover ${className}`} />
    : <div className="w-full h-full flex items-center justify-center text-texto-tenue bg-superficie-2"><ImageOff size={26} /></div>;
}

const precioDesde = (p) => {
  const ps = p.variantes && p.variantes.length ? p.variantes.map((v) => v.precio) : [p.precio];
  const min = Math.min(...ps), max = Math.max(...ps);
  return { min, varios: max > min };
};

function TarjetaProducto({ ctx, p }) {
  const { d } = ctx;
  const { min, varios } = precioDesde(p);
  const moderna = d.plantilla === "moderna", minima = d.plantilla === "minima";
  return (
    <Enlace a={rutaProducto(p)} data-tarjeta={p.id} className={`group flex flex-col ${moderna ? "" : minima ? "" : "rounded-xl border border-borde bg-superficie overflow-hidden"} `}>
      <div className={`relative overflow-hidden bg-superficie-2 ${moderna ? "rounded-2xl" : ""} ${minima ? "aspect-[3/4]" : "aspect-square"}`}>
        <Foto src={p.imagen} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        {p.agotado && <span className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider bg-fondo/90 text-texto rounded px-2 py-1">Sin stock</span>}
        {!p.agotado && p.destacado && !minima && <span className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider bg-acento text-sobre-acento rounded px-2 py-1">Destacado</span>}
      </div>
      <div className={`${moderna || minima ? "pt-3" : "p-3.5"} flex-1 flex flex-col`}>
        <div className={`leading-snug line-clamp-2 ${minima ? "text-xs uppercase tracking-[0.12em]" : "text-sm font-medium"}`}>{p.nombre}</div>
        <div className="mt-1.5 tabular-nums font-semibold">
          {varios && <span className="text-xs font-normal text-texto-tenue">desde </span>}{plata(min)}
          {p.unidad === "kg" && <span className="text-xs font-normal text-texto-tenue"> el kg</span>}
        </div>
      </div>
    </Enlace>
  );
}

function Grilla({ ctx, lista }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-5">
      {lista.map((p) => <TarjetaProducto key={p.id} ctx={ctx} p={p} />)}
    </div>
  );
}

function Banner({ ctx }) {
  const { d, marca, tienda } = ctx;
  const banners = d.banners || [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);
  /* Sin banners cargados: la portada de siempre, con la frase. */
  const b = banners[i] || (marca.portada ? { url: marca.portada, titulo: marca.lema || null, texto: null, boton: tienda ? "Ver productos" : null, enlace: "/productos" } : null);
  if (!b) {
    return (
      <Contenedor className="pt-12 pb-4">
        {marca.lema && <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl leading-tight">{marca.lema}</h1>}
        {marca.bajada && <p className="text-texto-suave mt-4 max-w-2xl text-base sm:text-lg">{marca.bajada}</p>}
      </Contenedor>
    );
  }
  const moderna = d.plantilla === "moderna", minima = d.plantilla === "minima";
  const enlace = b.enlace && b.enlace.startsWith("/") ? b.enlace : "/productos";
  return (
    <div className={moderna ? "max-w-7xl mx-auto px-4 sm:px-6 pt-4" : ""}>
      <div className={`relative overflow-hidden bg-superficie-2 ${moderna ? "rounded-3xl" : ""} ${minima ? "aspect-[16/7] sm:aspect-[16/6]" : "h-[340px] sm:h-[460px]"}`}>
        <img src={b.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {!minima && (b.titulo || b.texto || b.boton) && (
          <div className={`absolute inset-0 flex ${moderna ? "items-end" : "items-center"} bg-gradient-to-r from-black/60 via-black/25 to-transparent`}>
            <div className={`max-w-7xl mx-auto w-full px-6 sm:px-10 ${moderna ? "pb-10" : ""}`}>
              <div className="max-w-lg text-white">
                {b.titulo && <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">{b.titulo}</h1>}
                {b.texto && <p className="mt-3 text-base sm:text-lg text-white/90">{b.texto}</p>}
                {b.boton && <Enlace a={enlace} className="inline-flex items-center gap-2 mt-6 rounded-full bg-acento text-sobre-acento px-6 py-3 text-sm font-bold hover:bg-acento-vivo">{b.boton} <ArrowRight size={16} /></Enlace>}
              </div>
            </div>
          </div>
        )}
        {banners.length > 1 && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
            {banners.map((_, j) => <button key={j} type="button" aria-label={`Banner ${j + 1}`} onClick={() => setI(j)} className={`h-1.5 rounded-full transition-all ${j === i ? "w-6 bg-white" : "w-1.5 bg-white/60"}`} />)}
          </div>
        )}
      </div>
      {minima && (b.titulo || b.texto) && (
        <Contenedor className="pt-6 text-center">
          {b.titulo && <h1 className="text-2xl sm:text-3xl tracking-tight">{b.titulo}</h1>}
          {b.texto && <p className="text-texto-suave mt-2">{b.texto}</p>}
        </Contenedor>
      )}
    </div>
  );
}

/* ============================================================
   PÁGINAS
   ============================================================ */

function Inicio({ ctx }) {
  const { d, items, categorias, info, marca, tienda } = ctx;
  const orden = (d.secciones && d.secciones.length ? d.secciones : SECCIONES_DE_FABRICA.map((k) => ({ k, activo: true })))
    .filter((s) => s.activo !== false).map((s) => s.k);
  const destacados = items.filter((i) => i.destacado);
  const fotos = (info && info.galeria) || [];
  const video = info && videoEmbebido(info.video);

  const partes = {
    banner: <Banner key="banner" ctx={ctx} />,
    destacados: tienda && destacados.length > 0 && (
      <Contenedor key="destacados" className="pt-12"><Titulo ver="/productos">Destacados</Titulo><Grilla ctx={ctx} lista={destacados.slice(0, 8)} /></Contenedor>
    ),
    categorias: tienda && categorias.length > 1 && (
      <Contenedor key="categorias" className="pt-12">
        <Titulo>Categorías</Titulo>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {categorias.map((c) => {
            const foto = (items.find((i) => i.categoria === c && i.imagen) || {}).imagen;
            return (
              <Enlace key={c} a={rutaCategoria(c)} className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-superficie-2">
                <Foto src={foto} className="transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <span className="text-white font-semibold">{c}</span>
                </div>
              </Enlace>
            );
          })}
        </div>
      </Contenedor>
    ),
    productos: tienda && items.length > 0 && (
      <Contenedor key="productos" className="pt-12">
        <Titulo ver={items.length > 8 ? "/productos" : null}>{destacados.length ? "Todos los productos" : "Productos"}</Titulo>
        <Grilla ctx={ctx} lista={items.slice(0, 12)} />
      </Contenedor>
    ),
    local: info && (
      <Contenedor key="local" className="pt-14">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start rounded-2xl border border-borde bg-superficie p-6 sm:p-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{marca.lema || `Visitanos`}</h2>
            {marca.bajada && <p className="text-texto-suave mt-3 leading-relaxed max-w-xl">{marca.bajada}</p>}
            {info.contacto && info.contacto.direccion && <p className="mt-5 flex items-center gap-2 text-sm"><MapPin size={16} className="text-acento" /> {info.contacto.direccion}</p>}
          </div>
          <Vidriera nombre={marca.nombre} presencia={{ ...info, aviso: null }} enlaces={!ctx.memoria} />
        </div>
      </Contenedor>
    ),
    galeria: fotos.length > 0 && (
      <Contenedor key="galeria" className="pt-14">
        <Titulo>Fotos</Titulo>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{fotos.map((f, j) => <div key={j} className="aspect-square rounded-xl overflow-hidden bg-superficie-2"><Foto src={f} /></div>)}</div>
      </Contenedor>
    ),
    video: video && (
      <Contenedor key="video" className="pt-14">
        <div className={`mx-auto overflow-hidden rounded-2xl bg-superficie-2 ${video.vertical ? "aspect-[9/16] max-w-sm" : "aspect-video max-w-4xl"}`}>
          {ctx.memoria ? <div className="w-full h-full flex items-center justify-center text-texto-tenue">Video</div>
            : <iframe src={video.src} title="Video" className="w-full h-full" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
        </div>
      </Contenedor>
    ),
  };
  return <div>{orden.map((k) => partes[k]).filter(Boolean)}</div>;
}

const ORDENES = { destacados: "Destacados", menor: "Menor precio", mayor: "Mayor precio", nombre: "A-Z" };

function Catalogo({ ctx, titulo, lista, categoria = null }) {
  const { categorias } = ctx;
  const [orden, setOrden] = useState("destacados");
  const ordenada = [...lista].sort((a, b) => orden === "menor" ? precioDesde(a).min - precioDesde(b).min
    : orden === "mayor" ? precioDesde(b).min - precioDesde(a).min
    : orden === "nombre" ? a.nombre.localeCompare(b.nombre) : (b.destacado - a.destacado));
  return (
    <Contenedor className="pt-8">
      <div className="text-xs text-texto-tenue mb-2"><Enlace a="/" className="hover:text-texto">Inicio</Enlace> / {titulo}</div>
      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="hidden lg:block">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-texto-tenue mb-3">Categorías</div>
          <ul className="space-y-1.5 text-sm">
            <li><Enlace a="/productos" className={!categoria ? "font-semibold text-acento" : "text-texto-suave hover:text-texto"}>Todos</Enlace></li>
            {categorias.map((c) => <li key={c}><Enlace a={rutaCategoria(c)} className={c === categoria ? "font-semibold text-acento" : "text-texto-suave hover:text-texto"}>{c}</Enlace></li>)}
          </ul>
        </aside>
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{titulo}</h1>
              <p className="text-sm text-texto-tenue mt-1">{lista.length} {lista.length === 1 ? "producto" : "productos"}</p>
            </div>
            <select value={orden} onChange={(e) => setOrden(e.target.value)} className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm">
              {Object.entries(ORDENES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </div>
          <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-3 mb-2 -mx-1 px-1">
            <Enlace a="/productos" className={`shrink-0 text-xs font-semibold rounded-full border px-3 py-1.5 ${!categoria ? "border-acento bg-acento-suave" : "border-borde"}`}>Todos</Enlace>
            {categorias.map((c) => <Enlace key={c} a={rutaCategoria(c)} className={`shrink-0 text-xs font-semibold rounded-full border px-3 py-1.5 ${c === categoria ? "border-acento bg-acento-suave" : "border-borde"}`}>{c}</Enlace>)}
          </div>
          {ordenada.length ? <Grilla ctx={ctx} lista={ordenada} /> : <p className="text-texto-suave py-10">No encontramos productos.</p>}
        </div>
      </div>
    </Contenedor>
  );
}

function PaginaProducto({ ctx, p }) {
  const { items, carrito, abrirCarrito, memoria } = ctx;
  const { ir } = useRuta();
  const fotos = [p.imagen, ...(p.fotos || [])].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  const [foto, setFoto] = useState(0);
  const variantes = p.variantes || [];
  /* Los atributos y sus valores, en el orden en que aparecen. */
  const atributos = useMemo(() => {
    const m = {};
    for (const v of variantes) for (const [k, val] of Object.entries(v.atributos || {})) { m[k] = m[k] || []; if (!m[k].includes(val)) m[k].push(val); }
    return m;
  }, [variantes]);
  const [eleccion, setEleccion] = useState({});
  const elegida = variantes.length ? variantes.find((v) => Object.keys(atributos).every((k) => (v.atributos || {})[k] === eleccion[k])) : null;
  const disponible = (k, val) => variantes.some((v) => (v.atributos || {})[k] === val && !v.agotado
    && Object.entries(eleccion).every(([k2, v2]) => k2 === k || (v.atributos || {})[k2] === v2));
  const [cantidad, setCantidad] = useState(1);
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const precio = elegida ? elegida.precio : precioDesde(p).min;
  const agotado = elegida ? elegida.agotado : p.agotado;
  const falta = variantes.length && !elegida;
  const paso = p.unidad === "kg" ? 0.25 : 1;
  const parecidos = items.filter((x) => x.categoria === p.categoria && x.id !== p.id).slice(0, 4);

  useEffect(() => { setFoto(0); setEleccion({}); setCantidad(1); setAviso(null); }, [p.id]);
  useEffect(() => { if (elegida && elegida.imagen) { const i = fotos.indexOf(elegida.imagen); if (i >= 0) setFoto(i); } }, [elegida && elegida.id]);

  const agregar = (yComprar) => {
    if (falta) { setAviso(`Elegí ${Object.keys(atributos).filter((k) => !eleccion[k]).join(" y ").toLowerCase()}.`); return; }
    if (agotado || memoria) return;
    carrito.agregar({ id: elegida ? elegida.id : p.id, productoId: p.id, nombre: p.nombre, detalle: elegida ? atributosTexto(elegida.atributos) : null,
      precio, imagen: (elegida && elegida.imagen) || p.imagen, unidad: p.unidad }, cantidad);
    if (yComprar) ir("/checkout"); else abrirCarrito();
  };
  const url = typeof window !== "undefined" ? window.location.href : "";

  return (
    <Contenedor className="pt-6">
      <div className="text-xs text-texto-tenue mb-4">
        <Enlace a="/" className="hover:text-texto">Inicio</Enlace> / <Enlace a={rutaCategoria(p.categoria)} className="hover:text-texto">{p.categoria}</Enlace> / <span className="text-texto-suave">{p.nombre}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-8 lg:gap-14">
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-superficie-2">
            <Foto src={fotos[foto]} />
            {fotos.length > 1 && (
              <>
                <button type="button" aria-label="Foto anterior" onClick={() => setFoto((f) => (f - 1 + fotos.length) % fotos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-fondo/90 flex items-center justify-center shadow"><ChevronLeft size={20} /></button>
                <button type="button" aria-label="Foto siguiente" onClick={() => setFoto((f) => (f + 1) % fotos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-fondo/90 flex items-center justify-center shadow"><ChevronRight size={20} /></button>
              </>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {fotos.map((f, i) => (
                <button key={i} type="button" onClick={() => setFoto(i)} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 border-2 ${i === foto ? "border-acento" : "border-transparent"}`}><Foto src={f} /></button>
              ))}
            </div>
          )}
        </div>

        <div>
          {p.marca && <div className="text-xs uppercase tracking-[0.15em] text-texto-tenue">{p.marca}</div>}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 leading-tight">{p.nombre}</h1>
          <div className="text-2xl sm:text-3xl font-semibold tabular-nums mt-3">
            {plata(precio)}{p.unidad === "kg" && <span className="text-base font-normal text-texto-tenue"> el kg</span>}
          </div>
          {(elegida ? elegida.stock : p.stock) != null && !agotado && <p className="text-sm text-texto-suave mt-1">Quedan {elegida ? elegida.stock : p.stock}</p>}

          {Object.entries(atributos).map(([k, vals]) => (
            <div key={k} className="mt-6">
              <div className="text-sm font-semibold mb-2">{k}{eleccion[k] ? <span className="font-normal text-texto-suave">: {eleccion[k]}</span> : null}</div>
              <div className="flex flex-wrap gap-2">
                {vals.map((val) => {
                  const ok = disponible(k, val);
                  const sel = eleccion[k] === val;
                  return (
                    <button key={val} type="button" data-variante={`${k}:${val}`} onClick={() => { setAviso(null); setEleccion((e) => ({ ...e, [k]: sel ? undefined : val })); }}
                      className={`min-w-[44px] rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${sel ? "border-acento bg-acento text-sobre-acento" : "border-borde hover:border-texto"} ${ok ? "" : "opacity-40 line-through"}`}>
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="flex items-center rounded-xl border border-borde">
              <button type="button" aria-label="Uno menos" onClick={() => setCantidad((c) => Math.max(paso, +(c - paso).toFixed(2)))} className="p-3"><Minus size={16} /></button>
              <span className="w-12 text-center tabular-nums font-semibold">{p.unidad === "kg" ? `${cantidad} kg` : cantidad}</span>
              <button type="button" aria-label="Uno más" onClick={() => setCantidad((c) => Math.min(50, +(c + paso).toFixed(2)))} className="p-3"><Plus size={16} /></button>
            </div>
            <button type="button" onClick={() => agregar(false)} disabled={agotado} data-agregar-producto
              className="flex-1 min-w-[180px] rounded-xl bg-acento text-sobre-acento font-bold py-3.5 hover:bg-acento-vivo disabled:bg-superficie-3 disabled:text-texto-tenue">
              {agotado ? "Sin stock" : "Agregar al carrito"}
            </button>
          </div>
          {!agotado && <button type="button" onClick={() => agregar(true)} className="w-full mt-3 rounded-xl border border-texto py-3.5 font-bold hover:bg-superficie-2">Comprar ahora</button>}
          {aviso && <p className="text-sm text-ojo mt-3" role="alert">{aviso}</p>}

          {ctx.tienda && (
            <div className="mt-6 rounded-xl border border-borde p-4 text-sm space-y-2">
              {ctx.tienda.config.envio && <p className="flex items-center gap-2"><Truck size={16} className="text-acento" /> Envío a domicilio{ctx.tienda.config.zona ? ` · ${ctx.tienda.config.zona}` : ""}{ctx.tienda.config.envioGratisDesde ? ` · gratis desde ${plata(ctx.tienda.config.envioGratisDesde)}` : ""}</p>}
              {ctx.tienda.config.retiro && <p className="flex items-center gap-2"><Store size={16} className="text-acento" /> Retiro en el local, sin cargo</p>}
            </div>
          )}

          {p.descripcion && (
            <div className="mt-7">
              <div className="text-sm font-semibold mb-2">Descripción</div>
              <p className="text-sm text-texto-suave leading-relaxed whitespace-pre-line">{p.descripcion}</p>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 text-sm">
            <span className="text-texto-tenue flex items-center gap-1.5"><Share2 size={15} /> Compartir</span>
            <a href={memoria ? undefined : `https://wa.me/?text=${encodeURIComponent(`${p.nombre} ${url}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-texto-suave hover:text-texto"><MessageCircle size={15} /> WhatsApp</a>
            <button type="button" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="flex items-center gap-1 text-texto-suave hover:text-texto"><Copy size={15} /> {copiado ? "Copiado" : "Copiar link"}</button>
          </div>
        </div>
      </div>

      {parecidos.length > 0 && <div className="mt-16"><Titulo ver={rutaCategoria(p.categoria)}>También te puede gustar</Titulo><Grilla ctx={ctx} lista={parecidos} /></div>}
    </Contenedor>
  );
}

function NoEsta() {
  return (
    <Contenedor className="py-20 text-center">
      <h1 className="text-2xl font-bold">No encontramos esa página</h1>
      <p className="text-texto-suave mt-2">Puede que el producto ya no esté publicado.</p>
      <Enlace a="/productos" className="inline-flex items-center gap-2 mt-6 rounded-full bg-acento text-sobre-acento px-6 py-3 text-sm font-bold">Ver productos <ArrowRight size={16} /></Enlace>
    </Contenedor>
  );
}

function Contacto({ ctx }) {
  const { info, marca, memoria } = ctx;
  return (
    <Contenedor className="pt-10">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contacto</h1>
      {info ? (
        <div className="grid lg:grid-cols-[1fr_420px] gap-8 mt-6 items-start">
          <div className="text-texto-suave leading-relaxed">
            {marca.bajada && <p>{marca.bajada}</p>}
            {info.contacto && info.contacto.direccion && (
              <a href={memoria ? undefined : (info.contacto.mapa || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.contacto.direccion)}`)} target="_blank" rel="noopener noreferrer"
                className="mt-5 flex items-center gap-2 text-texto hover:text-acento"><MapPin size={18} className="text-acento" /> {info.contacto.direccion}</a>
            )}
          </div>
          <div className="rounded-2xl border border-borde bg-superficie p-6"><Vidriera nombre={marca.nombre} presencia={info} enlaces={!memoria} /></div>
        </div>
      ) : <p className="text-texto-suave mt-3">Escribinos por el carrito o al hacer tu pedido.</p>}
    </Contenedor>
  );
}

/* ============================================================
   CARRITO Y CHECKOUT
   ============================================================ */

function Cantidad({ l, carrito }) {
  const paso = l.unidad === "kg" ? 0.25 : 1;
  return (
    <div className="flex items-center rounded-lg border border-borde">
      <button type="button" aria-label="Uno menos" onClick={() => carrito.cambiar(l.id, +(l.cantidad - paso).toFixed(2))} className="p-1.5"><Minus size={14} /></button>
      <span className="w-10 text-center text-sm tabular-nums">{l.unidad === "kg" ? `${l.cantidad}kg` : l.cantidad}</span>
      <button type="button" aria-label="Uno más" onClick={() => carrito.cambiar(l.id, +(l.cantidad + paso).toFixed(2))} className="p-1.5"><Plus size={14} /></button>
    </div>
  );
}

function CarritoLateral({ ctx, onCerrar, onComprar }) {
  const { carrito, tienda } = ctx;
  const minimo = tienda ? tienda.config.minimo : 0;
  const falta = minimo && carrito.subtotal < minimo ? minimo - carrito.subtotal : 0;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onCerrar} />
      <div className="relative w-full max-w-md h-full bg-fondo text-texto flex flex-col shadow-xl" role="dialog" aria-label="Carrito">
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde">
          <div className="text-lg font-bold">Tu carrito</div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-superficie-2"><X size={20} /></button>
        </div>
        {carrito.lineas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-texto-suave">
            <ShoppingBag size={36} className="text-texto-tenue" />
            <p className="mt-3">Tu carrito está vacío.</p>
            <Enlace a="/productos" onClick={onCerrar} className="mt-5 text-sm font-semibold text-acento hover:underline">Ver productos</Enlace>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-borde px-5">
              {carrito.lineas.map((l) => (
                <li key={l.id} className="py-4 flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-superficie-2 shrink-0"><Foto src={l.imagen} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">{l.nombre}</div>
                    {l.detalle && <div className="text-xs text-texto-tenue mt-0.5">{l.detalle}</div>}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <Cantidad l={l} carrito={carrito} />
                      <span className="text-sm font-semibold tabular-nums">{plata(l.precio * l.cantidad)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-borde p-5 space-y-3">
              <div className="flex justify-between text-base font-bold"><span>Subtotal</span><span className="tabular-nums">{plata(carrito.subtotal)}</span></div>
              {falta > 0 && <p className="text-sm text-ojo">La compra mínima es de {plata(minimo)}: te faltan {plata(falta)}.</p>}
              <button type="button" onClick={onComprar} disabled={falta > 0} data-iniciar-compra className="w-full rounded-xl bg-acento text-sobre-acento font-bold py-3.5 hover:bg-acento-vivo disabled:opacity-50">Iniciar compra</button>
              <button type="button" onClick={onCerrar} className="w-full text-sm text-texto-suave hover:text-texto">Seguir comprando</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Paso({ n, titulo, abierto, hecho, resumen, onEditar, children }) {
  return (
    <section className={`rounded-2xl border ${abierto ? "border-texto" : "border-borde"} bg-superficie`}>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${hecho ? "bg-bien text-white" : abierto ? "bg-texto text-fondo" : "bg-superficie-3 text-texto-tenue"}`}>{hecho ? <Check size={14} /> : n}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{titulo}</div>
          {!abierto && hecho && resumen && <div className="text-sm text-texto-suave truncate">{resumen}</div>}
        </div>
        {!abierto && hecho && <button type="button" onClick={onEditar} className="text-sm font-semibold text-acento hover:underline">Cambiar</button>}
      </div>
      {abierto && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function Checkout({ ctx }) {
  const { carrito, tienda, onPedir, memoria } = ctx;
  const { ir } = useRuta();
  const cfg = (tienda && tienda.config) || {};
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("genez:comprador") || "{}") || {}; } catch { return {}; }
  });
  const entregas = [cfg.retiro !== false && "retiro", cfg.envio && "envio"].filter(Boolean);
  const pagos = [cfg.efectivo !== false && "efectivo", cfg.transferencia && "transferencia"].filter(Boolean);
  const [entrega, setEntrega] = useState(entregas[0] || "retiro");
  const [pago, setPago] = useState(pagos[0] || "efectivo");
  const [error, setError] = useState(null);
  const [mandando, setMandando] = useState(false);
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }));

  const gratis = cfg.envioGratisDesde && carrito.subtotal >= cfg.envioGratisDesde;
  const envio = entrega === "envio" && !gratis ? Number(cfg.costoEnvio) || 0 : 0;
  const total = carrito.subtotal + envio;
  const campo = "w-full rounded-xl border border-borde bg-fondo px-3.5 py-3 text-sm outline-none focus:border-acento";
  const telOk = String(datos.telefono || "").replace(/\D/g, "").length >= 8;

  if (!carrito.lineas.length) {
    return <Contenedor className="py-20 text-center"><h1 className="text-2xl font-bold">Tu carrito está vacío</h1><Enlace a="/productos" className="inline-block mt-5 font-semibold text-acento hover:underline">Ver productos</Enlace></Contenedor>;
  }

  async function confirmar() {
    if (!onPedir || mandando) return;
    setError(null);
    setMandando(true);
    try {
      const r = await onPedir({
        nombre: datos.nombre || "", telefono: datos.telefono || "", email: datos.email || null, entrega, pago,
        direccion: entrega === "envio" ? datos.direccion || "" : null, nota: datos.nota || null,
        lineas: carrito.lineas.map((l) => ({ item_id: l.id, cantidad: l.cantidad })),
      });
      try {
        localStorage.setItem("genez:comprador", JSON.stringify({ nombre: datos.nombre, telefono: datos.telefono, email: datos.email, direccion: datos.direccion }));
        sessionStorage.setItem(`genez:pedido:${r.numero}`, JSON.stringify({ ...r, lineas: carrito.lineas, entrega, pago, envio }));
      } catch { /* nada */ }
      carrito.vaciar();
      ir(`/pedido/${r.numero}`);
    } catch (e) {
      setError(e.message);
    }
    setMandando(false);
  }

  return (
    <Contenedor className="pt-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Finalizar compra</h1>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-6 items-start">
        <div className="space-y-4">
          <Paso n={1} titulo="Tus datos" abierto={paso === 1} hecho={paso > 1} resumen={`${datos.nombre || ""} · ${datos.telefono || ""}`} onEditar={() => setPaso(1)}>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={datos.nombre || ""} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre y apellido" autoComplete="name" className={campo} />
              <input value={datos.telefono || ""} onChange={(e) => set("telefono", e.target.value)} placeholder="Celular, con código de área" inputMode="tel" autoComplete="tel" className={campo} />
              <input value={datos.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="Mail (opcional)" type="email" autoComplete="email" className={`${campo} sm:col-span-2`} />
            </div>
            <button type="button" disabled={String(datos.nombre || "").trim().length < 2 || !telOk} onClick={() => setPaso(2)} className="mt-4 rounded-xl bg-texto text-fondo font-semibold px-6 py-3 disabled:opacity-40">Continuar</button>
          </Paso>

          <Paso n={2} titulo="Entrega" abierto={paso === 2} hecho={paso > 2} resumen={entrega === "envio" ? `Envío a ${datos.direccion || ""}` : "Retiro en el local"} onEditar={() => setPaso(2)}>
            <div className="grid sm:grid-cols-2 gap-3">
              {entregas.map((o) => (
                <button key={o} type="button" onClick={() => setEntrega(o)} className={`text-left rounded-xl border p-4 ${entrega === o ? "border-acento bg-acento-suave" : "border-borde"}`}>
                  <div className="font-semibold flex items-center gap-2">{o === "envio" ? <><Truck size={17} /> Envío a domicilio</> : <><Store size={17} /> Retiro en el local</>}</div>
                  <div className="text-sm text-texto-suave mt-1">
                    {o === "envio" ? (gratis ? "Gratis" : plata(cfg.costoEnvio || 0)) + (cfg.zona ? ` · ${cfg.zona}` : "") : "Sin cargo"}
                  </div>
                </button>
              ))}
            </div>
            {entrega === "envio" && <input value={datos.direccion || ""} onChange={(e) => set("direccion", e.target.value)} placeholder="Calle, número, piso y depto" autoComplete="street-address" className={`${campo} mt-3`} />}
            <textarea value={datos.nota || ""} onChange={(e) => set("nota", e.target.value)} placeholder="¿Algo que tengamos que saber? (opcional)" rows={2} className={`${campo} mt-3 resize-none`} />
            <button type="button" disabled={entrega === "envio" && String(datos.direccion || "").trim().length < 5} onClick={() => setPaso(3)} className="mt-4 rounded-xl bg-texto text-fondo font-semibold px-6 py-3 disabled:opacity-40">Continuar</button>
          </Paso>

          <Paso n={3} titulo="Pago" abierto={paso === 3} hecho={false}>
            <div className="grid sm:grid-cols-2 gap-3">
              {pagos.map((o) => (
                <button key={o} type="button" onClick={() => setPago(o)} className={`text-left rounded-xl border p-4 ${pago === o ? "border-acento bg-acento-suave" : "border-borde"}`}>
                  <div className="font-semibold flex items-center gap-2">{o === "transferencia" ? <><Landmark size={17} /> Transferencia</> : <><Banknote size={17} /> Efectivo</>}</div>
                  <div className="text-sm text-texto-suave mt-1">{o === "transferencia" ? "Te pasamos los datos al confirmar" : entrega === "envio" ? "Pagás cuando llega" : "Pagás al retirar"}</div>
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-mal mt-4" role="alert">{error}</p>}
            <button type="button" onClick={confirmar} disabled={mandando || memoria} data-confirmar-pedido
              className="mt-5 w-full rounded-xl bg-acento text-sobre-acento font-bold py-4 text-base hover:bg-acento-vivo disabled:opacity-50">
              {mandando ? "Confirmando…" : `Confirmar pedido · ${plata(total)}`}
            </button>
          </Paso>
        </div>

        <aside className="lg:sticky lg:top-24 rounded-2xl border border-borde bg-superficie p-5">
          <div className="font-semibold mb-3">Resumen</div>
          <ul className="space-y-3 max-h-72 overflow-y-auto">
            {carrito.lineas.map((l) => (
              <li key={l.id} className="flex gap-3 text-sm">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-superficie-2 shrink-0"><Foto src={l.imagen} />
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-texto text-fondo text-[10px] font-bold flex items-center justify-center">{l.unidad === "kg" ? "kg" : l.cantidad}</span></div>
                <div className="min-w-0 flex-1"><div className="leading-snug">{l.nombre}</div>{l.detalle && <div className="text-xs text-texto-tenue">{l.detalle}</div>}</div>
                <span className="tabular-nums">{plata(l.precio * l.cantidad)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-borde mt-4 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-texto-suave">Subtotal</span><span className="tabular-nums">{plata(carrito.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-texto-suave">Envío</span><span className="tabular-nums">{entrega === "envio" ? (gratis ? "Gratis" : plata(envio)) : "—"}</span></div>
            <div className="flex justify-between text-base font-bold pt-1"><span>Total</span><span className="tabular-nums">{plata(total)}</span></div>
          </div>
        </aside>
      </div>
    </Contenedor>
  );
}

function Confirmacion({ ctx, numero }) {
  const { tienda, info, marca, memoria } = ctx;
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem(`genez:pedido:${numero}`) || "null"); } catch { /* nada */ }
  const cfg = (tienda && tienda.config) || {};
  const wa = info && info.contacto && info.contacto.whatsapp ? numeroWhatsApp(info.contacto.whatsapp) : null;
  const texto = `Hola ${marca.nombre}, hice el pedido #${numero} por la tienda${p && p.pago === "transferencia" ? ". Te mando el comprobante de la transferencia." : "."}`;
  return (
    <Contenedor className="py-12 max-w-2xl">
      <div className="w-14 h-14 rounded-full bg-bien text-white flex items-center justify-center"><Check size={28} /></div>
      <h1 className="text-3xl font-bold tracking-tight mt-5">¡Gracias! Recibimos tu pedido #{numero}</h1>
      <p className="text-texto-suave mt-3 leading-relaxed">
        {marca.nombre} te va a escribir para confirmarlo.
        {p ? (p.entrega === "envio" ? " Te lo llevamos a tu casa." : " Te avisamos cuando esté listo para retirar.") : ""}
      </p>
      {p && p.pago === "transferencia" && (
        <div className="mt-6 rounded-2xl border border-acento bg-acento-suave p-5">
          <div className="font-semibold">Para pagar por transferencia</div>
          <p className="text-sm mt-2">Transferí <b className="tabular-nums">{plata(p.total)}</b>{cfg.alias ? <> al alias <b className="select-all">{cfg.alias}</b></> : ""}{cfg.titular ? ` (a nombre de ${cfg.titular})` : ""} y mandanos el comprobante.</p>
        </div>
      )}
      {p && (
        <div className="mt-6 rounded-2xl border border-borde p-5 text-sm space-y-2">
          {p.lineas.map((l) => <div key={l.id} className="flex justify-between gap-3"><span>{l.unidad === "kg" ? `${l.cantidad} kg` : l.cantidad} × {l.nombre}{l.detalle ? ` (${l.detalle})` : ""}</span><span className="tabular-nums">{plata(l.precio * l.cantidad)}</span></div>)}
          {p.envio > 0 && <div className="flex justify-between gap-3"><span>Envío</span><span className="tabular-nums">{plata(p.envio)}</span></div>}
          <div className="flex justify-between font-bold pt-2 border-t border-borde"><span>Total</span><span className="tabular-nums">{plata(p.total)}</span></div>
        </div>
      )}
      <div className="mt-7 flex flex-wrap gap-3">
        {wa && <a href={memoria ? undefined : `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] text-white font-semibold px-5 py-3"><MessageCircle size={18} /> Avisar por WhatsApp</a>}
        <Enlace a="/" className="inline-flex items-center gap-2 rounded-xl border border-borde font-semibold px-5 py-3">Volver a la tienda</Enlace>
      </div>
    </Contenedor>
  );
}
