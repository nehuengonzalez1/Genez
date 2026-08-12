/* ============================================================
   3. MOTOR DE DIAGNÓSTICO  ("Lo que tenés que saber")
   ============================================================ */

import { TrendingDown, TrendingUp, AlertTriangle, Boxes, Clock, Percent } from "lucide-react";
import { pct, money, nf, faltantesProducto, diasHasta } from "./helpers.js";

export function calcular(productos, diario, coberturaDias) {
  const ult30 = diario.slice(-30);
  const prev30 = diario.slice(-60, -30);
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);

  // Margen calculado sobre el catálogo actual: si el usuario corrige precios, mejora en vivo.
  const v30 = productos.reduce((s, p) => s + p.precio * p.u30, 0);
  const c30 = productos.reduce((s, p) => s + p.costo * p.u30, 0);
  const v30p = productos.reduce((s, p) => s + p.precioPrev * p.u30p, 0);
  const c30p = productos.reduce((s, p) => s + p.costoPrev * p.u30p, 0);
  const margen30 = v30 ? (v30 - c30) / v30 : 0;
  const margen30p = v30p ? (v30p - c30p) / v30p : 0;

  const tickets30 = sum(ult30, "tickets");
  const ticketProm = tickets30 ? sum(ult30, "ventas") / tickets30 : 0;
  const ticketsP = sum(prev30, "tickets");
  const ticketPromP = ticketsP ? sum(prev30, "ventas") / ticketsP : 0;

  const valorStock = productos.reduce((s, p) => s + p.stock * p.costo, 0);

  const subas = productos
    .filter((p) => p.costo > p.costoPrev * 1.005 && p.u30 > 0)
    .map((p) => ({
      p,
      subaPct: p.costo / p.costoPrev - 1,
      impacto: (p.costo - p.costoPrev) * p.u30,
      margenHoy: (p.precio - p.costo) / p.precio,
      margenAntes: (p.precioPrev - p.costoPrev) / p.precioPrev,
    }))
    .filter((x) => x.margenHoy < x.margenAntes - 0.004)
    .sort((a, b) => b.impacto - a.impacto);
  const impactoTotal = subas.reduce((s, x) => s + x.impacto, 0);

  const criticos = productos
    .filter((p) => p.activo && p.vel > 0.08 && p.stock <= Math.max(p.stockMin, p.vel * 3))
    .map((p) => ({ p, cobertura: p.vel > 0 ? p.stock / p.vel : 99 }))
    .sort((a, b) => a.cobertura - b.cobertura);

  const incompletos = productos
    .map((p) => ({ p, faltan: faltantesProducto(p) }))
    .filter((x) => x.faltan.length);

  const dormidos = productos
    .filter((p) => p.u30 === 0 && p.stock > 0 && !p.nuevo)
    .map((p) => ({ p, valor: p.stock * p.costo }))
    .sort((a, b) => b.valor - a.valor);
  const valorDormido = dormidos.reduce((s, x) => s + x.valor, 0);

  const porVencer = productos
    .filter((p) => p.vence && diasHasta(p.vence) <= 15 && p.stock > 0)
    .map((p) => ({ p, dias: diasHasta(p.vence), valor: p.stock * p.costo }))
    .sort((a, b) => a.dias - b.dias);
  const valorVencer = porVencer.reduce((s, x) => s + x.valor, 0);

  const margenFlaco = productos
    .filter((p) => p.u30 >= 4 && (p.precio - p.costo) / p.precio < 0.15)
    .map((p) => ({ p, m: (p.precio - p.costo) / p.precio, vol: p.precio * p.u30 }))
    .sort((a, b) => b.vol - a.vol);

  const sugeridos = productos
    .filter((p) => p.activo && p.vel > 0.05)
    .map((p) => {
      const falta = p.vel * coberturaDias + p.stockMin - p.stock;
      if (falta <= 0) return null;
      const cant = Math.max(p.bulto, Math.ceil(falta / p.bulto) * p.bulto);
      return { p, cant, costo: cant * p.costo, cobertura: p.vel > 0 ? p.stock / p.vel : 99 };
    })
    .filter(Boolean)
    .sort((a, b) => a.cobertura - b.cobertura);

  return {
    v30, v30p, margen30, margen30p, ticketProm, ticketPromP, tickets30,
    valorStock, subas, impactoTotal, criticos, dormidos, valorDormido, incompletos,
    porVencer, valorVencer, margenFlaco, sugeridos, diario,
  };
}

