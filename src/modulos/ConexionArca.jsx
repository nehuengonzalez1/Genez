/* ============================================================
   AJUSTES · FACTURA ELECTRÓNICA
   ============================================================

   Conectar un comercio con ARCA para facturar de verdad. Lo hace el
   propio comercio, o Genez entrando como él: son cinco pasos y dos pasan
   en la página de ARCA, con la Clave Fiscal del dueño, que Genez no tiene
   ni tiene que tener.

     1. Genez genera el pedido de certificado. La clave privada se queda
        en el servidor; el comercio se lleva solo el pedido (.csr).
     2. En ARCA se sube el pedido y se descarga el certificado (.crt), que
        se sube acá.
     3. En ARCA se autoriza ese certificado a facturar y se crea el punto
        de venta de web service.
     4. Probar conexión: habla con ARCA de producción paso por paso y dice
        cuál anda y cuál no. No emite nada.
     5. Activar. Desde ese momento las facturas son de verdad.

   El botón de probar sigue estando después de activar: es lo primero que
   hay que apretar el día que una factura no sale.
   ============================================================ */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Check, X, Download, Upload, PlugZap, ShieldCheck } from "lucide-react";
import { conexionArca } from "../datos/arca.js";
import { Card, Boton } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const fechaHora = (d) => (d ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const diasHasta = (d) => Math.floor((new Date(d).getTime() - Date.now()) / 86400000);

function Paso({ n, titulo, hecho, children }) {
  return (
    <div className="border-t border-borde pt-4 mt-4 first:border-0 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2.5">
        <span className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold ${hecho ? "border-bien bg-bien-suave text-bien" : "border-borde text-texto-suave"}`}>
          {hecho ? <Check size={13} /> : n}
        </span>
        <span className="font-semibold text-sm">{titulo}</span>
      </div>
      <div className="pl-8 mt-2 text-sm text-texto-suave leading-relaxed">{children}</div>
    </div>
  );
}

function descargar(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/pkcs10" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ConexionArca({ empresaId, toast, alCambiar }) {
  const [est, setEst] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [cuit, setCuit] = useState("");
  const [pv, setPv] = useState("");
  const archivo = useRef(null);

  const aplicar = useCallback((e) => {
    setEst(e);
    setCuit((c) => c || (e.pedido && e.pedido.cuit) || (e.certificado && e.certificado.cuit) || e.comercio.cuit || "");
    setPv((v) => v || String((e.prueba && e.prueba.puntoVenta) || (e.conexion && e.conexion.modo === "produccion" && e.conexion.puntoVenta) || ""));
  }, []);

  useEffect(() => {
    conexionArca("estado", {}, empresaId).then(aplicar).catch((e) => setError(e.message));
  }, [empresaId, aplicar]);

  const hacer = async (accion, datos, exito) => {
    setOcupado(accion);
    try {
      const e = await conexionArca(accion, datos, empresaId);
      aplicar(e);
      if (exito) toast(exito);
      return e;
    } catch (e) {
      toast(e.message, "mal");
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const subir = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    const pem = await f.text();
    await hacer("certificado", { pem }, "Certificado cargado.");
  };

  const activar = async () => {
    const ok = window.confirm(
      `Desde ahora, cada venta cobrada como factura sale con un CAE de verdad, a nombre del CUIT ${est.certificado.cuit}, ` +
      `en el punto de venta ${pv}. No se puede deshacer una factura: se anula con nota de crédito.\n\n¿Empezar a facturar de verdad?`
    );
    if (!ok) return;
    const e = await hacer("activar", { puntoVenta: Number(pv) }, "Listo: el comercio factura de verdad.");
    if (e && alCambiar) alCambiar();
  };

  if (error) {
    return (
      <Card className="p-5">
        <h3 className="f-d text-lg">Factura electrónica</h3>
        <p className="text-sm text-mal mt-2">{error}</p>
      </Card>
    );
  }
  if (!est) {
    return <Card className="p-5"><h3 className="f-d text-lg">Factura electrónica</h3><p className="text-sm text-texto-tenue mt-2">Cargando…</p></Card>;
  }

  const enProduccion = est.conexion && est.conexion.modo === "produccion";
  const cert = est.certificado;
  const pedido = est.pedido;
  const prueba = est.prueba;
  const pruebaLista = prueba && prueba.ok && String(prueba.puntoVenta) === String(pv);
  const alias = (pedido && pedido.alias) || (cert && cert.alias) || "genez-…";

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="f-d text-lg">Factura electrónica</h3>
          <p className="text-sm text-texto-suave mt-1">
            La conexión de este comercio con ARCA, con su propio certificado. La clave privada la genera Genez y no sale nunca del servidor.
          </p>
        </div>
        <span className={`shrink-0 text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded border ${
          enProduccion ? "border-bien bg-bien-suave text-bien" : est.conexion ? "border-ojo bg-ojo-suave text-ojo" : "border-borde text-texto-tenue"}`}>
          {enProduccion ? "Facturando de verdad" : est.conexion ? "En pruebas" : "Sin conectar"}
        </span>
      </div>

      {enProduccion && (
        <div className="mt-4 rounded-md border border-borde p-4 text-sm">
          <div>CUIT <span className="f-m">{est.conexion.cuit}</span> · punto de venta <span className="f-m">{est.conexion.puntoVenta}</span></div>
          <div className="text-texto-tenue text-xs mt-1">
            Última prueba bien: {fechaHora(est.conexion.verificadaEn)}
            {est.conexion.ultimoError && <span className="text-mal"> · Último error: {est.conexion.ultimoError}</span>}
          </div>
        </div>
      )}

      <div className="mt-5">
        <Paso n={1} titulo="Pedido de certificado" hecho={!!pedido || !!cert}>
          {!pedido && !cert && (
            <p>Genez genera la clave y el pedido que después se sube a ARCA. Tiene que ser el CUIT del titular del comercio.</p>
          )}
          {pedido && (
            <p>
              Pedido generado el {fecha(pedido.en)} para el CUIT <span className="f-m">{pedido.cuit}</span>, con el nombre <span className="f-m">{pedido.alias}</span>.
              {cert && " El certificado actual sigue andando hasta que cargues el nuevo."}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2 mt-3">
            <Campo label="CUIT" ancho="w-44">
              <input value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="20-12345678-9" className={`${inputCls} f-m`} />
            </Campo>
            <Boton variant={pedido || cert ? "ghost" : "primary"} disabled={!!ocupado || !cuit}
              onClick={() => {
                if (cert && !window.confirm("Ya hay un certificado cargado. Generar un pedido nuevo sirve para renovarlo: el actual sigue andando hasta que cargues el que emita ARCA. ¿Seguir?")) return;
                hacer("generar", { cuit }, "Pedido generado.");
              }}>
              {ocupado === "generar" ? "Generando…" : pedido ? "Generar otro" : cert ? "Renovar certificado" : "Generar pedido"}
            </Boton>
            {pedido && (
              <Boton variant="primary" onClick={() => descargar(`${pedido.alias}.csr`, pedido.csr)}>
                <Download size={14} /> Descargar pedido (.csr)
              </Boton>
            )}
          </div>
        </Paso>

        <Paso n={2} titulo="Certificado de ARCA" hecho={!!cert && !pedido}>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Entrá a ARCA con la Clave Fiscal del titular y abrí <b>Administración de Certificados Digitales</b>. Si no aparece, se agrega desde <b>Administrador de Relaciones de Clave Fiscal → Adherir servicio</b>.</li>
            <li>Agregá un alias con el nombre <span className="f-m">{alias}</span> y subí el pedido (.csr).</li>
            <li>Descargá el certificado (.crt) y subilo acá.</li>
          </ol>
          {cert && (
            <p className="mt-2">
              Cargado: CUIT <span className="f-m">{cert.cuit}</span>, vence el {fecha(cert.vence)}
              {diasHasta(cert.vence) < 60 && <span className="text-mal"> · faltan {diasHasta(cert.vence)} días, generá el pedido para renovarlo</span>}.
            </p>
          )}
          <input ref={archivo} type="file" accept=".crt,.pem,.cer" className="hidden" onChange={subir} />
          <Boton className="mt-3" variant={pedido ? "primary" : "ghost"} disabled={!pedido || !!ocupado} onClick={() => archivo.current && archivo.current.click()}>
            <Upload size={14} /> {ocupado === "certificado" ? "Cargando…" : "Subir certificado (.crt)"}
          </Boton>
        </Paso>

        <Paso n={3} titulo="Autorizar en ARCA y crear el punto de venta" hecho={!!(prueba && prueba.ok)}>
          <ol className="list-decimal pl-4 space-y-1">
            <li>En <b>Administrador de Relaciones de Clave Fiscal → Nueva relación</b>, buscá el servicio <b>Facturación Electrónica</b> (ARCA → WebServices) y elegí como representante el computador fiscal <span className="f-m">{alias}</span>.</li>
            <li>En <b>Administración de puntos de venta y domicilios</b>, agregá un punto de venta con el sistema <b>Factura Electrónica - Monotributo - Web Services</b>. Tiene que ser uno nuevo, no el de la factura en línea.</li>
          </ol>
        </Paso>

        <Paso n={4} titulo="Probar la conexión" hecho={!!(prueba && prueba.ok)}>
          <p>Habla con ARCA de producción y revisa cada paso. No emite ninguna factura.</p>
          <div className="flex flex-wrap items-end gap-2 mt-3">
            <Campo label="Punto de venta" ancho="w-36">
              <input value={pv} onChange={(e) => setPv(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 3" className={`${inputCls} f-m`} />
            </Campo>
            <Boton variant="primary" disabled={!cert || !!ocupado} onClick={() => hacer("probar", { puntoVenta: Number(pv) || null })}>
              <PlugZap size={14} /> {ocupado === "probar" ? "Probando…" : "Probar conexión"}
            </Boton>
          </div>
          {prueba && (
            <ul className="mt-3 space-y-2">
              {prueba.pasos.map((p) => (
                <li key={p.clave} className="flex gap-2">
                  {p.ok ? <Check size={16} className="text-bien shrink-0 mt-0.5" /> : <X size={16} className="text-mal shrink-0 mt-0.5" />}
                  <span>
                    <span className="font-semibold text-texto">{p.nombre}.</span> <span className={p.ok ? "" : "text-mal"}>{p.detalle}</span>
                  </span>
                </li>
              ))}
              <li className="text-xs text-texto-tenue">Probado el {fechaHora(prueba.en)}</li>
            </ul>
          )}
        </Paso>

        {!enProduccion && (
          <Paso n={5} titulo="Empezar a facturar de verdad" hecho={false}>
            <p>
              Con la prueba bien, las facturas pasan a salir con CAE de verdad, a nombre del CUIT del certificado.
              {est.sinCAE > 0 && <span className="text-mal"> Antes hay que resolver las {est.sinCAE} factura(s) que esperan CAE en Caja → Facturas.</span>}
            </p>
            <Boton className="mt-3" variant="primary" disabled={!pruebaLista || est.sinCAE > 0 || !!ocupado} onClick={activar}>
              <ShieldCheck size={14} /> {ocupado === "activar" ? "Activando…" : "Activar facturación real"}
            </Boton>
            {prueba && prueba.ok && !pruebaLista && <p className="text-xs mt-2">La prueba se hizo con otro punto de venta: probá con el {pv || "que vas a usar"}.</p>}
          </Paso>
        )}
      </div>
    </Card>
  );
}
