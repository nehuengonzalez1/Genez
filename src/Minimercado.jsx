import React, { useState, useMemo, useRef, useEffect, useCallback, useContext, createContext } from "react";
import {
  LayoutDashboard, Barcode, Package, Boxes, Truck, Wallet, BarChart3,
  Sparkles, Settings, Search, Plus, Minus, Trash2, X, Check, AlertTriangle,
  TrendingDown, TrendingUp, Printer, MessageCircle, Mail, QrCode, ArrowRight,
  Clock, ChevronLeft, ChevronRight, FileText, Store, Percent, CalendarDays,
  CircleDollarSign, ArrowDownRight, ArrowUpRight, Send, Loader2, ClipboardList, Camera, Upload, FileImage, Bell, BellOff, Volume2 as Vol2, Camera as Cam, CameraOff, Zap, ZapOff, ScanLine, Volume2, VolumeX, Phone, Bike, PackageCheck
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

/* ============================================================
   1. GENERADOR DE DATOS  (catálogo, historial, proveedores)
   ============================================================ */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(20260809);
const rf = (a, b) => a + R() * (b - a);
const ri = (a, b) => Math.floor(rf(a, b + 1));
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 9);

const HOY = new Date(2026, 7, 9);
const dayMs = 86400000;
const addDays = (d, n) => new Date(d.getTime() + n * dayMs);
const fdate = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const fdatel = (d) => `${fdate(d)}/${String(d.getFullYear()).slice(2)}`;

const PROVS = {
  "Bebidas": "Distribuidora Sur",
  "Cervezas y vinos": "Bebidas del Litoral",
  "Almacén": "Mayorista Vital",
  "Lácteos": "Lácteos del Oeste",
  "Fiambrería": "Fiambres Don Pedro",
  "Panificados": "Panadería La Esquina",
  "Golosinas": "Golosinas Express",
  "Galletitas": "Golosinas Express",
  "Snacks": "Golosinas Express",
  "Infusiones": "Mayorista Vital",
  "Limpieza": "Higiene Total",
  "Perfumería": "Higiene Total",
  "Congelados": "Frío Norte",
  "Mascotas": "Mascotas Plus",
  "Kiosco": "Tabacalera Zona",
};

const PROV_INFO = {
  "Distribuidora Sur": { pago: "Cta. cte. 21 días", entrega: "Mar y Vie", tel: "11 4455-2210", cuit: "30-72491377-6" },
  "Bebidas del Litoral": { pago: "Contado", entrega: "Jue", tel: "11 4712-8890", cuit: "30-73080092-4" },
  "Mayorista Vital": { pago: "Cta. cte. 30 días", entrega: "Lun y Jue", tel: "11 5566-3311", cuit: "30-79495784-1" },
  "Lácteos del Oeste": { pago: "Contado", entrega: "Lun a Sáb", tel: "11 6677-1020", cuit: "30-74261487-5" },
  "Fiambres Don Pedro": { pago: "Cta. cte. 15 días", entrega: "Mar y Sáb", tel: "11 3344-9987", cuit: "30-72068618-4" },
  "Panadería La Esquina": { pago: "Contado", entrega: "Diario", tel: "11 2211-5566", cuit: "30-77658891-8" },
  "Golosinas Express": { pago: "Cta. cte. 21 días", entrega: "Mié", tel: "11 8899-4433", cuit: "30-75283583-7" },
  "Higiene Total": { pago: "Cta. cte. 30 días", entrega: "Vie", tel: "11 7788-2244", cuit: "30-78144708-5" },
  "Frío Norte": { pago: "Contado", entrega: "Mar", tel: "11 9900-1122", cuit: "30-79829978-7" },
  "Mascotas Plus": { pago: "Cta. cte. 15 días", entrega: "Vie", tel: "11 6543-2109", cuit: "30-71930564-1" },
  "Tabacalera Zona": { pago: "Contado", entrega: "Lun y Jue", tel: "11 3210-7654", cuit: "30-79682374-3" },
};

const CATALOGO = [
  { c: "Bebidas", items: [
    { t: "Gaseosa", b: ["Coca-Cola", "Pepsi", "Sprite", "Fanta", "7Up", "Manaos", "Paso de los Toros", "Mirinda", "Cunnington"], v: ["500 ml", "1,5 L", "2,25 L", "3 L", "lata 354 ml", "pack x6 500 ml"], p: [850, 5400], m: [.20, .32], vel: [.4, 7] },
    { t: "Agua mineral", b: ["Villavicencio", "Eco de los Andes", "Villa del Sur", "Glaciar", "Ser"], v: ["500 ml", "1,5 L", "2 L", "con gas 1,5 L", "saborizada 1,5 L"], p: [700, 2700], m: [.24, .36], vel: [.5, 5] },
    { t: "Jugo", b: ["Baggio", "Cepita", "Ades", "Citric", "Tang"], v: ["1 L", "200 ml", "polvo 18 g", "pack x3 200 ml"], p: [400, 2500], m: [.25, .40], vel: [.3, 4] },
    { t: "Isotónica", b: ["Gatorade", "Powerade"], v: ["500 ml", "750 ml", "1,5 L"], p: [1500, 3300], m: [.22, .32], vel: [.2, 2] },
    { t: "Energizante", b: ["Red Bull", "Speed", "Monster"], v: ["250 ml", "473 ml"], p: [2200, 4900], m: [.25, .38], vel: [.2, 2.5] },
    { t: "Agua saborizada", b: ["Levité", "Awafrut", "Aquarius"], v: ["500 ml", "1,5 L", "2,25 L"], p: [800, 3000], m: [.24, .36], vel: [.3, 3] },
    { t: "Cerveza sin alcohol", b: ["Quilmes", "Corona", "Heineken"], v: ["lata 473 ml", "botella 1 L"], p: [1400, 4200], m: [.20, .30], vel: [.1, 1] },
    { t: "Soda", b: ["Ivess", "Sierra de los Padres"], v: ["sifón 1,5 L", "botella 2 L"], p: [800, 2000], m: [.20, .30], vel: [.3, 2] },
  ]},
  { c: "Cervezas y vinos", items: [
    { t: "Cerveza", b: ["Quilmes", "Brahma", "Stella Artois", "Corona", "Heineken", "Andes", "Patagonia", "Imperial", "Schneider"], v: ["lata 473 ml", "botella 1 L", "porrón 340 ml", "pack x6 lata"], p: [1200, 9500], m: [.18, .30], vel: [.4, 6] },
    { t: "Vino", b: ["Toro Viejo", "Termidor", "Uvita", "Dada", "Benjamín", "Alamos", "Trumpeter", "Callia", "Norton"], v: ["tinto 750 ml", "blanco 750 ml", "malbec 750 ml", "tetra 1 L"], p: [1800, 12000], m: [.22, .38], vel: [.1, 2] },
    { t: "Aperitivo", b: ["Fernet Branca", "Fernet 1882", "Gancia", "Campari", "Cynar"], v: ["750 ml", "450 ml", "1 L"], p: [4000, 19000], m: [.20, .32], vel: [.1, 1.2] },
    { t: "Espumante", b: ["Chandon", "Nieto Senetiner", "Real"], v: ["750 ml"], p: [6000, 22000], m: [.24, .38], vel: [.03, .5] },
    { t: "Bebida blanca", b: ["Smirnoff", "Bols", "Sernova", "Criadores"], v: ["700 ml", "1 L"], p: [5000, 16000], m: [.22, .34], vel: [.05, .8] },
  ]},
  { c: "Almacén", items: [
    { t: "Arroz", b: ["Gallo", "Molinos Ala", "Lucchetti", "Dos Hermanos", "Marolio"], v: ["largo fino 1 kg", "doble carolina 1 kg", "integral 500 g", "parboil 1 kg"], p: [1200, 3800], m: [.20, .32], vel: [.3, 3], iva: 10.5 },
    { t: "Fideos", b: ["Matarazzo", "Lucchetti", "Don Vicente", "Knorr", "Terrabusi", "Favorita"], v: ["spaghetti 500 g", "mostachol 500 g", "tirabuzón 500 g", "moñito 500 g", "tallarín 500 g"], p: [900, 2600], m: [.22, .35], vel: [.4, 4], iva: 10.5 },
    { t: "Aceite", b: ["Natura", "Cocinero", "Legítimo", "Cañuelas"], v: ["girasol 900 ml", "girasol 1,5 L", "mezcla 900 ml", "oliva 500 ml"], p: [2200, 12000], m: [.16, .28], vel: [.3, 2.5], iva: 10.5 },
    { t: "Azúcar", b: ["Ledesma", "Chango", "Domino"], v: ["1 kg", "500 g"], p: [1100, 2400], m: [.18, .28], vel: [.4, 2.5], iva: 10.5 },
    { t: "Harina", b: ["Pureza", "Blancaflor", "Favorita", "Morixe"], v: ["000 1 kg", "0000 1 kg", "leudante 1 kg"], p: [900, 2200], m: [.20, .30], vel: [.3, 2.5], iva: 10.5 },
    { t: "Yerba mate", b: ["Playadito", "Taragüi", "Rosamonte", "Cruz de Malta", "La Merced", "Amanda", "Union"], v: ["500 g", "1 kg", "despalada 500 g"], p: [2600, 9500], m: [.20, .32], vel: [.4, 3] },
    { t: "Conserva", b: ["La Campagnola", "Arcor", "Marolio", "Noel"], v: ["arvejas 350 g", "choclo 350 g", "atún 170 g", "durazno 820 g", "tomate perita 400 g"], p: [900, 4200], m: [.24, .38], vel: [.2, 2] },
    { t: "Puré de tomate", b: ["Arcor", "Marolio", "Molto", "Inca"], v: ["520 g", "1 kg"], p: [800, 2100], m: [.22, .34], vel: [.4, 3] },
    { t: "Legumbres", b: ["Egran", "Marolio", "Arcor"], v: ["lentejas 500 g", "porotos 500 g", "garbanzos 500 g"], p: [1200, 3000], m: [.24, .36], vel: [.1, 1.2] },
    { t: "Aderezo", b: ["Hellmann's", "Natura", "Danica", "Fanacoa"], v: ["mayonesa 237 g", "ketchup 250 g", "mostaza 250 g", "mayonesa 475 g"], p: [1100, 3600], m: [.26, .40], vel: [.2, 2] },
    { t: "Mermelada", b: ["Arcor", "BC", "La Campagnola"], v: ["durazno 454 g", "frutilla 454 g", "ciruela 454 g"], p: [1500, 3400], m: [.26, .38], vel: [.1, 1] },
    { t: "Sopas y caldos", b: ["Knorr", "Maggi"], v: ["sopa crema 63 g", "caldo x6", "caldo x12"], p: [700, 2600], m: [.28, .42], vel: [.1, 1.4] },
    { t: "Polenta y avena", b: ["Presto Pronta", "Quaker", "Mapricor"], v: ["500 g", "1 kg"], p: [900, 3200], m: [.24, .36], vel: [.1, 1.2] },
    { t: "Galletas de arroz", b: ["Gallo", "Ceralc"], v: ["100 g", "150 g"], p: [1200, 2800], m: [.28, .40], vel: [.1, 1] },
    { t: "Huevos", b: ["Granja del Sol", "Ovoprot"], v: ["maple x30", "cartón x6", "cartón x12"], p: [1800, 12000], m: [.18, .30], vel: [.5, 3.5], per: 25, iva: 10.5 },
    { t: "Sal y condimentos", b: ["Celusal", "Dos Anclas", "Alicante"], v: ["fina 500 g", "gruesa 1 kg", "orégano 25 g", "pimentón 25 g"], p: [500, 1800], m: [.30, .45], vel: [.2, 1.5] },
  ]},
  { c: "Lácteos", items: [
    { t: "Leche", b: ["La Serenísima", "Sancor", "Ilolay", "Armonía"], v: ["entera sachet 1 L", "descremada sachet 1 L", "larga vida 1 L", "chocolatada 1 L"], p: [1100, 2900], m: [.14, .24], vel: [1, 9], per: 20, iva: 10.5 },
    { t: "Yogur", b: ["Ser", "Yogurísimo", "Sancor", "La Serenísima"], v: ["bebible 900 g", "firme 190 g", "griego 150 g", "pack x4"], p: [900, 4200], m: [.22, .34], vel: [.4, 4], per: 25 },
    { t: "Queso untable", b: ["Casancrem", "Finlandia", "Mendicrim"], v: ["190 g", "290 g", "light 190 g"], p: [1800, 4200], m: [.22, .32], vel: [.2, 2], per: 35 },
    { t: "Manteca", b: ["La Serenísima", "Sancor"], v: ["100 g", "200 g"], p: [1400, 3600], m: [.20, .30], vel: [.2, 1.6], per: 40 },
    { t: "Crema de leche", b: ["La Serenísima", "Sancor"], v: ["200 ml", "500 ml"], p: [1500, 3800], m: [.22, .32], vel: [.1, 1.2], per: 25 },
    { t: "Dulce de leche", b: ["La Serenísima", "Sancor", "Vacalin", "Havanna"], v: ["400 g", "1 kg", "repostero 400 g"], p: [2200, 7500], m: [.24, .36], vel: [.2, 1.8] },
    { t: "Leche en polvo", b: ["Nido", "La Serenísima", "Sancor"], v: ["400 g", "800 g"], p: [4200, 12000], m: [.18, .28], vel: [.05, .8] },
    { t: "Postre", b: ["Danette", "Ser", "Shimy"], v: ["vainilla 95 g", "chocolate 95 g", "flan 95 g"], p: [700, 1800], m: [.26, .40], vel: [.3, 2.5], per: 30 },
  ]},
  { c: "Fiambrería", items: [
    { t: "Jamón cocido", b: ["Paladini", "Cagnoli", "La Piamontesa"], v: ["x kg"], p: [9000, 16000], m: [.28, .42], vel: [.2, 1.5], per: 12, kg: true },
    { t: "Queso", b: ["La Suerte", "Sancor", "Verónica"], v: ["cremoso x kg", "port salut x kg", "sardo x kg", "rallado 100 g"], p: [1500, 18000], m: [.26, .40], vel: [.2, 1.8], per: 25 },
    { t: "Salame", b: ["Cagnoli", "Paladini", "Tandilero"], v: ["milán x kg", "tandilero x kg"], p: [12000, 24000], m: [.30, .44], vel: [.1, .9], per: 40, kg: true },
    { t: "Mortadela", b: ["Paladini", "Cagnoli"], v: ["x kg"], p: [6000, 11000], m: [.28, .42], vel: [.1, 1], per: 15, kg: true },
    { t: "Fiambre envasado", b: ["Paladini", "Swift", "Cagnoli"], v: ["jamón 150 g", "salame 100 g", "panceta 150 g"], p: [1800, 4800], m: [.24, .36], vel: [.2, 1.6], per: 30 },
  ]},
  { c: "Panificados", items: [
    { t: "Pan", b: ["La Esquina"], v: ["francés x kg", "mignon x kg", "figazza unidad"], p: [800, 4200], m: [.35, .55], vel: [1, 6], per: 2, iva: 10.5 },
    { t: "Pan lactal", b: ["Bimbo", "Fargo", "Lactal"], v: ["blanco 390 g", "integral 390 g", "salvado 500 g"], p: [1800, 4200], m: [.22, .34], vel: [.3, 2.5], per: 10 },
    { t: "Facturas", b: ["La Esquina"], v: ["docena", "media docena", "unidad"], p: [700, 8500], m: [.40, .60], vel: [.5, 3], per: 1 },
    { t: "Tostadas", b: ["Bimbo", "Fargo", "Riera"], v: ["clásicas 190 g", "integrales 190 g"], p: [1400, 3000], m: [.26, .38], vel: [.1, 1.2] },
  ]},
  { c: "Golosinas", items: [
    { t: "Chocolate", b: ["Milka", "Cofler", "Block", "Shot", "Rhodesia", "Águila"], v: ["barra 100 g", "barra 55 g", "tableta 150 g"], p: [900, 5200], m: [.28, .45], vel: [.3, 3] },
    { t: "Alfajor", b: ["Jorgito", "Guaymallén", "Terrabusi", "Milka", "Fantoche"], v: ["simple", "triple", "pack x6"], p: [500, 4200], m: [.30, .48], vel: [.5, 5] },
    { t: "Caramelos", b: ["Arcor", "Sugus", "Media Hora", "Butter Toffees"], v: ["bolsa 100 g", "bolsa 400 g", "unidad"], p: [200, 3200], m: [.35, .55], vel: [.3, 3] },
    { t: "Chicle", b: ["Beldent", "Topline", "Bazooka"], v: ["blister 10 u", "unidad"], p: [300, 1600], m: [.35, .55], vel: [.4, 3.5] },
    { t: "Bocaditos", b: ["Bon o Bon", "Cofler", "Arcor"], v: ["unidad", "caja x18"], p: [400, 9500], m: [.30, .46], vel: [.2, 2.5] },
    { t: "Chupetín", b: ["Mister Pop", "Pico Dulce", "Chupa Chups"], v: ["unidad", "pack x10"], p: [200, 2500], m: [.40, .60], vel: [.3, 3] },
  ]},
  { c: "Galletitas", items: [
    { t: "Galletitas dulces", b: ["Oreo", "Chocolinas", "Rumba", "Melba", "Traviata", "Merengadas", "Pepitos", "Sonrisas"], v: ["paquete 118 g", "paquete 170 g", "pack x3"], p: [700, 4200], m: [.26, .40], vel: [.4, 4] },
    { t: "Galletitas saladas", b: ["Criollitas", "Express", "Club Social", "Saladix", "Cerealitas"], v: ["paquete 100 g", "paquete 300 g", "pack x3"], p: [700, 3800], m: [.26, .40], vel: [.4, 4] },
    { t: "Obleas", b: ["Rhodesia", "Bon o Bon", "Opera"], v: ["unidad", "pack x6"], p: [500, 3600], m: [.30, .45], vel: [.3, 2.5] },
  ]},
  { c: "Snacks", items: [
    { t: "Papas fritas", b: ["Lays", "Pehuamar", "Krachitos", "Pringles", "Quento"], v: ["65 g", "130 g", "220 g"], p: [1300, 5200], m: [.28, .42], vel: [.4, 3.5] },
    { t: "Palitos", b: ["Pehuamar", "Doritos", "3D"], v: ["70 g", "100 g"], p: [1100, 3200], m: [.30, .44], vel: [.3, 3] },
    { t: "Maní", b: ["Pehuamar", "Krachitos", "Nucete"], v: ["salado 100 g", "japonés 100 g", "con chocolate 80 g"], p: [900, 3400], m: [.30, .45], vel: [.2, 2] },
  ]},
  { c: "Infusiones", items: [
    { t: "Café", b: ["La Virginia", "Nescafé", "Dolca", "Bonafide", "Cabrales"], v: ["instantáneo 100 g", "molido 250 g", "molido 500 g"], p: [2400, 9800], m: [.22, .34], vel: [.2, 2] },
    { t: "Té", b: ["Green Hills", "La Virginia", "Taragüi"], v: ["saquitos x25", "saquitos x50", "verde x20"], p: [900, 3200], m: [.28, .42], vel: [.2, 1.8] },
    { t: "Mate cocido", b: ["Taragüi", "CBSé", "Rosamonte"], v: ["saquitos x25", "saquitos x50"], p: [1100, 2600], m: [.26, .38], vel: [.1, 1.2] },
    { t: "Endulzante", b: ["Hileret", "Chuker"], v: ["líquido 200 ml", "polvo x50"], p: [1400, 4800], m: [.28, .42], vel: [.05, .8] },
    { t: "Cacao", b: ["Nesquik", "Toddy", "Vascolet"], v: ["400 g", "800 g"], p: [2600, 7200], m: [.22, .34], vel: [.2, 1.6] },
  ]},
  { c: "Limpieza", items: [
    { t: "Lavandina", b: ["Ayudín", "Odex", "Procenex"], v: ["1 L", "2 L", "gel 1 L"], p: [900, 3200], m: [.28, .42], vel: [.3, 2.5] },
    { t: "Detergente", b: ["Magistral", "Ala", "Zorro"], v: ["300 ml", "750 ml", "1,25 L"], p: [1200, 5200], m: [.26, .40], vel: [.3, 2.8] },
    { t: "Jabón en polvo", b: ["Ala", "Skip", "Ariel", "Zorro"], v: ["800 g", "3 kg", "líquido 800 ml"], p: [2400, 14000], m: [.22, .34], vel: [.2, 2] },
    { t: "Suavizante", b: ["Vívere", "Comfort", "Ala"], v: ["900 ml", "1,8 L"], p: [1900, 6200], m: [.24, .36], vel: [.2, 1.8] },
    { t: "Limpiador", b: ["Cif", "Mr Músculo", "Poett", "Procenex"], v: ["líquido 900 ml", "crema 750 g", "gatillo 500 ml"], p: [1500, 5400], m: [.28, .42], vel: [.2, 2] },
    { t: "Insecticida", b: ["Raid", "Fuyi"], v: ["aerosol 360 ml", "espiral x10", "tabletas x12"], p: [1800, 7200], m: [.28, .42], vel: [.05, .9] },
    { t: "Papel de cocina", b: ["Elite", "Sussex", "Felpita"], v: ["x2", "x3"], p: [1600, 5200], m: [.26, .38], vel: [.2, 1.8] },
    { t: "Accesorios limpieza", b: ["Mortimer", "Virulana", "Genérico"], v: ["esponja x2", "trapo piso", "rejilla x3", "bolsas 45x60 x10"], p: [600, 3200], m: [.35, .55], vel: [.2, 2] },
  ]},
  { c: "Perfumería", items: [
    { t: "Papel higiénico", b: ["Higienol", "Elite", "Sussex", "Felpita"], v: ["x4 30 m", "x4 80 m", "x12 30 m"], p: [1800, 9500], m: [.24, .38], vel: [.5, 3.5] },
    { t: "Shampoo", b: ["Sedal", "Pantene", "Plusbelle", "Head & Shoulders"], v: ["350 ml", "650 ml", "acondicionador 350 ml"], p: [2200, 8500], m: [.26, .40], vel: [.2, 1.8] },
    { t: "Jabón de tocador", b: ["Lux", "Dove", "Rexona", "Plusbelle"], v: ["90 g", "pack x3"], p: [700, 3600], m: [.30, .44], vel: [.2, 2] },
    { t: "Pasta dental", b: ["Colgate", "Odol", "Kolynos"], v: ["90 g", "140 g"], p: [1400, 4200], m: [.28, .42], vel: [.2, 1.8] },
    { t: "Desodorante", b: ["Rexona", "Nivea", "Axe"], v: ["aerosol 150 ml", "roll on 50 ml"], p: [2400, 6800], m: [.26, .40], vel: [.2, 1.6] },
    { t: "Toallas femeninas", b: ["Always", "Ladysoft", "Nosotras"], v: ["x8", "x16"], p: [1600, 5200], m: [.26, .40], vel: [.2, 1.5] },
    { t: "Afeitado", b: ["Gillette", "Bic"], v: ["máquina x2", "espuma 200 ml"], p: [1800, 7500], m: [.28, .42], vel: [.05, .8] },
    { t: "Botiquín", b: ["Estrella", "Curitas"], v: ["algodón 100 g", "gasas x10", "alcohol 250 ml"], p: [900, 3600], m: [.30, .46], vel: [.05, .9] },
    { t: "Pañales", b: ["Pampers", "Huggies", "Babysec"], v: ["talle M x30", "talle G x30", "talle XG x30"], p: [12000, 26000], m: [.16, .26], vel: [.1, .8] },
  ]},
  { c: "Congelados", items: [
    { t: "Hamburguesas", b: ["Paty", "Swift", "Good Mark"], v: ["x4", "x8"], p: [3200, 9800], m: [.22, .34], vel: [.2, 2], per: 90 },
    { t: "Papas congeladas", b: ["McCain", "Farm Frites"], v: ["bastón 700 g", "noisette 500 g"], p: [3200, 7800], m: [.22, .34], vel: [.2, 1.6], per: 120 },
    { t: "Helado", b: ["Grido", "Frigor", "Ice Cream"], v: ["pote 1 L", "palito", "bombón"], p: [1200, 9500], m: [.28, .44], vel: [.2, 2.5], per: 180 },
    { t: "Milanesas", b: ["Granja del Sol", "Swift"], v: ["pollo 4 u", "carne 4 u"], p: [4200, 9800], m: [.20, .32], vel: [.2, 1.4], per: 90 },
    { t: "Pescado congelado", b: ["Nautilus", "Marfrío"], v: ["merluza 400 g", "rabas 300 g"], p: [4200, 11000], m: [.22, .34], vel: [.05, .7], per: 120 },
    { t: "Rebozados", b: ["Granja del Sol", "Bocatti"], v: ["nuggets 400 g", "patitas 400 g"], p: [3800, 8200], m: [.22, .34], vel: [.2, 1.4], per: 90 },
  ]},
  { c: "Mascotas", items: [
    { t: "Alimento perro", b: ["Dog Chow", "Pedigree", "Vital Can", "Excellent"], v: ["3 kg", "8 kg", "15 kg"], p: [8000, 48000], m: [.18, .28], vel: [.05, .8] },
    { t: "Alimento gato", b: ["Cat Chow", "Whiskas", "Vital Cat"], v: ["1 kg", "3 kg", "7,5 kg"], p: [5000, 32000], m: [.18, .28], vel: [.05, .7] },
    { t: "Snack mascota", b: ["Pedigree", "Whiskas"], v: ["hueso masticable", "sobre 100 g"], p: [900, 3600], m: [.28, .44], vel: [.1, 1.2] },
    { t: "Accesorios mascota", b: ["Genérico"], v: ["piedritas 4 kg", "hueso masticable", "collar"], p: [2500, 9000], m: [.30, .50], vel: [.05, .6] },
  ]},
  { c: "Kiosco", items: [
    { t: "Cigarrillos", b: ["Marlboro", "Philip Morris", "Lucky Strike", "Camel", "Chesterfield"], v: ["box 10", "box 20", "KS 20"], p: [2500, 6800], m: [.08, .14], vel: [.5, 5] },
    { t: "Encendedor", b: ["Bic", "Genérico"], v: ["unidad"], p: [900, 2200], m: [.40, .60], vel: [.2, 1.5] },
    { t: "Pilas", b: ["Duracell", "Energizer", "Eveready"], v: ["AA x2", "AAA x2", "9V"], p: [2200, 7500], m: [.32, .48], vel: [.05, .8] },
    { t: "Papelería", b: ["Bic", "Rivadavia"], v: ["birome", "cuaderno 48 h", "cinta adhesiva"], p: [600, 3800], m: [.35, .55], vel: [.05, .8] },
    { t: "Varios kiosco", b: ["Genérico"], v: ["velas x6", "fósforos", "preservativos x3", "curitas x10"], p: [800, 4200], m: [.35, .55], vel: [.05, 1] },
  ]},
];

