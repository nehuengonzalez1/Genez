/* ============================================================
   LO QUE COMPARTEN LA PORTADA Y EL ALTA GUIADA
   ============================================================

   Íconos por rubro, por módulo y por dolor; una foto por negocio; y la
   flecha dibujada a mano de las anotaciones. Es una decisión de estas
   pantallas y no del dato: el catálogo y los rubros no saben de dibujos.
   ============================================================ */

import React from "react";
import {
  ShoppingCart, UtensilsCrossed, CalendarDays, Store, MoreHorizontal,
  ScanBarcode, Wallet, Settings, Package, Boxes, Truck, ClipboardList, FileText, Users,
  Ticket, Landmark, LayoutGrid, BarChart3, MessageCircle, Bell, ShieldCheck, Sparkles,
  Tag, Clock, TrendingDown, Building2, MessageSquare, PiggyBank,
} from "lucide-react";

export const ICONO_RUBRO = { carrito: ShoppingCart, cubiertos: UtensilsCrossed, agenda: CalendarDays, tienda: Store, otro: MoreHorizontal };

export const ICONO_MODULO = {
  cobro: ScanBarcode, caja: Wallet, ajustes: Settings, comandas: UtensilsCrossed, productos: Package,
  stock: Boxes, compras: Truck, pedidos: ClipboardList, clientes: FileText, equipo: Users,
  agenda: CalendarDays, ventas: Ticket, finanzas: Landmark, servicios: LayoutGrid, reportes: BarChart3,
  informes: BarChart3, crm: MessageCircle, comunicaciones: Bell, permisos: ShieldCheck, asistente: Sparkles,
};

export const ICONO_DOLOR = {
  d_stock: Boxes, d_faltantes: TrendingDown, d_precios: Tag, d_caja: FileText, d_atencion: Clock,
  d_proveedores: Truck, d_sucursales: Building2, d_clientes: Users, d_ganancia: PiggyBank, d_otro: MessageSquare,
};

/* Una foto por negocio (identificador de Unsplash). Sin foto, el ícono. */
export const FOTOS = {
  "Almacén": "photo-1583258292688-d0213dc5a3a8",
  "Minimercado": "photo-1604719312566-8912e9227c6a",
  "Kiosco": "photo-1595263431959-23ccced5e5b5",
  "Dietética": "photo-1542990253-a781e04c0082",
  "Verdulería": "photo-1550989460-0adf9ea622e2",
  "Panadería": "photo-1608198093002-ad4e005484ec",
  "Ferretería": "photo-1519520104014-df63821cb6f9",
  "Casa de sanitarios": "photo-1542855368-ca6ea825bca2",
  "Bar": "photo-1566417713940-fe7c737a9ef2",
  "Café": "photo-1533776992670-a72f4c28235e",
  "Restaurante": "photo-1414235077428-338989a2e8c0",
  "Cervecería": "photo-1567696911980-2eed69a46042",
  "Rotisería": "photo-1606728035253-49e8a23146de",
  "Take away": "photo-1616429368325-d5d7542b0ec3",
  "Estética": "photo-1540555700478-4be289fbecef",
  "Peluquería": "photo-1553521041-d168abd31de3",
  "Barbería": "photo-1585747860715-2ba37e788b70",
  "Pilates": "photo-1747239069226-55382c570116",
  "Gimnasio": "photo-1534438327276-14e5300c3a48",
  "Consultorio": "photo-1710074213379-2a9c2653046a",
  "Spa": "photo-1630595271375-5073a6c0638b",
};
export const foto = (nombre) => (FOTOS[nombre] ? `https://images.unsplash.com/${FOTOS[nombre]}?auto=format&fit=crop&w=320&h=200&q=70` : null);

/* Una flecha dibujada a mano, para las anotaciones de la maqueta. */
export function Flecha({ className = "" }) {
  return (
    <svg viewBox="0 0 64 44" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5c12 24 28 32 52 26" />
      <path d="M46 24l11 7-5 9" />
    </svg>
  );
}

/* La anotación a mano con su flecha, arriba a la derecha de cada paso. */
export function Anotacion({ children, className = "" }) {
  return (
    <div className={`manuscrita hidden lg:block absolute right-0 top-0 w-44 text-[19px] leading-[1.05] text-texto rotate-3 text-right ${className}`} aria-hidden="true">
      {children}
      <Flecha className="w-10 mt-0.5 ml-auto mr-6 text-texto-suave -scale-x-100 rotate-12" />
    </div>
  );
}
