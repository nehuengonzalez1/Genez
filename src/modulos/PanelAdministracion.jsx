/* ============================================================
   EL PANEL DE ADMINISTRACIÓN (08/10)
   ============================================================

   Vendi tiene una sección Administración con tres entradas —Panel Admin,
   Suscripción y Configuración— separada del trabajo de todos los días.
   Nehuen lo marcó en la comparación: "nosotros los tenemos todos
   juntos". La 0138 juntó Equipo, Permisos y Ajustes al pie del menú,
   pero seguían siendo renglones sueltos y el plan estaba escondido en
   Ajustes → Mi cuenta.

   Esto es la puerta: una tarjeta por cada cosa que se administra, con
   qué hay adentro, y cada una lleva a su pantalla. Cada uno ve solo las
   tarjetas de lo que puede usar (el comercio lo contrató y su rol lo
   habilita): el panel no da acceso a nada que no tuviera.

   Los apartados de Ajustes se abren directo: se deja anotado cuál en la
   misma memoria que usa Ajustes para recordar el último que se miró.
   ============================================================ */

import React from "react";
import { UserCog, ShieldCheck, CreditCard, Store, Receipt, Printer, Tags, Users, KeyRound, ArrowRight } from "lucide-react";
import { Card } from "../ui/Base.jsx";

const APARTADO_GUARDADO = "genez.ajustes.apartado";

export function PanelAdministracion({ puedeVer, ir, negocio }) {
  const abrirAjustes = (apartado) => {
    try { localStorage.setItem(APARTADO_GUARDADO, apartado); } catch { /* arranca en el primero */ }
    ir("ajustes");
  };

  const grupos = [
    {
      titulo: "La gente",
      tarjetas: [
        puedeVer("equipo") && { i: UserCog, n: "Equipo", d: "Quién trabaja, qué hace cada uno y cuándo está. Dar de alta a alguien y darle acceso.", ir: () => ir("equipo") },
        puedeVer("permisos") && { i: ShieldCheck, n: "Permisos", d: "Qué puede hacer cada rol, las excepciones de cada persona, y quién cambió qué.", ir: () => ir("permisos") },
      ],
    },
    {
      titulo: "El negocio y la cuenta",
      tarjetas: [
        puedeVer("plan") && { i: CreditCard, n: "Mi plan", d: "El plan que tenés, cuánto pagás, cambiarlo o darlo de baja.", ir: () => ir("plan") },
        puedeVer("ajustes") && { i: Store, n: "Datos del negocio", d: "Nombre, datos fiscales, objetivos y logo.", ir: () => abrirAjustes("negocio") },
        puedeVer("ajustes") && { i: KeyRound, n: "Mi cuenta", d: "Tu contraseña y la descarga de tus datos.", ir: () => abrirAjustes("plan") },
      ],
    },
    {
      titulo: "Cómo se vende",
      tarjetas: [
        puedeVer("ajustes") && { i: Receipt, n: "Cobros y facturas", d: "Fondo de caja, descuentos por rol, medios de pago, comprobantes y avisos de Mercado Pago.", ir: () => abrirAjustes("cobros") },
        puedeVer("ajustes") && { i: Tags, n: "Precios y stock", d: "Listas de precio, redondeos, venta sin stock, reposición y margen mínimo.", ir: () => abrirAjustes("precios") },
        puedeVer("ajustes") && { i: Users, n: "Clientes", d: "Los puntos que suman al comprar.", ir: () => abrirAjustes("clientes") },
        puedeVer("ajustes") && { i: Printer, n: "Equipos", d: "El ticket, los sonidos, la impresión, la comandera y la pistola, la balanza.", ir: () => abrirAjustes("equipos") },
      ],
    },
  ].map((g) => ({ ...g, tarjetas: g.tarjetas.filter(Boolean) })).filter((g) => g.tarjetas.length);

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-texto-suave">
        Todo lo que se configura de {negocio || "tu negocio"} está acá, separado de lo de todos los días.
      </p>
      {grupos.map((g) => (
        <section key={g.titulo}>
          <h3 className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">{g.titulo}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.tarjetas.map((t) => (
              <button key={t.n} onClick={t.ir} className="text-left group">
                <Card className="p-4 h-full transition-colors group-hover:border-borde-fuerte">
                  <div className="flex items-center gap-2">
                    <t.i size={18} className="text-acento-vivo shrink-0" />
                    <span className="font-semibold flex-1">{t.n}</span>
                    <ArrowRight size={15} className="text-texto-tenue group-hover:text-texto" />
                  </div>
                  <p className="text-sm text-texto-suave mt-1.5">{t.d}</p>
                </Card>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