export function insights(k) {
  const out = [];
  const caidaMargen = k.margen30p - k.margen30;
  if (caidaMargen > 0.002 && k.subas.length) {
    const top = k.subas.slice(0, 8);
    const share = k.impactoTotal ? top.reduce((s, x) => s + x.impacto, 0) / k.impactoTotal : 0;
    out.push({
      id: "margen", sev: "alta", tab: "reportes", icon: TrendingDown,
      titulo: `Tu margen bajó ${(caidaMargen * 100).toFixed(1).replace(".", ",")} puntos en 30 días`,
      que: `Pasaste de ${pct(k.margen30p)} a ${pct(k.margen30)} de margen bruto. Sobre ${money(k.v30)} de venta, son ${money(k.impactoTotal)} menos de ganancia por mes.`,
      porque: `${k.subas.length} productos aumentaron de costo y los seguís vendiendo al precio viejo. Los ${top.length} más pesados explican el ${pct(share, 0)} de la caída, empezando por ${top[0].p.nombre}: ${pct(top[0].subaPct, 0)} más caro, de ${pct(top[0].margenAntes, 0)} a ${pct(top[0].margenHoy, 0)} de margen.`,
      hacer: `Corregí el precio de esos ${top.length} primero: son ${money(top.reduce((s, x) => s + x.impacto, 0))} al mes. El sistema te sugiere el precio que recupera el margen que tenías.`,
      accion: "Ver productos que perdieron margen",
    });
  }
  if (k.criticos.length) {
    const urg = k.criticos.filter((x) => x.cobertura < 4);
    out.push({
      id: "quiebre", sev: urg.length > 12 ? "alta" : "media", tab: "compras", icon: AlertTriangle,
      titulo: `${urg.length} productos se te acaban esta semana`,
      que: `${urg.length} artículos que vendés todos los días tienen menos de 4 días de stock. Otros ${k.criticos.length - urg.length} están cerca del mínimo.`,
      porque: `Los de mayor rotación: ${urg.slice(0, 3).map((x) => x.p.nombre).join(", ")}.`,
      hacer: `Tenés un pedido sugerido armado por proveedor. Confirmalo antes del próximo reparto.`,
      accion: "Ir al pedido sugerido",
    });
  }
  if (k.valorDormido > 0) {
    out.push({
      id: "dormido", sev: "media", tab: "stock", icon: Boxes,
      titulo: `${money(k.valorDormido)} parados en mercadería que no se vende`,
      que: `${k.dormidos.length} productos no tuvieron ni una venta en 30 días y siguen ocupando góndola y plata.`,
      porque: `El más pesado es ${k.dormidos[0].p.nombre}: ${nf.format(k.dormidos[0].p.stock)} unidades por ${money(k.dormidos[0].valor)}.`,
      hacer: `Liquidalos con descuento o dejá de reponerlos. Es el ${pct(k.valorDormido / k.valorStock, 0)} de tu inventario.`,
      accion: "Ver productos sin movimiento",
    });
  }
  if (k.porVencer.length) {
    out.push({
      id: "vencer", sev: k.porVencer.some((x) => x.dias <= 0) ? "alta" : "media", tab: "stock", icon: Clock,
      titulo: `${k.porVencer.length} productos vencen en menos de 15 días`,
      que: `Hay ${money(k.valorVencer)} en mercadería con fecha próxima.`,
      porque: `${k.porVencer.filter((x) => x.dias <= 0).length} ya están vencidos y ${k.porVencer.filter((x) => x.dias > 0 && x.dias <= 7).length} vencen dentro de la semana.`,
      hacer: `Adelantalos en góndola o armá una promo. Si vencen, la pérdida es total.`,
      accion: "Ver vencimientos",
    });
  }
  if (k.margenFlaco.length) {
    out.push({
      id: "flaco", sev: "info", tab: "productos", icon: Percent,
      titulo: `${k.margenFlaco.length} productos venden mucho y dejan poco`,
      que: `Mueven ${money(k.margenFlaco.reduce((s, x) => s + x.vol, 0))} al mes con menos de 15% de margen.`,
      porque: `Encabeza ${k.margenFlaco[0].p.nombre}, con ${pct(k.margenFlaco[0].m)} de margen.`,
      hacer: `No siempre conviene tocarles el precio: algunos traen gente al local. Pero conocé cuáles son.`,
      accion: "Ver listado",
    });
  }
  if (k.incompletos.length) {
    const sinPrecio = k.incompletos.filter((x) => x.faltan.includes("precio de venta"));
    const campos = {};
    k.incompletos.forEach((x) => x.faltan.forEach((f) => { campos[f] = (campos[f] || 0) + 1; }));
    const top = Object.entries(campos).sort((a, b) => b[1] - a[1]).slice(0, 3);
    out.push({
      id: "incompletos", sev: sinPrecio.length ? "alta" : "media", tab: "productos", icon: AlertTriangle,
      titulo: `${k.incompletos.length} fichas de producto quedaron incompletas`,
      que: sinPrecio.length
        ? `${sinPrecio.length} no tienen precio de venta cargado: no se pueden cobrar hasta que los completes.`
        : `Se pueden vender, pero les falta información para que los reportes salgan bien.`,
      porque: `Lo que más falta: ${top.map(([f, n]) => `${f} (${n})`).join(", ")}. Suele pasar con lo que se dio de alta rápido al recibir un remito.`,
      hacer: `Completalas desde Productos, con el filtro "Incompletos".`,
      accion: "Completar fichas",
    });
  }

  const dt = k.ticketPromP ? k.ticketProm / k.ticketPromP - 1 : 0;
  out.push({
    id: "ticket", sev: "info", tab: "reportes", icon: dt >= 0 ? TrendingUp : TrendingDown,
    titulo: `Ticket promedio ${money(k.ticketProm)} (${dt >= 0 ? "+" : ""}${pct(dt)} vs. mes anterior)`,
    que: `${nf.format(k.tickets30)} tickets en 30 días por ${money(k.v30)}.`,
    porque: dt >= 0 ? `Cada cliente se está llevando un poco más que el mes pasado.` : `Cada cliente se está llevando menos que el mes pasado.`,
    hacer: `Probá combos en caja con los productos de mayor margen.`,
    accion: "Ver reporte de ventas",
  });
  const orden = { alta: 0, media: 1, info: 2 };
  return out.sort((a, b) => orden[a.sev] - orden[b.sev]);
}
