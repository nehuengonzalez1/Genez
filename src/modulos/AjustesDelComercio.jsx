/* ============================================================
   AJUSTES · lo que se sumó el 06/10
   ============================================================

   Al ordenar Ajustes por apartado, Nehuen pidió revisar qué no le podía
   faltar a un comercio. Salieron nueve cosas; estas son las tarjetas
   nuevas. Viven aparte para que Ajustes.jsx, que ya pasaba las
   setecientas líneas, no siga creciendo.

   Todo lo que es configuración va en `ajustes` (empresas.config, ver
   src/datos/ajustes.js) y se guarda solo, como el resto de Ajustes. El
   nombre del comercio no: es la columna `empresas.nombre`, y desde 0132
   el comercio lo puede cambiar.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Volume2, VolumeX, Eye, EyeOff, Download } from "lucide-react";
import { Card, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { renombrarComercio } from "../datos/ajustes.js";
import { cambiarClave } from "../datos/sesion.js";
import { datosParaDescargar } from "../datos/exportar.js";
import { bajarExcel } from "../utils/planilla.js";

const Rotulo = ({ children }) => <span className="block text-xs font-semibold text-texto-suave mb-1">{children}</span>;

/* ---------- Negocio: el nombre y cómo contactarlo ---------- */

const CONTACTO = [
  ["telefono", "Teléfono", "Ej: 11 4444-5555", "tel"],
  ["whatsapp", "WhatsApp", "Con código de área", "tel"],
  ["email", "Mail", "contacto@tucomercio.com", "email"],
  ["instagram", "Instagram", "@tucomercio", "text"],
  ["direccion", "Dirección del local", "Calle 123, Localidad", "text"],
  ["horarios", "Horarios", "Lun a sáb de 8 a 21", "text"],
];