function generar() {
  const productos = [];
  let n = 1;
  for (const grupo of CATALOGO) {
    for (const it of grupo.items) {
      for (const b of it.b) {
        for (const v of it.v) {
          const precio = Math.round(rf(it.p[0], it.p[1]) / 10) * 10;
          const margen = rf(it.m[0], it.m[1]);
          const costo = Math.round(precio / (1 + margen));

          // Historial de costos: 2 a 4 cambios en los últimos 150 días.
          // El cambio más reciente deja el costo actual; hacia atrás, más barato.
          const bebida = grupo.c === "Bebidas" || grupo.c === "Cervezas y vinos";
          const subioReciente = R() < (bebida ? 0.62 : 0.16);
          const dias = [];
          for (let x = 0; x < ri(1, 3); x++) dias.push(ri(34, 150));
          dias.push(subioReciente ? ri(2, 28) : ri(34, 150));
          dias.sort((a, c) => c - a);                 // más viejo primero
          const costos = new Array(dias.length);
          let cur = costo;
          for (let i = dias.length - 1; i >= 0; i--) {
            costos[i] = Math.round(cur);
            cur = cur / (1 + rf(0.04, 0.16));
          }
          const historial = dias.map((d, i) => ({ fecha: addDays(HOY, -d), costo: costos[i] }));
          const viejos = historial.filter((h) => h.fecha < addDays(HOY, -30));
          const costoPrev = viejos.length ? viejos[viejos.length - 1].costo : costos[0];

          productos.push({
            id: n,
            nombre: `${it.t} ${b} ${v}`,
            categoria: grupo.c,
            marca: b,
            sku: `${grupo.c.slice(0, 3).toUpperCase()}-${String(n).padStart(4, "0")}`,
            barcode: "779" + String(1000000 + n * 37).padStart(10, "0").slice(0, 10),
            costo, costoPrev, precio, precioPrev: precio,
            precio2: null,
            iva: it.iva || 21,
            bulto: pick([1, 6, 6, 12, 12, 24]),
            unidad: it.kg ? "kg" : "un",
            proveedor: PROVS[grupo.c],
            velRaw: rf(it.vel[0], it.vel[1]) * (R() < 0.12 ? 0.2 : 1),
            muerto: R() < 0.05,
            per: it.per,
            historial,
            activo: true,
          });
          n++;
        }
      }
    }
  }

  // Escalar la rotación al tamaño real de un minimercado de una caja
  const OBJETIVO_DIA = 1800000;
  const bruto = productos.reduce((s, p) => s + p.precio * p.velRaw, 0);
  const esc = OBJETIVO_DIA / bruto;

  // Lista 2: precio por cantidad. No todos los productos la tienen, y nunca
  // puede quedar por debajo del costo.
  for (const p of productos) {
    if (R() < 0.75) {
      const cand = Math.round((p.precio * (1 - rf(0.05, 0.13))) / 10) * 10;
      p.precio2 = cand > p.costo * 1.05 ? cand : null;
    }
  }

  for (const p of productos) {
    p.vel = p.muerto ? +rf(0.002, 0.02).toFixed(4) : +(p.velRaw * esc).toFixed(4);
    delete p.velRaw;
    p.stockMin = p.unidad === "kg" ? +(p.vel * 5).toFixed(1) : Math.max(2, Math.round(p.vel * 6));
    if (p.muerto) {
      p.u30 = 0;
      p.u30p = ri(0, 2);
      p.stock = ri(3, 24);
      p.ultimaVenta = addDays(HOY, -ri(38, 170));
    } else {
      p.u30 = Math.max(0, Math.round(p.vel * 30 * rf(0.78, 1.22)));
      p.u30p = Math.max(0, Math.round(p.vel * 30 * rf(0.72, 1.26)));
      p.stock = Math.round(p.vel * rf(4, 34));
      if (R() < 0.06) p.stock = 0;
      if (R() < 0.09) p.stock = Math.round(p.vel * rf(45, 95));   // sobrestock
      p.ultimaVenta = addDays(HOY, -(p.u30 > 0 ? ri(0, 5) : ri(30, 90)));
    }
    if (p.unidad === "kg") p.stock = Math.round(Math.max(p.vel * rf(4, 20), 0.5) * 10) / 10;
    p.vence = p.per ? addDays(HOY, ri(-2, Math.max(10, p.per))) : null;
    delete p.per;
    delete p.muerto;
  }

  // Serie diaria de 90 días, coherente con los datos de producto
  const v30 = productos.reduce((s, p) => s + p.precio * p.u30, 0);
  const c30 = productos.reduce((s, p) => s + p.costo * p.u30, 0);
  const v30p = productos.reduce((s, p) => s + p.precio * p.u30p, 0);
  const c30p = productos.reduce((s, p) => s + p.costoPrev * p.u30p, 0);
  const m30 = v30 ? 1 - c30 / v30 : 0;
  const m30p = v30p ? 1 - c30p / v30p : 0;

  const bloques = [
    { desde: 89, hasta: 60, total: v30p * 0.93, margen: m30p * 1.01, ticket: 8900 },
    { desde: 59, hasta: 30, total: v30p, margen: m30p, ticket: 9150 },
    { desde: 29, hasta: 0, total: v30, margen: m30, ticket: 9400 },
  ];
  const diario = [];
  for (const b of bloques) {
    const dias = [];
    for (let i = b.desde; i >= b.hasta; i--) {
      const d = addDays(HOY, -i);
      const forma = [0.72, 0.86, 0.9, 0.95, 1.02, 1.24, 1.31][d.getDay()] * rf(0.88, 1.12) * (i === 0 ? 0.55 : 1);
      dias.push({ d, forma });
    }
    const suma = dias.reduce((s, x) => s + x.forma, 0);
    for (const x of dias) {
      const ventas = Math.round((x.forma / suma) * b.total);
      diario.push({
        fecha: x.d, label: fdate(x.d), ventas,
        costo: Math.round(ventas * (1 - b.margen)),
        tickets: Math.max(1, Math.round(ventas / b.ticket)),
      });
    }
  }
  return { productos, diario };
}

const DATA = generar();

/* Pedidos de clientes para preparar (WhatsApp, teléfono, mostrador) */
const CLIENTES = [
  { n: "Marta Gómez", tel: "11 5031-7742", dir: "Rivadavia 2140, 3º B" },
  { n: "Rubén Ledesma", tel: "11 6284-1190", dir: "Retira en el local" },
  { n: "Almacén de Vicky", tel: "11 4478-9032", dir: "Sarmiento 88" },
  { n: "Flia. Paniagua", tel: "11 3390-2255", dir: "Belgrano 415, PB" },
  { n: "Nico (kiosco)", tel: "11 7712-6604", dir: "Retira en el local" },
];

function generarPedidos(productos) {
  const candidatos = productos.filter((p) => p.stock > 2 && p.vel > 0.4);
  const notas = ["Si no hay Coca, mandá Pepsi.", "", "Tocar timbre 3B.", "", "Paga con transferencia, ya la mandé."];
  return CLIENTES.map((c, i) => {
    const cant = ri(5, 9);
    const usados = new Set();
    const items = [];
    while (items.length < cant) {
      const p = candidatos[Math.floor(R() * candidatos.length)];
      if (usados.has(p.id)) continue;
      usados.add(p.id);
      items.push({
        pid: p.id, nombre: p.nombre, barcode: p.barcode, precio: p.precio, unidad: p.unidad,
        pedido: p.unidad === "kg" ? +(0.25 * ri(1, 4)).toFixed(2) : ri(1, 4),
        preparado: 0, faltante: 0,
      });
    }
    return {
      id: uid(), nro: `P-${1040 + i}`, cliente: c.n, tel: c.tel, dir: c.dir,
      canal: ["WhatsApp", "WhatsApp", "Teléfono", "WhatsApp", "Mostrador"][i],
      entrega: c.dir.startsWith("Retira") ? "Retira" : "Envío",
      hora: ["09:15", "09:48", "10:22", "10:51", "11:07"][i],
      nota: notas[i], estado: "pendiente", items,
    };
  });
}
const PEDIDOS_INICIALES = generarPedidos(DATA.productos);


/* ============================================================
   2. HELPERS
   ============================================================ */

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v) => "$" + nf.format(Math.round(v || 0));
const moneyk = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1000000) return "$" + (v / 1000000).toFixed(1).replace(".", ",") + "M";
  if (a >= 1000) return "$" + Math.round(v / 1000) + "k";
  return "$" + Math.round(v || 0);
};
const pct = (v, dec = 1) => (v * 100).toFixed(dec).replace(".", ",") + "%";
const diasDesde = (d) => Math.floor((HOY - d) / dayMs);
const diasHasta = (d) => Math.ceil((d - HOY) / dayMs);

const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "https://api.anthropic.com";
const API_MODELO = (typeof window !== "undefined" && window.__API_MODELO__) || "claude-sonnet-4-6";

/* Lista 2: se activa sola cuando el renglón llega a la cantidad mínima, y
   solo en ese renglón. Tres fideos iguales pagan lista 2; el aceite que va
   solo en el mismo ticket sigue en lista 1.                                 */
/* Un código de barras tiene 6 dígitos o más; una cantidad, 4 o menos (y puede
   llevar decimales para los pesables). Con esa frontera se puede escribir la
   cantidad en el mismo campo donde se escanea, sin ambigüedad.              */
/* La síntesis de voz lee "24.500" de forma irregular según el navegador, así
   que el monto se convierte a palabras antes de mandarlo a hablar.          */
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menosDeMil(n) {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  let out = CENTENAS[c];
  if (r) {
    let resto;
    if (r < 20) resto = UNIDADES[r];
    else if (r < 30) resto = r === 20 ? "veinte" : "veinti" + UNIDADES[r - 20];
    else {
      const d = Math.floor(r / 10), u = r % 10;
      resto = DECENAS[d] + (u ? " y " + UNIDADES[u] : "");
    }
    out = out ? out + " " + resto : resto;
  }
  return out;
}

function numeroALetras(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones === 1) partes.push("un millón");
  else if (millones > 1) partes.push(menosDeMil(millones) + " millones");
  if (miles === 1) partes.push("mil");
  else if (miles > 1) partes.push(menosDeMil(miles) + " mil");
  if (resto) partes.push(menosDeMil(resto));
  return partes.join(" ").replace("uno mil", "un mil").trim();
}

function esCantidad(t) {
  return /^\d{1,4}([.,]\d{1,3})?$/.test(String(t).trim());
}
const aNumero = (t) => Number(String(t).trim().replace(",", "."));

function precioAplicado(precio, precio2, cantidad, ajustes) {
  if (!ajustes || !ajustes.lista2 || !precio2) return { precio, lista: 1 };
  return cantidad >= ajustes.umbral2 ? { precio: precio2, lista: 2 } : { precio, lista: 1 };
}

function faltantesProducto(p) {
  const f = [];
  if (!p.precio) f.push("precio de venta");
  if (!p.costo) f.push("costo");
  if (!p.categoria) f.push("rubro");
  if (!p.proveedor) f.push("proveedor");
  if (!p.barcode) f.push("código de barras");
  if (!p.stockMin) f.push("stock mínimo");
  return f;
}

function faltantesProveedor(v) {
  const f = [];
  if (!v || !v.cuit) f.push("CUIT");
  if (!v || !v.tel) f.push("teléfono");
  if (!v || !v.pago) f.push("condición de pago");
  if (!v || !v.entrega) f.push("día de entrega");
  return f;
}

/* Ficha nueva con lo mínimo para operar. Lo que no se sabe queda vacío y el
   sistema lo reclama después, en vez de inventar un valor por defecto que
   después nadie revisa.                                                     */
function productoNuevo(datos, productos) {
  const id = productos.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  const costo = Number(datos.costo) || 0;
  return {
    id,
    nombre: (datos.nombre || "Producto sin nombre").trim(),
    categoria: datos.categoria || "",
    marca: datos.marca || "",
    sku: `NUE-${String(id).padStart(4, "0")}`,
    barcode: (datos.barcode || "").replace(/\D/g, ""),
    costo, costoPrev: costo,
    precio: Number(datos.precio) || 0,
    precioPrev: Number(datos.precio) || 0,
    precio2: Number(datos.precio2) || null,
    iva: Number(datos.iva) || 21,
    stock: Number(datos.stock) || 0,
    stockMin: Number(datos.stockMin) || 0,
    bulto: Number(datos.bulto) || 1,
    unidad: datos.unidad || "un",
    proveedor: datos.proveedor || "",
    vel: 0, u30: 0, u30p: 0,
    ultimaVenta: HOY, vence: null,
    historial: costo ? [{ fecha: HOY, costo }] : [],
    activo: true, nuevo: true, creado: HOY,
  };
}

const MEDIOS = [
  { k: "efectivo", n: "Efectivo", com: 0 },
  { k: "debito", n: "Débito", com: 0.012 },
  { k: "credito", n: "Crédito", com: 0.031 },
  { k: "mp", n: "QR / Mercado Pago", com: 0.008 },
  { k: "transferencia", n: "Transferencia", com: 0 },
];

/* ============================================================
   3. MOTOR DE DIAGNÓSTICO  ("Lo que tenés que saber")
   ============================================================ */

function calcular(productos, diario, coberturaDias) {
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

function insights(k) {
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

/* ============================================================
   4. UI BASE
   ============================================================ */

const SEV = {
  alta: { pill: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", label: "Urgente" },
  media: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", label: "Atención" },
  info: { pill: "bg-stone-100 text-stone-600 border-stone-200", dot: "bg-stone-400", label: "Dato" },
};

function Card({ children, className = "" }) {
  return <div className={`bg-white border border-stone-200 rounded-2xl ${className}`}>{children}</div>;
}

function Kpi({ label, valor, delta, sub, tono = "neutro" }) {
  const col = tono === "bien" ? "text-emerald-600" : tono === "mal" ? "text-red-600" : "text-stone-900";
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">{label}</div>
      <div className={`f-d text-3xl mt-1 tabular-nums ${col}`}>{valor}</div>
      <div className="flex items-center gap-2 mt-1">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {pct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="text-xs text-stone-400">{sub}</span>}
      </div>
    </Card>
  );
}

function Boton({ children, onClick, variant = "primary", size = "md", className = "", disabled, title }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed";
  const v = {
    primary: "bg-orange-500 text-white hover:bg-orange-600",
    dark: "bg-stone-900 text-white hover:bg-stone-800",
    ghost: "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50",
    quiet: "text-stone-500 hover:text-stone-900 hover:bg-stone-100",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  }[variant];
  const s = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-3.5 py-2", lg: "text-base px-5 py-3" }[size];
  return <button title={title} disabled={disabled} onClick={onClick} className={`${base} ${v} ${s} ${className}`}>{children}</button>;
}

function Modal({ open, onClose, children, ancho = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${ancho} bg-white rounded-t-3xl md:rounded-2xl border border-stone-200 shadow-xl max-h-[92vh] md:max-h-[88vh] overflow-auto seguro-abajo`}>{children}</div>
    </div>
  );
}

function Tabs({ items, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-stone-200 overflow-x-auto">
      {items.map((it) => (
        <button key={it.k} onClick={() => onChange(it.k)}
          className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${value === it.k ? "border-orange-500 text-stone-900" : "border-transparent text-stone-400 hover:text-stone-700"}`}>
          {it.n}{it.badge != null && <span className="ml-1.5 text-[10px] bg-stone-100 text-stone-600 rounded-full px-1.5 py-0.5">{it.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* --- Pistola lectora ---------------------------------------------------
   Un lector de códigos se comporta como un teclado: escribe muy rápido y
   cierra con Enter. Capturamos esa ráfaga a nivel de ventana, así el
   operador puede disparar sin tener que clickear ningún campo antes.      */
function useScanner(onScan, activo = true) {
  const buf = useRef("");
  const ult = useRef(0);
  useEffect(() => {
    if (!activo) return;
    const h = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ahora = Date.now();
      if (ahora - ult.current > 90) buf.current = "";
      ult.current = ahora;
      if (e.key === "Enter") {
        const cod = buf.current;
        buf.current = "";
        if (/^\d{6,}$/.test(cod)) { e.preventDefault(); onScan(cod); }
        return;
      }
      if (e.key.length === 1) buf.current += e.key;
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onScan, activo]);
}

/* Despachador de escaneo. Cada pantalla que sabe qué hacer con un código se
   registra en una pila; el último en montarse gana (un modal le gana a la
   pantalla que lo abrió). Si nadie se registra, el escaneo cae en la ficha
   rápida global: el producto se puede vender, reponer o repreciar desde
   cualquier lugar del sistema.                                              */
const ScanCtx = createContext({ push: () => () => {} });

function useScanHandler(fn, activo = true) {
  const { push } = useContext(ScanCtx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    return push((cod) => ref.current(cod));
  }, [activo, push]);
}

let _ac = null;
function beep(ok = true, activo = true) {
  if (!activo) return;
  try {
    if (!audio()) return;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = "square";
    o.frequency.value = ok ? 1760 : 240;
    g.gain.setValueAtTime(0.05, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, _ac.currentTime + (ok ? 0.08 : 0.3));
    o.start(); o.stop(_ac.currentTime + (ok ? 0.09 : 0.32));
  } catch (e) { /* sin audio disponible */ }
}

/* Aviso sonoro de cobro: dos notas ascendentes, distintas del beep del
   lector para que no se confundan a tres metros del mostrador.              */
/* Chrome suspende el AudioContext cuando la pestaña pasa a segundo plano o
   tras un rato sin uso. Si se programan notas sobre un contexto suspendido no
   suena nada, así que hay que despertarlo en cada aviso.                     */
function audio() {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === "suspended") _ac.resume();
    return _ac;
  } catch (e) { return null; }
}

function campanita(activo = true) {
  if (!activo) return;
  const ac = audio();
  if (!ac) return;
  try {
    [880, 1318.5].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ac.currentTime + 0.05 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      o.start(t0); o.stop(t0 + 0.45);
    });
  } catch (e) { /* sin audio disponible */ }
}

/* Ojo con cancel(): si entran dos cobros seguidos, el segundo cortaba al
   primero y Chrome puede quedar en pausa y no volver a hablar nunca más.
   Sin cancel, los avisos se encolan y se escuchan todos.                     */
function hablar(texto, activo = true) {
  if (!activo) return;
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.resume();
    let dicho = false;
    const decir = () => {
      if (dicho) return;
      dicho = true;
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-AR";
      u.rate = 0.98;
      const voces = s.getVoices();
      const voz = voces.find((v) => /es[-_]AR/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang));
      if (voz) u.voice = voz;
      s.speak(u);
    };
    // Las voces cargan de forma asíncrona la primera vez.
    if (!s.getVoices().length) {
      s.addEventListener("voiceschanged", decir, { once: true });
      setTimeout(decir, 300);
    } else decir();
  } catch (e) { /* sin voz disponible */ }
}

/* Imprimir la comandera.
   Antes se ocultaba la app con CSS y se imprimía la página. Eso fallaba por
   dos motivos: el papel salía en A4 con márgenes enormes, y el ticket estaba
   posicionado como "fixed", lo que hace que el navegador lo repita en TODAS
   las hojas. Por eso salían dos.
   Ahora el ticket se imprime en un documento propio, dentro de un iframe
   invisible, con el tamaño de papel declarado. Sale una sola hoja del ancho
   del rollo y del alto exacto del contenido. */
function escaparHTML(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function imprimirComandera(lineas, ancho, qrSemilla, toast) {
  try {
    const mm = ancho === 58 ? 58 : 80;
    const cuerpo = escaparHTML(lineas.join("\n"));
    const qr = qrSemilla
      ? `<div class="qr">${svgQR(qrSemilla, mm === 58 ? 18 : 22)}</div>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: ${mm}mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { width: ${mm}mm; }
      pre { margin: 0; padding: ${mm === 58 ? "2mm 1.5mm" : "3mm 2.5mm"}; white-space: pre;
            font-family: "Courier New", ui-monospace, monospace;
            font-size: ${mm === 58 ? "8.6pt" : "9.2pt"}; line-height: 1.3; color: #000; }
      .qr { text-align: center; padding-bottom: 4mm; }
      .qr svg { display: inline-block; }
    </style></head><body><pre>${cuerpo}</pre>${qr}</body></html>`;

    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    marco.onload = () => {
      try {
        marco.contentWindow.focus();
        marco.contentWindow.print();
      } catch (e) {
        toast && toast("El navegador bloqueó la impresión.", "mal");
      }
      setTimeout(() => { try { marco.remove(); } catch (e) {} }, 2000);
    };
    document.body.appendChild(marco);
    marco.srcdoc = html;
  } catch (e) {
    toast && toast(`No se pudo imprimir: ${e.message}`, "mal");
  }
}

/* --- Comandera térmica -------------------------------------------------
   58 mm = 32 caracteres, 80 mm = 48. Todo se compone como texto de ancho
   fijo, igual que lo que recibe la impresora.                              */
function armarLineas(W, bloques) {
  const out = [];
  const sep = (c) => c.repeat(W);
  const centro = (t) => {
    const s = t.slice(0, W);
    return " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
  };
  const lr = (a, b) => {
    const der = String(b);
    const izq = String(a).slice(0, Math.max(0, W - der.length - 1));
    return izq + " ".repeat(Math.max(1, W - izq.length - der.length)) + der;
  };
  const wrap = (t) => {
    const palabras = String(t).split(" ");
    const ls = []; let cur = "";
    for (const p of palabras) {
      if ((cur + " " + p).trim().length > W) { if (cur) ls.push(cur); cur = p.slice(0, W); }
      else cur = (cur ? cur + " " : "") + p;
    }
    if (cur) ls.push(cur);
    return ls;
  };
  for (const b of bloques) {
    if (b.t === "sep") out.push(sep(b.c || "-"));
    else if (b.t === "c") out.push(centro(b.v));
    else if (b.t === "lr") out.push(lr(b.a, b.b));
    else if (b.t === "w") out.push(...wrap(b.v));
    else if (b.t === "b") out.push("");
    else out.push(String(b.v).slice(0, W));
  }
  return out;
}

function celdasQR(semilla) {
  const n = 21;
  let h = 0;
  for (let i = 0; i < String(semilla).length; i++) h = (h * 31 + String(semilla).charCodeAt(i)) >>> 0;
  const rnd = mulberry32(h);
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const esquina = (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8);
    const anillo = esquina && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) ||
      ((x > n - 7 && x < n - 2) && y > 1 && y < 5) || (x > 1 && x < 5 && y > n - 7 && y < n - 2));
    if (esquina ? anillo : rnd() > 0.55) out.push([x, y]);
  }
  return { n, celdas: out };
}

function PseudoQR({ semilla, size = 84 }) {
  const { n, celdas } = celdasQR(semilla);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" fill="currentColor">
      {celdas.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
    </svg>
  );
}

