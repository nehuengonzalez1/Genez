/* ============================================================
   BARRERA · una pantalla que se rompe no se lleva el sistema
   ============================================================

   Sin esto, un error de JavaScript en cualquier pantalla desmonta todo
   React y queda la pantalla en negro: sin menú, sin mensaje, sin forma
   de salir más que refrescar. Pasó en Pedidos y en Productos, y lo único
   que se podía contar era "se queda en negro", que no alcanza para
   encontrar nada.

   Ahora el error queda adentro de la pantalla que lo tuvo. El menú sigue
   andando, se puede ir a otra sección o reintentar, y el mensaje queda a
   la vista para mandarlo en una captura.

   Tiene que ser una clase: es la única forma que tiene React de atrapar
   un error de dibujo. Se monta con `key` de la pantalla, así cambiar de
   sección la limpia sola.
   ============================================================ */

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export class Barrera extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    /* A la consola también, con la pila de componentes: es lo que sirve
       para encontrar el renglón. */
    console.error(`[Barrera ${this.props.nombre || ""}]`, error, info && info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const pila = String((error && error.stack) || "").split("\n").slice(0, 4).join("\n");
    return (
      <div className="max-w-2xl mx-auto mt-6 border border-mal rounded-lg bg-superficie p-6">
        <div className="flex items-center gap-2 text-mal font-semibold">
          <AlertTriangle size={18} /> Esta pantalla tuvo un error
        </div>
        <p className="text-sm text-texto-suave mt-2">
          El resto del sistema sigue andando: podés ir a otra sección desde el menú. Si se repite, mandá una captura de este recuadro.
        </p>
        <div className="mt-4 rounded-md border border-borde bg-superficie-2 p-3">
          <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">
            {this.props.nombre ? `${this.props.nombre} · ` : ""}Detalle
          </div>
          <div className="f-m text-sm text-texto mt-1 break-words">{String((error && error.message) || error)}</div>
          {pila && <pre className="f-m text-[11px] text-texto-tenue mt-2 whitespace-pre-wrap break-words">{pila}</pre>}
        </div>
        <button onClick={() => this.setState({ error: null })}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-md border border-borde hover:bg-superficie-2">
          <RotateCcw size={14} /> Reintentar
        </button>
      </div>
    );
  }
}