export function DatosDelComercio({ ajustes, setAjustes, empresaId, toast }) {
  const [nombre, setNombre] = useState(ajustes.negocio || "");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setNombre(ajustes.negocio || ""); }, [ajustes.negocio]);
  const c = ajustes.contacto || {};
  const setContacto = (k, v) => setAjustes({ ...ajustes, contacto: { ...c, [k]: v } });

  const guardarNombre = async () => {
    const limpio = nombre.trim();
    if (limpio === (ajustes.negocio || "")) return;
    if (limpio.length < 2) { setNombre(ajustes.negocio || ""); return toast("El nombre tiene que tener al menos 2 letras.", "mal"); }
    setGuardando(true);
    try {
      const guardado = await renombrarComercio(empresaId, limpio);
      setAjustes({ ...ajustes, negocio: guardado });
      toast("Nombre guardado.");
    } catch (e) {
      setNombre(ajustes.negocio || "");
      toast(e.message || "No se pudo cambiar el nombre.", "mal");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Tu comercio</h3>
      <p className="text-sm text-texto-suave mt-1">
        El nombre es el que se ve en el sistema y en los mails. En el ticket sale el "Nombre en la factura" de Datos fiscales, si lo
        cargaste. El teléfono y el Instagram se pueden imprimir al pie (Equipos → Ticket).
      </p>
      <label className="block mt-4">
        <Rotulo>Nombre del comercio</Rotulo>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          maxLength={80} disabled={guardando || !empresaId} className={inputCls} />
      </label>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        {CONTACTO.map(([k, n, ph, tipo]) => (
          <label key={k} className="block">
            <Rotulo>{n}</Rotulo>
            <input value={c[k] || ""} onChange={(e) => setContacto(k, e.target.value)} placeholder={ph} type={tipo}
              maxLength={k === "direccion" || k === "horarios" ? 120 : 80} className={inputCls} />
          </label>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Negocio: los objetivos del mes (06/10) ---------- */

/* Valen para todos los meses hasta que se cambien. Se ven en Inicio y en
   Reportes (src/modulos/Objetivos.jsx). Vacío: sin objetivo. */
export function ObjetivosConfig({ ajustes, setAjustes }) {
  const o = ajustes.objetivos || {};
  const set = (k, texto) => {
    const n = Number(String(texto).replace(/[^\d]/g, "")) || null;
    setAjustes({ ...ajustes, objetivos: { ...o, [k]: k === "margen" && n ? Math.min(99, n) : n } });
  };
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Objetivos del mes</h3>
      <p className="text-sm text-texto-suave mt-1">
        Cuánto querés vender por mes. En Inicio y en Reportes vas a ver cuánto llevás y a qué llegás al cierre si seguís a este ritmo.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        <label className="block">
          <Rotulo>Ventas del mes ($)</Rotulo>
          <input value={o.ventas || ""} onChange={(e) => set("ventas", e.target.value)} inputMode="numeric" placeholder="sin objetivo"
            className={`${inputCls} f-m text-right`} />
          {o.ventas > 0 && <span className="block text-xs text-texto-tenue mt-1">{money(o.ventas)}</span>}
        </label>
        <label className="block">
          <Rotulo>Margen (%)</Rotulo>
          <input value={o.margen || ""} onChange={(e) => set("margen", e.target.value)} inputMode="numeric" placeholder="sin objetivo"
            className={`${inputCls} f-m text-right`} />
        </label>
        <label className="block">
          <Rotulo>Ticket promedio ($)</Rotulo>
          <input value={o.ticket || ""} onChange={(e) => set("ticket", e.target.value)} inputMode="numeric" placeholder="sin objetivo"
            className={`${inputCls} f-m text-right`} />
        </label>
      </div>
    </Card>
  );
}

/* ---------- Equipos: el pie del ticket y los sonidos ---------- */

export function TicketDelComercio({ ajustes, setAjustes }) {
  const t = ajustes.ticket || {};
  const c = ajustes.contacto || {};
  const set = (k, v) => setAjustes({ ...ajustes, ticket: { ...t, [k]: v } });
  const hayContacto = !!(c.telefono || c.whatsapp || c.instagram);
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Ticket</h3>
      <p className="text-sm text-texto-suave mt-1">
        Lo que sale al final de cada ticket. Vacío, dice "Gracias por su compra".
      </p>
      <label className="block mt-4">
        <Rotulo>Texto del pie (hasta 4 renglones)</Rotulo>
        <textarea value={t.pie || ""} onChange={(e) => set("pie", e.target.value.split("\n").slice(0, 4).join("\n"))}
          rows={3} maxLength={200} placeholder={"Gracias por su compra\nCambios dentro de los 30 días con este ticket"}
          className={`${inputCls} resize-none`} />
      </label>
      <label className={`flex items-center gap-2 text-sm mt-3 ${hayContacto ? "" : "opacity-60"}`}>
        <input type="checkbox" checked={t.contacto !== false} onChange={(e) => set("contacto", e.target.checked)} disabled={!hayContacto} />
        Imprimir el teléfono, el WhatsApp y el Instagram del comercio
        {!hayContacto && <span className="text-texto-tenue">(cargalos en Negocio → Tu comercio)</span>}
      </label>
    </Card>
  );
}

export function Sonidos({ ajustes, setAjustes }) {
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Sonidos</h3>
      <p className="text-sm text-texto-suave mt-1">
        El beep al escanear y el aviso con voz cuando entra un cobro de Mercado Pago.
      </p>
      <button onClick={() => setAjustes({ ...ajustes, sonido: !ajustes.sonido })}
        className="flex items-center gap-2 text-sm text-texto-suave mt-3 hover:text-texto">
        {ajustes.sonido ? <Volume2 size={16} className="text-acento" /> : <VolumeX size={16} />}
        Sonidos: <strong>{ajustes.sonido ? "activados" : "silenciados"}</strong>
      </button>
    </Card>
  );
}

/* ---------- Cobros: con cuánto se abre la caja ---------- */

export function FondoDeCaja({ ajustes, setAjustes }) {
  const fijo = ajustes.fondoCaja != null;
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Fondo de la caja</h3>
      <p className="text-sm text-texto-suave mt-1">
        Con cuánta plata se propone abrir la caja. Se puede cambiar cada vez que se abre.
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!fijo} onChange={() => setAjustes({ ...ajustes, fondoCaja: null })} />
          Lo que quedó en el cajón al último cierre
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={fijo} onChange={() => setAjustes({ ...ajustes, fondoCaja: 50000 })} />
          Siempre el mismo monto
          {fijo && (
            <input value={ajustes.fondoCaja} inputMode="numeric"
              onChange={(e) => setAjustes({ ...ajustes, fondoCaja: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              className={`${inputCls} f-m w-32 text-right ml-2`} />
          )}
        </label>
        {fijo && <p className="text-xs text-texto-tenue">Se propone abrir con {money(ajustes.fondoCaja || 0)}.</p>}
      </div>
    </Card>
  );
}

/* ---------- Cobros: hasta cuánto descuenta cada rol ---------- */

/* El dueño no tiene tope. Los otros tres son los roles de fábrica; uno sin
   el permiso de hacer descuentos (Permisos) no descuenta nada, tenga tope
   o no. Va en ajustes y no en los permisos: aquellos son sí o no, y la
   regla de la base que impide dar lo que uno no tiene (0049) está pensada
   para eso. */
const ROLES_CON_TOPE = [["encargado", "Encargado"], ["cajero", "Cajero"], ["repositor", "Repositor"]];

export function DescuentosPorRol({ ajustes, setAjustes }) {
  const topes = ajustes.descuentoMax || {};
  const setTope = (rol, texto) => {
    const limpio = texto.replace(/[^\d]/g, "");
    const nuevo = { ...topes };
    if (limpio === "") delete nuevo[rol]; else nuevo[rol] = Math.min(99, Number(limpio));
    setAjustes({ ...ajustes, descuentoMax: nuevo });
  };
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Descuento máximo por rol</h3>
      <p className="text-sm text-texto-suave mt-1">
        Hasta cuánto puede descontar cada uno en el cobro, contando también bajar el precio de un producto a mano. Vacío: sin tope.
        El dueño nunca tiene tope.
      </p>
      <div className="mt-3 space-y-2">
        {ROLES_CON_TOPE.map(([k, n]) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <span className="w-28">{n}</span>
            <input value={topes[k] ?? ""} onChange={(e) => setTope(k, e.target.value)} inputMode="numeric" placeholder="sin tope"
              className={`${inputCls} f-m w-28 text-right`} />
            <span className="text-texto-suave">%</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-texto-tenue mt-2">Quién puede hacer descuentos, sí o no, se decide en Permisos.</p>
    </Card>
  );
}

/* ---------- Precios y stock: redondeo y venta sin stock ---------- */

export function PreciosYStock({ ajustes, setAjustes }) {
  const sinStock = ajustes.sinStock || "permitir";
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Precios y venta sin stock</h3>
      <label className="block mt-3">
        <Rotulo>Redondeo de precios al actualizarlos</Rotulo>
        <select value={String(ajustes.redondeo || 10)} onChange={(e) => setAjustes({ ...ajustes, redondeo: Number(e.target.value) })}
          className={`${inputCls} max-w-xs`}>
          <option value="1">Sin redondear</option>
          <option value="10">A $10</option>
          <option value="50">A $50</option>
          <option value="100">A $100</option>
        </select>
        <span className="block text-xs text-texto-tenue mt-1">Es con lo que arranca la actualización de precios en Productos; ahí se puede cambiar cada vez.</span>
      </label>
      <label className="block mt-4">
        <Rotulo>Redondear el total cuando se cobra en efectivo</Rotulo>
        <select value={String(ajustes.redondeoEfectivo || 0)} onChange={(e) => setAjustes({ ...ajustes, redondeoEfectivo: Number(e.target.value) })}
          className={`${inputCls} max-w-xs`}>
          <option value="0">No redondear</option>
          <option value="10">Para abajo, a $10</option>
          <option value="50">Para abajo, a $50</option>
          <option value="100">Para abajo, a $100</option>
        </select>
        <span className="block text-xs text-texto-tenue mt-1">Siempre a favor del cliente: con $7.380 y a $100 se cobran $7.300. La diferencia sale en el ticket como redondeo. Con tarjeta, QR o transferencia se cobra el total exacto.</span>
      </label>
      <div className="mt-4">
        <Rotulo>Si se vende un producto sin stock</Rotulo>
        <div className="space-y-2 text-sm">
          {[
            ["permitir", "Dejar vender", "El stock queda en negativo. Sirve si el stock no está bien cargado."],
            ["avisar", "Avisar y dejar vender", "Sale un aviso en la caja, pero la venta sigue."],
            ["bloquear", "No dejar vender", "El producto no entra al ticket hasta que se cargue stock."],
          ].map(([k, n, d]) => (
            <label key={k} className="flex items-start gap-2">
              <input type="radio" className="mt-1" checked={sinStock === k} onChange={() => setAjustes({ ...ajustes, sinStock: k })} />
              <span><b className="font-semibold">{n}</b> <span className="text-texto-suave">· {d}</span></span>
            </label>
          ))}
        </div>
        <p className="text-xs text-texto-tenue mt-2">Los productos que no controlan stock o a los que nunca se les cargó stock se venden siempre.</p>
      </div>
    </Card>
  );
}

/* ---------- Mi cuenta: la contraseña y los datos ---------- */

export function MiContrasena({ toast }) {
  const [nueva, setNueva] = useState("");
  const [otra, setOtra] = useState("");
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async () => {
    setError(null);
    if (nueva.length < 8) return setError("La contraseña nueva tiene que tener al menos 8 caracteres.");
    if (nueva !== otra) return setError("Las dos contraseñas no coinciden.");
    setGuardando(true);
    try {
      await cambiarClave(nueva);
      setNueva(""); setOtra("");
      toast("Contraseña cambiada. La próxima vez entrás con la nueva.");
    } catch (e) {
      setError(e.message || "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Mi contraseña</h3>
      <p className="text-sm text-texto-suave mt-1">La de tu usuario, no la de las otras personas del comercio (esas se cambian en Permisos).</p>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <label className="block">
          <Rotulo>Contraseña nueva</Rotulo>
          <span className="relative block">
            <input value={nueva} onChange={(e) => setNueva(e.target.value)} type={ver ? "text" : "password"} autoComplete="new-password"
              className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar" : "Mostrar"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-texto-suave hover:text-texto">
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        <label className="block">
          <Rotulo>Repetila</Rotulo>
          <input value={otra} onChange={(e) => setOtra(e.target.value)} type={ver ? "text" : "password"} autoComplete="new-password" className={inputCls} />
        </label>
      </div>
      {error && <p className="text-sm text-mal mt-2" role="alert">{error}</p>}
      <Boton className="mt-3" onClick={guardar} disabled={guardando || !nueva}>{guardando ? "Guardando…" : "Cambiar contraseña"}</Boton>
    </Card>
  );
}

export function DescargarDatos({ empresaId, productos, toast }) {
  const [bajando, setBajando] = useState(false);
  const bajar = async () => {
    setBajando(true);
    try {
      const hojas = await datosParaDescargar(empresaId, productos);
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      const formato = await bajarExcel(`Genez - mis datos - ${hoy}`, hojas);
      toast(formato === "xlsx" ? "Listo: bajó una planilla con tus datos." : "Listo: bajaron las planillas en CSV.");
    } catch (e) {
      toast(e.message || "No se pudieron bajar los datos.", "mal");
    } finally {
      setBajando(false);
    }
  };
  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Descargar mis datos</h3>
      <p className="text-sm text-texto-suave mt-1">
        Una planilla con tus productos, tus clientes y las ventas de los últimos 12 meses. Tus datos son tuyos: los podés bajar cuando quieras.
      </p>
      <Boton variant="ghost" className="mt-3" onClick={bajar} disabled={bajando || !empresaId}>
        <Download size={15} /> {bajando ? "Preparando…" : "Descargar planilla"}
      </Boton>
    </Card>
  );
}