/* El mismo QR, como texto, para el documento de impresión. */
function svgQR(semilla, mm) {
  const { n, celdas } = celdasQR(semilla);
  const rects = celdas.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join("");
  return `<svg viewBox="0 0 ${n} ${n}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges" fill="#000" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

function Comandera({ lineas, ancho, qr, className = "" }) {
  const mm = ancho === 58 ? 58 : 80;
  return (
    <div className={`bg-white text-black mx-auto ${className}`} style={{ width: `${mm}mm`, maxWidth: "100%" }}>
      <pre className="f-m whitespace-pre leading-[1.35] m-0" style={{ fontSize: ancho === 58 ? "9.5px" : "10.5px" }}>
        {lineas.join("\n")}
      </pre>
      {qr && <div className="flex justify-center py-1"><PseudoQR semilla={qr} size={ancho === 58 ? 70 : 88} /></div>}
    </div>
  );
}

function ticketVenta(t, ajustes, W) {
  const b = [
    { t: "c", v: ajustes.negocio.toUpperCase() },
    { t: "c", v: "Av. San Martin 1204 - Caseros" },
    { t: "c", v: `CUIT ${ajustes.cuit}` },
    { t: "c", v: ajustes.arca ? "IVA RESPONSABLE INSCRIPTO" : "NO VALIDO COMO FACTURA" },
    { t: "sep", c: "=" },
    { t: "c", v: ajustes.arca ? "FACTURA B" : "TICKET DE VENTA" },
    { t: "lr", a: `Nro ${t.nro}`, b: `${fdatel(HOY)} ${t.hora}` },
    { t: "sep" },
  ];
  for (const l of t.items) {
    b.push({ t: "w", v: l.nombre.toUpperCase() });
    const cant = l.unidad === "kg" ? `${l.qty.toFixed(3)} kg x ${money(l.precio)}` : `${l.qty} x ${money(l.precio)}`;
    b.push({ t: "lr", a: "  " + cant, b: money(l.precio * l.qty) });
    if (l.lista === 2) b.push({ t: "v", v: "  PRECIO POR CANTIDAD (LISTA 2)" });
  }
  b.push({ t: "sep" });
  b.push({ t: "lr", a: "SUBTOTAL", b: money(t.sub) });
  if (t.desc > 0) b.push({ t: "lr", a: "DESCUENTO", b: "-" + money(t.desc) });
  b.push({ t: "sep", c: "=" });
  b.push({ t: "lr", a: "TOTAL", b: money(t.total) });
  b.push({ t: "sep", c: "=" });
  const pagos = t.pagos && t.pagos.length ? t.pagos : [{ medio: t.medio, monto: t.total }];
  pagos.forEach((p) => b.push({ t: "lr", a: MEDIOS.find((m) => m.k === p.medio).n.toUpperCase(), b: money(p.monto) }));
  if (t.recibe) {
    b.push({ t: "lr", a: "RECIBIDO EN EFECTIVO", b: money(t.recibe) });
    b.push({ t: "lr", a: "VUELTO", b: money(t.vuelto != null ? t.vuelto : t.recibe - t.total) });
  }
  if (ajustes.arca) {
    b.push({ t: "b" });
    b.push({ t: "lr", a: `IVA 21%`, b: money(t.total - t.total / 1.21) });
    b.push({ t: "c", v: `CAE ${t.cae}` });
    b.push({ t: "c", v: `Vto CAE ${fdatel(addDays(HOY, 10))}` });
  }
  b.push({ t: "b" });
  b.push({ t: "c", v: `${t.items.length} items` });
  b.push({ t: "c", v: "GRACIAS POR SU COMPRA" });
  b.push({ t: "b" });
  return armarLineas(W, b);
}

function comandaPicking(ped, W) {
  const b = [
    { t: "c", v: "PREPARACION DE PEDIDO" },
    { t: "sep", c: "=" },
    { t: "lr", a: ped.nro, b: `${fdatel(HOY)} ${ped.hora}` },
    { t: "w", v: `CLIENTE: ${ped.cliente.toUpperCase()}` },
    { t: "w", v: `${ped.entrega.toUpperCase()}: ${ped.dir.toUpperCase()}` },
    { t: "v", v: `TEL ${ped.tel}` },
    { t: "sep" },
  ];
  for (const l of ped.items) {
    b.push({ t: "w", v: l.nombre.toUpperCase() });
    const est = l.faltante > 0 ? `FALTAN ${l.faltante}` : "OK";
    b.push({ t: "lr", a: `  [ ] ${l.unidad === "kg" ? l.preparado.toFixed(2) + " kg" : l.preparado + " u"} de ${l.unidad === "kg" ? l.pedido.toFixed(2) : l.pedido}`, b: est });
  }
  b.push({ t: "sep" });
  const tot = ped.items.reduce((s, l) => s + l.precio * l.preparado, 0);
  b.push({ t: "lr", a: "TOTAL PREPARADO", b: money(tot) });
  const falt = ped.items.filter((l) => l.faltante > 0);
  if (falt.length) {
    b.push({ t: "sep" });
    b.push({ t: "v", v: "NO SE PUDO PREPARAR:" });
    falt.forEach((l) => b.push({ t: "w", v: `- ${l.nombre.toUpperCase()} (${l.faltante})` }));
  }
  if (ped.nota) { b.push({ t: "sep" }); b.push({ t: "w", v: `NOTA: ${ped.nota.toUpperCase()}` }); }
  b.push({ t: "b" });
  b.push({ t: "c", v: `Preparo: ${fdatel(HOY)}  Control: ______` });
  b.push({ t: "b" });
  return armarLineas(W, b);
}

function Vacio({ children }) {
  return <div className="text-center py-14 text-stone-400 text-sm">{children}</div>;
}

/* ============================================================
   5. INICIO
   ============================================================ */

function Inicio({ k, ins, ventasHoy, ticketsHoy, ir, negocio, aCobrar }) {
  const serie = k.diario.slice(-30).map((d) => ({ ...d, ganancia: d.ventas - d.costo }));
  const ganHoy = ventasHoy * k.margen30;
  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-orange-500/15" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">
            {negocio} · {fdatel(HOY)}
          </div>
          <h1 className="f-d text-2xl md:text-4xl leading-tight mt-3 max-w-3xl">
            Hoy llevás <span className="text-orange-400 tabular-nums">{money(ventasHoy)}</span> en{" "}
            <span className="tabular-nums">{ticketsHoy}</span> tickets.
            <br className="hidden md:block" /> Te queda aproximadamente{" "}
            <span className="text-emerald-400 tabular-nums">{money(ganHoy)}</span> de ganancia bruta.
          </h1>
          <p className="text-stone-300 text-sm mt-3 max-w-2xl">
            Tenés {ins.filter((i) => i.sev === "alta").length} cosas urgentes y {ins.filter((i) => i.sev === "media").length} para
            mirar esta semana. Están abajo, en orden.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Boton onClick={aCobrar} variant="primary"><Barcode size={16} /> Volver a cobrar</Boton>
            <Boton onClick={() => ir("compras")} variant="ghost" className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20"><Truck size={16} /> Pedido sugerido</Boton>
            <Boton onClick={() => ir("caja")} variant="ghost" className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20"><Wallet size={16} /> Caja</Boton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ventas 30 días" valor={money(k.v30)} delta={k.v30 / k.v30p - 1} sub="vs. 30 previos" />
        <Kpi label="Margen bruto" valor={pct(k.margen30)} delta={k.margen30 - k.margen30p} tono={k.margen30 >= k.margen30p ? "bien" : "mal"} sub="vs. mes anterior" />
        <Kpi label="Ticket promedio" valor={money(k.ticketProm)} delta={k.ticketProm / k.ticketPromP - 1} />
        <Kpi label="Valor del stock" valor={moneyk(k.valorStock)} sub={`${nf.format(k.dormidos.length)} sin rotar`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="f-d text-lg">Lo que tenés que saber</h2>
            <button onClick={() => ir("asistente")} className="text-xs font-semibold text-orange-600 hover:underline">Ver todo el análisis</button>
          </div>
          {ins.slice(0, 4).map((i) => {
            const s = SEV[i.sev]; const Ico = i.icon;
            return (
              <Card key={i.id} className="p-4 hover:border-stone-300 transition-colors">
                <div className="flex gap-3">
                  <div className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-stone-100 flex items-center justify-center"><Ico size={17} className="text-stone-600" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-stone-900 leading-snug">{i.titulo}</h3>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${s.pill}`}>{s.label}</span>
                    </div>
                    <p className="text-sm text-stone-600 mt-1.5">{i.que}</p>
                    <p className="text-sm text-stone-500 mt-1">{i.porque}</p>
                    <div className="flex items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-stone-100">
                      <p className="text-sm font-medium text-stone-800">{i.hacer}</p>
                      <button onClick={() => ir(i.tab)} className="shrink-0 text-xs font-semibold text-orange-600 hover:underline inline-flex items-center gap-1">
                        {i.accion} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Ventas y ganancia · 30 días</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={serie} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} interval={6} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={54} />
                <Tooltip formatter={(v, n) => [money(v), n === "ventas" ? "Ventas" : "Ganancia"]} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
                <Area type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={2} fill="url(#gV)" />
                <Area type="monotone" dataKey="ganancia" stroke="#16a34a" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Se acaban primero</div>
            <ul className="space-y-2.5">
              {k.criticos.slice(0, 6).map(({ p, cobertura }) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cobertura < 2 ? "bg-red-500" : "bg-amber-500"}`} />
                  <span className="truncate flex-1 text-stone-700">{p.nombre}</span>
                  <span className="f-m text-xs text-stone-400 shrink-0">{cobertura < 1 ? "hoy" : `${Math.round(cobertura)} d`}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => ir("compras")} className="mt-3 text-xs font-semibold text-orange-600 hover:underline">Armar pedido</button>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   6. VENDER (POS)
   ============================================================ */

function AltaRapida({ abierto, inicial, productos, ajustes, onCrear, onClose }) {
  const [camara, setCamara] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [precio2, setPrecio2] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre((inicial && inicial.nombre) || "");
    setPrecio(""); setCosto(""); setPrecio2("");
    setCodigo((inicial && inicial.barcode) || "");
    setTimeout(() => ref.current && ref.current.focus(), 30);
  }, [abierto, inicial]);

  if (!abierto) return null;
  const margen = Number(precio) && Number(costo) ? (Number(precio) - Number(costo)) / Number(precio) : null;

  const crear = (agregar) => {
    if (!nombre.trim()) return;
    onCrear({ nombre: nombre.trim(), precio: Number(precio) || 0, costo: Number(costo) || 0, precio2: Number(precio2) || null, barcode: codigo }, agregar);
  };

  const teclas = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key === "Enter") { e.preventDefault(); crear(!!Number(precio)); }
  };

  if (camara) {
    return <EscanerCamara abierto onCerrar={() => setCamara(false)} titulo="Leé el código del producto"
      onLeer={(cod) => { setCodigo(cod); setCamara(false); }} />;
  }

  return (
    <Overlay ancho="max-w-md">
      <div className="bg-orange-500 text-white px-5 py-3.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-orange-100">
          <ScanLine size={13} /> Producto nuevo
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="f-d text-xl flex-1">{codigo ? `Código ${codigo}` : "Sin código de barras"}</div>
          {!codigo && (
            <button onClick={() => setCamara(true)} className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 active:bg-white/30 rounded-xl px-2.5 py-1.5">
              <Cam size={14} /> Leer
            </button>
          )}
        </div>
      </div>
      <div className="p-5" onKeyDown={teclas}>
        <p className="text-sm text-stone-600">
          Cargá lo mínimo para poder cobrar. El rubro, el proveedor y el stock los completás después, cuando no haya nadie esperando.
        </p>
        <label className="block mt-4">
          <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Nombre</span>
          <input ref={ref} value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Alfajor Jorgito triple" className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 text-base mt-1 outline-none focus:border-orange-400" />
        </label>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Precio de venta</span>
            <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
              className="f-m w-full text-right border-2 border-stone-200 rounded-xl px-3 py-2.5 text-lg mt-1 outline-none focus:border-orange-400" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Costo (opcional)</span>
            <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
              className="f-m w-full text-right border border-stone-200 rounded-xl px-3 py-2.5 text-lg mt-1 outline-none focus:border-orange-400" />
          </label>
        </div>
        {margen != null && <p className="text-xs text-stone-500 mt-2 text-right">Margen {pct(margen)}</p>}

        {ajustes.lista2 && (
          <div className="border border-stone-200 rounded-xl p-3 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Precio por cantidad (lista 2)</div>
                <div className="text-[11px] text-stone-500">Se cobra a partir de {ajustes.umbral2} unidades. Si lo dejás vacío, este producto no tiene descuento por cantidad.</div>
              </div>
              <input value={precio2} onChange={(e) => setPrecio2(e.target.value.replace(/\D/g, ""))}
                placeholder="opcional" className="f-m w-28 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400 shrink-0" />
            </div>
            {Number(precio) > 0 && !Number(precio2) && (
              <button onClick={() => setPrecio2(String(Math.round((Number(precio) * (1 - ajustes.desc2 / 100)) / 10) * 10))}
                className="text-xs font-semibold text-orange-600 hover:underline mt-2">
                Poner {money(Math.round((Number(precio) * (1 - ajustes.desc2 / 100)) / 10) * 10)} ({ajustes.desc2}% menos)
              </button>
            )}
          </div>
        )}

        <Boton size="lg" className="w-full mt-4" disabled={!nombre.trim() || !Number(precio)} onClick={() => crear(true)}>
          Crear y agregar al ticket <Tecla>Enter</Tecla>
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" disabled={!nombre.trim()} onClick={() => crear(false)}>
          Crear sin precio y seguir
        </Boton>
        <p className="text-[11px] text-stone-400 mt-3 text-center">
          Va a quedar marcado como ficha incompleta en el Panel. <Tecla>Esc</Tecla> cancela.
        </p>
      </div>
    </Overlay>
  );
}

/* --- Lector por cámara -------------------------------------------------
   Para el que no tiene pistola. Usa BarcodeDetector, que viene en Chrome de
   Android y no pesa nada. Safari todavía no lo trae, así que ahí se carga
   ZXing bajo demanda: solo lo descarga quien lo necesita.
   Sigue leyendo sin cerrarse, para poder cargar varios productos seguidos.  */
function EscanerCamara({ abierto, onLeer, onCerrar, titulo = "Escaneá el código" }) {
  const video = useRef(null);
  const [estado, setEstado] = useState("iniciando");   // iniciando | leyendo | error
  const [detalle, setDetalle] = useState("");
  const [ultimo, setUltimo] = useState(null);
  const [linterna, setLinterna] = useState(false);
  const pista = useRef(null);
  const ultimoCodigo = useRef({ cod: "", t: 0 });

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    let stream = null, timer = null, controles = null;

    const manejar = (cod) => {
      const limpio = String(cod || "").trim();
      if (!limpio) return;
      const ahora = Date.now();
      // Un código se lee muchas veces por segundo: se ignora el repetido.
      if (ultimoCodigo.current.cod === limpio && ahora - ultimoCodigo.current.t < 1800) return;
      ultimoCodigo.current = { cod: limpio, t: ahora };
      setUltimo(limpio);
      try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
      onLeer(limpio);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        pista.current = stream.getVideoTracks()[0];
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }

        if ("BarcodeDetector" in window) {
          const det = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
          });
          setEstado("leyendo");
          timer = setInterval(async () => {
            if (!vivo || !video.current || video.current.readyState < 2) return;
            try {
              const r = await det.detect(video.current);
              if (r && r.length) manejar(r[0].rawValue);
            } catch (e) { /* fotograma sin código */ }
          }, 220);
        } else {
          // Safari y navegadores viejos: se trae el lector solo si hace falta.
          setDetalle("Preparando el lector…");
          const mod = await import(/* @vite-ignore */ "https://esm.sh/@zxing/browser@0.1.5");
          if (!vivo) return;
          const lector = new mod.BrowserMultiFormatReader();
          controles = await lector.decodeFromVideoElement(video.current, (res) => {
            if (res) manejar(res.getText());
          });
          setDetalle(""); setEstado("leyendo");
        }
      } catch (e) {
        if (!vivo) return;
        setEstado("error");
        setDetalle(
          e && e.name === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Habilitalo desde el candado de la barra de direcciones."
            : e && e.name === "NotFoundError"
              ? "Este dispositivo no tiene cámara disponible."
              : `No se pudo abrir la cámara: ${e && e.message ? e.message : "error desconocido"}`
        );
      }
    })();

    return () => {
      vivo = false;
      if (timer) clearInterval(timer);
      try { controles && controles.stop && controles.stop(); } catch (e) {}
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [abierto]);

  const cambiarLinterna = async () => {
    try {
      const t = pista.current;
      if (!t) return;
      const caps = t.getCapabilities ? t.getCapabilities() : {};
      if (!caps.torch) return;
      await t.applyConstraints({ advanced: [{ torch: !linterna }] });
      setLinterna((v) => !v);
    } catch (e) { /* sin linterna */ }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 text-white bg-black/80">
        <Cam size={18} className="text-orange-400 shrink-0" />
        <span className="font-semibold text-sm flex-1">{titulo}</span>
        <button onClick={cambiarLinterna} className="p-2 text-white/70 active:text-white" title="Linterna">
          {linterna ? <Zap size={18} /> : <ZapOff size={18} />}
        </button>
        <button onClick={onCerrar} className="p-2 text-white/70 active:text-white"><X size={20} /></button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
        {estado === "leyendo" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[78%] max-w-sm aspect-[5/3] border-2 border-orange-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {estado !== "leyendo" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="text-white">
              {estado === "error" ? <CameraOff size={30} className="mx-auto text-red-400" /> : <Loader2 size={30} className="mx-auto animate-spin text-orange-400" />}
              <p className="text-sm mt-3 max-w-xs">{detalle || "Encendiendo la cámara…"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-black/85 text-center seguro-abajo">
        {ultimo
          ? <p className="f-m text-sm text-emerald-400">Leído: {ultimo}</p>
          : <p className="text-xs text-white/60">Acercá el código de barras al recuadro</p>}
        <p className="text-[11px] text-white/40 mt-1">Podés seguir escaneando: la ventana no se cierra sola</p>
      </div>
    </div>
  );
}

function Overlay({ children, ancho = "max-w-xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-[3px]" />
      <div className={`relative w-full ${ancho} bg-white rounded-t-3xl md:rounded-2xl border border-stone-200 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto seguro-abajo`}>{children}</div>
    </div>
  );
}

function Tecla({ children }) {
  return <kbd className="f-m text-[10px] border border-stone-300 rounded px-1.5 py-0.5 bg-white text-stone-600">{children}</kbd>;
}

const ATAJOS = [
  ["F2", "Cobrar"], ["F4", "Descuento"], ["F7", "Quitar último"], ["F8", "Anular venta"],
  ["F9", "Salón"], ["F10", "Panel"], ["F1", "Ayuda"],
];

function POS({ productos, setProductos, cobrar, ajustes, toast, ir, pendiente, setPendiente, aPanel }) {
  const [paso, setPaso] = useState("carga");     // carga → pago → monto → fin
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [cart, setCart] = useState([]);
  const [desc, setDesc] = useState(0);
  const [medioSel, setMedioSel] = useState(0);
  const [recibe, setRecibe] = useState("");
  const [pagos, setPagos] = useState([]);
  const [montoMix, setMontoMix] = useState("");
  const [ticket, setTicket] = useState(null);
  const [verTicket, setVerTicket] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [alta, setAlta] = useState(null);
  const [ultimo, setUltimo] = useState(null);
  const [camara, setCamara] = useState(false);
  const inp = useRef(null);
  const inpMonto = useRef(null);
  const inpMix = useRef(null);

  const enCarga = paso === "carga";
  useEffect(() => { if (enCarga && inp.current) inp.current.focus(); }, [enCarga, cart.length, ticket]);
  useEffect(() => { if (paso === "monto" && inpMonto.current) inpMonto.current.focus(); }, [paso]);
  useEffect(() => { if (paso === "mixto" && inpMix.current) inpMix.current.focus(); }, [paso, pagos.length]);

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const res = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = norm(q.trim());
    const ex = productos.find((p) => p.barcode === q.trim());
    if (ex) return [ex];
    return productos.filter((p) => norm(p.nombre).includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 7);
  }, [q, productos]);

  const add = (p, qty) => {
    if (!p.precio) { beep(false, ajustes.sonido); return toast(`${p.nombre} no tiene precio de venta cargado.`, "mal"); }
    const paso_ = p.unidad === "kg" ? 0.25 : 1;
    const cantidad = qty != null ? qty : paso_;
    setCart((c) => {
      const i = c.findIndex((l) => l.pid === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: +(n[i].qty + cantidad).toFixed(3) }; return n; }
      return [...c, { pid: p.id, qty: cantidad, precio: p.precio, precio2: p.precio2, costo: p.costo, nombre: p.nombre, unidad: p.unidad }];
    });
    setUltimo({ pid: p.id, nombre: p.nombre, unidad: p.unidad });
    setQ(""); setSel(0);
  };

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (p) { add(p); beep(true, ajustes.sonido); }
    else { beep(false, ajustes.sonido); setAlta({ barcode: cod }); }
  }, enCarga && !alta && !camara);

  useEffect(() => {
    if (!pendiente) return;
    const p = productos.find((x) => x.id === pendiente.id);
    if (p) add(p);
    setPendiente(null);
  }, [pendiente]);

  const crearAlVuelo = (datos, agregar) => {
    let creado = null;
    setProductos((ps) => {
      creado = productoNuevo(datos, ps);
      return [...ps, creado];
    });
    setAlta(null);
    setQ(""); setSel(0);
    setTimeout(() => {
      if (agregar && creado && creado.precio) {
        setCart((c) => [...c, { pid: creado.id, qty: creado.unidad === "kg" ? 0.25 : 1, precio: creado.precio, precio2: creado.precio2, costo: creado.costo, nombre: creado.nombre, unidad: creado.unidad }]);
        setUltimo({ pid: creado.id, nombre: creado.nombre, unidad: creado.unidad });
        beep(true, ajustes.sonido);
        toast(`${datos.nombre} creado y agregado. Completá la ficha después.`);
      } else {
        toast(`${datos.nombre} creado sin precio: no se puede cobrar hasta completarlo.`, "mal");
      }
    }, 0);
  };

  const setQty = (pid, qty) => setCart((c) => c.map((l) => (l.pid === pid ? { ...l, qty: Math.max(0, +qty.toFixed(3)) } : l)).filter((l) => l.qty > 0));
  const quitar = (pid) => setCart((c) => c.filter((l) => l.pid !== pid));

  const lineas = cart.map((l) => {
    const { precio, lista } = precioAplicado(l.precio, l.precio2, l.qty, ajustes);
    return { ...l, unit: precio, lista, importe: precio * l.qty, ahorro: (l.precio - precio) * l.qty };
  });
  const ahorroTotal = lineas.reduce((s, l) => s + l.ahorro, 0);
  const sub = lineas.reduce((s, l) => s + l.importe, 0);
  const descMonto = sub * (desc / 100);
  const total = sub - descMonto;
  const costoTot = lineas.reduce((s, l) => s + l.costo * l.qty, 0);
  const ganancia = total - costoTot;
  const medio = MEDIOS[medioSel];
  const vuelto = recibe ? Number(recibe) - total : 0;

  const irAPago = () => { if (!cart.length) return; setMedioSel(0); setRecibe(""); setPagos([]); setMontoMix(""); setPaso("pago"); };

  // ---- Pago combinado ----
  const cubierto = pagos.reduce((s2, p) => s2 + p.monto, 0);
  const falta = Math.max(0, total - cubierto);
  const vueltoMix = pagos.reduce((s2, p) => s2 + (p.exceso || 0), 0);
  const efectivoEntregado = pagos.filter((p) => p.medio === "efectivo").reduce((s2, p) => s2 + p.monto + (p.exceso || 0), 0);

  const agregarPago = () => {
    const m = MEDIOS[medioSel];
    const entrada = Number(montoMix) || falta;
    if (entrada <= 0 || falta <= 0) return;
    const aplicado = Math.min(entrada, falta);
    const exceso = m.k === "efectivo" ? Math.max(0, entrada - falta) : 0;
    if (m.k !== "efectivo" && entrada > falta) return toast("Con tarjeta o transferencia no puede sobrar: cobrá el importe exacto.", "mal");
    setPagos((ps) => [...ps, { medio: m.k, monto: aplicado, exceso }]);
    setMontoMix("");
    beep(true, ajustes.sonido);
  };

  const finalizarMixto = () => {
    if (cubierto < total) return toast(`Todavía faltan ${money(falta)}.`, "mal");
    finalizar(pagos[0].medio, efectivoEntregado || null, pagos.map((p) => ({ medio: p.medio, monto: p.monto })), vueltoMix);
  };

  const finalizar = (k, recibido, listaPagos, vueltoDado) => {
    const items = lineas.map((l) => ({ pid: l.pid, qty: l.qty, precio: l.unit, costo: l.costo, nombre: l.nombre, unidad: l.unidad, lista: l.lista }));
    const t = cobrar({ items, sub, desc: descMonto, total, medio: k, ganancia, recibe: recibido || null, pagos: listaPagos });
    if (vueltoDado != null) t.vuelto = vueltoDado;
    setProductos((ps) => ps.map((p) => {
      const l = lineas.find((x) => x.pid === p.id);
      return l ? { ...p, stock: +(p.stock - l.qty).toFixed(3), ultimaVenta: HOY, u30: p.u30 + l.qty } : p;
    }));
    setTicket(t);
    setPaso("fin");
  };

  const nuevaVenta = () => {
    setCart([]); setDesc(0); setRecibe(""); setMedioSel(0); setPagos([]); setMontoMix(""); setUltimo(null);
    setTicket(null); setVerTicket(false); setPaso("carga");
  };

  // ---- Teclado ----
  useEffect(() => {
    const h = (e) => {
      if (alta || camara) return;
      if (e.key === "F1") { e.preventDefault(); return setAyuda((a) => !a); }
      if (ayuda) { if (e.key === "Escape") { e.preventDefault(); setAyuda(false); } return; }

      if (paso === "carga") {
        if (e.key === "F2") { e.preventDefault(); return irAPago(); }
        if (e.key === "F4") { e.preventDefault(); return setDesc((d) => [0, 5, 10, 15][([0, 5, 10, 15].indexOf(d) + 1) % 4]); }
        if (e.key === "F7") { e.preventDefault(); return setCart((c) => c.slice(0, -1)); }
        if (e.key === "F8") { e.preventDefault(); if (cart.length) { setCart([]); setDesc(0); toast("Venta anulada."); } return; }
        if (e.key === "F9") { e.preventDefault(); return ir("pedidos"); }
        if (e.key === "F10") { e.preventDefault(); return aPanel(); }
        return;
      }

      if (paso === "pago") {
        e.preventDefault();
        if (e.key === "Escape") return setPaso("carga");
        if (e.key === "ArrowDown") return setMedioSel((i) => (i + 1) % MEDIOS.length);
        if (e.key === "ArrowUp") return setMedioSel((i) => (i - 1 + MEDIOS.length) % MEDIOS.length);
        if (e.key === "6" || e.key.toLowerCase() === "c") { setMedioSel(0); setMontoMix(""); return setPaso("mixto"); }
        if (/^[1-5]$/.test(e.key)) {
          const i = Number(e.key) - 1;
          setMedioSel(i);
          if (MEDIOS[i].k === "efectivo") return setPaso("monto");
          return finalizar(MEDIOS[i].k, null);
        }
        if (e.key === "Enter") {
          if (MEDIOS[medioSel].k === "efectivo") return setPaso("monto");
          return finalizar(MEDIOS[medioSel].k, null);
        }
        return;
      }

      if (paso === "monto") {
        if (e.key === "Escape") { e.preventDefault(); return setPaso("pago"); }
        if (e.key === "Enter") {
          e.preventDefault();
          if (recibe && Number(recibe) < total) return toast("El importe recibido es menor al total.", "mal");
          return finalizar("efectivo", recibe ? Number(recibe) : null);
        }
        return;
      }

      if (paso === "mixto") {
        if (e.key === "Escape") { e.preventDefault(); setPagos([]); return setPaso("pago"); }
        if (e.key === "ArrowDown") { e.preventDefault(); return setMedioSel((i) => (i + 1) % MEDIOS.length); }
        if (e.key === "ArrowUp") { e.preventDefault(); return setMedioSel((i) => (i - 1 + MEDIOS.length) % MEDIOS.length); }
        if (e.key === "Delete") { e.preventDefault(); return setPagos((ps) => ps.slice(0, -1)); }
        if (e.key === "Enter") {
          e.preventDefault();
          if (falta <= 0) return finalizarMixto();
          return agregarPago();
        }
        return;
      }

      if (paso === "fin") {
        e.preventDefault();
        if (e.key === "Enter" || e.key === "Escape") return nuevaVenta();
        const k = e.key.toLowerCase();
        if (k === "t") return setVerTicket(true);
        if (k === "i") return imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ajustes.arca ? ticket.cae : null, toast);
        if (k === "w") return toast("Comprobante enviado por WhatsApp.");
        if (k === "e") return toast("Comprobante enviado por email.");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paso, cart, medioSel, recibe, total, ayuda, pagos, montoMix, falta, alta, camara]);

  const activo = ultimo && cart.find((l) => l.pid === ultimo.pid) ? ultimo : null;
  const cantidadPendiente = activo && esCantidad(q) && q.trim() !== "";
  const puedeCrear = q.trim().length >= 3 && res.length === 0 && !cantidadPendiente;

  const aplicarCantidad = () => {
    const n = aNumero(q);
    if (!activo || !(n > 0)) return false;
    setQty(activo.pid, n);
    setQ(""); setSel(0);
    beep(true, ajustes.sonido);
    return true;
  };

  const onKeyInput = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((x) => Math.min(x + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!q.trim()) return irAPago();
      if (cantidadPendiente && aplicarCantidad()) return;
      const exacto = productos.find((p) => p.barcode === q.trim());
      if (exacto) { beep(true, ajustes.sonido); return add(exacto); }
      if (res[sel]) { beep(true, ajustes.sonido); return add(res[sel]); }
      if (/^\d{6,}$/.test(q.trim())) return setAlta({ barcode: q.trim() });
      if (puedeCrear) return setAlta({ nombre: q.trim() });
      beep(false, ajustes.sonido); toast("No encontramos ese producto.", "mal");
    } else if (e.key === "*" || e.key === "x") {
      if (cantidadPendiente) { e.preventDefault(); aplicarCantidad(); }
    } else if (e.key === "Escape") setQ("");
  };

  const rapidos = [1000, 2000, 5000, 10000, 20000, 50000];
  const W = ajustes.ancho === 58 ? 32 : 48;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
      <div className="space-y-3">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-stone-900">
            <Barcode size={20} className="text-orange-400 shrink-0" />
            <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKeyInput}
              placeholder="Escaneá o escribí el nombre · Enter con el campo vacío cobra"
              className="f-m flex-1 bg-transparent text-white placeholder-stone-500 text-base outline-none py-1" autoFocus />
            <button onClick={() => setCamara(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 active:bg-white/20 border border-white/20 rounded-xl px-2.5 py-2"
              title="Leer con la cámara">
              <Cam size={16} className="text-orange-400" /> <span className="hidden sm:inline">Cámara</span>
            </button>
            <Tecla>Enter</Tecla>
          </div>
          {cantidadPendiente && (
            <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-sm">
              <span className="f-d text-emerald-800 text-lg">{aNumero(q)}</span>
              <span className="text-emerald-900 truncate flex-1">
                {activo.unidad === "kg" ? "kg de" : "unidades de"} <strong>{activo.nombre}</strong>
              </span>
              <Tecla>Enter</Tecla>
            </div>
          )}
          {puedeCrear && (
            <button onClick={() => setAlta(/^\d{6,}$/.test(q.trim()) ? { barcode: q.trim() } : { nombre: q.trim() })}
              className="w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 flex items-center gap-2 border-b border-orange-200">
              <Plus size={15} className="text-orange-600 shrink-0" />
              <span className="text-sm text-stone-800 truncate">Crear <strong>{q.trim()}</strong> y seguir cobrando</span>
              <Tecla>Enter</Tecla>
            </button>
          )}
          {res.length > 0 && (
            <ul className="divide-y divide-stone-100 max-h-72 overflow-auto">
              {res.map((p, i) => (
                <li key={p.id}>
                  <button onMouseEnter={() => setSel(i)} onClick={() => add(p)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${i === sel ? "bg-orange-50" : "hover:bg-stone-50"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 truncate">{p.nombre}</div>
                      <div className="f-m text-[11px] text-stone-400">{p.barcode || "sin código"} · stock {p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</div>
                    </div>
                    <div className="f-m text-sm font-semibold shrink-0">{p.precio ? money(p.precio) : <span className="text-amber-600 text-xs">sin precio</span>}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          {cart.length === 0 ? <Vacio>El ticket está vacío. Escaneá el primer producto.</Vacio> : (
          <>
            {/* En celular no entra una tabla de cinco columnas: va como lista */}
            <ul className="md:hidden divide-y divide-stone-100">
              {lineas.map((l, i) => (
                <li key={l.pid} className={`px-3 py-2.5 ${i === lineas.length - 1 ? "bg-orange-50/40" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 leading-snug">{l.nombre}</div>
                      <div className="f-m text-[11px] text-stone-400 mt-0.5">
                        {l.lista === 2 && <span className="line-through mr-1">{money(l.precio)}</span>}
                        <span className={l.lista === 2 ? "text-emerald-700 font-semibold" : ""}>{money(l.unit)}</span> c/u
                        {l.lista === 2 && <span className="ml-1 text-emerald-700 font-bold">L2</span>}
                      </div>
                    </div>
                    <div className="f-m text-base font-semibold shrink-0">{money(l.importe)}</div>
                    <button onClick={() => quitar(l.pid)} className="text-stone-300 active:text-red-600 shrink-0 p-1"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setQty(l.pid, l.qty - (l.unidad === "kg" ? 0.25 : 1))} className="w-10 h-10 rounded-xl border border-stone-200 flex items-center justify-center active:bg-stone-100"><Minus size={16} /></button>
                    <span className="f-m w-14 text-center text-base">{l.unidad === "kg" ? l.qty.toFixed(2) : l.qty}</span>
                    <button onClick={() => setQty(l.pid, l.qty + (l.unidad === "kg" ? 0.25 : 1))} className="w-10 h-10 rounded-xl border border-stone-200 flex items-center justify-center active:bg-stone-100"><Plus size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200">
                  <th className="px-4 py-2 font-semibold">Producto</th>
                  <th className="px-2 py-2 font-semibold w-32 text-center">Cantidad</th>
                  <th className="px-2 py-2 font-semibold w-24 text-right">Precio</th>
                  <th className="px-4 py-2 font-semibold w-28 text-right">Subtotal</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lineas.map((l, i) => (
                  <tr key={l.pid} className={i === lineas.length - 1 ? "bg-orange-50/40" : "hover:bg-stone-50"}>
                    <td className="px-4 py-2.5 text-stone-800">
                      {l.nombre}
                      {l.lista === 2 && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                          lista 2 −{money(l.ahorro)}
                        </span>
                      )}
                      {l.lista === 1 && l.precio2 && ajustes.lista2 && (
                        <span className="ml-2 text-[10px] text-stone-400">
                          desde {ajustes.umbral2} u paga {money(l.precio2)}
                        </span>
                      )}
                      {ajustes.lista2 && !l.precio2 && l.qty >= ajustes.umbral2 && (
                        <span className="ml-2 text-[10px] text-stone-400" title="Este producto no tiene precio de lista 2 cargado">
                          sin precio por cantidad
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setQty(l.pid, l.qty - (l.unidad === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-lg border border-stone-200 hover:bg-stone-100 flex items-center justify-center"><Minus size={13} /></button>
                        <span className="f-m w-12 text-center">{l.unidad === "kg" ? l.qty.toFixed(2) : l.qty}</span>
                        <button onClick={() => setQty(l.pid, l.qty + (l.unidad === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-lg border border-stone-200 hover:bg-stone-100 flex items-center justify-center"><Plus size={13} /></button>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right f-m text-stone-500">
                      {l.lista === 2 && <span className="line-through text-stone-300 mr-1">{money(l.precio)}</span>}
                      <span className={l.lista === 2 ? "text-emerald-700 font-semibold" : ""}>{money(l.unit)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right f-m font-semibold">{money(l.importe)}</td>
                    <td className="pr-3"><button onClick={() => quitar(l.pid)} className="text-stone-300 hover:text-red-600"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
          )}
        </Card>

        {activo && !cantidadPendiente && (
          <p className="text-xs text-stone-400 px-1 -mt-1">
            Último cargado: <strong className="text-stone-600">{activo.nombre}</strong>. Escribí un número y Enter para dejarlo en esa cantidad.
          </p>
        )}

        <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
          {ATAJOS.map(([t, n]) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-stone-400"><Tecla>{t}</Tecla> {n}</span>
          ))}
        </div>
      </div>

      {/* En celular el total y el botón de cobrar viven fijos al pie, al alcance del pulgar */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-3 py-2.5 seguro-abajo shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{cart.length} productos</div>
              <div className="f-d text-2xl leading-none">{money(total)}</div>
              {ahorroTotal > 0 && <div className="text-[11px] text-emerald-700">−{money(ahorroTotal)} por cantidad</div>}
            </div>
            <Boton onClick={irAPago} size="lg" className="flex-1 justify-center">Cobrar</Boton>
          </div>
        </div>
      )}

      <div className="space-y-3 lg:sticky lg:top-4 pb-24 md:pb-0">
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-stone-500">{cart.length} productos</span>
            <span className="f-m text-sm">{money(sub)}</span>
          </div>
          {ahorroTotal > 0 && (
            <div className="flex items-baseline justify-between mt-1 text-emerald-700">
              <span className="text-sm">Precio por cantidad</span>
              <span className="f-m text-sm">−{money(ahorroTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-stone-500">Descuento <Tecla>F4</Tecla></span>
            <div className="flex items-center gap-1">
              {[0, 5, 10, 15].map((d) => (
                <button key={d} onClick={() => setDesc(d)} className={`f-m text-xs px-2 py-1 rounded-lg border ${desc === d ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>{d}%</button>
              ))}
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-stone-200">
            <span className="f-d text-lg">Total</span>
            <span className="f-d text-4xl tabular-nums">{money(total)}</span>
          </div>
          {cart.length > 0 && <div className="text-xs text-stone-400 mt-1 text-right">Ganancia {money(ganancia)} · {pct(total ? ganancia / total : 0)}</div>}
          <Boton onClick={irAPago} disabled={!cart.length} size="lg" className="w-full mt-4">
            Cobrar {money(total)} <Tecla>F2</Tecla>
          </Boton>
          <button onClick={() => ir("pedidos")} className="w-full text-xs font-semibold text-orange-600 hover:underline mt-3 inline-flex items-center justify-center gap-1">
            <ScanLine size={13} /> Vender recorriendo el salón <Tecla>F9</Tecla>
          </button>
        </Card>
      </div>

      {/* ---------- Ventana 2: medio de pago ---------- */}
      {paso === "pago" && (
        <Overlay>
          <div className="bg-stone-900 text-white px-6 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Total a cobrar · {cart.length} productos</div>
              <div className="f-d text-4xl mt-0.5">{money(total)}</div>
            </div>
            <div className="text-right text-xs text-stone-400"><Tecla>Esc</Tecla> volver</div>
          </div>
          <div className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold mb-2">¿Cómo paga?</div>
            <ul className="space-y-1.5">
              {MEDIOS.map((m, i) => (
                <li key={m.k}>
                  <button onClick={() => { setMedioSel(i); m.k === "efectivo" ? setPaso("monto") : finalizar(m.k, null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${i === medioSel ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
                    <Tecla>{i + 1}</Tecla>
                    <span className="font-semibold flex-1">{m.n}</span>
                    {m.com > 0 && <span className="text-xs text-stone-400">comisión {money(total * m.com)}</span>}
                    {i === medioSel && <ArrowRight size={16} className="text-orange-500" />}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => { setMedioSel(0); setMontoMix(""); setPaso("mixto"); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-stone-300 hover:bg-stone-50 text-left mt-1.5">
              <Tecla>6</Tecla>
              <span className="font-semibold flex-1">Pago combinado</span>
              <span className="text-xs text-stone-400">parte en efectivo y parte con tarjeta</span>
            </button>
            <p className="text-xs text-stone-400 mt-3 flex items-center gap-2">
              <Tecla>↑</Tecla><Tecla>↓</Tecla> elegir · <Tecla>Enter</Tecla> confirmar · <Tecla>1</Tecla>–<Tecla>6</Tecla> atajo directo
            </p>
          </div>
        </Overlay>
      )}

      {/* ---------- Ventana 2b: efectivo ---------- */}
      {paso === "monto" && (
        <Overlay ancho="max-w-lg">
          <div className="bg-stone-900 text-white px-6 py-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Efectivo · total</div>
            <div className="f-d text-4xl mt-0.5">{money(total)}</div>
          </div>
          <div className="p-5">
            <label className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">¿Con cuánto paga?</label>
            <input ref={inpMonto} value={recibe} onChange={(e) => setRecibe(e.target.value.replace(/\D/g, ""))}
              placeholder="Dejalo vacío si paga justo"
              className="f-m w-full text-right text-3xl border-2 border-stone-200 rounded-xl px-4 py-3 mt-2 outline-none focus:border-orange-400" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {rapidos.filter((r) => r >= total).slice(0, 4).map((r) => (
                <button key={r} onClick={() => setRecibe(String(r))} className="f-m text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700">{money(r)}</button>
              ))}
              <button onClick={() => setRecibe(String(Math.ceil(total / 1000) * 1000))} className="f-m text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700">
                {money(Math.ceil(total / 1000) * 1000)}
              </button>
            </div>
            {recibe !== "" && (
              <div className={`mt-4 p-3 rounded-xl text-center ${vuelto < 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <div className="text-[11px] uppercase tracking-widest font-bold text-stone-500">{vuelto < 0 ? "Falta" : "Vuelto"}</div>
                <div className={`f-d text-3xl ${vuelto < 0 ? "text-red-600" : "text-emerald-600"}`}>{money(Math.abs(vuelto))}</div>
              </div>
            )}
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-stone-400"><Tecla>Esc</Tecla> cambiar medio</span>
              <Boton size="lg" onClick={() => { if (recibe && Number(recibe) < total) return toast("El importe recibido es menor al total.", "mal"); finalizar("efectivo", recibe ? Number(recibe) : null); }}>
                Confirmar cobro <Tecla>Enter</Tecla>
              </Boton>
            </div>
          </div>
        </Overlay>
      )}

      {/* ---------- Ventana 2c: pago combinado ---------- */}
      {paso === "mixto" && (
        <Overlay ancho="max-w-lg">
          <div className="bg-stone-900 text-white px-6 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">
                {falta > 0 ? "Falta cobrar" : "Cubierto"}
              </div>
              <div className={`f-d text-4xl mt-0.5 ${falta > 0 ? "text-orange-400" : "text-emerald-400"}`}>{money(falta > 0 ? falta : total)}</div>
            </div>
            <div className="text-right text-xs text-stone-400">de {money(total)}<br /><Tecla>Esc</Tecla> volver</div>
          </div>

          <div className="p-5">
            {pagos.length > 0 && (
              <ul className="mb-4 border border-stone-200 rounded-xl divide-y divide-stone-100">
                {pagos.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span className="flex-1">{MEDIOS.find((m) => m.k === p.medio).n}</span>
                    <span className="f-m">{money(p.monto)}</span>
                    {p.exceso > 0 && <span className="f-m text-[11px] text-stone-400">+{money(p.exceso)} vuelto</span>}
                    <button onClick={() => setPagos((ps) => ps.filter((_, j) => j !== i))} className="text-stone-300 hover:text-red-600"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}

            {falta > 0 ? (
              <>
                <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">¿Con qué paga esta parte?</div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {MEDIOS.map((m, i) => (
                    <button key={m.k} onClick={() => setMedioSel(i)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-sm font-semibold ${i === medioSel ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
                      <Tecla>{i + 1}</Tecla> {m.n}
                    </button>
                  ))}
                </div>
                <label className="block text-[11px] uppercase tracking-widest text-stone-400 font-bold mt-4">Importe</label>
                <input ref={inpMix} value={montoMix} onChange={(e) => setMontoMix(e.target.value.replace(/\D/g, ""))}
                  placeholder={`${money(falta)} (todo lo que falta)`}
                  className="f-m w-full text-right text-2xl border-2 border-stone-200 rounded-xl px-4 py-2.5 mt-1 outline-none focus:border-orange-400" />
                <p className="text-xs text-stone-400 mt-2 flex items-center gap-1.5 flex-wrap">
                  <Tecla>↑</Tecla><Tecla>↓</Tecla> medio · <Tecla>Enter</Tecla> agregar · <Tecla>Supr</Tecla> borrar el último ·
                  vacío toma {money(falta)}
                </p>
                <Boton size="lg" className="w-full mt-3" onClick={agregarPago}>
                  Agregar {money(Number(montoMix) || falta)} en {MEDIOS[medioSel].n} <Tecla>Enter</Tecla>
                </Boton>
              </>
            ) : (
              <>
                {vueltoMix > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-3 text-center mb-3">
                    <div className="text-[11px] uppercase tracking-widest font-bold text-stone-500">Vuelto</div>
                    <div className="f-d text-3xl text-emerald-600">{money(vueltoMix)}</div>
                  </div>
                )}
                <Boton size="lg" className="w-full" onClick={finalizarMixto}>Confirmar cobro <Tecla>Enter</Tecla></Boton>
              </>
            )}
          </div>
        </Overlay>
      )}

      {/* ---------- Ventana 3: cobrado, ticket opcional ---------- */}
      {paso === "fin" && ticket && (
        <Overlay ancho="max-w-lg">
          <div className="bg-emerald-600 text-white px-6 py-5 text-center">
            <Check size={26} className="mx-auto" />
            <div className="f-d text-2xl mt-1">Cobrado {money(ticket.total)}</div>
            <div className="text-emerald-100 text-sm">
              {(ticket.pagos || [{ medio: ticket.medio, monto: ticket.total }]).map((p) => `${MEDIOS.find((m) => m.k === p.medio).n} ${money(p.monto)}`).join(" + ")} · {ticket.nro}
            </div>
          </div>
          {ticket.recibe && (ticket.vuelto != null ? ticket.vuelto : ticket.recibe - ticket.total) > 0 && (
            <div className="bg-stone-900 text-white px-6 py-4 text-center">
              <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Vuelto</div>
              <div className="f-d text-5xl text-orange-400">{money(ticket.vuelto != null ? ticket.vuelto : ticket.recibe - ticket.total)}</div>
            </div>
          )}
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold mb-2">¿Querés comprobante?</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[[Printer, "Imprimir", "I", () => imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ajustes.arca ? ticket.cae : null, toast)],
                [FileText, "Ver ticket", "T", () => setVerTicket(true)],
                [MessageCircle, "WhatsApp", "W", () => toast("Comprobante enviado por WhatsApp.")],
                [Mail, "Email", "E", () => toast("Comprobante enviado por email.")]].map(([I, n, k2, fn]) => (
                <button key={n} onClick={fn} className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-[11px] font-semibold text-stone-600">
                  <I size={16} /> {n} <Tecla>{k2}</Tecla>
                </button>
              ))}
            </div>
            <Boton variant="dark" size="lg" className="w-full mt-4" onClick={nuevaVenta}>Nueva venta <Tecla>Enter</Tecla></Boton>
          </div>
        </Overlay>
      )}

      {verTicket && ticket && (
        <Modal open onClose={() => setVerTicket(false)} ancho="max-w-md">
          <div className="p-5">
            <div className="bg-stone-100 rounded-xl p-3 overflow-auto">
              <Comandera lineas={ticketVenta(ticket, ajustes, W)} ancho={ajustes.ancho} qr={ajustes.arca ? ticket.cae : null} className="py-2 shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3 no-print">
              <Boton variant="ghost" onClick={() => imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ajustes.arca ? ticket.cae : null, toast)}><Printer size={15} /> Imprimir</Boton>
              <Boton variant="dark" onClick={() => setVerTicket(false)}>Cerrar</Boton>
            </div>
          </div>
        </Modal>
      )}

      <EscanerCamara abierto={camara} onCerrar={() => setCamara(false)}
        titulo="Escaneá los productos"
        onLeer={(cod) => {
          const p = productos.find((x) => x.barcode === cod);
          if (p) { add(p); beep(true, ajustes.sonido); toast(`${p.nombre} · ${money(p.precio)}`); }
          else { beep(false, ajustes.sonido); setCamara(false); setAlta({ barcode: cod }); }
        }} />

      <AltaRapida abierto={!!alta} inicial={alta} productos={productos} ajustes={ajustes}
        onClose={() => { setAlta(null); setQ(""); }} onCrear={crearAlVuelo} />

      {ayuda && (
        <Overlay ancho="max-w-md">
          <div className="p-5">
            <h3 className="f-d text-lg">Atajos de teclado</h3>
            <p className="text-sm text-stone-500 mt-0.5">Todo el cobro se puede hacer sin tocar el mouse.</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {[["Escribir / escanear", "busca y carga el producto"], ["Enter", "agrega el producto marcado"],
                ["Un número + Enter", "cambia la cantidad del último producto"], ["Enter con el campo vacío", "pasa a cobrar"], ["↑ ↓", "elegir en la lista"],
                ["F2", "cobrar"], ["F4", "cambiar descuento"], ["F7", "quitar el último renglón"],
                ["F8", "anular la venta"], ["F9", "vender recorriendo el salón"], ["F10", "ir al panel"],
                ["1 – 5", "elegir medio de pago"], ["6", "pago combinado"], ["Supr", "borrar el último pago parcial"], ["I / T / W / E", "imprimir, ver, WhatsApp, email"],
                ["Esc", "volver un paso"]].map(([k2, d]) => (
                <li key={k2} className="flex items-baseline gap-3">
                  <span className="w-44 shrink-0"><Tecla>{k2}</Tecla></span>
                  <span className="text-stone-600">{d}</span>
                </li>
              ))}
            </ul>
            <Boton variant="dark" className="w-full mt-4" onClick={() => setAyuda(false)}>Cerrar <Tecla>F1</Tecla></Boton>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function TicketModal({ t, onClose, ajustes, toast }) {
  if (!t) return null;
  const W = ajustes.ancho === 58 ? 32 : 48;
  const acciones = [
    { i: Printer, n: "Imprimir", fn: () => imprimirComandera(ticketVenta(t, ajustes, W), ajustes.ancho, ajustes.arca ? t.cae : null, toast) },
    { i: MessageCircle, n: "WhatsApp", fn: () => toast("Comprobante enviado por WhatsApp.") },
    { i: Mail, n: "Email", fn: () => toast("Comprobante enviado por email.") },
    { i: QrCode, n: "QR", fn: () => toast("QR en pantalla para el cliente.") },
  ];
  return (
    <Modal open={!!t} onClose={onClose} ancho="max-w-md">
      <div className="p-5">
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><Check size={14} /></div>
            Venta registrada
          </div>
          <span className="text-[11px] text-stone-400">Comandera {ajustes.ancho} mm</span>
        </div>
        <div className="bg-stone-100 rounded-xl p-3 mt-4 overflow-auto">
          <Comandera lineas={ticketVenta(t, ajustes, W)} ancho={ajustes.ancho}
            qr={ajustes.arca ? t.cae : null} className="py-2 shadow-sm" />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-4 no-print">
          {acciones.map((a) => (
            <button key={a.n} onClick={a.fn} className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-[11px] font-semibold text-stone-600">
              <a.i size={16} /> {a.n}
            </button>
          ))}
        </div>
        <Boton onClick={onClose} variant="dark" className="w-full mt-3 no-print">Listo</Boton>
      </div>
    </Modal>
  );
}

/* ============================================================
   6 bis. ALTAS: PRODUCTO Y PROVEEDOR
   ============================================================ */

function Campo({ label, children, ancho = "" }) {
  return (
    <label className={`block ${ancho}`}>
      <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm mt-1 outline-none focus:border-orange-400";

function FormProducto({ abierto, inicial, productos, provs, onGuardar, onClose }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD({ iva: 21, unidad: "un", bulto: 1, stock: 0, ...(inicial || {}) }); }, [abierto, inicial]);
  if (!abierto) return null;

  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const cats = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean))).sort();
  const editando = !!d.id;
  const costo = Number(d.costo) || 0, precio = Number(d.precio) || 0;
  const margen = precio ? (precio - costo) / precio : 0;
  const faltan = faltantesProducto({ ...d, costo, precio });
  const duplicado = d.barcode && productos.find((p) => p.barcode === String(d.barcode).replace(/\D/g, "") && p.id !== d.id);

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3.5 flex items-center justify-between">
        <h3 className="f-d text-lg">{editando ? "Editar producto" : "Nuevo producto"}</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">
        <Campo label="Nombre">
          <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)} autoFocus
            placeholder="Ej: Gaseosa Coca-Cola 2,25 L" className={inputCls} />
        </Campo>

        <div className="grid md:grid-cols-3 gap-3">
          <Campo label="Código de barras">
            <input value={d.barcode || ""} onChange={(e) => set("barcode", e.target.value.replace(/\D/g, ""))}
              placeholder="Disparalo con la pistola" className={`${inputCls} f-m`} />
            {duplicado && <span className="text-[11px] text-red-600">Ya lo usa {duplicado.nombre}</span>}
          </Campo>
          <Campo label="Rubro">
            <input list="rubros" value={d.categoria || ""} onChange={(e) => set("categoria", e.target.value)} className={inputCls} />
            <datalist id="rubros">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Marca">
            <input value={d.marca || ""} onChange={(e) => set("marca", e.target.value)} className={inputCls} />
          </Campo>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Costo">
            <input value={d.costo || ""} onChange={(e) => set("costo", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Precio lista 1">
            <input value={d.precio || ""} onChange={(e) => set("precio", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Lista 2 (por cantidad)">
            <input value={d.precio2 || ""} onChange={(e) => set("precio2", e.target.value.replace(/\D/g, ""))}
              placeholder="opcional" className={`${inputCls} f-m text-right`} />
            {Number(d.precio2) > 0 && Number(d.precio2) <= costo && <span className="text-[11px] text-red-600">Está por debajo del costo</span>}
            {Number(d.precio2) > costo && <span className="text-[11px] text-stone-400">margen {pct((Number(d.precio2) - costo) / Number(d.precio2), 0)}</span>}
          </Campo>
          <Campo label="Margen lista 1">
            <div className={`${inputCls} f-m text-right bg-stone-50 ${margen > 0 && margen < 0.12 ? "text-red-600" : ""}`}>{precio ? pct(margen) : "—"}</div>
          </Campo>
          <Campo label="IVA">
            <select value={d.iva} onChange={(e) => set("iva", Number(e.target.value))} className={inputCls}>
              <option value={21}>21%</option><option value={10.5}>10,5%</option><option value={0}>Exento</option>
            </select>
          </Campo>
        </div>
        {costo > 0 && !precio && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-stone-500 self-center">Sugerir precio con margen:</span>
            {[0.25, 0.3, 0.35, 0.4].map((m) => (
              <button key={m} onClick={() => set("precio", String(Math.round(costo / (1 - m) / 10) * 10))}
                className="text-xs px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 f-m">
                {pct(m, 0)} → {money(Math.round(costo / (1 - m) / 10) * 10)}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Stock actual">
            <input value={d.stock || ""} onChange={(e) => set("stock", e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Stock mínimo">
            <input value={d.stockMin || ""} onChange={(e) => set("stockMin", e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Unidad de venta">
            <select value={d.unidad} onChange={(e) => set("unidad", e.target.value)} className={inputCls}>
              <option value="un">Por unidad</option><option value="kg">Por kilo</option>
            </select>
          </Campo>
          <Campo label="Compra por bulto de">
            <input value={d.bulto || ""} onChange={(e) => set("bulto", e.target.value.replace(/\D/g, ""))} className={`${inputCls} f-m text-right`} />
          </Campo>
        </div>

        <Campo label="Proveedor">
          <select value={d.proveedor || ""} onChange={(e) => set("proveedor", e.target.value)} className={inputCls}>
            <option value="">Sin asignar</option>
            {Object.keys(provs).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Campo>

        {faltan.length > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Podés guardarlo igual, pero le falta: <strong>{faltan.join(", ")}</strong>. Va a quedar marcado como ficha incompleta hasta que lo completes.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
          <Boton variant="quiet" onClick={onClose}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d, faltan)} disabled={!d.nombre || !!duplicado}>
            <Check size={15} /> {editando ? "Guardar cambios" : "Crear producto"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

function FormProveedor({ abierto, inicial, onGuardar, onClose }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD(inicial || {}); }, [abierto, inicial]);
  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const faltan = faltantesProveedor(d);
  return (
    <Modal open onClose={onClose} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{inicial && inicial.nombreOriginal ? "Editar proveedor" : "Nuevo proveedor"}</h3>
        <div className="space-y-3 mt-4">
          <Campo label="Nombre"><input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)} autoFocus className={inputCls} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CUIT"><input value={d.cuit || ""} onChange={(e) => set("cuit", e.target.value)} placeholder="30-12345678-9" className={`${inputCls} f-m`} /></Campo>
            <Campo label="Teléfono"><input value={d.tel || ""} onChange={(e) => set("tel", e.target.value)} placeholder="11 4455-2210" className={`${inputCls} f-m`} /></Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Condición de pago">
              <input list="pagos" value={d.pago || ""} onChange={(e) => set("pago", e.target.value)} placeholder="Contado" className={inputCls} />
              <datalist id="pagos"><option value="Contado" /><option value="Cta. cte. 15 días" /><option value="Cta. cte. 21 días" /><option value="Cta. cte. 30 días" /></datalist>
            </Campo>
            <Campo label="Días de entrega"><input value={d.entrega || ""} onChange={(e) => set("entrega", e.target.value)} placeholder="Mar y Vie" className={inputCls} /></Campo>
          </div>
        </div>
        {faltan.length > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
            Falta: <strong>{faltan.join(", ")}</strong>. Se guarda igual y queda marcado para completar.
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onClose}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d)} disabled={!d.nombre}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   7. PRODUCTOS
   ============================================================ */

function Productos({ productos, setProductos, toast, focoInicial, provs }) {
  const [alta, setAlta] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [orden, setOrden] = useState("nombre");
  const [pag, setPag] = useState(0);
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState(focoInicial || "todos");

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) { beep(false, true); return toast(`El código ${cod} no está en el catálogo.`, "mal"); }
    beep(true, true); setQ(""); setCat("Todas"); setFiltro("todos"); setAbierto(p.id);
  }, true);

  const cats = useMemo(() => ["Todas", ...Array.from(new Set(productos.map((p) => p.categoria)))], [productos]);
  const conLista2 = productos.filter((p) => p.precio2).length;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const lista = useMemo(() => {
    let l = productos;
    if (cat !== "Todas") l = l.filter((p) => p.categoria === cat);
    if (filtro === "margen") l = l.filter((p) => p.costo > p.costoPrev * 1.005);
    if (filtro === "flaco") l = l.filter((p) => (p.precio - p.costo) / p.precio < 0.15 && p.u30 >= 4);
    if (filtro === "incompletos") l = l.filter((p) => faltantesProducto(p).length);
    if (q.trim().length >= 2) {
      const t = norm(q.trim());
      l = l.filter((p) => norm(p.nombre).includes(t) || p.sku.toLowerCase().includes(t) || p.barcode.includes(t));
    }
    const cmp = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre),
      venta: (a, b) => b.u30 * b.precio - a.u30 * a.precio,
      margen: (a, b) => (a.precio - a.costo) / a.precio - (b.precio - b.costo) / b.precio,
      stock: (a, b) => a.stock / (a.vel || 0.01) - b.stock / (b.vel || 0.01),
    }[orden];
    return [...l].sort(cmp);
  }, [productos, cat, q, orden, filtro]);

  const porPagina = 40;
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const p0 = Math.min(pag, paginas - 1);
  const visibles = lista.slice(p0 * porPagina, p0 * porPagina + porPagina);
  useEffect(() => setPag(0), [q, cat, orden, filtro]);

  const actualizar = (id, cambios, msg) => {
    setProductos((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
    if (msg) toast(msg);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU o código"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-orange-400 bg-white" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-orange-400">
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-orange-400">
          <option value="nombre">Orden alfabético</option>
          <option value="venta">Más vendidos</option>
          <option value="margen">Menor margen</option>
          <option value="stock">Menos cobertura</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[["todos", "Todos"], ["margen", "Subieron de costo"], ["flaco", "Margen bajo"], ["incompletos", "Incompletos"]].map(([k, n]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filtro === k ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"}`}>{n}</button>
        ))}
        <span className="text-xs text-stone-400 self-center ml-1">{nf.format(lista.length)} productos</span>
        <Boton size="sm" className="ml-auto shrink-0" onClick={() => setAlta({})}><Plus size={14} /> <span className="hidden sm:inline">Nuevo producto</span><span className="sm:hidden">Nuevo</span></Boton>
      </div>

      <Card className="overflow-hidden">
        {/* Siete columnas no entran en un celular: mismos datos, otra forma */}
        <ul className="md:hidden divide-y divide-stone-100">
          {visibles.map((p) => {
            const m = p.precio ? (p.precio - p.costo) / p.precio : 0;
            const cob = p.vel > 0 ? p.stock / p.vel : 99;
            const faltan = faltantesProducto(p);
            return (
              <li key={p.id}>
                <button onClick={() => setAbierto(p.id)} className="w-full text-left px-3 py-2.5 active:bg-orange-50/60">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 leading-snug">{p.nombre}</div>
                      <div className="f-m text-[11px] text-stone-400">{p.categoria}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="f-m text-sm font-semibold">{p.precio ? money(p.precio) : <span className="text-amber-600 text-xs">sin precio</span>}</div>
                      {p.precio2 && <div className="text-[10px] text-emerald-600">L2 {money(p.precio2)}</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
                    <span className="f-m text-stone-500">Stock <span className={cob < 4 ? "text-red-600 font-semibold" : "text-stone-700"}>{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span></span>
                    <span className="f-m text-stone-500">Costo {money(p.costo)}</span>
                    {p.precio > 0 && <span className={`f-m ${m < 0.14 ? "text-red-600" : m < 0.22 ? "text-amber-600" : "text-emerald-600"}`}>{pct(m, 0)}</span>}
                    <span className="f-m text-stone-400">{nf.format(p.u30)} u/mes</span>
                    {faltan.length > 0 && <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">incompleta</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-2.5 font-semibold">Producto</th>
                <th className="px-2 py-2.5 font-semibold">Categoría</th>
                <th className="px-2 py-2.5 font-semibold text-right">Stock</th>
                <th className="px-2 py-2.5 font-semibold text-right">Costo</th>
                <th className="px-2 py-2.5 font-semibold text-right">Precio</th>
                <th className="px-2 py-2.5 font-semibold text-right">Margen</th>
                <th className="px-4 py-2.5 font-semibold text-right">30 días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibles.map((p) => {
                const m = (p.precio - p.costo) / p.precio;
                const cob = p.vel > 0 ? p.stock / p.vel : 99;
                const subio = p.costo > p.costoPrev * 1.005;
                return (
                  <tr key={p.id} onClick={() => setAbierto(p.id)} className="hover:bg-orange-50/50 cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-900 flex items-center gap-1.5">
                        {p.nombre}
                        {faltantesProducto(p).length > 0 && (
                          <span title={`Falta: ${faltantesProducto(p).join(", ")}`}
                            className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">incompleta</span>
                        )}
                      </div>
                      <div className="f-m text-[11px] text-stone-400">{p.sku} · {p.barcode || "sin código"}</div>
                    </td>
                    <td className="px-2 py-2.5 text-stone-500 text-xs">{p.categoria}</td>
                    <td className="px-2 py-2.5 text-right f-m">
                      <span className={cob < 4 ? "text-red-600 font-semibold" : cob < 8 ? "text-amber-600" : "text-stone-700"}>
                        {p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}
                      </span>
                      <div className="text-[10px] text-stone-400">{cob > 90 ? "+90 d" : `${Math.round(cob)} d`}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right f-m text-stone-600">
                      {money(p.costo)}
                      {subio && <div className="text-[10px] text-red-500">+{pct(p.costo / p.costoPrev - 1, 0)}</div>}
                    </td>
                    <td className="px-2 py-2.5 text-right f-m font-semibold">
                      {money(p.precio)}
                      {p.precio2 && <div className="text-[10px] text-emerald-600 font-normal">L2 {money(p.precio2)}</div>}
                    </td>
                    <td className="px-2 py-2.5 text-right f-m">
                      <span className={m < 0.14 ? "text-red-600" : m < 0.22 ? "text-amber-600" : "text-emerald-600"}>{pct(m, 0)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right f-m text-stone-600">{nf.format(p.u30)} <span className="text-[10px] text-stone-400">u</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && <Vacio>No hay productos con esos filtros. Probá con otra búsqueda.</Vacio>}
        {paginas > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-stone-200 text-xs text-stone-500">
            <span>Página {p0 + 1} de {paginas}</span>
            <div className="flex gap-1">
              <Boton size="sm" variant="ghost" onClick={() => setPag(Math.max(0, p0 - 1))} disabled={p0 === 0}><ChevronLeft size={14} /></Boton>
              <Boton size="sm" variant="ghost" onClick={() => setPag(Math.min(paginas - 1, p0 + 1))} disabled={p0 >= paginas - 1}><ChevronRight size={14} /></Boton>
            </div>
          </div>
        )}
      </Card>

      <FichaProducto p={productos.find((x) => x.id === abierto)} onClose={() => setAbierto(null)} actualizar={actualizar} editar={(p) => { setAbierto(null); setAlta(p); }} />

      <FormProducto abierto={!!alta} inicial={alta} productos={productos} provs={provs} onClose={() => setAlta(null)}
        onGuardar={(d, faltan) => {
          if (d.id) {
            setProductos((ps) => ps.map((p) => (p.id === d.id ? {
              ...p, ...d,
              costo: Number(d.costo) || 0, precio: Number(d.precio) || 0,
              stock: Number(d.stock) || 0, stockMin: Number(d.stockMin) || 0, bulto: Number(d.bulto) || 1,
              barcode: String(d.barcode || "").replace(/\D/g, ""),
              precio2: Number(d.precio2) || null,
            } : p)));
            toast(faltan.length ? `Guardado. Todavía falta ${faltan.join(", ")}.` : "Producto actualizado.");
          } else {
            setProductos((ps) => [...ps, productoNuevo(d, ps)]);
            toast(faltan.length ? `${d.nombre} creado. Falta ${faltan.join(", ")}.` : `${d.nombre} creado.`);
          }
          setAlta(null);
        }} />
    </div>
  );
}

function FichaProducto({ p, onClose, actualizar, editar }) {
  const [precio, setPrecio] = useState("");
  useEffect(() => { if (p) setPrecio(String(p.precio)); }, [p && p.id]);
  if (!p) return null;

  const m = (p.precio - p.costo) / p.precio;
  const mAntes = (p.precio - p.costoPrev) / p.precio;
  const subio = p.costo > p.costoPrev * 1.005;
  const precioSug = Math.round(p.costo / (1 - mAntes) / 10) * 10;
  const serie = p.historial.map((h) => ({ label: fdate(h.fecha), costo: h.costo }));

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3.5 flex items-start justify-between gap-4">
        <div>
          <h3 className="f-d text-lg leading-tight">{p.nombre}</h3>
          <div className="f-m text-[11px] text-stone-400 mt-0.5">{p.sku} · {p.barcode} · {p.proveedor}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editar && <Boton size="sm" variant="ghost" onClick={() => editar(p)}>Editar ficha</Boton>}
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {faltantesProducto(p).length > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Ficha incompleta. Falta: <strong>{faltantesProducto(p).join(", ")}</strong>.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[["Costo", money(p.costo)], ["Lista 1", money(p.precio)],
            ["Lista 2", p.precio2 ? money(p.precio2) : "—"], ["Margen", pct(m)]].map(([l, v]) => (
            <div key={l} className="bg-stone-50 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{l}</div>
              <div className="f-m text-lg mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        {subio && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <TrendingDown size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">El costo subió {pct(p.costo / p.costoPrev - 1, 0)} y el precio quedó igual.</p>
                <p className="text-amber-800 mt-1">
                  Ganabas {pct(mAntes)} y ahora ganás {pct(m)}. Con {nf.format(p.u30)} unidades al mes, son{" "}
                  {money((p.costo - p.costoPrev) * p.u30)} menos de ganancia.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Boton size="sm" onClick={() => actualizar(p.id, { precio: precioSug }, `Precio actualizado a ${money(precioSug)}.`)}>
                    Poner a {money(precioSug)} y recuperar el {pct(mAntes, 0)}
                  </Boton>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Historial de costo</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={serie} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v) => [money(v), "Costo"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
              <Area type="stepAfter" dataKey="costo" stroke="#f97316" strokeWidth={2} fill="#fed7aa" fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Cambiar precio</div>
            <div className="flex gap-2">
              <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                className="f-m flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <Boton size="sm" onClick={() => actualizar(p.id, { precio: Number(precio) || p.precio }, "Precio actualizado.")}>Guardar</Boton>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Margen con ese precio: <strong>{pct(((Number(precio) || p.precio) - p.costo) / (Number(precio) || p.precio))}</strong>
            </p>
          </div>
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Movimiento</div>
            <ul className="text-sm text-stone-600 space-y-1">
              <li className="flex justify-between"><span>Vendidas 30 días</span><span className="f-m">{nf.format(p.u30)}</span></li>
              <li className="flex justify-between"><span>Mes anterior</span><span className="f-m">{nf.format(p.u30p)}</span></li>
              <li className="flex justify-between"><span>Última venta</span><span className="f-m">{diasDesde(p.ultimaVenta) === 0 ? "hoy" : `hace ${diasDesde(p.ultimaVenta)} d`}</span></li>
              <li className="flex justify-between"><span>Compra por bulto</span><span className="f-m">{p.bulto} u</span></li>
              {p.vence && <li className="flex justify-between"><span>Vence</span><span className={`f-m ${diasHasta(p.vence) <= 7 ? "text-red-600" : ""}`}>{fdatel(p.vence)}</span></li>}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   8. STOCK
   ============================================================ */

function Stock({ productos, setProductos, k, toast }) {
  const [tab, setTab] = useState("alertas");
  const [q, setQ] = useState("");
  const [conteo, setConteo] = useState({});
  const [ajustados, setAjustados] = useState([]);

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) { beep(false, true); return toast(`El código ${cod} no está en el catálogo.`, "mal"); }
    beep(true, true);
    setQ(cod);
    setConteo((c) => ({ ...c, [p.id]: String((Number(c[p.id]) || 0) + 1) }));
  }, tab === "inventario");

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscar = q.trim().length >= 2 ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || p.barcode.includes(q.trim())).slice(0, 25) : [];

  const aplicar = (p) => {
    const real = Number(conteo[p.id]);
    if (isNaN(real)) return;
    const dif = +(real - p.stock).toFixed(2);
    setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, stock: real } : x)));
    setAjustados((a) => [{ id: uid(), nombre: p.nombre, antes: p.stock, real, dif, valor: dif * p.costo }, ...a]);
    setConteo((c) => ({ ...c, [p.id]: "" }));
    toast(`${p.nombre}: stock ajustado a ${real}.`);
  };

  const items = [
    { k: "alertas", n: "Reponer", badge: k.criticos.length },
    { k: "vencer", n: "Vencimientos", badge: k.porVencer.length },
    { k: "dormidos", n: "Sin movimiento", badge: k.dormidos.length },
    { k: "inventario", n: "Conteo de inventario" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Valor del inventario" valor={moneyk(k.valorStock)} sub={`${nf.format(productos.length)} artículos`} />
        <Kpi label="Para reponer ya" valor={nf.format(k.criticos.filter((x) => x.cobertura < 4).length)} sub="menos de 4 días" tono="mal" />
        <Kpi label="Sin rotación" valor={moneyk(k.valorDormido)} sub={`${k.dormidos.length} productos`} />
        <Kpi label="Vencen en 15 días" valor={moneyk(k.valorVencer)} sub={`${k.porVencer.length} productos`} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-2"><Tabs items={items} value={tab} onChange={setTab} /></div>

        {tab === "alertas" && (
          <TablaSimple
            cols={["Producto", "Stock", "Vende por día", "Alcanza para", "Sugerido"]}
            filas={k.criticos.slice(0, 60).map(({ p, cobertura }) => [
              <div key="a"><div className="font-medium">{p.nombre}</div><div className="text-[11px] text-stone-400">{p.proveedor}</div></div>,
              <span className="f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span>,
              <span className="f-m text-stone-500">{p.vel.toFixed(1)}</span>,
              <span className={`f-m font-semibold ${cobertura < 2 ? "text-red-600" : "text-amber-600"}`}>{cobertura < 1 ? "hoy" : `${Math.round(cobertura)} días`}</span>,
              <span className="f-m">{Math.max(p.bulto, Math.ceil((p.vel * 14 - p.stock) / p.bulto) * p.bulto)} u</span>,
            ])}
            vacio="No hay nada por reponer. Buen momento."
          />
        )}

        {tab === "vencer" && (
          <TablaSimple
            cols={["Producto", "Vence", "Stock", "Plata en riesgo", ""]}
            filas={k.porVencer.map(({ p, dias, valor }) => [
              <div key="a" className="font-medium">{p.nombre}</div>,
              <span className={`f-m ${dias <= 0 ? "text-red-600 font-semibold" : dias <= 7 ? "text-amber-600" : ""}`}>{dias <= 0 ? "Vencido" : `en ${dias} días`} · {fdatel(p.vence)}</span>,
              <span className="f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span>,
              <span className="f-m">{money(valor)}</span>,
              <Boton key="b" size="sm" variant="ghost" onClick={() => {
                setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, precio: Math.round(x.precio * 0.7 / 10) * 10 } : x)));
                toast(`${p.nombre} pasó a promo con 30% off.`);
              }}>Poner en promo</Boton>,
            ])}
            vacio="Ningún producto vence en los próximos 15 días."
          />
        )}

        {tab === "dormidos" && (
          <TablaSimple
            cols={["Producto", "Última venta", "Stock", "Plata inmovilizada", ""]}
            filas={k.dormidos.slice(0, 60).map(({ p, valor }) => [
              <div key="a"><div className="font-medium">{p.nombre}</div><div className="text-[11px] text-stone-400">{p.categoria}</div></div>,
              <span className="f-m text-stone-500">hace {diasDesde(p.ultimaVenta)} días</span>,
              <span className="f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span>,
              <span className="f-m font-semibold">{money(valor)}</span>,
              <Boton key="b" size="sm" variant="ghost" onClick={() => {
                setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, activo: false } : x)));
                toast(`${p.nombre} marcado para no reponer.`);
              }}>No reponer</Boton>,
            ])}
            vacio="Todo tu inventario rotó en los últimos 30 días."
          />
        )}

        {tab === "inventario" && (
          <div className="p-4">
            <p className="text-sm text-stone-500 mb-3">
              Escaneá o buscá el producto, contá lo que hay en góndola y cargá el número real. El sistema calcula la diferencia contra el stock teórico.
            </p>
            <div className="relative max-w-lg">
              <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Disparale con la pistola o buscalo por nombre"
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-orange-400" />
            </div>
            {buscar.length > 0 && (
              <div className="mt-3 border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-80 overflow-auto">
                {buscar.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.nombre}</div>
                      <div className="f-m text-[11px] text-stone-400">Sistema: {p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)} {p.unidad}</div>
                    </div>
                    <input value={conteo[p.id] || ""} onChange={(e) => setConteo((c) => ({ ...c, [p.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                      placeholder="Contado" className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
                    <Boton size="sm" onClick={() => aplicar(p)} disabled={!conteo[p.id]}>Ajustar</Boton>
                  </div>
                ))}
              </div>
            )}
            {ajustados.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Ajustes de esta sesión</div>
                <ul className="text-sm divide-y divide-stone-100 border border-stone-200 rounded-xl">
                  {ajustados.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-3 py-2">
                      <span className="truncate">{a.nombre}</span>
                      <span className="f-m text-xs shrink-0 ml-3">
                        {a.antes} → {a.real}
                        <span className={a.dif < 0 ? "text-red-600 ml-2" : "text-emerald-600 ml-2"}>{a.dif > 0 ? "+" : ""}{a.dif} ({money(a.valor)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-stone-500 mt-2">
                  Diferencia acumulada: <strong className={ajustados.reduce((s, a) => s + a.valor, 0) < 0 ? "text-red-600" : "text-emerald-600"}>{money(ajustados.reduce((s, a) => s + a.valor, 0))}</strong>. Si da negativo seguido, hay merma o error de carga.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TablaSimple({ cols, filas, vacio }) {
  if (!filas.length) return <Vacio>{vacio}</Vacio>;
  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200">
            {cols.map((c, i) => <th key={i} className={`px-4 py-2.5 font-semibold ${i > 0 ? "text-right" : ""}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {filas.map((f, i) => (
            <tr key={i} className="hover:bg-stone-50">
              {f.map((c, j) => <td key={j} className={`px-4 py-2.5 ${j > 0 ? "text-right" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --- Emparejar un renglón de remito con el catálogo --------------------
   Los remitos abrevian ("COCA COLA 2.25 X6"), a veces traen el código del
   proveedor y no el EAN. Se prueba primero por código y después por
   coincidencia de palabras, devolviendo la confianza para que la pantalla
   marque en amarillo lo que hay que revisar a mano.                        */
function palabras(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/).filter((x) => x.length > 2);
}

function emparejar(descripcion, codigo, productos) {
  const cod = String(codigo || "").replace(/\D/g, "");
  if (cod.length >= 8) {
    const p = productos.find((x) => x.barcode === cod);
    if (p) return { p, conf: 1 };
  }
  const ts = palabras(descripcion);
  if (!ts.length) return { p: null, conf: 0 };
  let mejor = null, punt = 0;
  for (const p of productos) {
    const ps = palabras(p.nombre);
    let c = 0;
    for (const t of ts) if (ps.some((x) => x.startsWith(t) || t.startsWith(x))) c++;
    const score = c / ts.length;
    if (score > punt) { punt = score; mejor = p; }
  }
  return punt >= 0.5 ? { p: mejor, conf: punt } : { p: mejor, conf: punt };
}

/* ============================================================
   9. COMPRAS
   ============================================================ */

function CargarCompra({ productos, setProductos, movCaja, toast, provs, setProvs }) {
  const [lineas, setLineas] = useState([]);
  const [prov, setProv] = useState(Object.keys(provs)[0]);
  const [comprobante, setComprobante] = useState("");
  const [pagado, setPagado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [buscando, setBuscando] = useState(null);
  const [avisoProv, setAvisoProv] = useState(null);
  const [q, setQ] = useState("");
  const archivo = useRef(null);

  const agregar = (p, cant = 1, costoLeido = null, origen = "pistola", desc = null, conf = 1) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.pid === p.id);
      if (i >= 0 && origen === "pistola") return ls.map((l, j) => (j === i ? { ...l, cant: +(l.cant + cant).toFixed(2) } : l));
      const margen = (p.precio - p.costo) / p.precio;
      const costo = costoLeido != null ? Math.round(costoLeido) : p.costo;
      return [...ls, {
        uid: uid(), pid: p.id, nombre: p.nombre, barcode: p.barcode, unidad: p.unidad,
        cant, costo, costoAnterior: p.costo, precioAnterior: p.precio,
        precio: p.precio, margenAnterior: margen, origen, desc, conf,
      }];
    });
  };

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) {
      beep(false, true);
      setLineas((ls) => [...ls, { uid: uid(), pid: null, cant: 1, costo: null, desc: `Código ${cod}`, origen: "pistola", conf: 0,
        crear: { nombre: "", precio: "", barcode: cod, categoria: "" } }]);
      return toast(`Código ${cod} nuevo: completá el nombre y el precio en el renglón.`, "mal");
    }
    beep(true, true);
    agregar(p, 1);
    if (p.proveedor !== prov) setProv(p.proveedor);
  }, !buscando);

  const set = (u, campo, val) => setLineas((ls) => ls.map((l) => (l.uid === u ? { ...l, [campo]: val } : l)));
  const setCrear = (u, campo, val) => setLineas((ls) => ls.map((l) => (l.uid === u ? { ...l, crear: { ...l.crear, [campo]: val } } : l)));
  const marcarAlta = (l) => setLineas((ls) => ls.map((x) => (x.uid === l.uid
    ? { ...x, crear: { nombre: (x.desc || "").replace(/\s+/g, " ").trim(), precio: "", barcode: "", categoria: "" } } : x)));
  const altaTodos = () => setLineas((ls) => ls.map((x) => (!x.pid && !x.crear
    ? { ...x, crear: { nombre: (x.desc || "").replace(/\s+/g, " ").trim(), precio: "", barcode: "", categoria: "" } } : x)));
  const quitar = (u) => setLineas((ls) => ls.filter((l) => l.uid !== u));
  const sugerido = (l) => Math.round(Number(l.costo) / (1 - l.margenAnterior) / 10) * 10;

  const total = lineas.reduce((s2, l) => s2 + Number(l.cant) * Number(l.costo), 0);
  const sinResolver = lineas.filter((l) => !l.pid && !l.crear).length;
  const porCrear = lineas.filter((l) => !l.pid && l.crear);

  const leerFoto = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      return setErrorFoto("El archivo tiene que ser una foto (jpg, png o webp).");
    }
    setLeyendo(true); setErrorFoto(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = () => rej(new Error("No se pudo leer el archivo"));
        r.readAsDataURL(file);
      });
      const r = await fetch(`${API_BASE}/v1/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: API_MODELO, max_tokens: 2000,
          system: "Leés remitos y facturas de compra de comercios argentinos y devolvés únicamente JSON válido, sin markdown ni explicaciones. Nunca inventás renglones: si algo no se lee, ponés null.",
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: file.type, data: b64 } },
            { type: "text", text: 'Devolvé exactamente este formato: {"proveedor": string|null, "cuit": string|null, "comprobante": string|null, "items": [{"descripcion": string, "codigo": string|null, "cantidad": number, "costoUnitario": number|null}]}. costoUnitario es el precio unitario de compra tal como figura. Si el remito no trae precios, dejá costoUnitario en null.' },
          ] }],
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message || "Error de la API");
      const txt = (data.content || []).map((c) => c.text || "").join("").trim().replace(/```json|```/g, "").trim();
      const leido = JSON.parse(txt);
      const items = Array.isArray(leido.items) ? leido.items : [];
      if (!items.length) throw new Error("No se reconoció ningún renglón en la foto.");
      if (leido.comprobante) setComprobante(String(leido.comprobante));

      // Proveedor: si no lo tenemos, se crea con lo que traiga el remito.
      const nomProv = String(leido.proveedor || "").trim();
      let provNuevo = null;
      if (nomProv) {
        const clave = (t) => palabras(t).join(" ");
        const existente = Object.keys(provs).find((x) => clave(x) === clave(nomProv));
        if (existente) setProv(existente);
        else {
          setProvs((v) => ({ ...v, [nomProv]: { pago: "", entrega: "", tel: "", cuit: leido.cuit || "" } }));
          setProv(nomProv);
          provNuevo = nomProv;
        }
      }
      setAvisoProv(provNuevo);
      const nuevas = items.map((it) => {
        const { p, conf } = emparejar(it.descripcion, it.codigo, productos);
        const cant = Number(it.cantidad) || 1;
        const costo = it.costoUnitario != null ? Math.round(Number(it.costoUnitario)) : null;
        if (p && conf >= 0.5) {
          const margen = (p.precio - p.costo) / p.precio;
          return { uid: uid(), pid: p.id, nombre: p.nombre, barcode: p.barcode, unidad: p.unidad,
            cant, costo: costo != null ? costo : p.costo, costoAnterior: p.costo, precioAnterior: p.precio,
            precio: p.precio, margenAnterior: margen, origen: "foto", desc: it.descripcion, conf };
        }
        return { uid: uid(), pid: null, nombre: null, cant, costo, desc: it.descripcion, origen: "foto", conf, sugerencia: p };
      });
      setLineas((ls) => [...ls, ...nuevas]);
      const ok = nuevas.filter((l) => l.pid).length;
      toast(`Leí ${items.length} renglones: ${ok} reconocidos, ${items.length - ok} para dar de alta.`);
    } catch (e) {
      setErrorFoto(`No pude leer el remito: ${e.message}. Podés cargarlo con la pistola mientras tanto.`);
    }
    setLeyendo(false);
  };

  const confirmar = () => {
    const validas = lineas.filter((l) => (l.pid || l.crear) && Number(l.cant) > 0);
    if (!validas.length) return;
    const altas = validas.filter((l) => !l.pid && l.crear);

    setProductos((ps) => {
      let acc = [...ps];
      const mapa = {};
      for (const l of altas) {
        const p = productoNuevo({
          nombre: l.crear.nombre, costo: l.costo, precio: l.crear.precio,
          categoria: l.crear.categoria, barcode: l.crear.barcode, proveedor: prov, bulto: 1,
        }, acc);
        acc = [...acc, p];
        mapa[l.uid] = p.id;
      }
      return acc.map((p) => {
        const l = validas.find((x) => (x.pid || mapa[x.uid]) === p.id);
        if (!l) return p;
        const costo = Number(l.costo) || p.costo;
        const precio = Number(l.pid ? l.precio : l.crear.precio) || p.precio;
        return {
          ...p,
          stock: +(p.stock + Number(l.cant)).toFixed(3),
          costo, precio,
          historial: costo !== p.costo ? [...p.historial, { fecha: HOY, costo }] : p.historial,
        };
      });
    });

    if (pagado) movCaja({ tipo: "egreso", medio: "efectivo", monto: total, detalle: `Compra ${comprobante || "s/nro"} · ${prov}` });
    const incompletas = altas.filter((l) => !Number(l.crear.precio)).length;
    const partes = [`${validas.length} productos ingresados por ${money(total)}`];
    if (altas.length) partes.push(`${altas.length} dados de alta`);
    if (incompletas) partes.push(`${incompletas} sin precio de venta`);
    toast(partes.join(" · ") + ".", incompletas ? "mal" : "ok");
    setLineas([]); setComprobante(""); setPagado(false); setAvisoProv(null);
  };

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const candidatos = q.trim().length >= 2
    ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || p.barcode.includes(q.trim())).slice(0, 8) : [];

  return (
    <div className="p-4 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-stone-200 rounded-xl p-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><ScanLine size={16} className="text-orange-500" /> Con la pistola</div>
          <p className="text-sm text-stone-500 mt-1">Disparale a cada producto del bulto. Trae el costo que tenía cargado y lo podés corregir si el proveedor aumentó.</p>
          <p className="f-m text-[11px] text-stone-400 mt-2">Lector activo · esperando disparo</p>
        </div>
        <div className="border border-stone-200 rounded-xl p-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><Camera size={16} className="text-orange-500" /> Desde una foto del remito</div>
          <p className="text-sm text-stone-500 mt-1">Sacale una foto al remito o la factura. Se leen los renglones y quedan acá abajo para que los revises antes de aplicar nada.</p>
          <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={(e) => { leerFoto(e.target.files[0]); e.target.value = ""; }} />
          <Boton variant="ghost" size="sm" className="mt-2" onClick={() => archivo.current && archivo.current.click()} disabled={leyendo}>
            {leyendo ? <><Loader2 size={15} className="animate-spin" /> Leyendo el remito…</> : <><Upload size={15} /> Subir foto</>}
          </Boton>
        </div>
      </div>

      {errorFoto && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{errorFoto}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <select value={prov} onChange={(e) => setProv(e.target.value)} className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-orange-400">
          {Object.keys(provs).map((p) => <option key={p}>{p}</option>)}
        </select>
        <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="Nº de remito o factura"
          className="text-sm border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-orange-400" />
        <span className="text-xs text-stone-400">{(provs[prov] || {}).pago}</span>
      </div>

      {lineas.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-2xl py-12 text-center">
          <FileImage size={26} className="mx-auto text-stone-300" />
          <p className="text-sm text-stone-400 mt-2">Escaneá el primer producto o subí la foto del remito</p>
        </div>
      ) : (
        <>
          {avisoProv && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <strong>{avisoProv}</strong> no estaba cargado y lo di de alta con lo que traía el remito.
              Le faltan <strong>{faltantesProveedor(provs[avisoProv]).join(", ")}</strong>: completalo en la pestaña Proveedores.
            </div>
          )}
          {sinResolver > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <span className="flex-1">
                {sinResolver} renglones no están en el catálogo. Podés darlos de alta con los datos del remito, buscarlos a mano o quitarlos.
                No se aplica nada hasta que confirmes.
              </span>
              <Boton size="sm" onClick={altaTodos}><Plus size={14} /> Dar de alta los {sinResolver}</Boton>
            </div>
          )}
          {porCrear.length > 0 && (
            <div className="text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-3">
              {porCrear.length} productos nuevos se van a crear al confirmar. Los que queden sin precio de venta no se van a poder cobrar
              y van a aparecer en el aviso de fichas incompletas.
            </div>
          )}
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200">
                  <th className="py-2 font-semibold">Producto</th>
                  <th className="py-2 font-semibold text-right w-20">Cant.</th>
                  <th className="py-2 font-semibold text-right w-28">Costo</th>
                  <th className="py-2 font-semibold text-right w-32">Precio de venta</th>
                  <th className="py-2 font-semibold text-right w-28">Margen</th>
                  <th className="py-2 font-semibold text-right w-24">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lineas.map((l) => {
                  if (!l.pid && l.crear) return (
                    <tr key={l.uid} className="bg-orange-50/40">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-orange-100 text-orange-800 border-orange-200">nuevo</span>
                          <input value={l.crear.nombre} onChange={(e) => setCrear(l.uid, "nombre", e.target.value)}
                            className="flex-1 border border-stone-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400" />
                        </div>
                        <div className="flex gap-1.5 mt-1">
                          <input value={l.crear.barcode} onChange={(e) => setCrear(l.uid, "barcode", e.target.value.replace(/\D/g, ""))}
                            placeholder="código (opcional)" className="f-m w-40 border border-stone-200 rounded-lg px-2 py-0.5 text-[11px] outline-none focus:border-orange-400" />
                          <input value={l.crear.categoria} onChange={(e) => setCrear(l.uid, "categoria", e.target.value)}
                            placeholder="rubro" className="w-32 border border-stone-200 rounded-lg px-2 py-0.5 text-[11px] outline-none focus:border-orange-400" />
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.cant} onChange={(e) => set(l.uid, "cant", e.target.value.replace(/[^\d.]/g, ""))}
                          className="f-m w-14 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.costo || ""} onChange={(e) => set(l.uid, "costo", e.target.value.replace(/\D/g, ""))}
                          className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.crear.precio} onChange={(e) => setCrear(l.uid, "precio", e.target.value.replace(/\D/g, ""))}
                          placeholder="sin precio" className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                        {Number(l.costo) > 0 && !Number(l.crear.precio) && (
                          <button onClick={() => setCrear(l.uid, "precio", String(Math.round(Number(l.costo) / 0.7 / 10) * 10))}
                            className="block ml-auto text-[10px] font-semibold text-orange-600 hover:underline mt-0.5">
                            poner {money(Math.round(Number(l.costo) / 0.7 / 10) * 10)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right f-m text-xs">
                        {Number(l.crear.precio) > 0
                          ? <span className="text-emerald-600">{pct((Number(l.crear.precio) - Number(l.costo)) / Number(l.crear.precio), 0)}</span>
                          : <span className="text-amber-600">falta precio</span>}
                      </td>
                      <td className="py-2 text-right f-m">{money(Number(l.cant) * Number(l.costo || 0))}</td>
                      <td className="py-2 text-right"><button onClick={() => quitar(l.uid)} className="text-stone-300 hover:text-red-600"><Trash2 size={15} /></button></td>
                    </tr>
                  );
                  if (!l.pid) return (
                    <tr key={l.uid} className="bg-amber-50/50">
                      <td className="py-2 pr-2" colSpan={5}>
                        <div className="text-xs text-stone-500">Del remito: <span className="f-m text-stone-800">{l.desc}</span> · {l.cant} u {l.costo ? `· ${money(l.costo)}` : ""}</div>
                        <div className="flex gap-1.5 mt-1.5">
                          <Boton size="sm" variant="ghost" onClick={() => { setBuscando(l.uid); setQ(l.sugerencia ? l.sugerencia.nombre.split(" ").slice(0, 2).join(" ") : ""); }}>
                            <Search size={13} /> Buscarlo en el catálogo
                          </Boton>
                          <Boton size="sm" onClick={() => marcarAlta(l)}><Plus size={13} /> Darlo de alta</Boton>
                        </div>
                      </td>
                      <td className="py-2 text-right f-m text-stone-400">—</td>
                      <td className="py-2 text-right"><button onClick={() => quitar(l.uid)} className="text-stone-300 hover:text-red-600"><Trash2 size={15} /></button></td>
                    </tr>
                  );
                  const dif = Number(l.costo) / l.costoAnterior - 1;
                  const mNuevo = (Number(l.precio) - Number(l.costo)) / Number(l.precio);
                  const sug = sugerido(l);
                  return (
                    <tr key={l.uid} className="hover:bg-stone-50">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{l.nombre}</div>
                        {l.origen === "foto" && <div className="text-[10px] text-stone-400">Remito: {l.desc} · coincidencia {pct(l.conf, 0)}</div>}
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.cant} onChange={(e) => set(l.uid, "cant", e.target.value.replace(/[^\d.]/g, ""))}
                          className="f-m w-14 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.costo} onChange={(e) => set(l.uid, "costo", e.target.value.replace(/\D/g, ""))}
                          className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                        {Math.abs(dif) > 0.005 && <div className={`text-[10px] ${dif > 0 ? "text-red-500" : "text-emerald-600"}`}>{dif > 0 ? "+" : ""}{pct(dif, 0)} vs. {money(l.costoAnterior)}</div>}
                      </td>
                      <td className="py-2 text-right">
                        <input value={l.precio} onChange={(e) => set(l.uid, "precio", e.target.value.replace(/\D/g, ""))}
                          className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                        {sug !== Number(l.precio) && (
                          <button onClick={() => set(l.uid, "precio", sug)} className="block ml-auto text-[10px] font-semibold text-orange-600 hover:underline mt-0.5">
                            poner {money(sug)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right f-m text-xs">
                        <span className="text-stone-400">{pct(l.margenAnterior, 0)}</span>
                        <span className="text-stone-300 mx-1">→</span>
                        <span className={mNuevo < l.margenAnterior - 0.005 ? "text-red-600 font-semibold" : "text-emerald-600"}>{pct(mNuevo, 0)}</span>
                      </td>
                      <td className="py-2 text-right f-m">{money(Number(l.cant) * Number(l.costo))}</td>
                      <td className="py-2 text-right"><button onClick={() => quitar(l.uid)} className="text-stone-300 hover:text-red-600"><Trash2 size={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} className="w-4 h-4 accent-orange-500" />
              Lo pagué en efectivo · {money(total)} sale de caja
            </label>
            <div className="flex items-center gap-3">
              <div className="text-right"><div className="text-[11px] text-stone-400">Total de la compra</div><div className="f-d text-xl">{money(total)}</div></div>
              <Boton onClick={confirmar} disabled={!lineas.some((l) => l.pid || l.crear)}><Check size={16} /> Confirmar compra</Boton>
            </div>
          </div>
        </>
      )}

      <Modal open={!!buscando} onClose={() => setBuscando(null)} ancho="max-w-md">
        <div className="p-5">
          <h3 className="f-d text-lg">¿A qué producto corresponde?</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            {buscando && lineas.find((l) => l.uid === buscando) ? lineas.find((l) => l.uid === buscando).desc : ""}
          </p>
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Buscar en el catálogo"
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mt-3 outline-none focus:border-orange-400" />
          <ul className="mt-2 border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-72 overflow-auto">
            {candidatos.map((p) => (
              <li key={p.id}>
                <button className="w-full text-left px-3 py-2 hover:bg-stone-50" onClick={() => {
                  const l = lineas.find((x) => x.uid === buscando);
                  const margen = (p.precio - p.costo) / p.precio;
                  setLineas((ls) => ls.map((x) => (x.uid === buscando ? {
                    ...x, pid: p.id, nombre: p.nombre, barcode: p.barcode, unidad: p.unidad,
                    costo: x.costo != null ? x.costo : p.costo, costoAnterior: p.costo,
                    precio: p.precio, precioAnterior: p.precio, margenAnterior: margen, conf: 1,
                  } : x)));
                  setBuscando(null); setQ("");
                }}>
                  <div className="text-sm">{p.nombre}</div>
                  <div className="f-m text-[11px] text-stone-400">{p.barcode} · costo {money(p.costo)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}

function Compras({ productos, setProductos, k, pedidos, setPedidos, movCaja, toast, cobertura, provs, setProvs }) {
  const [altaProv, setAltaProv] = useState(null);
  const [prov, setProv] = useState(Object.keys(provs)[0]);
  const [sel, setSel] = useState({});
  const [recibiendo, setRecibiendo] = useState(null);
  const [tab, setTab] = useState("cargar");

  const sugeridos = useMemo(() => k.sugeridos.filter((s) => s.p.proveedor === prov), [k.sugeridos, prov]);
  const forzar = useRef(null);
  useEffect(() => {
    const inicial = {};
    sugeridos.forEach((s) => { if (s.cobertura < 10) inicial[s.p.id] = s.cant; });
    if (forzar.current) { inicial[forzar.current.pid] = forzar.current.cant; forzar.current = null; }
    setSel(inicial);
  }, [prov]);

  useScanHandler((cod) => {
    const item = k.sugeridos.find((x) => x.p.barcode === cod);
    if (!item) {
      const p = productos.find((x) => x.barcode === cod);
      beep(false, true);
      return toast(p ? `${p.nombre} está cubierto: no hace falta pedirlo.` : `El código ${cod} no está en el catálogo.`, "mal");
    }
    beep(true, true);
    if (item.p.proveedor !== prov) {
      forzar.current = { pid: item.p.id, cant: item.cant };
      setProv(item.p.proveedor);
      toast(`${item.p.nombre} · cambié al pedido de ${item.p.proveedor}.`);
    } else {
      setSel((x) => ({ ...x, [item.p.id]: (x[item.p.id] || 0) + item.p.bulto }));
    }
  }, tab === "sugerido");

  const totalPedido = sugeridos.reduce((s, x) => s + (sel[x.p.id] ? sel[x.p.id] * x.p.costo : 0), 0);
  const lineas = sugeridos.filter((s) => sel[s.p.id] > 0);

  const generar = () => {
    if (!lineas.length) return;
    const ped = {
      id: uid(), nro: `OC-${String(1200 + pedidos.length + 1)}`, prov, fecha: HOY, estado: "pendiente",
      items: lineas.map((l) => ({ pid: l.p.id, nombre: l.p.nombre, barcode: l.p.barcode, cant: sel[l.p.id], costo: l.p.costo })),
      total: totalPedido,
    };
    setPedidos((ps) => [ped, ...ps]);
    setSel({}); setTab("pedidos");
    toast(`Pedido ${ped.nro} generado para ${prov}.`);
  };

  const recibir = (ped, lineasRec) => {
    setProductos((ps) => ps.map((p) => {
      const l = lineasRec.find((x) => x.pid === p.id);
      if (!l) return p;
      const nuevoCosto = Number(l.costo) || p.costo;
      const hist = nuevoCosto !== p.costo ? [...p.historial, { fecha: HOY, costo: nuevoCosto }] : p.historial;
      return { ...p, stock: +(p.stock + Number(l.cant)).toFixed(2), costo: nuevoCosto, historial: hist };
    }));
    const total = lineasRec.reduce((s, l) => s + Number(l.cant) * Number(l.costo), 0);
    const contado = (provs[ped.prov] || {}).pago === "Contado";
    if (contado) movCaja({ tipo: "egreso", medio: "efectivo", monto: total, detalle: `Compra ${ped.nro} · ${ped.prov}` });
    setPedidos((ps) => ps.map((x) => (x.id === ped.id ? { ...x, estado: "recibido", total } : x)));
    setRecibiendo(null);
    toast(contado ? `Mercadería recibida y ${money(total)} pagados de caja.` : `Mercadería recibida. ${money(total)} quedan en cuenta corriente.`);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-4 pt-2">
          <Tabs items={[{ k: "cargar", n: "Cargar compra" }, { k: "sugerido", n: "Pedido sugerido" }, { k: "pedidos", n: "Órdenes de compra", badge: pedidos.length }, { k: "prov", n: "Proveedores" }]} value={tab} onChange={setTab} />
        </div>

        {tab === "cargar" && <CargarCompra productos={productos} setProductos={setProductos} movCaja={movCaja} toast={toast} provs={provs} setProvs={setProvs} />}

        {tab === "sugerido" && (
          <div>
            <div className="p-4 flex flex-wrap items-center gap-3 border-b border-stone-100">
              <select value={prov} onChange={(e) => setProv(e.target.value)} className="text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-orange-400">
                {Object.keys(provs).map((p) => <option key={p}>{p}</option>)}
              </select>
              <span className="text-xs text-stone-500">
                {(provs[prov] || {}).pago} · entrega {(provs[prov] || {}).entrega} · {(provs[prov] || {}).tel}
              </span>
              <span className="text-xs text-stone-400 ml-auto">Cobertura objetivo: {cobertura} días</span>
            </div>
            {sugeridos.length === 0 ? (
              <Vacio>Con este proveedor estás cubierto. No hace falta pedir nada.</Vacio>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200">
                        <th className="pl-4 py-2.5 w-8"></th>
                        <th className="px-2 py-2.5 font-semibold">Producto</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Tenés</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Vende/día</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Alcanza</th>
                        <th className="px-2 py-2.5 font-semibold text-right w-28">Pedir</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sugeridos.slice(0, 40).map(({ p, cant, cobertura: cob }) => (
                        <tr key={p.id} className={sel[p.id] ? "bg-orange-50/40" : "hover:bg-stone-50"}>
                          <td className="pl-4 py-2">
                            <input type="checkbox" checked={!!sel[p.id]} onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked ? cant : 0 }))}
                              className="w-4 h-4 accent-orange-500" />
                          </td>
                          <td className="px-2 py-2"><div className="font-medium">{p.nombre}</div><div className="text-[11px] text-stone-400">bulto de {p.bulto}</div></td>
                          <td className="px-2 py-2 text-right f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</td>
                          <td className="px-2 py-2 text-right f-m text-stone-500">{p.vel.toFixed(1)}</td>
                          <td className="px-2 py-2 text-right f-m"><span className={cob < 4 ? "text-red-600 font-semibold" : "text-stone-500"}>{Math.round(cob)} d</span></td>
                          <td className="px-2 py-2 text-right">
                            <input value={sel[p.id] || ""} onChange={(e) => setSel((s) => ({ ...s, [p.id]: Number(e.target.value.replace(/\D/g, "")) }))}
                              placeholder={String(cant)} className="f-m w-20 text-right border border-stone-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400" />
                          </td>
                          <td className="px-4 py-2 text-right f-m">{money((sel[p.id] || 0) * p.costo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-stone-200 bg-stone-50">
                  <div className="text-sm">
                    <span className="text-stone-500">{lineas.length} productos · </span>
                    <span className="f-d text-xl">{money(totalPedido)}</span>
                  </div>
                  <Boton onClick={generar} disabled={!lineas.length}>Generar orden de compra <ArrowRight size={15} /></Boton>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "pedidos" && (
          pedidos.length === 0 ? <Vacio>Todavía no generaste ninguna orden. Empezá por el pedido sugerido.</Vacio> : (
            <ul className="divide-y divide-stone-100">
              {pedidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{p.nro} · {p.prov}</div>
                    <div className="text-xs text-stone-500">{p.items.length} productos · {fdatel(p.fecha)} · {(provs[p.prov] || {}).pago}</div>
                  </div>
                  <span className="f-m text-sm">{money(p.total)}</span>
                  {p.estado === "pendiente"
                    ? <Boton size="sm" onClick={() => setRecibiendo(p)}>Recibir mercadería</Boton>
                    : <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">Recibido</span>}
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "prov" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-stone-500">
                {Object.entries(provs).filter(([, i]) => faltantesProveedor(i).length).length} de {Object.keys(provs).length} fichas necesitan datos.
              </p>
              <Boton size="sm" onClick={() => setAltaProv({})}><Plus size={14} /> Nuevo proveedor</Boton>
            </div>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(provs).map(([n, i]) => {
              const ps = productos.filter((p) => p.proveedor === n);
              const subas = ps.filter((p) => p.costo > p.costoPrev * 1.005);
              const impacto = subas.reduce((s, p) => s + (p.costo - p.costoPrev) * p.u30, 0);
              const subaProm = subas.length ? subas.reduce((s, p) => s + (p.costo / p.costoPrev - 1), 0) / subas.length : 0;
              const faltan = faltantesProveedor(i);
                return (
                <div key={n} className={`border rounded-xl p-4 ${faltan.length ? "border-amber-300 bg-amber-50/40" : "border-stone-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {n}
                        {faltan.length > 0 && <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300">incompleta</span>}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">{[i.pago, i.entrega && `entrega ${i.entrega}`, i.tel, i.cuit].filter(Boolean).join(" · ") || "Sin datos cargados"}</div>
                    </div>
                    <Boton size="sm" variant="quiet" onClick={() => setAltaProv({ ...i, nombre: n, nombreOriginal: n })}>Editar</Boton>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div><div className="f-m text-base">{ps.length}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Productos</div></div>
                    <div><div className="f-m text-base">{moneyk(ps.reduce((s, p) => s + p.costo * p.u30, 0))}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Compra/mes</div></div>
                    <div><div className={`f-m text-base ${subaProm > 0.06 ? "text-red-600" : ""}`}>{subaProm ? "+" + pct(subaProm, 0) : "—"}</div><div className="text-[10px] uppercase tracking-wider text-stone-400">Suba prom.</div></div>
                  </div>
                  {subas.length > 0 && (
                    <p className="text-xs text-stone-600 mt-3 border-t border-stone-100 pt-2.5">
                      Aumentó {subas.length} productos en los últimos 30 días. Te cuesta <strong>{money(impacto)}</strong> al mes si no tocás precios.
                    </p>
                  )}
                  {faltan.length > 0 && (
                    <p className="text-xs text-amber-800 mt-3 border-t border-amber-200 pt-2.5">Falta cargar: <strong>{faltan.join(", ")}</strong>.</p>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}
      </Card>

      <FormProveedor abierto={!!altaProv} inicial={altaProv} onClose={() => setAltaProv(null)}
        onGuardar={(d) => {
          const nombre = d.nombre.trim();
          setProvs((v) => {
            const n = { ...v };
            if (d.nombreOriginal && d.nombreOriginal !== nombre) delete n[d.nombreOriginal];
            n[nombre] = { pago: d.pago || "", entrega: d.entrega || "", tel: d.tel || "", cuit: d.cuit || "" };
            return n;
          });
          if (d.nombreOriginal && d.nombreOriginal !== nombre) {
            setProductos((ps) => ps.map((p) => (p.proveedor === d.nombreOriginal ? { ...p, proveedor: nombre } : p)));
          }
          setAltaProv(null);
          const f = faltantesProveedor(d);
          toast(f.length ? `${nombre} guardado. Falta ${f.join(", ")}.` : `${nombre} guardado.`);
        }} />

      {recibiendo && <RecepcionModal ped={recibiendo} onClose={() => setRecibiendo(null)} onConfirm={recibir} provs={provs} />}
    </div>
  );
}

function RecepcionModal({ ped, onClose, onConfirm, provs }) {
  const [lineas, setLineas] = useState(ped.items.map((i) => ({ ...i, cant: i.cant, costo: i.costo, ver: 0 })));
  const set = (pid, campo, val) => setLineas((ls) => ls.map((l) => (l.pid === pid ? { ...l, [campo]: val } : l)));
  useScanHandler((cod) => {
    const i = lineas.findIndex((l) => l.barcode === cod);
    if (i === -1) return beep(false, true);
    beep(true, true);
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ver: l.ver + 1 } : l)));
  }, true);
  const controlados = lineas.filter((l) => l.ver >= Number(l.cant)).length;
  const total = lineas.reduce((s, l) => s + Number(l.cant) * Number(l.costo), 0);
  const cambios = lineas.filter((l) => Number(l.costo) !== ped.items.find((i) => i.pid === l.pid).costo);

  return (
    <Modal open onClose={onClose} ancho="max-w-2xl">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">Recibir {ped.nro}</h3>
          <p className="text-xs text-stone-500">Disparale a cada bulto con la pistola: {controlados} de {lineas.length} renglones controlados.</p>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
      </div>
      <div className="p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200">
              <th className="py-2 font-semibold">Producto</th>
              <th className="py-2 font-semibold text-right w-28">Llegaron</th>
              <th className="py-2 font-semibold text-right w-28">Costo unit.</th>
              <th className="py-2 font-semibold text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lineas.map((l) => {
              const orig = ped.items.find((i) => i.pid === l.pid).costo;
              const dif = Number(l.costo) / orig - 1;
              return (
                <tr key={l.pid}>
                  <td className="py-2 pr-2">
                    <span className={`inline-flex items-center gap-1.5 ${l.ver >= Number(l.cant) ? "text-emerald-700 font-medium" : ""}`}>
                      {l.ver >= Number(l.cant) ? <Check size={14} /> : <span className="w-3.5" />}{l.nombre}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <input value={l.cant} onChange={(e) => set(l.pid, "cant", e.target.value.replace(/\D/g, ""))}
                      className="f-m w-16 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                    {l.ver > 0 && <div className="text-[10px] text-stone-400">{l.ver} leídos</div>}
                  </td>
                  <td className="py-2 text-right">
                    <input value={l.costo} onChange={(e) => set(l.pid, "costo", e.target.value.replace(/\D/g, ""))}
                      className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-orange-400" />
                    {Math.abs(dif) > 0.005 && <div className={`text-[10px] ${dif > 0 ? "text-red-500" : "text-emerald-600"}`}>{dif > 0 ? "+" : ""}{pct(dif, 0)}</div>}
                  </td>
                  <td className="py-2 text-right f-m">{money(Number(l.cant) * Number(l.costo))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cambios.length > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
            {cambios.length} productos llegan con otro costo. Al confirmar se actualiza el costo, el historial y el margen — y vas a ver el aviso de precios a revisar.
          </p>
        )}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          <div><span className="text-sm text-stone-500">Total a pagar </span><span className="f-d text-xl">{money(total)}</span>
            <div className="text-xs text-stone-400">{(provs[ped.prov] || {}).pago === "Contado" ? "Sale de caja al confirmar" : "Queda en cuenta corriente"}</div>
          </div>
          <Boton onClick={() => onConfirm(ped, lineas)}><Check size={15} /> Confirmar recepción</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   9 bis. PREPARAR PEDIDOS (picking con pistola)
   ============================================================ */

function Picking({ pedidos, setPedidos, productos, setProductos, cobrar, ajustes, toast }) {
  const [abierto, setAbierto] = useState(null);
  const ped = pedidos.find((p) => p.id === abierto);
  if (ped) {
    return <PrepararPedido ped={ped} setPedidos={setPedidos} productos={productos} setProductos={setProductos}
      cobrar={cobrar} ajustes={ajustes} toast={toast} volver={() => setAbierto(null)} />;
  }

  const nuevaVenta = () => {
    const nro = `V-${String(pedidos.filter((p) => p.libre).length + 1).padStart(3, "0")}`;
    const p = {
      id: uid(), nro, cliente: "Venta en el salón", tel: "", dir: "Retira en el local",
      canal: "Mostrador", entrega: "Retira",
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      nota: "", estado: "preparando", libre: true, items: [],
    };
    setPedidos((ps) => [p, ...ps]);
    setAbierto(p.id);
  };

  const chip = { pendiente: "bg-amber-50 text-amber-700 border-amber-200", preparando: "bg-blue-50 text-blue-700 border-blue-200", listo: "bg-emerald-50 text-emerald-700 border-emerald-200", entregado: "bg-stone-100 text-stone-500 border-stone-200" };
  const pend = pedidos.filter((p) => p.estado !== "entregado");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Pedidos por preparar" valor={nf.format(pedidos.filter((p) => p.estado === "pendiente").length)} />
        <Kpi label="En preparación" valor={nf.format(pedidos.filter((p) => p.estado === "preparando").length)} />
        <Kpi label="Listos para entregar" valor={nf.format(pedidos.filter((p) => p.estado === "listo").length)} tono="bien" />
        <Kpi label="A facturar" valor={money(pend.reduce((s, p) => s + p.items.reduce((a, l) => a + l.precio * l.pedido, 0), 0))} />
      </div>

      <Card className="p-4 border-orange-200 bg-orange-50/60">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0"><ScanLine size={20} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="f-d text-base">Armar una venta con la pistola</h3>
            <p className="text-sm text-stone-600">Recorré el salón cargando el changuito: escaneás, se arma la lista sola y cobrás al final. Sirve para pedidos por teléfono o para el cliente que espera en el mostrador.</p>
          </div>
          <Boton onClick={nuevaVenta}><Plus size={16} /> Empezar</Boton>
        </div>
      </Card>

      {pedidos.length === 0 ? <Vacio>No hay pedidos cargados.</Vacio> : (
        <div className="grid md:grid-cols-2 gap-3">
          {pedidos.map((p) => {
            const total = p.items.reduce((s, l) => s + l.precio * l.pedido, 0);
            const unid = p.items.reduce((s, l) => s + l.pedido, 0);
            const listas = p.items.filter((l) => l.preparado >= l.pedido || l.faltante > 0).length;
            return (
              <Card key={p.id} className="p-4 hover:border-stone-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="f-m text-xs text-stone-400">{p.nro}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${chip[p.estado]}`}>{p.estado}</span>
                    </div>
                    <h3 className="f-d text-base mt-1 truncate">{p.cliente}</h3>
                    <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                      {p.canal === "Teléfono" ? <Phone size={12} /> : <MessageCircle size={12} />} {p.canal} · {p.hora}
                      <span className="text-stone-300">·</span>
                      {p.entrega === "Envío" ? <Bike size={12} /> : <Store size={12} />} {p.entrega}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="f-d text-lg">{money(total)}</div>
                    <div className="text-[11px] text-stone-400">{p.items.length} productos · {nf.format(Math.round(unid))} u</div>
                  </div>
                </div>
                {p.nota && <p className="text-xs text-stone-500 bg-stone-50 rounded-lg px-2.5 py-1.5 mt-2.5">{p.nota}</p>}
                {p.estado !== "pendiente" && (
                  <div className="h-1.5 bg-stone-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(listas / p.items.length) * 100}%` }} />
                  </div>
                )}
                <Boton className="w-full mt-3" variant={p.estado === "listo" ? "ghost" : "primary"} onClick={() => setAbierto(p.id)}>
                  <ScanLine size={15} /> {p.estado === "pendiente" ? "Preparar con pistola" : p.estado === "preparando" ? "Seguir preparando" : "Ver y cobrar"}
                </Boton>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrepararPedido({ ped, setPedidos, productos, setProductos, cobrar, ajustes, toast, volver }) {
  const [items, setItems] = useState(ped.items.map((l) => ({ ...l })));
  const [ultimo, setUltimo] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [camara, setCamara] = useState(false);
  const libre = !!ped.libre;

  useEffect(() => {
    if (ped.estado === "pendiente") setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, estado: "preparando" } : p)));
  }, []);

  const guardar = (nuevos, estado) => {
    setItems(nuevos);
    setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, items: nuevos, ...(estado ? { estado } : {}) } : p)));
  };

  const registrar = (codigo) => {
    setError(null);
    const i = items.findIndex((l) => l.barcode === codigo);

    // Venta libre: la lista no existe de antemano, se arma con cada disparo.
    if (libre) {
      const p = productos.find((x) => x.barcode === codigo);
      if (!p) {
        beep(false, ajustes.sonido);
        setError({ msg: `Código ${codigo} desconocido.` });
        setUltimo(null);
        return;
      }
      const paso = p.unidad === "kg" ? 0.25 : 1;
      const nuevos = i === -1
        ? [...items, { pid: p.id, nombre: p.nombre, barcode: p.barcode, precio: p.precio, unidad: p.unidad, pedido: paso, preparado: paso, faltante: 0 }]
        : items.map((l, j) => (j === i ? { ...l, pedido: +(l.pedido + paso).toFixed(3), preparado: +(l.preparado + paso).toFixed(3) } : l));
      const linea = i === -1 ? nuevos[nuevos.length - 1] : nuevos[i];
      beep(true, ajustes.sonido);
      guardar(nuevos);
      setUltimo({
        pid: p.id, nombre: p.nombre, preparado: linea.preparado, pedido: linea.preparado, unidad: p.unidad,
        precio: p.precio,
        aviso: linea.preparado > p.stock ? `En sistema figuran ${p.unidad === "kg" ? p.stock.toFixed(1) : p.stock} ${p.unidad}` : null,
      });
      return;
    }

    if (i === -1) {
      const p = productos.find((x) => x.barcode === codigo);
      beep(false, ajustes.sonido);
      setError(p ? { msg: `${p.nombre} no está en este pedido.`, extra: p } : { msg: `Código ${codigo} desconocido.` });
      setUltimo(null);
      return;
    }
    const l = items[i];
    const paso = l.unidad === "kg" ? 0.25 : 1;
    if (l.preparado + paso > l.pedido + 0.001) {
      beep(false, ajustes.sonido);
      setError({ msg: `${l.nombre}: ya escaneaste las ${l.unidad === "kg" ? l.pedido.toFixed(2) + " kg" : l.pedido + " unidades"} del pedido.` });
      return;
    }
    const nuevos = [...items];
    nuevos[i] = { ...l, preparado: +(l.preparado + paso).toFixed(3), faltante: 0 };
    beep(true, ajustes.sonido);
    guardar(nuevos);
    setUltimo({ pid: l.pid, nombre: l.nombre, preparado: nuevos[i].preparado, pedido: l.pedido, unidad: l.unidad });
  };

  useScanHandler(registrar, !cerrando && !ticket && !camara);

  const agregarExtra = (p) => {
    const nuevos = [...items, { pid: p.id, nombre: p.nombre, barcode: p.barcode, precio: p.precio, unidad: p.unidad, pedido: 1, preparado: 1, faltante: 0, extra: true }];
    guardar(nuevos); setError(null); setUltimo({ pid: p.id, nombre: p.nombre, preparado: 1, pedido: 1, unidad: p.unidad });
    beep(true, ajustes.sonido);
    toast(`${p.nombre} agregado al pedido.`);
  };

  const setCant = (pid, v) => {
    const n = Math.max(0, +v.toFixed(3));
    if (libre && n === 0) return guardar(items.filter((l) => l.pid !== pid));
    guardar(items.map((l) => (l.pid === pid ? { ...l, preparado: n, faltante: 0, ...(libre ? { pedido: n } : {}) } : l)));
  };
  const quitar = (pid) => guardar(items.filter((l) => l.pid !== pid));
  const marcarFaltante = (pid) => guardar(items.map((l) => (l.pid === pid ? { ...l, faltante: +(l.pedido - l.preparado).toFixed(3) } : l)));

  const conPrecio = items.map((l) => {
    const p = productos.find((x) => x.id === l.pid);
    const { precio, lista } = precioAplicado(l.precio, p ? p.precio2 : null, l.preparado, ajustes);
    return { ...l, unit: precio, lista };
  });
  const totalPedido = items.reduce((s, l) => s + l.pedido, 0);
  const totalPrep = items.reduce((s, l) => s + l.preparado, 0);
  const resueltos = items.filter((l) => l.preparado >= l.pedido - 0.001 || l.faltante > 0).length;
  const monto = conPrecio.reduce((s, l) => s + l.unit * l.preparado, 0);
  const faltantes = items.filter((l) => l.faltante > 0);
  const completo = resueltos === items.length;

  const cantidadPendiente = ultimo && ultimo.pid && items.some((l) => l.pid === ultimo.pid) && esCantidad(q) && q.trim() !== "";

  const aplicarCantidad = () => {
    const n = aNumero(q);
    const l = items.find((x) => x.pid === ultimo.pid);
    if (!(n > 0) || !l) return;
    setCant(ultimo.pid, libre ? n : Math.min(n, l.pedido));
    setUltimo({ ...ultimo, preparado: libre ? n : Math.min(n, l.pedido) });
    beep(true, ajustes.sonido);
    setQ("");
  };

  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const busq = !cantidadPendiente && q.trim().length >= 2 ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || p.barcode.includes(q.trim())).slice(0, 6) : [];

  const cobrarPedido = (medio) => {
    const lineas = conPrecio.filter((l) => l.preparado > 0).map((l) => {
      const p = productos.find((x) => x.id === l.pid);
      return { pid: l.pid, qty: l.preparado, precio: l.unit, costo: p ? p.costo : 0, nombre: l.nombre, unidad: l.unidad, lista: l.lista };
    });
    const t = cobrar({ items: lineas, sub: monto, desc: 0, total: monto, medio, ganancia: monto - lineas.reduce((s, l) => s + l.costo * l.qty, 0) });
    setProductos((ps) => ps.map((p) => {
      const l = lineas.find((x) => x.pid === p.id);
      return l ? { ...p, stock: +(p.stock - l.qty).toFixed(3), ultimaVenta: HOY, u30: p.u30 + l.qty } : p;
    }));
    setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, items, estado: "entregado" } : p)));
    setCerrando(false);
    setTicket(t);
  };

  const W = ajustes.ancho === 58 ? 32 : 48;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton variant="quiet" size="sm" onClick={volver}><ChevronLeft size={15} /> Todos los pedidos</Boton>
        <div className="flex-1 min-w-0">
          {libre ? (
            <>
              <div className="f-d text-lg">{ped.nro} · Venta con pistola</div>
              <input value={ped.cliente === "Venta en el salón" ? "" : ped.cliente}
                onChange={(e) => setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, cliente: e.target.value || "Venta en el salón" } : p)))}
                placeholder="Cliente (opcional)"
                className="text-xs text-stone-600 border border-stone-200 rounded-lg px-2 py-1 mt-1 outline-none focus:border-orange-400 w-56" />
            </>
          ) : (
            <>
              <div className="f-d text-lg">{ped.nro} · {ped.cliente}</div>
              <div className="text-xs text-stone-500">{ped.entrega} · {ped.dir} · {ped.tel}</div>
            </>
          )}
        </div>
        <div className="text-right">
          <div className="f-d text-xl">{money(monto)}</div>
          <div className="text-[11px] text-stone-400">{libre ? `${items.length} renglones · ${nf.format(Math.round(totalPrep))} u` : `${resueltos} de ${items.length} renglones`}</div>
        </div>
      </div>

      {/* Zona de escaneo */}
      <div className={`rounded-2xl p-5 text-center transition-colors ${error ? "bg-red-600" : ultimo ? "bg-emerald-600" : "bg-stone-900"}`}>
        <div className="flex items-center justify-center gap-2 text-white/70 text-[11px] uppercase tracking-widest font-semibold">
          <ScanLine size={14} /> {libre ? "Pistola activa · cargá el changuito" : "Pistola activa · dispará sobre el producto"}
        </div>
        <button onClick={() => setCamara(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 active:bg-white/25 border border-white/25 rounded-xl px-3 py-1.5">
          <Cam size={14} /> Usar la cámara
        </button>
        {error ? (
          <>
            <div className="f-d text-white text-xl mt-2">{error.msg}</div>
            {error.extra && <Boton size="sm" variant="ghost" className="mt-3" onClick={() => agregarExtra(error.extra)}>Agregarlo igual al pedido</Boton>}
          </>
        ) : ultimo ? (
          <>
            <div className="f-d text-white text-xl mt-2">{ultimo.nombre}</div>
            <div className="f-m text-white/80 text-sm mt-1">
              {libre
                ? `${ultimo.unidad === "kg" ? ultimo.preparado.toFixed(2) + " kg" : ultimo.preparado + " u"} · ${money(ultimo.precio * ultimo.preparado)}`
                : ultimo.unidad === "kg" ? `${ultimo.preparado.toFixed(2)} de ${ultimo.pedido.toFixed(2)} kg` : `${ultimo.preparado} de ${ultimo.pedido} unidades`}
            </div>
            {ultimo.aviso && <div className="text-white/70 text-xs mt-1">{ultimo.aviso}</div>}
          </>
        ) : (
          <div className="f-d text-white text-xl mt-2">{libre ? "Escaneá el primer producto" : "Esperando el primer disparo"}</div>
        )}
        {libre ? (
          <div className="f-m text-white/70 text-sm mt-4">{nf.format(Math.round(totalPrep))} unidades · {money(monto)}</div>
        ) : (
          <>
            <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden max-w-md mx-auto">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${totalPedido ? (totalPrep / totalPedido) * 100 : 0}%` }} />
            </div>
            <div className="f-m text-white/70 text-xs mt-1.5">{Math.round(totalPrep)} de {Math.round(totalPedido)} unidades</div>
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {libre && items.length === 0 && <Vacio>El changuito está vacío. Disparale al primer producto o buscalo abajo.</Vacio>}
        <ul className="divide-y divide-stone-100">
          {items.map((l) => {
            const ok = l.preparado >= l.pedido - 0.001;
            const falt = l.faltante > 0;
            return (
              <li key={l.pid} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${ok ? "bg-emerald-50/40" : falt ? "bg-red-50/40" : ""}`}>
                <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${libre ? "bg-stone-900 text-white" : ok ? "bg-emerald-500 text-white" : falt ? "bg-red-500 text-white" : "bg-stone-100 text-stone-400"}`}>
                  {libre ? <span className="f-m text-[11px]">{l.unidad === "kg" ? l.preparado.toFixed(1) : l.preparado}</span>
                    : ok ? <Check size={15} /> : falt ? <X size={15} /> : <span className="f-m text-[11px]">{l.unidad === "kg" ? l.pedido.toFixed(1) : l.pedido}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-stone-900 truncate">{l.nombre} {l.extra && <span className="text-[10px] text-orange-600 font-bold">AGREGADO</span>}</div>
                  <div className="f-m text-[11px] text-stone-400">{l.barcode} · {money(l.precio)}{l.unidad === "kg" ? "/kg" : ""}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCant(l.pid, l.preparado - (l.unidad === "kg" ? 0.25 : 1))} className="w-7 h-7 rounded-lg border border-stone-200 hover:bg-stone-100 flex items-center justify-center"><Minus size={13} /></button>
                  <span className="f-m w-16 text-center text-sm">
                    {l.unidad === "kg" ? l.preparado.toFixed(2) : l.preparado}
                    {!libre && <span className="text-stone-300">/{l.unidad === "kg" ? l.pedido.toFixed(2) : l.pedido}</span>}
                  </span>
                  <button onClick={() => setCant(l.pid, libre ? l.preparado + (l.unidad === "kg" ? 0.25 : 1) : Math.min(l.pedido, l.preparado + (l.unidad === "kg" ? 0.25 : 1)))} className="w-7 h-7 rounded-lg border border-stone-200 hover:bg-stone-100 flex items-center justify-center"><Plus size={13} /></button>
                </div>
                {libre
                  ? <><span className="f-m text-sm w-24 text-right">
                      {money((conPrecio.find((x) => x.pid === l.pid) || l).unit * l.preparado)}
                      {(conPrecio.find((x) => x.pid === l.pid) || {}).lista === 2 && <span className="block text-[9px] text-emerald-600 font-bold">LISTA 2</span>}
                    </span>
                      <button onClick={() => quitar(l.pid)} className="text-stone-300 hover:text-red-600"><Trash2 size={15} /></button></>
                  : <Boton size="sm" variant={falt ? "danger" : "quiet"} onClick={() => marcarFaltante(l.pid)} title="No hay stock en góndola">Sin stock</Boton>}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-stone-200 p-4 bg-stone-50">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Buscar a mano, o escribir la cantidad del último escaneado</div>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && cantidadPendiente) { e.preventDefault(); aplicarCantidad(); } }}
            placeholder="Nombre, código, o una cantidad para el último"
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white" />
          {cantidadPendiente && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-2">
              <strong className="f-d text-lg">{aNumero(q)}</strong> {ultimo.unidad === "kg" ? "kg" : "unidades"} de <strong>{ultimo.nombre}</strong> · Enter para aplicar
            </p>
          )}
          {busq.length > 0 && (
            <ul className="mt-2 bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-56 overflow-auto">
              {busq.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { registrar(p.barcode); setQ(""); }} className="w-full text-left px-3 py-2 hover:bg-stone-50 flex justify-between gap-3">
                    <span className="text-sm truncate">{p.nombre}</span>
                    <span className="f-m text-xs text-stone-400 shrink-0">{p.barcode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 sticky bottom-24 md:bottom-4 bg-white border border-stone-200 rounded-2xl p-3 shadow-sm z-30">
        <div className="text-sm">
          <span className="text-stone-500">{libre ? "Total " : "Preparado "}</span><span className="f-d text-xl">{money(monto)}</span>
          {faltantes.length > 0 && <span className="text-red-600 text-xs font-semibold ml-2">{faltantes.length} sin stock</span>}
        </div>
        <Boton onClick={() => setCerrando(true)} disabled={totalPrep === 0} variant={libre || completo ? "primary" : "dark"}>
          <PackageCheck size={16} /> {libre ? "Cobrar" : completo ? "Cerrar preparación" : "Cerrar igual"}
        </Boton>
      </div>

      {/* Cierre: comanda + cobro */}
      <Modal open={cerrando} onClose={() => setCerrando(false)} ancho="max-w-md">
        <div className="p-5">
          <h3 className="f-d text-lg">{libre ? `Cobrar ${ped.nro}` : `Pedido ${ped.nro} preparado`}</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            {libre ? `${items.length} productos, ${nf.format(Math.round(totalPrep))} unidades. Al cobrar se emite el ticket, se descuenta el stock y entra en caja.`
              : "Esta es la comanda que sale por la impresora para el bolsón."}
          </p>
          {libre ? (
            <ul className="mt-4 border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-56 overflow-auto text-sm">
              {items.map((l) => (
                <li key={l.pid} className="flex justify-between gap-3 px-3 py-2">
                  <span className="truncate">
                    {l.unidad === "kg" ? l.preparado.toFixed(2) + " kg" : l.preparado + " ×"} {l.nombre}
                    {(conPrecio.find((x) => x.pid === l.pid) || {}).lista === 2 && <span className="ml-1.5 text-[9px] font-bold text-emerald-600">LISTA 2</span>}
                  </span>
                  <span className="f-m shrink-0">{money((conPrecio.find((x) => x.pid === l.pid) || l).unit * l.preparado)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-stone-100 rounded-xl p-3 mt-4 overflow-auto">
              <Comandera lineas={comandaPicking({ ...ped, items }, W)} ancho={ajustes.ancho} className="py-2 shadow-sm" />
            </div>
          )}
          {faltantes.length > 0 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
              Faltaron {faltantes.length} productos. Conviene avisarle a {ped.cliente.split(" ")[0]} antes de cobrar.
            </div>
          )}
          {!libre && (
            <div className="grid grid-cols-2 gap-1.5 mt-4">
              <Boton variant="ghost" onClick={() => imprimirComandera(comandaPicking({ ...ped, items }, W), ajustes.ancho, null, toast)}><Printer size={15} /> Imprimir comanda</Boton>
              <Boton variant="ghost" onClick={() => toast(`Aviso enviado a ${ped.cliente} por WhatsApp.`)}><MessageCircle size={15} /> Avisar al cliente</Boton>
            </div>
          )}
          <div className="border-t border-stone-200 mt-4 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-stone-500">Total a cobrar</span>
              <span className="f-d text-2xl">{money(monto)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              {MEDIOS.map((m) => <Boton key={m.k} size="sm" variant="ghost" onClick={() => cobrarPedido(m.k)}>{m.n}</Boton>)}
            </div>
            <Boton variant="quiet" className="w-full mt-2" onClick={() => {
              setPedidos((ps) => ps.map((p) => (p.id === ped.id ? { ...p, items, estado: "listo" } : p)));
              setCerrando(false); volver();
              toast(libre ? "Queda apartado. Se cobra cuando lo pasan a buscar." : "Pedido listo para retirar. Se cobra cuando lo pasan a buscar.");
            }}>{libre ? "Dejar apartado sin cobrar" : "Dejar listo y cobrar después"}</Boton>
          </div>
        </div>
      </Modal>

      <EscanerCamara abierto={camara} onCerrar={() => setCamara(false)}
        titulo={libre ? "Cargá el changuito" : `Preparando ${ped.nro}`}
        onLeer={(cod) => registrar(cod)} />

      <TicketModal t={ticket} onClose={() => { setTicket(null); volver(); }} ajustes={ajustes} toast={toast} />
    </div>
  );
}

/* ============================================================
   10. CAJA
   ============================================================ */

function Caja({ caja, movCaja, cerrarCaja, abrirCaja, toast }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ monto: "", detalle: "", medio: "efectivo" });
  const [contado, setContado] = useState("");

  const porMedio = MEDIOS.map((m) => {
    const ing = caja.movimientos.filter((x) => x.tipo === "ingreso" && x.medio === m.k).reduce((s, x) => s + x.monto, 0);
    const egr = caja.movimientos.filter((x) => x.tipo === "egreso" && x.medio === m.k).reduce((s, x) => s + x.monto, 0);
    return { ...m, ing, egr, neto: ing - egr };
  });
  const ingresos = caja.movimientos.filter((x) => x.tipo === "ingreso").reduce((s, x) => s + x.monto, 0);
  const egresos = caja.movimientos.filter((x) => x.tipo === "egreso").reduce((s, x) => s + x.monto, 0);
  const efectivoEsperado = caja.saldoInicial + porMedio.find((m) => m.k === "efectivo").neto;
  const dif = contado === "" ? null : Number(contado) - efectivoEsperado;

  const guardar = () => {
    const monto = Number(form.monto);
    if (!monto) return;
    movCaja({ tipo: modal === "gasto" ? "egreso" : "egreso", medio: form.medio, monto, detalle: form.detalle || (modal === "gasto" ? "Gasto" : "Retiro del dueño"), clase: modal });
    setForm({ monto: "", detalle: "", medio: "efectivo" });
    setModal(null);
    toast(modal === "gasto" ? "Gasto registrado." : "Retiro registrado.");
  };

  if (!caja.abierta) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <Wallet size={28} className="mx-auto text-stone-300" />
        <h3 className="f-d text-xl mt-3">La caja está cerrada</h3>
        <p className="text-sm text-stone-500 mt-1">Abrila con el efectivo con el que arrancás el turno para poder cobrar.</p>
        {caja.cierres.length > 0 && (
          <div className="text-left text-sm bg-stone-50 rounded-xl p-3 mt-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-1">Último cierre</div>
            <div className="flex justify-between"><span>Esperado</span><span className="f-m">{money(caja.cierres[0].esperado)}</span></div>
            <div className="flex justify-between"><span>Contado</span><span className="f-m">{money(caja.cierres[0].contado)}</span></div>
            <div className="flex justify-between font-semibold"><span>Diferencia</span><span className={`f-m ${caja.cierres[0].dif < 0 ? "text-red-600" : "text-emerald-600"}`}>{money(caja.cierres[0].dif)}</span></div>
          </div>
        )}
        <Boton className="mt-5 w-full" size="lg" onClick={() => abrirCaja(50000)}>Abrir caja con {money(50000)}</Boton>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Efectivo en caja" valor={money(efectivoEsperado)} sub={`Apertura ${money(caja.saldoInicial)}`} />
        <Kpi label="Ingresos del día" valor={money(ingresos)} tono="bien" />
        <Kpi label="Egresos del día" valor={money(egresos)} tono={egresos > 0 ? "mal" : "neutro"} />
        <Kpi label="Movimientos" valor={nf.format(caja.movimientos.length)} sub={`Abierta ${caja.hora}`} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
            <h3 className="f-d">Movimientos de hoy</h3>
            <div className="flex gap-1.5">
              <Boton size="sm" variant="ghost" onClick={() => setModal("gasto")}><Plus size={13} /> Gasto</Boton>
              <Boton size="sm" variant="ghost" onClick={() => setModal("retiro")}><Plus size={13} /> Retiro</Boton>
            </div>
          </div>
          {caja.movimientos.length === 0 ? <Vacio>Todavía no hay movimientos. La primera venta aparece acá.</Vacio> : (
            <ul className="divide-y divide-stone-100 max-h-[460px] overflow-auto">
              {[...caja.movimientos].reverse().map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "ingreso" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                    {m.tipo === "ingreso" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-stone-800 truncate">{m.detalle}</div>
                    <div className="text-[11px] text-stone-400">{m.hora} · {MEDIOS.find((x) => x.k === m.medio).n}</div>
                  </div>
                  <span className={`f-m text-sm font-semibold shrink-0 ${m.tipo === "ingreso" ? "text-emerald-700" : "text-red-600"}`}>
                    {m.tipo === "ingreso" ? "+" : "−"}{money(m.monto)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Cobrado por medio de pago</div>
            <ul className="space-y-2">
              {porMedio.map((m) => (
                <li key={m.k}>
                  <div className="flex justify-between text-sm"><span className="text-stone-600">{m.n}</span><span className="f-m">{money(m.ing)}</span></div>
                  <div className="h-1.5 bg-stone-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${ingresos ? (m.ing / ingresos) * 100 : 0}%` }} />
                  </div>
                  {m.com > 0 && m.ing > 0 && <div className="text-[10px] text-stone-400 mt-0.5">Comisión estimada {money(m.ing * m.com)}</div>}
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 mt-3 pt-3 text-xs text-stone-500">
              Las comisiones de tarjeta te descuentan <strong>{money(porMedio.reduce((s, m) => s + m.ing * m.com, 0))}</strong> hoy. No aparecen en el ticket pero sí en tu ganancia.
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Cerrar caja</div>
            <p className="text-sm text-stone-500">Contá el efectivo y cargá cuánto hay realmente.</p>
            <div className="flex justify-between text-sm mt-3"><span className="text-stone-500">Deberías tener</span><span className="f-m font-semibold">{money(efectivoEsperado)}</span></div>
            <input value={contado} onChange={(e) => setContado(e.target.value.replace(/\D/g, ""))} placeholder="Efectivo contado"
              className="f-m w-full text-right border border-stone-200 rounded-xl px-3 py-2 text-sm mt-2 outline-none focus:border-orange-400" />
            {dif !== null && (
              <div className={`text-sm font-semibold mt-2 ${dif === 0 ? "text-emerald-600" : Math.abs(dif) < 2000 ? "text-amber-600" : "text-red-600"}`}>
                {dif === 0 ? "Cuadra perfecto." : dif > 0 ? `Sobran ${money(dif)}` : `Faltan ${money(-dif)}`}
              </div>
            )}
            <Boton variant="dark" className="w-full mt-3" disabled={contado === ""} onClick={() => { cerrarCaja(efectivoEsperado, Number(contado)); setContado(""); toast("Caja cerrada. Se guardó el arqueo del día."); }}>
              Cerrar caja del día
            </Boton>
          </Card>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} ancho="max-w-sm">
        <div className="p-5">
          <h3 className="f-d text-lg">{modal === "gasto" ? "Registrar un gasto" : "Registrar un retiro"}</h3>
          <p className="text-sm text-stone-500 mt-1">
            {modal === "gasto" ? "Alquiler, servicios, flete, sueldos, mantenimiento." : "Plata que sacás del negocio para uso personal."}
          </p>
          <input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder={modal === "gasto" ? "Detalle (ej. flete de bebidas)" : "Detalle"}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mt-4 outline-none focus:border-orange-400" />
          <input value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value.replace(/\D/g, "") })} placeholder="Monto"
            className="f-m w-full text-right border border-stone-200 rounded-xl px-3 py-2 text-sm mt-2 outline-none focus:border-orange-400" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {MEDIOS.map((m) => (
              <button key={m.k} onClick={() => setForm({ ...form, medio: m.k })}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${form.medio === m.k ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500"}`}>{m.n}</button>
            ))}
          </div>
          <Boton className="w-full mt-4" onClick={guardar} disabled={!form.monto}>Guardar</Boton>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   11. REPORTES
   ============================================================ */

function Reportes({ productos, k, ir }) {
  const [dias, setDias] = useState(30);
  const serie = k.diario.slice(-dias).map((d) => ({ ...d, ganancia: d.ventas - d.costo }));
  const ventas = serie.reduce((s, d) => s + d.ventas, 0);
  const costo = serie.reduce((s, d) => s + d.costo, 0);
  const factor = dias / 30;

  const topVenta = [...productos].sort((a, b) => b.u30 * b.precio - a.u30 * a.precio).slice(0, 10);
  const topGanancia = [...productos].sort((a, b) => (b.precio - b.costo) * b.u30 - (a.precio - a.costo) * a.u30).slice(0, 10);
  const porCat = useMemo(() => {
    const m = {};
    productos.forEach((p) => {
      if (!m[p.categoria]) m[p.categoria] = { cat: p.categoria, venta: 0, ganancia: 0 };
      m[p.categoria].venta += p.precio * p.u30 * factor;
      m[p.categoria].ganancia += (p.precio - p.costo) * p.u30 * factor;
    });
    return Object.values(m).sort((a, b) => b.venta - a.venta);
  }, [productos, factor]);

  const maxVenta = topVenta.length ? topVenta[0].u30 * topVenta[0].precio : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDias(d)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${dias === d ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
            {d} días
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={`Ventas ${dias} días`} valor={money(ventas)} />
        <Kpi label="Ganancia bruta" valor={money(ventas - costo)} tono="bien" />
        <Kpi label="Margen" valor={pct(ventas ? (ventas - costo) / ventas : 0)} />
        <Kpi label="Promedio por día" valor={money(ventas / dias)} />
      </div>

      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Ventas y ganancia por día</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={serie} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="gV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gG2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} interval={Math.floor(dias / 8)} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v, n) => [money(v), n === "ventas" ? "Ventas" : "Ganancia"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
            <Area type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={2} fill="url(#gV2)" />
            <Area type="monotone" dataKey="ganancia" stroke="#16a34a" strokeWidth={2} fill="url(#gG2)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Los que más facturan</div>
          <ul className="space-y-2.5">
            {topVenta.map((p, i) => (
              <li key={p.id}>
                <div className="flex justify-between text-sm gap-3">
                  <span className="truncate text-stone-700"><span className="f-m text-stone-300 mr-2">{i + 1}</span>{p.nombre}</span>
                  <span className="f-m shrink-0">{money(p.u30 * p.precio * factor)}</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-stone-800 rounded-full" style={{ width: `${(p.u30 * p.precio / maxVenta) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Los que más ganancia dejan</div>
          <ul className="space-y-2">
            {topGanancia.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between text-sm gap-3 py-0.5">
                <span className="truncate text-stone-700"><span className="f-m text-stone-300 mr-2">{i + 1}</span>{p.nombre}</span>
                <span className="shrink-0 text-right">
                  <span className="f-m block">{money((p.precio - p.costo) * p.u30 * factor)}</span>
                  <span className="text-[10px] text-stone-400">{pct((p.precio - p.costo) / p.precio, 0)} margen</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Ventas y ganancia por rubro</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porCat} margin={{ top: 4, right: 8, left: -14, bottom: 40 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#78716c" }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v, n) => [money(v), n === "venta" ? "Venta" : "Ganancia"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
            <Bar dataKey="venta" fill="#e7e5e4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ganancia" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="f-d">Productos que perdieron margen</h3>
            <p className="text-xs text-stone-500">Subió el costo y el precio quedó donde estaba.</p>
          </div>
          <Boton size="sm" variant="ghost" onClick={() => ir("productos", "margen")}>Ver todos</Boton>
        </div>
        <TablaSimple
          cols={["Producto", "Costo antes", "Costo hoy", "Margen", "Cuánto te cuesta"]}
          filas={k.subas.slice(0, 12).map((x) => [
            <div key="a"><div className="font-medium">{x.p.nombre}</div><div className="text-[11px] text-stone-400">{x.p.proveedor}</div></div>,
            <span className="f-m text-stone-400">{money(x.p.costoPrev)}</span>,
            <span className="f-m">{money(x.p.costo)} <span className="text-[10px] text-red-500">+{pct(x.subaPct, 0)}</span></span>,
            <span className="f-m">{pct(x.margenAntes, 0)} → <span className="text-red-600 font-semibold">{pct(x.margenHoy, 0)}</span></span>,
            <span className="f-m font-semibold">{money(x.impacto)}/mes</span>,
          ])}
          vacio="Ningún costo subió en los últimos 30 días."
        />
      </Card>
    </div>
  );
}

/* ============================================================
   12. ASISTENTE
   ============================================================ */

function Asistente({ k, ins, ir, negocio }) {
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

/* ============================================================
   13. AJUSTES
   ============================================================ */

function Ajustes({ ajustes, setAjustes, productos, toast, mp, setMp, simularCobro }) {
  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <h3 className="f-d text-lg">Datos del negocio</h3>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <label className="text-sm">
            <span className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Nombre</span>
            <input value={ajustes.negocio} onChange={(e) => setAjustes({ ...ajustes, negocio: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-orange-400" />
          </label>
          <label className="text-sm">
            <span className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">CUIT</span>
            <input value={ajustes.cuit} onChange={(e) => setAjustes({ ...ajustes, cuit: e.target.value })}
              className="f-m w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:border-orange-400" />
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Comprobantes</h3>
        <div className="mt-4 space-y-2">
          <button onClick={() => setAjustes({ ...ajustes, arca: false })}
            className={`w-full text-left border rounded-xl p-4 ${!ajustes.arca ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Fase 1</span>
              <span className="font-semibold text-sm">Ticket no fiscal</span>
              {!ajustes.arca && <Check size={15} className="ml-auto text-orange-600" />}
            </div>
            <p className="text-sm text-stone-600 mt-1">Arrancás vendiendo hoy mismo. El sistema numera, imprime y envía comprobantes internos, y registra todo en ventas, stock y caja.</p>
          </button>
          <button onClick={() => setAjustes({ ...ajustes, arca: true })}
            className={`w-full text-left border rounded-xl p-4 ${ajustes.arca ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Fase 2</span>
              <span className="font-semibold text-sm">Factura electrónica (ARCA)</span>
              {ajustes.arca && <Check size={15} className="ml-auto text-orange-600" />}
            </div>
            <p className="text-sm text-stone-600 mt-1">La misma venta emite Factura B con CAE. Se activa cuando cargamos el certificado fiscal y el punto de venta; el flujo de caja no cambia.</p>
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-3">En esta demo el CAE es simulado: sirve para ver el flujo completo, no tiene validez fiscal.</p>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Comandera y pistola</h3>
        <p className="text-sm text-stone-500 mt-1">Ancho del rollo térmico. El ticket se compone en texto de ancho fijo, igual que lo recibe la impresora.</p>
        <div className="flex gap-2 mt-3">
          {[58, 80].map((a) => (
            <button key={a} onClick={() => setAjustes({ ...ajustes, ancho: a })}
              className={`flex-1 border rounded-xl p-3 text-left ${ajustes.ancho === a ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
              <div className="font-semibold text-sm">{a} mm</div>
              <div className="text-xs text-stone-500">{a === 58 ? "32 caracteres · comandera chica" : "48 caracteres · comandera estándar"}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setAjustes({ ...ajustes, sonido: !ajustes.sonido })}
          className="flex items-center gap-2 text-sm text-stone-600 mt-3 hover:text-stone-900">
          {ajustes.sonido ? <Volume2 size={16} className="text-orange-500" /> : <VolumeX size={16} />}
          Beep al escanear: <strong>{ajustes.sonido ? "activado" : "silenciado"}</strong>
        </button>
        <p className="text-xs text-stone-400 mt-3">
          La pistola funciona como un teclado. El sistema reconoce la ráfaga de tecleo y el Enter final, así que se puede disparar sin clickear ningún campo.
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Avisos de Mercado Pago</h3>
            <p className="text-sm text-stone-500 mt-1">
              Cuando entra una transferencia o un pago por QR, salta un cartel, suena una campanita y una voz dice el monto en voz alta.
              El cobro queda registrado en caja solo.
            </p>
          </div>
          <button onClick={() => setMp({ ...mp, activo: !mp.activo })}
            className={`shrink-0 flex items-center gap-2 text-sm font-semibold ${mp.activo ? "text-emerald-700" : "text-stone-400"}`}>
            {mp.activo ? <Bell size={16} /> : <BellOff size={16} />}
            {mp.activo ? "Activo" : "Apagado"}
          </button>
        </div>

        <div className={`mt-3 rounded-xl p-3 text-sm border ${
          mp.configurado === null ? "bg-stone-50 border-stone-200 text-stone-500"
          : mp.configurado ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {mp.configurado === null ? "Consultando el estado de la conexión…"
            : mp.configurado
              ? <>Conectado a Mercado Pago. Consultando cada 6 segundos{mp.ultimoChequeo ? ` · último chequeo ${mp.ultimoChequeo.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}.</>
              : <>Todavía sin conectar: falta cargar <strong>MP_ACCESS_TOKEN</strong> en Vercel. El aviso se puede probar igual con el botón de abajo.</>}
          {mp.error && <div className="text-xs mt-1 opacity-80">{mp.error}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button onClick={() => setMp({ ...mp, voz: !mp.voz })}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900">
            {mp.voz ? <Vol2 size={16} className="text-orange-500" /> : <VolumeX size={16} />}
            Leer el monto en voz alta: <strong>{mp.voz ? "sí" : "no"}</strong>
          </button>
          <Boton size="sm" variant="ghost" className="ml-auto" onClick={simularCobro}>
            <Bell size={14} /> Probar el aviso
          </Boton>
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-stone-600 font-semibold">Cómo conectar la cuenta</summary>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-stone-600">
            <li>Entrá a <span className="f-m text-xs">mercadopago.com.ar/developers</span> con la cuenta del negocio y creá una aplicación.</li>
            <li>Copiá el <strong>Access Token de producción</strong> (empieza con APP_USR).</li>
            <li>En Vercel, Settings → Environment Variables, creá <span className="f-m text-xs">MP_ACCESS_TOKEN</span> en Production.</li>
            <li>Volvé a desplegar. Este panel va a pasar a "Conectado" solo.</li>
          </ol>
          <p className="text-xs text-stone-400 mt-2">
            La API de Mercado Pago no tiene costo. El token nunca llega al navegador: se usa del lado del servidor.
          </p>
        </details>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Listas de precio</h3>
        <p className="text-sm text-stone-500 mt-1">
          La lista 2 es el precio por cantidad. Se activa sola cuando un renglón del ticket llega a la cantidad mínima,
          y solo en ese renglón: si el cliente lleva 3 fideos iguales y 1 aceite, los fideos pasan a lista 2 y el aceite queda en lista 1.
        </p>
        <button onClick={() => setAjustes({ ...ajustes, lista2: !ajustes.lista2 })}
          className={`flex items-center gap-2 text-sm mt-3 font-semibold ${ajustes.lista2 ? "text-emerald-700" : "text-stone-400"}`}>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${ajustes.lista2 ? "bg-emerald-500" : "bg-stone-300"}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${ajustes.lista2 ? "left-4.5" : "left-0.5"}`} style={{ left: ajustes.lista2 ? 18 : 2 }} />
          </span>
          Lista 2 {ajustes.lista2 ? "activada" : "desactivada"}
        </button>
        {ajustes.lista2 && (
          <>
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm text-stone-500 shrink-0">Se activa a partir de</span>
              <input type="range" min="2" max="12" value={ajustes.umbral2}
                onChange={(e) => setAjustes({ ...ajustes, umbral2: Number(e.target.value) })} className="flex-1 accent-orange-500" />
              <span className="f-m text-lg w-24 text-right">{ajustes.umbral2} unidades</span>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-stone-500 shrink-0">Descuento sugerido al crear</span>
              <input type="range" min="3" max="30" value={ajustes.desc2}
                onChange={(e) => setAjustes({ ...ajustes, desc2: Number(e.target.value) })} className="flex-1 accent-orange-500" />
              <span className="f-m text-lg w-16 text-right">{ajustes.desc2}%</span>
            </div>
            <p className="text-xs text-stone-400 mt-3">
              {productos.filter((p) => p.precio2).length} de {nf.format(productos.length)} productos tienen precio de lista 2 cargado.
              El resto se cobra siempre a lista 1. El segundo precio se carga en la ficha de cada producto.
            </p>
          </>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Reposición</h3>
        <p className="text-sm text-stone-500 mt-1">Cuántos días de venta querés tener cubiertos cuando el sistema arma el pedido sugerido.</p>
        <div className="flex items-center gap-4 mt-3">
          <input type="range" min="7" max="30" value={ajustes.cobertura} onChange={(e) => setAjustes({ ...ajustes, cobertura: Number(e.target.value) })}
            className="flex-1 accent-orange-500" />
          <span className="f-m text-lg w-16 text-right">{ajustes.cobertura} d</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="f-d text-lg">Datos de la demo</h3>
        <ul className="text-sm text-stone-600 mt-2 space-y-1">
          <li>{nf.format(productos.length)} productos con costo, precio, stock, proveedor y vencimiento</li>
          <li>90 días de historial de ventas y hasta 5 cambios de costo por producto</li>
          <li>{Object.keys(PROV_INFO).length} proveedores con condiciones de pago y día de entrega</li>
        </ul>
        <Boton variant="ghost" className="mt-4" onClick={() => { window.location.reload(); toast("Recargando…"); }}>Reiniciar la demo</Boton>
      </Card>
    </div>
  );
}

/* ============================================================
   13 bis. FICHA RÁPIDA (escaneo desde cualquier pantalla)
   ============================================================ */

function FichaRapida({ p, onClose, setProductos, vender, verFicha, movCaja, toast }) {
  const [cant, setCant] = useState("");
  const [costo, setCosto] = useState("");
  const [precio, setPrecio] = useState("");
  const [pagar, setPagar] = useState(false);
  useEffect(() => { if (p) { setCant(String(p.bulto)); setCosto(String(p.costo)); setPrecio(String(p.precio)); setPagar(false); } }, [p && p.id]);
  if (!p) return null;

  const m = (p.precio - p.costo) / p.precio;
  const cobertura = p.vel > 0 ? p.stock / p.vel : 99;

  const sumarStock = () => {
    const n = Number(cant);
    if (!n) return;
    const c = Number(costo) || p.costo;
    setProductos((ps) => ps.map((x) => (x.id === p.id
      ? { ...x, stock: +(x.stock + n).toFixed(3), costo: c, historial: c !== x.costo ? [...x.historial, { fecha: HOY, costo: c }] : x.historial }
      : x)));
    if (pagar) movCaja({ tipo: "egreso", medio: "efectivo", monto: n * c, detalle: `Entrada de mercadería · ${p.nombre}` });
    toast(`+${n} ${p.unidad} de ${p.nombre}. Stock: ${+(p.stock + n).toFixed(2)}.`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} ancho="max-w-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-orange-600 font-bold"><ScanLine size={12} /> Escaneado</div>
            <h3 className="f-d text-lg leading-tight mt-1">{p.nombre}</h3>
            <div className="f-m text-[11px] text-stone-400">{p.barcode} · {p.proveedor}</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[["Stock", p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)], ["Alcanza", cobertura > 90 ? "+90 d" : `${Math.round(cobertura)} d`],
            ["Precio", money(p.precio)], ["Margen", pct(m, 0)]].map(([l, v]) => (
            <div key={l} className="bg-stone-50 rounded-xl p-2 text-center">
              <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">{l}</div>
              <div className="f-m text-sm mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <Boton className="w-full mt-4" size="lg" onClick={() => vender(p)}><Barcode size={17} /> Agregar al ticket y vender</Boton>

        <div className="border border-stone-200 rounded-xl p-3 mt-3">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Sumar stock</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-500 shrink-0">Cantidad</label>
            <input value={cant} onChange={(e) => setCant(e.target.value.replace(/[^\d.]/g, ""))}
              className="f-m w-20 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
            <label className="text-xs text-stone-500 shrink-0 ml-2">Costo</label>
            <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
              className="f-m flex-1 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600 mt-2">
            <input type="checkbox" checked={pagar} onChange={(e) => setPagar(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            Pagué {money((Number(cant) || 0) * (Number(costo) || p.costo))} en efectivo (sale de caja)
          </label>
          <Boton variant="ghost" className="w-full mt-2" onClick={sumarStock} disabled={!Number(cant)}>
            <Plus size={15} /> Sumar {cant || 0} al stock
          </Boton>
          {Number(costo) !== p.costo && Number(costo) > 0 && (
            <p className="text-[11px] text-amber-700 mt-2">
              El costo cambia de {money(p.costo)} a {money(Number(costo))}. Con el precio actual el margen queda en {pct((p.precio - Number(costo)) / p.precio, 0)}.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
            className="f-m w-28 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
          <Boton size="sm" variant="ghost" onClick={() => { setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, precio: Number(precio) || x.precio } : x))); toast("Precio actualizado."); onClose(); }}>
            Cambiar precio
          </Boton>
          <button onClick={() => verFicha(p)} className="text-xs font-semibold text-orange-600 hover:underline ml-auto">Ficha completa</button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   13 ter. AVISO DE COBRO POR MERCADO PAGO
   ============================================================ */

/* Tarjeta chica, abajo a la derecha: avisa sin frenar la caja. El cajero
   puede seguir cobrando al cliente siguiente mientras aparece.             */
function TarjetaCobro({ c, onCerrar }) {
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setSaliendo(true), 14000);
    const b = setTimeout(() => onCerrar(c.id), 14500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  return (
    <div className={`w-[calc(100vw-2.5rem)] max-w-xs md:w-72 bg-white border border-emerald-300 rounded-2xl shadow-xl overflow-hidden transition-all duration-500 ${saliendo ? "opacity-0 translate-x-6" : "opacity-100"}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white">
        <Bell size={14} className="shrink-0" />
        <span className="text-[10px] uppercase tracking-widest font-bold flex-1">Cobro recibido</span>
        <button onClick={() => onCerrar(c.id)} className="text-white/70 hover:text-white"><X size={14} /></button>
      </div>
      <div className="px-3 py-2.5">
        <div className="f-d text-3xl tabular-nums text-emerald-700 leading-none">{money(c.monto)}</div>
        <div className="text-[11px] text-stone-400 mt-1.5">
          Mercado Pago · {new Date(c.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · ya está en caja
        </div>
      </div>
    </div>
  );
}

function AvisoCobro({ cobros, onCerrar }) {
  if (!cobros.length) return null;
  return (
    <div className="fixed bottom-28 md:bottom-20 right-4 md:right-5 z-[60] flex flex-col gap-2 items-end pointer-events-none">
      {cobros.slice(-4).map((c) => (
        <div key={c.id} className="pointer-events-auto"><TarjetaCobro c={c} onCerrar={onCerrar} /></div>
      ))}
    </div>
  );
}

/* ============================================================
   14. APP
   ============================================================ */

const NAV = [
  { k: "inicio", n: "Inicio", i: LayoutDashboard },
  { k: "pedidos", n: "Pedidos", i: ClipboardList },
  { k: "productos", n: "Productos", i: Package },
  { k: "stock", n: "Stock", i: Boxes },
  { k: "compras", n: "Compras", i: Truck },
  { k: "caja", n: "Caja", i: Wallet },
  { k: "reportes", n: "Informes", i: BarChart3 },
  { k: "asistente", n: "Asistente", i: Sparkles },
  { k: "ajustes", n: "Ajustes", i: Settings },
];

const TITULOS = {
  inicio: ["Inicio", "Cómo viene el negocio hoy"],
  pedidos: ["Pedidos", "Preparación con pistola y control de faltantes"],
  productos: ["Productos", "Costos, precios y margen de todo tu catálogo"],
  stock: ["Stock", "Qué reponer, qué vence y qué no se mueve"],
  compras: ["Compras", "Cargar remitos, pedidos sugeridos y proveedores"],
  caja: ["Caja", "Ingresos, egresos y arqueo del día"],
  reportes: ["Informes", "Qué se vende, qué deja plata y qué cambió"],
  asistente: ["Asistente", "Tus datos explicados y qué conviene hacer"],
  ajustes: ["Ajustes", "Configuración del negocio y del sistema"],
};

export default function App() {
  const [vista, setVista] = useState("cobro");
  const [tab, setTab] = useState("inicio");
  const [foco, setFoco] = useState(null);
  const [productos, setProductos] = useState(DATA.productos);
  const [tickets, setTickets] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pedidosCli, setPedidosCli] = useState(PEDIDOS_INICIALES);
  const [provs, setProvs] = useState(PROV_INFO);
  const [altaProd, setAltaProd] = useState(null);
  const [ajustes, setAjustes] = useState({ negocio: "Minimercado El Progreso", cuit: "30-71234567-4", arca: false, cobertura: 14, ancho: 80, sonido: true, lista2: true, umbral2: 3, desc2: 10 });
  const [toasts, setToasts] = useState([]);

  const hoyDiario = DATA.diario[DATA.diario.length - 1];
  const [caja, setCaja] = useState(() => {
    const reparto = { efectivo: 0.42, debito: 0.17, credito: 0.12, mp: 0.25, transferencia: 0.04 };
    const movs = Object.entries(reparto).map(([medio, f], i) => ({
      id: uid(), tipo: "ingreso", medio, monto: Math.round(hoyDiario.ventas * f),
      detalle: "Ventas registradas · turno mañana", hora: `1${i}:0${i}`,
    }));
    movs.push({ id: uid(), tipo: "egreso", medio: "efectivo", monto: 18500, detalle: "Flete de bebidas", hora: "09:40", clase: "gasto" });
    return { abierta: true, saldoInicial: 50000, hora: "07:30", movimientos: movs, cierres: [] };
  });

  const [ficha, setFicha] = useState(null);
  const [pendientePOS, setPendientePOS] = useState(null);
  const pila = useRef([]);
  const push = useCallback((fn) => {
    pila.current.push(fn);
    return () => { pila.current = pila.current.filter((f) => f !== fn); };
  }, []);

  const [cobrosMP, setCobrosMP] = useState([]);
  const [mp, setMp] = useState({ activo: true, voz: true, configurado: null, ultimoChequeo: null, error: null });
  const vistos = useRef(new Set());
  const primeraVuelta = useRef(true);
  const abiertoDesde = useRef(Date.now());

  const toast = (texto, tono = "ok") => {
    const id = uid();
    setToasts((t) => [...t, { id, texto, tono }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const k = useMemo(() => calcular(productos, DATA.diario, ajustes.cobertura), [productos, ajustes.cobertura]);
  const ins = useMemo(() => insights(k), [k]);

  const movCaja = (m) => setCaja((c) => ({
    ...c,
    movimientos: [...c.movimientos, { id: uid(), hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), ...m }],
  }));

  const cobrar = ({ items, sub, desc, total, medio, ganancia, recibe, pagos }) => {
    const nro = `0001-${String(48210 + tickets.length + 1).padStart(8, "0")}`;
    const ps = pagos && pagos.length ? pagos : [{ medio, monto: total }];
    const t = {
      id: uid(), nro, cae: String(74300000000000 + tickets.length * 137),
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      items, sub, desc, total, medio: ps[0].medio, pagos: ps, ganancia, recibe: recibe || null,
    };
    setTickets((x) => [t, ...x]);
    // Un movimiento de caja por medio de pago: así el arqueo y el reporte
    // por medio siguen cerrando aunque la venta se haya cobrado partida.
    ps.forEach((p) => movCaja({ tipo: "ingreso", medio: p.medio, monto: p.monto, detalle: `Venta ${nro}${ps.length > 1 ? " (parte)" : ""}` }));
    return t;
  };

  // Un cobro que entra: suena, se lee en voz alta, se muestra y se registra.
  const recibirCobro = (c) => {
    if (vistos.current.has(c.id)) return;
    // Solo se anuncia lo que entró después de abrir la caja. Sin esto, un pago
    // anterior que Mercado Pago indexa con demora sonaría como si fuera nuevo.
    const cuando = new Date(c.fecha).getTime();
    if (isFinite(cuando) && cuando < abiertoDesde.current) { vistos.current.add(c.id); return; }
    vistos.current.add(c.id);
    setCobrosMP((x) => [...x, c]);
    campanita(ajustes.sonido);
    hablar(`Recibiste un pago de ${numeroALetras(c.monto)} pesos`, mp.voz && ajustes.sonido);
    movCaja({ tipo: "ingreso", medio: "mp", monto: c.monto, detalle: `Mercado Pago${c.pagador ? " · " + c.pagador : ""}` });
  };

  /* Se consulta siempre una ventana de los últimos minutos, no "lo nuevo desde
     la última vez". Mercado Pago tarda unos segundos en indexar el pago: con
     una ventana que avanza, el aviso aparece justo después de que la ventana
     pasó de largo y se pierde para siempre. Con ventana fija y solapada, el
     pago se ve igual aunque llegue tarde, y los repetidos los filtra `vistos`.
     La primera vuelta se marca como vista sin avisar, para no gritar cobros
     viejos al abrir la caja. */
  useEffect(() => {
    if (!mp.activo) return;
    let vivo = true;
    const consultar = async () => {
      try {
        const desde = new Date(Date.now() - 5 * 60000).toISOString();
        const r = await fetch(`/api/mp/pagos?desde=${encodeURIComponent(desde)}&t=${Date.now()}`);
        const d = await r.json();
        if (!vivo) return;
        setMp((m) => ({ ...m, configurado: !!d.configurado, ultimoChequeo: new Date(), error: d.error ? d.error.message : null }));
        const pagos = (d.pagos || []).slice().reverse();
        if (primeraVuelta.current) {
          pagos.forEach((p) => vistos.current.add(p.id));
          primeraVuelta.current = false;
        } else {
          pagos.forEach(recibirCobro);
        }
      } catch (e) {
        if (vivo) setMp((m) => ({ ...m, configurado: false, error: "Sin conexión con el servidor." }));
      }
    };
    consultar();
    const id = setInterval(consultar, 6000);
    // Chrome frena los temporizadores en pestañas de fondo: al volver a la
    // pestaña se consulta enseguida en vez de esperar el próximo turno.
    const alVolver = () => { if (document.visibilityState === "visible") consultar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      vivo = false; clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [mp.activo, mp.voz, ajustes.sonido]);

  const simularCobro = () => recibirCobro({
    id: "sim-" + uid(),
    monto: [4500, 12300, 24500, 8750, 51200][Math.floor(Math.random() * 5)],
    fecha: new Date().toISOString(),
    pagador: ["Marta Gómez", "Rubén Ledesma", "Nico", ""][Math.floor(Math.random() * 4)],
    detalle: "Simulación",
  });

  const ir = (t, f) => { setVista("panel"); setTab(t); setFoco(f || null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cobrar_ = () => { setVista("cobro"); window.scrollTo({ top: 0 }); };

  // Un único lector para todo el sistema: si la pantalla activa sabe qué hacer
  // con el código, se lo queda; si no, abre la ficha rápida del producto.
  useScanner((cod) => {
    const h = pila.current[pila.current.length - 1];
    if (h) return h(cod);
    const p = productos.find((x) => x.barcode === cod);
    if (p) { beep(true, ajustes.sonido); setFicha(p.id); }
    else { beep(false, ajustes.sonido); setAltaProd({ barcode: cod }); }
  }, true);

  const ventasHoy = hoyDiario.ventas + tickets.reduce((s, t) => s + t.total, 0);
  const ticketsHoy = hoyDiario.tickets + tickets.length;
  const [titulo, bajada] = TITULOS[tab];
  const alertasAltas = ins.filter((i) => i.sev === "alta").length;

  useEffect(() => {
    const h = (e) => {
      if (e.key === "F10" && vista === "panel") { e.preventDefault(); cobrar_(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [vista]);

  return (
    <ScanCtx.Provider value={{ push }}>
    <div className="f-ui min-h-screen bg-stone-50 text-stone-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter+Tight:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .f-ui { font-family: 'Inter Tight', ui-sans-serif, system-ui, -apple-system, sans-serif; }
        .f-d { font-family: 'Bricolage Grotesque', 'Inter Tight', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
        .f-m { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        input, select, button { font-family: inherit; }
        /* iOS hace zoom si un campo tiene menos de 16px: se fuerza en pantallas chicas */
        @media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }
        .seguro-abajo { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .bajo-seguro { bottom: calc(env(safe-area-inset-bottom, 0px)); }
        html { -webkit-text-size-adjust: 100%; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        /* La impresión se hace en un documento aparte (ver imprimirComandera),
           así que acá no hace falta ocultar nada. */
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* ============ PANTALLA DE COBRO (la de todo el día) ============ */}
      {vista === "cobro" && (
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 bg-stone-900 text-white">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center"><Store size={17} /></div>
                <div>
                  <div className="f-d text-sm leading-tight">{ajustes.negocio}</div>
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Cobro · {fdatel(HOY)}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 md:gap-5 ml-auto order-3 md:order-2 w-full md:w-auto overflow-x-auto">
                {[["Vendido hoy", money(ventasHoy)], ["Tickets", nf.format(ticketsHoy)],
                  ["Caja", caja.abierta ? "abierta" : "cerrada"]].map(([l, v]) => (
                  <div key={l} className="shrink-0">
                    <div className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">{l}</div>
                    <div className="f-m text-sm">{v}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => { setVista("panel"); setTab("inicio"); }}
                className="order-2 md:order-3 relative inline-flex items-center gap-2 text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3.5 py-2 transition-colors">
                <LayoutDashboard size={16} className="text-orange-400" /> Panel
                {alertasAltas > 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-orange-500 rounded-full px-1.5">{alertasAltas}</span>}
              </button>
            </div>
          </header>

          <main className="flex-1 p-3 md:p-5">
            <POS productos={productos} setProductos={setProductos} cobrar={cobrar} ajustes={ajustes}
              toast={toast} ir={ir} pendiente={pendientePOS} setPendiente={setPendientePOS}
              aPanel={() => { setVista("panel"); setTab("inicio"); }} />
          </main>

          <footer className="hidden md:block px-4 py-2 text-center text-[11px] text-stone-400 border-t border-stone-200 bg-white">
            F1 muestra todos los atajos · F2 cobra · F10 abre el Panel
          </footer>
        </div>
      )}

      {/* ============ PANEL (todo lo que no es cobrar) ============ */}
      {vista === "panel" && (
      <div className="flex">
        {/* Barra lateral */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-stone-200 p-3">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white"><Store size={17} /></div>
            <div className="min-w-0">
              <div className="f-d text-sm truncate">{ajustes.negocio}</div>
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">1 caja · {nf.format(productos.length)} art.</div>
            </div>
          </div>
          <Boton className="w-full mt-2" size="lg" onClick={cobrar_}><Barcode size={17} /> Cobrar <kbd className="f-m text-[10px] border border-white/30 rounded px-1 py-0.5">F10</kbd></Boton>
          <nav className="mt-3 space-y-0.5">
            {NAV.map((n) => (
              <button key={n.k} onClick={() => ir(n.k)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors ${tab === n.k ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
                <n.i size={16} className={tab === n.k ? "text-orange-400" : "text-stone-400"} /> {n.n}
                {n.k === "compras" && k.criticos.filter((x) => x.cobertura < 4).length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-orange-500 text-white rounded-full px-1.5">{k.criticos.filter((x) => x.cobertura < 4).length}</span>
                )}
                {n.k === "pedidos" && pedidosCli.filter((p) => p.estado !== "entregado").length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-orange-500 text-white rounded-full px-1.5">{pedidosCli.filter((p) => p.estado !== "entregado").length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto px-2.5 py-3 border-t border-stone-200">
            <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Caja</div>
            <div className={`text-sm font-semibold ${caja.abierta ? "text-emerald-600" : "text-stone-400"}`}>{caja.abierta ? "Abierta" : "Cerrada"}</div>
            <div className="text-[11px] text-stone-400 mt-1">Prototipo · datos simulados</div>
          </div>
        </aside>

        {/* Navegación móvil */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 overflow-x-auto seguro-abajo">
          <div className="flex">
            <button onClick={cobrar_} className="flex flex-col items-center gap-0.5 px-3.5 py-2 text-[10px] font-semibold shrink-0 text-white bg-orange-500">
              <Barcode size={17} /> Cobrar
            </button>
            {NAV.map((n) => (
              <button key={n.k} onClick={() => ir(n.k)}
                className={`flex flex-col items-center gap-0.5 px-3.5 py-2 text-[10px] font-semibold shrink-0 ${tab === n.k ? "text-orange-600" : "text-stone-400"}`}>
                <n.i size={17} /> {n.n}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-8">
          <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h1 className="f-d text-xl md:text-2xl">{titulo}</h1>
              <p className="text-sm text-stone-500">{bajada}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <CalendarDays size={14} /> {fdatel(HOY)}
              <span className="text-stone-300">·</span>
              <span className="f-m">{money(ventasHoy)} hoy</span>
              <Boton size="sm" variant="dark" className="ml-2 md:hidden" onClick={cobrar_}><Barcode size={14} /> Cobrar</Boton>
            </div>
          </header>

          {tab === "inicio" && <Inicio k={k} ins={ins} ventasHoy={ventasHoy} ticketsHoy={ticketsHoy} ir={ir} negocio={ajustes.negocio} aCobrar={cobrar_} />}
          {tab === "pedidos" && <Picking pedidos={pedidosCli} setPedidos={setPedidosCli} productos={productos} setProductos={setProductos} cobrar={cobrar} ajustes={ajustes} toast={toast} />}
          {tab === "productos" && <Productos key={foco || "todos"} productos={productos} setProductos={setProductos} toast={toast} focoInicial={foco} provs={provs} />}
          {tab === "stock" && <Stock productos={productos} setProductos={setProductos} k={k} toast={toast} />}
          {tab === "compras" && <Compras productos={productos} setProductos={setProductos} k={k} pedidos={pedidos} setPedidos={setPedidos} movCaja={movCaja} toast={toast} cobertura={ajustes.cobertura} provs={provs} setProvs={setProvs} />}
          {tab === "caja" && (
            <Caja caja={caja} movCaja={movCaja} toast={toast}
              abrirCaja={(s) => setCaja((c) => ({ ...c, abierta: true, saldoInicial: s, movimientos: [], hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }))}
              cerrarCaja={(esperado, contado) => setCaja((c) => ({ ...c, abierta: false, cierres: [{ fecha: HOY, esperado, contado, dif: contado - esperado }, ...c.cierres] }))} />
          )}
          {tab === "reportes" && <Reportes productos={productos} k={k} ir={ir} />}
          {tab === "asistente" && <Asistente k={k} ins={ins} ir={ir} negocio={ajustes.negocio} />}
          {tab === "ajustes" && <Ajustes ajustes={ajustes} setAjustes={setAjustes} productos={productos} toast={toast} mp={mp} setMp={setMp} simularCobro={simularCobro} />}
        </main>
      </div>
      )}

      <AvisoCobro cobros={cobrosMP} onCerrar={(id) => setCobrosMP((x) => x.filter((c) => c.id !== id))} />

      <FormProducto abierto={!!altaProd} inicial={altaProd} productos={productos} provs={provs}
        onClose={() => setAltaProd(null)}
        onGuardar={(d, faltan) => {
          setProductos((ps) => [...ps, productoNuevo(d, ps)]);
          setAltaProd(null);
          toast(faltan.length ? `${d.nombre} creado. Falta ${faltan.join(", ")}.` : `${d.nombre} creado.`);
        }} />

      <FichaRapida p={productos.find((x) => x.id === ficha)} onClose={() => setFicha(null)}
        setProductos={setProductos} movCaja={movCaja} toast={toast}
        vender={(p) => { setFicha(null); setPendientePOS({ id: p.id, t: Date.now() }); cobrar_(); }}
        verFicha={(p) => { setFicha(null); ir("productos"); }} />

      <div className="fixed bottom-44 md:bottom-5 right-4 md:right-5 z-50 space-y-2 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl shadow-lg border ${t.tono === "mal" ? "bg-red-600 text-white border-red-700" : "bg-stone-900 text-white border-stone-800"}`}>
            {t.tono === "mal" ? <AlertTriangle size={15} /> : <Check size={15} className="text-emerald-400" />} {t.texto}
          </div>
        ))}
      </div>
    </div>
    </ScanCtx.Provider>
  );
}
