/* ============================================================
   AJUSTES · LA CUENTA DE MERCADO PAGO DEL COMERCIO (0091)
   ============================================================

   El dueño pega el Access Token de su cuenta y listo: el servidor le
   pregunta a Mercado Pago de quién es, y si contesta lo guarda cifrado.
   Se muestra a qué cuenta quedó conectado, para que se vea enseguida si
   se pegó el de otra.

   El token viaja una vez, al guardarlo, y no vuelve nunca a la pantalla:
   el campo se vacía después de guardar.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Link2, Unlink, Check } from "lucide-react";
import { conexionMercadoPago } from "../datos/mercadopago.js";
import { Boton } from "../ui/Base.jsx";
import { fdatel } from "../datos/generador.js";

export function ConexionMercadoPago({ empresaId, toast, onCambio }) {
  const [estado, setEstado] = useState(null);   // null: leyendo
  const [error, setError] = useState(null);
  const [token, setToken] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const leer = useCallback(() => {
    conexionMercadoPago("estado", {}, empresaId)
      .then((e) => { setEstado(e); setError(null); })
      .catch((e) => { setEstado({ conectada: false }); setError(e.message); });
  }, [empresaId]);
  useEffect(() => { leer(); }, [leer]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const e = await conexionMercadoPago("guardar", { token: token.trim() }, empresaId);
      setEstado(e); setError(null); setToken("");
      toast(`Mercado Pago conectado a la cuenta de ${e.cuenta.nombre || e.cuenta.email || e.cuenta.id}.`);
      if (onCambio) onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    setGuardando(true);
    try {
      setEstado(await conexionMercadoPago("quitar", {}, empresaId));
      setConfirmarQuitar(false);
      toast("Se desconectó la cuenta de Mercado Pago.");
      if (onCambio) onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (estado === null) return <p className="text-sm text-texto-tenue mt-3">Leyendo la conexión…</p>;

  return (
    <div className="mt-3">
      {estado.conectada ? (
        <div className="rounded-xl p-3 text-sm border bg-bien-suave border-bien">
          <div className="flex items-start gap-2">
            <Check size={16} className="text-bien shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-texto">
                Conectado a la cuenta de <strong>{estado.cuenta.nombre || "Mercado Pago"}</strong>
                {estado.cuenta.email ? <span className="text-texto-suave"> · {estado.cuenta.email}</span> : null}
              </div>
              <div className="text-xs text-texto-suave mt-0.5">
                Cuenta <span className="f-m">{estado.cuenta.id}</span>
                {estado.verificadaEn ? ` · verificada el ${fdatel(new Date(estado.verificadaEn))}` : ""}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
            {confirmarQuitar ? (
              <>
                <span className="text-texto-suave">¿Desconectarla? Los avisos de cobro dejan de sonar.</span>
                <button onClick={quitar} disabled={guardando} className="font-semibold text-mal hover:underline">Sí, desconectar</button>
                <button onClick={() => setConfirmarQuitar(false)} className="font-semibold text-texto-suave hover:underline">No</button>
              </>
            ) : (
              <button onClick={() => setConfirmarQuitar(true)} className="inline-flex items-center gap-1 text-texto-suave hover:text-texto hover:underline">
                <Unlink size={13} /> Desconectar o cambiar de cuenta
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-3 text-sm border bg-ojo-suave border-ojo">
          <div className="text-texto">Todavía sin conectar. Pegá el Access Token de producción de la cuenta de Mercado Pago del negocio.</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <label htmlFor="mp-token" className="sr-only">Access Token de Mercado Pago</label>
            <input id="mp-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-…"
              autoComplete="off" spellCheck={false}
              className="f-m flex-1 min-w-[14rem] border border-borde rounded-md px-3 py-2 text-sm bg-superficie outline-none focus:border-acento" />
            <Boton onClick={guardar} disabled={guardando || !token.trim()}>
              <Link2 size={15} /> {guardando ? "Conectando…" : "Conectar"}
            </Boton>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-mal mt-2">{error}</p>}
    </div>
  );
}
