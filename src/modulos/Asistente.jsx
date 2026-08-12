/* ============================================================
   12. ASISTENTE
   ============================================================ */

import React, { useState, useMemo } from "react";
import { Send, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { fdatel, HOY } from "../datos/generador.js";
import { API_BASE, API_MODELO, pct, money, nf } from "../utils/helpers.js";
import { SEV, Card, Boton } from "../ui/Base.jsx";

export function Asistente({ k, ins, ir, negocio }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);

  const snapshot = useMemo(() => ({
    negocio, fecha: fdatel(HOY),
    ventas30: Math.round(k.v30), ventasMesAnterior: Math.round(k.v30p),
    margenActual: pct(k.margen30), margenMesAnterior: pct(k.margen30p),
    ticketPromedio: Math.round(k.ticketProm), tickets30: k.tickets30,
    valorStock: Math.round(k.valorStock),
    plataEnProductosSinVenta: Math.round(k.valorDormido),
    productosSinVenta30dias: k.dormidos.length,
    productosPorQuedarseSinStock: k.criticos.filter((x) => x.cobertura < 4).length,
    productosPorVencer: k.porVencer.length, valorPorVencer: Math.round(k.valorVencer),
    impactoMensualSubaDeCostos: Math.round(k.impactoTotal),
    topSubasDeCosto: k.subas.slice(0, 10).map((x) => ({ producto: x.p.nombre, proveedor: x.p.proveedor, subaPct: pct(x.subaPct, 0), margenHoy: pct(x.margenHoy, 0), costoMensual: Math.round(x.impacto) })),
    porQuedarseSinStock: k.criticos.slice(0, 10).map((x) => ({ producto: x.p.nombre, stock: x.p.stock, diasQueAlcanza: Math.round(x.cobertura) })),
    inmovilizados: k.dormidos.slice(0, 8).map((x) => ({ producto: x.p.nombre, valor: Math.round(x.valor) })),
  }), [k, negocio]);

  const sugeridas = [
    "¿Por qué bajó mi ganancia este mes?",
    "¿Qué tengo que comprar esta semana?",
    "¿Dónde tengo plata dormida?",
    "¿Qué precios debería tocar primero?",
  ];

  const preguntar = async (texto) => {
    const t = (texto || q).trim();
    if (!t || cargando) return;
    setMsgs((m) => [...m, { rol: "user", texto: t }]);
    setQ(""); setCargando(true);
    try {
      const r = await fetch(`${API_BASE}/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: API_MODELO,
          max_tokens: 1000,
          system: "Sos el asistente de gestión de un minimercado argentino. Respondés en español rioplatense, en tono claro y directo, sin tecnicismos ni jerga contable. Usás SOLO los datos del negocio que te paso en JSON: no inventes números. Estructurá siempre así: qué pasó, por qué, y qué hacer concretamente. Máximo 180 palabras. Montos en pesos con formato $12.345.",
          messages: [{ role: "user", content: `Datos del negocio:\n${JSON.stringify(snapshot)}\n\nPregunta del dueño: ${t}` }],
        }),
      });
      const data = await r.json();
      const txt = (data.content || []).map((c) => c.text || "").join("\n").trim();
      setMsgs((m) => [...m, { rol: "ia", texto: txt || "No pude generar la respuesta." }]);
    } catch (e) {
      setMsgs((m) => [...m, { rol: "ia", texto: "No pude conectarme al modelo. Revisá la API key en el archivo .env (o usá la app en Claude). Los diagnósticos de arriba se calculan sobre tus datos y funcionan sin conexión." }]);
    }
    setCargando(false);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-5 items-start">
      <div className="space-y-3">
        <h2 className="f-d text-lg">Diagnóstico completo</h2>
        {ins.map((i) => {
          const s = SEV[i.sev]; const Ico = i.icon;
          return (
            <Card key={i.id} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <Ico size={15} className="text-stone-400" />
                <h3 className="font-semibold text-sm flex-1">{i.titulo}</h3>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${s.pill}`}>{s.label}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {[["Qué pasó", i.que], ["Por qué", i.porque], ["Qué hacer", i.hacer]].map(([t, c]) => (
                  <div key={t} className="px-4 py-2.5 flex gap-4">
                    <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold w-20 shrink-0 pt-0.5">{t}</span>
                    <p className="text-sm text-stone-700">{c}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-stone-50">
                <button onClick={() => ir(i.tab)} className="text-xs font-semibold text-orange-600 hover:underline inline-flex items-center gap-1">{i.accion} <ArrowRight size={12} /></button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-orange-500" />
          <h3 className="f-d">Preguntale a tu negocio</h3>
        </div>
        <p className="text-xs text-stone-500 mt-1">Responde con tus números, no con generalidades.</p>

        <div className="mt-4 space-y-3 max-h-[380px] overflow-auto">
          {msgs.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sugeridas.map((s) => (
                <button key={s} onClick={() => preguntar(s)} className="text-xs text-left px-2.5 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50">{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.rol === "user" ? "text-right" : ""}>
              <div className={`inline-block text-sm rounded-2xl px-3 py-2 max-w-[92%] text-left whitespace-pre-wrap ${m.rol === "user" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-800"}`}>{m.texto}</div>
            </div>
          ))}
          {cargando && <div className="flex items-center gap-2 text-sm text-stone-400"><Loader2 size={14} className="animate-spin" /> Mirando tus datos…</div>}
        </div>

        <div className="flex gap-2 mt-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && preguntar()}
            placeholder="Escribí tu pregunta" className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
          <Boton onClick={() => preguntar()} disabled={cargando || !q.trim()}><Send size={15} /></Boton>
        </div>
      </Card>
    </div>
  );
}
