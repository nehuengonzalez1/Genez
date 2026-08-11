import React, { useState, useMemo, useRef, useEffect, useCallback, useContext, createContext } from "react";
import {
  LayoutDashboard, Barcode, Package, Boxes, Truck, Wallet, BarChart3,
  Sparkles, Settings, Search, Plus, Minus, Trash2, X, Check, AlertTriangle,
  TrendingDown, TrendingUp, Printer, MessageCircle, Mail, QrCode, ArrowRight,
  Clock, ChevronLeft, ChevronRight, FileText, Store, Percent, CalendarDays,
  CircleDollarSign, ArrowDownRight, ArrowUpRight, Send, Loader2, ClipboardList, Camera, Upload, FileImage, Bell, BellOff, Volume2 as Vol2, Camera as Cam, CameraOff, Users, Sun, Moon, LogOut, Zap, ZapOff, ScanLine, Volume2, VolumeX, Phone, Bike, PackageCheck
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
            precios: {},
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
      if (cand > p.costo * 1.05) p.precios = { l2: cand };
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

function precioAplicado(prod, cantidad, ajustes) {
  const base = { precio: prod ? prod.precio : 0, lista: null, nombre: "" };
  if (!prod || !ajustes || !ajustes.listas) return base;
  const precios = prod.precios || {};
  // Gana la lista más exigente que el renglón alcance: si un producto tiene
  // precio desde 3 y desde 12 unidades, con 12 se cobra la de 12.
  const candidatas = ajustes.listas
    .filter((l) => l.activa !== false && precios[l.id] > 0 && cantidad >= l.umbral)
    .sort((a, b) => b.umbral - a.umbral);
  if (!candidatas.length) return base;
  const l = candidatas[0];
  return { precio: precios[l.id], lista: l.id, nombre: l.nombre };
}

/* Próxima lista que el renglón podría alcanzar, para poder ofrecerla en el
   mostrador: "si llevás uno más te sale más barato". */
function proximaLista(prod, cantidad, ajustes) {
  if (!prod || !ajustes || !ajustes.listas) return null;
  const precios = prod.precios || {};
  const faltantes = ajustes.listas
    .filter((l) => l.activa !== false && precios[l.id] > 0 && cantidad < l.umbral)
    .sort((a, b) => a.umbral - b.umbral);
  return faltantes.length ? { ...faltantes[0], precio: precios[faltantes[0].id] } : null;
}

const LISTAS_INICIALES = [{ id: "l2", nombre: "Por cantidad", umbral: 3, activa: true }];

function listaPorId(ajustes, id) {
  return (ajustes.listas || []).find((l) => l.id === id) || null;
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
    precios: datos.precios && typeof datos.precios === "object"
      ? Object.fromEntries(Object.entries(datos.precios).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]))
      : {},
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

/* Medios de pago editables. `tasa` es el porcentaje del medio y `recargo`
   define quién lo paga: si está en false lo absorbe el negocio (comisión que
   descuenta ganancia); si está en true se le suma al cliente y cambia el
   total de la venta. */
const MEDIOS_INICIALES = [
  { k: "efectivo", n: "Efectivo", tasa: 0, recargo: false, activo: true },
  { k: "debito", n: "Débito", tasa: 1.2, recargo: false, activo: true },
  { k: "credito", n: "Crédito", tasa: 3.1, recargo: false, activo: true },
  { k: "mp", n: "QR / Mercado Pago", tasa: 0.8, recargo: false, activo: true },
  { k: "transferencia", n: "Transferencia", tasa: 0, recargo: false, activo: true },
];

/* --- Régimen fiscal ----------------------------------------------------
   Qué comprobante se puede emitir no lo decide el cajero: lo determina la
   condición del que vende cruzada con la del que compra.
   Un monotributista siempre emite C. Un responsable inscripto emite A si le
   vende a otro responsable inscripto, y B en los demás casos.              */
const CONDICIONES = [
  { k: "RI", n: "Responsable Inscripto", corto: "Resp. Inscripto", legal: "IVA RESPONSABLE INSCRIPTO" },
  { k: "MONOTRIBUTO", n: "Monotributista", corto: "Monotributo", legal: "RESPONSABLE MONOTRIBUTO" },
  { k: "EXENTO", n: "IVA Exento", corto: "Exento", legal: "IVA EXENTO" },
  { k: "CF", n: "Consumidor Final", corto: "Cons. Final", legal: "CONSUMIDOR FINAL" },
];

const condicionLegal = (k) => (CONDICIONES.find((c) => c.k === k) || {}).legal || String(k || "").toUpperCase();

const condicionNombre = (k) => (CONDICIONES.find((c) => c.k === k) || { n: k || "—" }).n;

function letraComprobante(emisor, cliente) {
  if (emisor === "MONOTRIBUTO" || emisor === "EXENTO") return "C";
  return cliente === "RI" ? "A" : "B";
}

/* La factura A discrimina el IVA; en B y C va incluido en el precio. */
function discriminaIVA(letra) {
  return letra === "A";
}

const FISCAL_INICIAL = {
  // El nombre de fantasía es el que ve el cliente arriba del comprobante;
  // la razón social y el CUIT van debajo, que es lo que exige ARCA.
  nombreFactura: "Super 25",
  razonSocial: "Axel Gonzalez",
  cuit: "20-41564841-0",
  condicion: "MONOTRIBUTO",
  iibb: "901-234567-8",
  inicio: "01/03/2019",
  puntoVenta: "0001",
  domicilio: "Av. San Martín 1204 · Caseros",
};

const CLIENTES_INICIALES = [
  { id: "c1", razonSocial: "Almacén de Vicky", doc: "27-31456789-4", tipoDoc: "CUIT", condicion: "RI", domicilio: "Sarmiento 88", email: "", tel: "11 4478-9032" },
  { id: "c2", razonSocial: "Rotisería Don Luis", doc: "20-28765432-1", tipoDoc: "CUIT", condicion: "MONOTRIBUTO", domicilio: "Belgrano 415", email: "", tel: "" },
  { id: "c3", razonSocial: "Marta Gómez", doc: "27.345.678", tipoDoc: "DNI", condicion: "CF", domicilio: "Rivadavia 2140", email: "", tel: "11 5031-7742" },
];

function mediosDe(ajustes) {
  const ms = (ajustes && ajustes.medios) || MEDIOS_INICIALES;
  return ms.filter((m) => m.activo !== false);
}

function medioPorK(ajustes, k) {
  const ms = (ajustes && ajustes.medios) || MEDIOS_INICIALES;
  return ms.find((m) => m.k === k) || { k, n: k, tasa: 0, recargo: false };
}

/* Total que paga el cliente con ese medio. Solo cambia si el recargo se
   traslada; si no, el total es el mismo y la tasa sale de la ganancia. */
function conRecargo(base, medio) {
  if (!medio || !medio.recargo || !medio.tasa) return { total: base, recargo: 0 };
  const r = Math.round(base * (medio.tasa / 100));
  return { total: base + r, recargo: r };
}

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
      <div className={`relative w-full ${ancho} bg-white text-stone-900 rounded-t-3xl md:rounded-2xl border border-stone-200 shadow-xl max-h-[92vh] md:max-h-[88vh] overflow-auto seguro-abajo`}>{children}</div>
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
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      pre { margin: 0; padding: ${mm === 58 ? "1.5mm 1mm" : "2mm 1.5mm"}; white-space: pre;
            font-family: "Courier New", ui-monospace, monospace;
            font-size: ${mm === 58 ? "8.6pt" : "9.2pt"}; line-height: 1.28;
            /* Negro puro y negrita: el papel térmico no imprime grises */
            color: #000; font-weight: 700; -webkit-font-smoothing: none; }
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
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const cli = t.cliente || null;
  const letra = t.fiscal ? letraComprobante(f.condicion, cli ? cli.condicion : "CF") : null;
  const discrimina = letra && discriminaIVA(letra);

  const b = [
    { t: "c", v: (f.nombreFactura || f.razonSocial || ajustes.negocio).toUpperCase() },
    { t: "c", v: f.domicilio || "" },
  ];
  // En un comprobante fiscal la razón social y el CUIT son obligatorios,
  // aunque arriba figure el nombre del local.
  if (t.fiscal && f.razonSocial && f.razonSocial !== f.nombreFactura) b.push({ t: "c", v: f.razonSocial.toUpperCase() });
  b.push({ t: "c", v: `CUIT ${f.cuit}` });
  if (t.fiscal && f.iibb) b.push({ t: "c", v: `IIBB ${f.iibb}  Inicio ${f.inicio || ""}`.trim() });
  b.push({ t: "c", v: t.fiscal ? condicionLegal(f.condicion) : "NO VALIDO COMO FACTURA" });
  b.push({ t: "sep", c: "=" });
  b.push({ t: "c", v: t.fiscal ? `FACTURA ${letra}` : "TICKET DE VENTA" });
  b.push({ t: "lr", a: `Nro ${t.nro}`, b: `${fdatel(HOY)} ${t.hora}` });

  if (t.fiscal) {
    b.push({ t: "sep" });
    b.push({ t: "w", v: `CLIENTE: ${(cli ? cli.razonSocial : "CONSUMIDOR FINAL").toUpperCase()}` });
    if (cli) {
      b.push({ t: "v", v: `${cli.tipoDoc || "CUIT"} ${cli.doc}` });
      b.push({ t: "w", v: condicionLegal(cli.condicion) });
      if (cli.domicilio) b.push({ t: "w", v: cli.domicilio.toUpperCase() });
    }
  }

  b.push({ t: "sep" });
  for (const l of t.items) {
    b.push({ t: "w", v: l.nombre.toUpperCase() });
    // En factura A los importes van sin IVA, porque se discrimina al pie.
    const unit = discrimina ? l.precio / 1.21 : l.precio;
    const cant = l.unidad === "kg" ? `${l.qty.toFixed(3)} kg x ${money(unit)}` : `${l.qty} x ${money(unit)}`;
    b.push({ t: "lr", a: "  " + cant, b: money(unit * l.qty) });
    if (l.lista) b.push({ t: "v", v: `  ${String(l.listaNombre || "PRECIO ESPECIAL").toUpperCase()}` });
  }

  b.push({ t: "sep" });
  if (discrimina) {
    const neto = t.total / 1.21;
    b.push({ t: "lr", a: "SUBTOTAL NETO", b: money(neto) });
    b.push({ t: "lr", a: "IVA 21%", b: money(t.total - neto) });
  } else {
    b.push({ t: "lr", a: "SUBTOTAL", b: money(t.sub) });
    if (t.desc > 0) b.push({ t: "lr", a: "DESCUENTO", b: "-" + money(t.desc) });
    if (t.recargo > 0) b.push({ t: "lr", a: `RECARGO ${t.recargoNombre || ""}`.trim(), b: "+" + money(t.recargo) });
  }
  b.push({ t: "sep", c: "=" });
  b.push({ t: "lr", a: "TOTAL", b: money(t.total) });
  b.push({ t: "sep", c: "=" });

  const pagos = t.pagos && t.pagos.length ? t.pagos : [{ medio: t.medio, monto: t.total }];
  pagos.forEach((p) => b.push({ t: "lr", a: medioPorK(ajustes, p.medio).n.toUpperCase(), b: money(p.monto) }));
  if (t.recibe) {
    b.push({ t: "lr", a: "RECIBIDO EN EFECTIVO", b: money(t.recibe) });
    b.push({ t: "lr", a: "VUELTO", b: money(t.vuelto != null ? t.vuelto : t.recibe - t.total) });
  }

  if (t.fiscal) {
    b.push({ t: "b" });
    b.push({ t: "c", v: `CAE ${t.cae}` });
    b.push({ t: "c", v: `Vto CAE ${fdatel(addDays(HOY, 10))}` });
  }
  b.push({ t: "b" });
  b.push({ t: "c", v: `${t.items.length} items` });
  b.push({ t: "c", v: "GRACIAS POR SU COMPRA" });
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
  const [otros, setOtros] = useState({});
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre((inicial && inicial.nombre) || "");
    setPrecio(""); setCosto(""); setOtros({});
    setCodigo((inicial && inicial.barcode) || "");
    setTimeout(() => ref.current && ref.current.focus(), 30);
  }, [abierto, inicial]);

  if (!abierto) return null;
  const margen = Number(precio) && Number(costo) ? (Number(precio) - Number(costo)) / Number(precio) : null;

  const crear = (agregar) => {
    if (!nombre.trim()) return;
    onCrear({ nombre: nombre.trim(), precio: Number(precio) || 0, costo: Number(costo) || 0, precios: otros, barcode: codigo }, agregar);
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

        {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
          <div key={l.id} className="border border-stone-200 rounded-xl p-3 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{l.nombre}</div>
                <div className="text-[11px] text-stone-500">Se cobra a partir de {l.umbral} unidades. Vacío: este producto no entra en esta lista.</div>
              </div>
              <input value={otros[l.id] || ""} onChange={(e) => setOtros((o) => ({ ...o, [l.id]: e.target.value.replace(/\D/g, "") }))}
                placeholder="opcional" className="f-m w-28 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400 shrink-0" />
            </div>
            {Number(precio) > 0 && !Number(otros[l.id]) && (
              <button onClick={() => setOtros((o) => ({ ...o, [l.id]: String(Math.round((Number(precio) * (1 - ajustes.desc2 / 100)) / 10) * 10) }))}
                className="text-xs font-semibold text-orange-600 hover:underline mt-2">
                Poner {money(Math.round((Number(precio) * (1 - ajustes.desc2 / 100)) / 10) * 10)} ({ajustes.desc2}% menos)
              </button>
            )}
          </div>
        ))}

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

/* --- Planilla de productos --------------------------------------------
   Exporta e importa el catálogo en Excel. La librería (SheetJS) se descarga
   solo cuando se usa, así no engorda la aplicación para quien nunca la abre.
   Si no se puede descargar, se cae a CSV, que Excel abre igual.            */
async function cargarPlanilla() {
  try {
    return await import(/* @vite-ignore */ "https://esm.sh/xlsx@0.18.5");
  } catch (e) {
    return null;
  }
}

function columnasCatalogo(listas) {
  return [
    ["id", "id"], ["codigo", "barcode"], ["nombre", "nombre"], ["rubro", "categoria"],
    ["marca", "marca"], ["proveedor", "proveedor"], ["unidad", "unidad"], ["iva", "iva"],
    ["bulto", "bulto"], ["stock", "stock"], ["stock_minimo", "stockMin"],
    ["costo", "costo"], ["precio", "precio"],
    ...listas.map((l) => [`precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`, `lista:${l.id}`]),
  ];
}

function filasCatalogo(productos, listas) {
  const cols = columnasCatalogo(listas);
  return productos.map((p) => {
    const fila = {};
    for (const [titulo, campo] of cols) {
      if (campo.startsWith("lista:")) fila[titulo] = (p.precios || {})[campo.slice(6)] || "";
      else fila[titulo] = p[campo] != null ? p[campo] : "";
    }
    return fila;
  });
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportarCatalogo(productos, listas, toast) {
  const filas = filasCatalogo(productos, listas);
  const fecha = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, "0")}-${String(HOY.getDate()).padStart(2, "0")}`;
  const XLSX = await cargarPlanilla();
  if (XLSX) {
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Productos");
    const buf = XLSX.write(libro, { bookType: "xlsx", type: "array" });
    descargar(`catalogo-${fecha}.xlsx`, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    toast(`${nf.format(filas.length)} productos exportados a Excel.`);
    return;
  }
  // Respaldo: CSV con punto y coma, que es lo que Excel en español espera.
  const cols = Object.keys(filas[0] || {});
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [cols.join(";"), ...filas.map((f) => cols.map((c) => esc(f[c])).join(";"))].join("\n");
  descargar(`catalogo-${fecha}.csv`, csv, "text/csv;charset=utf-8");
  toast(`${nf.format(filas.length)} productos exportados a CSV (Excel lo abre igual).`);
}

function parsearCSV(texto) {
  const limpio = texto.replace(/^\uFEFF/, "");
  const sep = (limpio.split("\n")[0].match(/;/g) || []).length >= (limpio.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  let campo = "", fila = [], entre = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entre) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entre = false;
      else campo += c;
    } else if (c === '"') entre = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  if (!filas.length) return [];
  const cab = filas[0].map((x) => x.trim());
  return filas.slice(1).filter((f) => f.some((x) => String(x).trim() !== ""))
    .map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i] != null ? f[i] : ""])));
}

async function leerPlanilla(archivo) {
  const esCSV = /\.csv$/i.test(archivo.name);
  if (esCSV) return parsearCSV(await archivo.text());
  const XLSX = await cargarPlanilla();
  if (!XLSX) throw new Error("No se pudo cargar el lector de Excel. Guardá la planilla como CSV y probá de nuevo.");
  const buf = await archivo.arrayBuffer();
  const libro = XLSX.read(buf, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { defval: "" });
}

/* Compara la planilla contra el catálogo y arma el resumen de cambios.
   No aplica nada: eso lo decide el usuario después de ver qué va a pasar. */
function analizarPlanilla(filas, productos, listas) {
  const porId = new Map(productos.map((p) => [String(p.id), p]));
  const porCodigo = new Map(productos.filter((p) => p.barcode).map((p) => [String(p.barcode), p]));
  const num = (v) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")); return isNaN(n) ? null : n; };
  const nuevos = [], cambios = [], errores = [];

  filas.forEach((f, i) => {
    const fila = i + 2;
    const id = f.id != null && String(f.id).trim() !== "" ? String(f.id).trim() : null;
    const cod = f.codigo != null ? String(f.codigo).trim().replace(/\D/g, "") : "";
    const p = (id && porId.get(id)) || (cod && porCodigo.get(cod)) || null;
    const nombre = String(f.nombre || "").trim();

    if (!p) {
      if (!nombre) { errores.push(`Fila ${fila}: sin nombre y sin coincidencia en el catálogo.`); return; }
      nuevos.push({ fila, datos: f });
      return;
    }
    const dif = [];
    const comparar = (campo, etiqueta, valor) => {
      if (valor == null || String(f[campo] ?? "").trim() === "") return;
      if (Number(p[etiqueta]) !== valor) dif.push({ campo, antes: p[etiqueta], ahora: valor });
    };
    comparar("costo", "costo", num(f.costo));
    comparar("precio", "precio", num(f.precio));
    comparar("stock", "stock", num(f.stock));
    comparar("stock_minimo", "stockMin", num(f.stock_minimo));
    for (const l of listas) {
      const col = `precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
      if (String(f[col] ?? "").trim() === "") continue;
      const v = num(f[col]);
      if (((p.precios || {})[l.id] || 0) !== (v || 0)) dif.push({ campo: col, antes: (p.precios || {})[l.id] || 0, ahora: v || 0 });
    }
    if (nombre && nombre !== p.nombre) dif.push({ campo: "nombre", antes: p.nombre, ahora: nombre });
    if (dif.length) cambios.push({ fila, p, dif, datos: f });
  });

  return { nuevos, cambios, errores };
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

function BuscarCliente({ clientes, onElegir, onCrear, onCerrar }) {
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lista = q.trim().length >= 1
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q.trim()))
    : clientes.slice(0, 8);

  if (nuevo) {
    return <FormCliente abierto inicial={{ razonSocial: q }} onCerrar={() => setNuevo(false)} onGuardar={(d) => onCrear(d)} />;
  }

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg">¿A quién se le factura?</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Nombre o CUIT"
          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mt-3 outline-none focus:border-orange-400" />
        <button onClick={() => onElegir(null)} className="w-full text-left px-3 py-2.5 mt-3 rounded-xl border border-stone-200 hover:bg-stone-50">
          <span className="text-sm font-semibold">Consumidor final</span>
          <span className="block text-[11px] text-stone-400">Sin datos del cliente</span>
        </button>
        <ul className="mt-2 border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-64 overflow-auto">
          {lista.map((c) => (
            <li key={c.id}>
              <button onClick={() => onElegir(c)} className="w-full text-left px-3 py-2 hover:bg-stone-50">
                <div className="text-sm font-medium">{c.razonSocial}</div>
                <div className="f-m text-[11px] text-stone-400">{c.tipoDoc} {c.doc} · {condicionNombre(c.condicion)}</div>
              </button>
            </li>
          ))}
        </ul>
        {lista.length === 0 && <p className="text-sm text-stone-400 text-center py-3">No hay coincidencias.</p>}
        <Boton variant="ghost" className="w-full mt-3" onClick={() => setNuevo(true)}><Plus size={15} /> Cargar un cliente nuevo</Boton>
      </div>
    </Modal>
  );
}

function Overlay({ children, ancho = "max-w-xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-[3px]" />
      <div className={`relative w-full ${ancho} bg-white text-stone-900 rounded-t-3xl md:rounded-2xl border border-stone-200 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto seguro-abajo`}>{children}</div>
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

function POS({ productos, setProductos, cobrar, ajustes, toast, ir, pendiente, setPendiente, aPanel, clientes, setClientes, permisos }) {
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
      return [...c, { pid: p.id, qty: cantidad, precio: p.precio, precios: p.precios || {}, costo: p.costo, nombre: p.nombre, unidad: p.unidad }];
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
        setCart((c) => [...c, { pid: creado.id, qty: creado.unidad === "kg" ? 0.25 : 1, precio: creado.precio, precios: creado.precios || {}, costo: creado.costo, nombre: creado.nombre, unidad: creado.unidad }]);
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
    const { precio, lista, nombre } = precioAplicado(l, l.qty, ajustes);
    return { ...l, unit: precio, lista, listaNombre: nombre, proxima: proximaLista(l, l.qty, ajustes),
      importe: precio * l.qty, ahorro: (l.precio - precio) * l.qty };
  });
  const ahorroTotal = lineas.reduce((s, l) => s + l.ahorro, 0);
  const sub = lineas.reduce((s, l) => s + l.importe, 0);
  const descMonto = sub * (desc / 100);
  const total = sub - descMonto;
  const costoTot = lineas.reduce((s, l) => s + l.costo * l.qty, 0);
  const ganancia = total - costoTot;
  const medios = mediosDe(ajustes);
  const medio = medios[medioSel] || medios[0];

  const [fiscal, setFiscal] = useState(!!ajustes.arca);
  const [cliente, setCliente] = useState(null);
  const [buscarCliente, setBuscarCliente] = useState(false);
  const letra = letraComprobante((ajustes.fiscal || FISCAL_INICIAL).condicion, cliente ? cliente.condicion : "CF");
  const rec = conRecargo(total, medio);
  const totalFinal = rec.total;
  // El vuelto se calcula sobre el total con recargo, así que va después.
  const vuelto = recibe ? Number(recibe) - totalFinal : 0;

  const irAPago = () => {
    if (!cart.length) return;
    setMedioSel(0); setRecibe(""); setPagos([]); setMontoMix("");
    setFiscal(!!ajustes.arca); setCliente(null);
    setPaso("pago");
  };

  // ---- Pago combinado ----
  const cubierto = pagos.reduce((s2, p) => s2 + p.monto, 0);
  const falta = Math.max(0, total - cubierto);
  const vueltoMix = pagos.reduce((s2, p) => s2 + (p.exceso || 0), 0);
  const efectivoEntregado = pagos.filter((p) => p.medio === "efectivo").reduce((s2, p) => s2 + p.monto + (p.exceso || 0), 0);

  const agregarPago = () => {
    const m = medios[medioSel];
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
    const items = lineas.map((l) => ({ pid: l.pid, qty: l.qty, precio: l.unit, costo: l.costo, nombre: l.nombre, unidad: l.unidad, lista: l.lista, listaNombre: l.listaNombre }));
    const m = medioPorK(ajustes, k);
    const r = listaPagos ? { total, recargo: 0 } : conRecargo(total, m);
    const t = cobrar({ items, sub, desc: descMonto, total: r.total, medio: k, ganancia: ganancia + r.recargo,
      recibe: recibido || null, pagos: listaPagos, recargo: r.recargo, recargoNombre: r.recargo ? m.n : "",
      fiscal, cliente });
    if (vueltoDado != null) t.vuelto = vueltoDado;
    setProductos((ps) => ps.map((p) => {
      const l = lineas.find((x) => x.pid === p.id);
      return l ? { ...p, stock: +(p.stock - l.qty).toFixed(3), ultimaVenta: HOY, u30: p.u30 + l.qty } : p;
    }));
    setTicket(t);
    setPaso("fin");
  };

  const nuevaVenta = () => {
    setCart([]); setDesc(0); setRecibe(""); setMedioSel(0); setPagos([]); setMontoMix(""); setUltimo(null); setCliente(null);
    setTicket(null); setVerTicket(false); setPaso("carga");
  };

  // ---- Teclado ----
  useEffect(() => {
    const h = (e) => {
      if (alta || camara || buscarCliente) return;
      if (e.key === "F1") { e.preventDefault(); return setAyuda((a) => !a); }
      if (ayuda) { if (e.key === "Escape") { e.preventDefault(); setAyuda(false); } return; }

      if (paso === "carga") {
        if (e.key === "F2") { e.preventDefault(); return irAPago(); }
        if (e.key === "F4") {
          e.preventDefault();
          if (!permisos.descuentos) return toast("Tu usuario no puede dar descuentos.", "mal");
          return setDesc((d) => [0, 5, 10, 15][([0, 5, 10, 15].indexOf(d) + 1) % 4]);
        }
        if (e.key === "F7") { e.preventDefault(); return setCart((c) => c.slice(0, -1)); }
        if (e.key === "F8") {
          e.preventDefault();
          if (!permisos.anular) return toast("Tu usuario no puede anular ventas.", "mal");
          if (cart.length) { setCart([]); setDesc(0); toast("Venta anulada."); }
          return;
        }
        if (e.key === "F9") { e.preventDefault(); return ir("pedidos"); }
        if (e.key === "F10") { e.preventDefault(); return aPanel(); }
        return;
      }

      if (paso === "pago") {
        e.preventDefault();
        if (e.key === "Escape") return setPaso("carga");
        if (e.key === "ArrowDown") return setMedioSel((i) => (i + 1) % medios.length);
        if (e.key === "ArrowUp") return setMedioSel((i) => (i - 1 + medios.length) % medios.length);
        if (e.key === "6" || e.key.toLowerCase() === "c") { setMedioSel(0); setMontoMix(""); return setPaso("mixto"); }
        if (/^[1-9]$/.test(e.key) && Number(e.key) <= medios.length) {
          const i = Number(e.key) - 1;
          setMedioSel(i);
          if (medios[i].k === "efectivo") return setPaso("monto");
          return finalizar(medios[i].k, null);
        }
        if (e.key === "Enter") {
          if (medios[medioSel].k === "efectivo") return setPaso("monto");
          return finalizar(medios[medioSel].k, null);
        }
        return;
      }

      if (paso === "monto") {
        if (e.key === "Escape") { e.preventDefault(); return setPaso("pago"); }
        if (e.key === "Enter") {
          e.preventDefault();
          if (recibe && Number(recibe) < totalFinal) return toast("El importe recibido es menor al total.", "mal");
          return finalizar("efectivo", recibe ? Number(recibe) : null);
        }
        return;
      }

      if (paso === "mixto") {
        if (e.key === "Escape") { e.preventDefault(); setPagos([]); return setPaso("pago"); }
        if (e.key === "ArrowDown") { e.preventDefault(); return setMedioSel((i) => (i + 1) % medios.length); }
        if (e.key === "ArrowUp") { e.preventDefault(); return setMedioSel((i) => (i - 1 + medios.length) % medios.length); }
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
        if (k === "i") return imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ticket.fiscal ? ticket.cae : null, toast);
        if (k === "w") return toast("Comprobante enviado por WhatsApp.");
        if (k === "e") return toast("Comprobante enviado por email.");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paso, cart, medioSel, recibe, total, ayuda, pagos, montoMix, falta, alta, camara, fiscal, totalFinal, cliente, buscarCliente, permisos]);

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
                        {l.lista && <span className="line-through mr-1">{money(l.precio)}</span>}
                        <span className={l.lista ? "text-emerald-700 font-semibold" : ""}>{money(l.unit)}</span> c/u
                        {l.lista && <span className="ml-1 text-emerald-700 font-bold uppercase">{l.listaNombre}</span>}
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
                      {l.lista && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {l.listaNombre} −{money(l.ahorro)}
                        </span>
                      )}
                      {!l.lista && l.proxima && (
                        <span className="ml-2 text-[10px] text-stone-400">
                          desde {l.proxima.umbral} u paga {money(l.proxima.precio)}
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
                      {l.lista && <span className="line-through text-stone-300 mr-1">{money(l.precio)}</span>}
                      <span className={l.lista ? "text-emerald-700 font-semibold" : ""}>{money(l.unit)}</span>
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
          {ATAJOS.filter(([t]) => (t !== "F4" || permisos.descuentos) && (t !== "F8" || permisos.anular)).map(([t, n]) => (
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
          {permisos.descuentos && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-stone-500">Descuento <Tecla>F4</Tecla></span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button key={d} onClick={() => setDesc(d)} className={`f-m text-xs px-2 py-1 rounded-lg border ${desc === d ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}>{d}%</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-stone-200">
            <span className="f-d text-lg">Total</span>
            <span className="f-d text-4xl tabular-nums">{money(total)}</span>
          </div>
          {cart.length > 0 && permisos.verCostos && <div className="text-xs text-stone-400 mt-1 text-right">Ganancia {money(ganancia)} · {pct(total ? ganancia / total : 0)}</div>}
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
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">¿Cómo paga?</span>
              <div className="flex rounded-xl border border-stone-200 overflow-hidden text-xs font-semibold">
                <button onClick={() => setFiscal(false)} className={`px-3 py-1.5 ${!fiscal ? "bg-stone-900 text-white" : "text-stone-500"}`}>Ticket</button>
                <button onClick={() => setFiscal(true)} className={`px-3 py-1.5 ${fiscal ? "bg-stone-900 text-white" : "text-stone-500"}`}>Factura {fiscal ? letra : ""}</button>
              </div>
            </div>

            {fiscal && (
              <button onClick={() => setBuscarCliente(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-left">
                <Users size={16} className="text-stone-400 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{cliente ? cliente.razonSocial : "Consumidor final"}</span>
                  <span className="block text-[11px] text-stone-400">
                    {cliente ? `${cliente.tipoDoc} ${cliente.doc} · ${condicionNombre(cliente.condicion)}` : "Sin identificar · toca para elegir un cliente"}
                  </span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-stone-900 text-white border-stone-900 shrink-0">{letra}</span>
              </button>
            )}
            <ul className="space-y-1.5">
              {medios.map((m, i) => (
                <li key={m.k}>
                  <button onClick={() => { setMedioSel(i); m.k === "efectivo" ? setPaso("monto") : finalizar(m.k, null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${i === medioSel ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
                    <Tecla>{i + 1}</Tecla>
                    <span className="font-semibold flex-1">{m.n}</span>
                    {m.tasa > 0 && (
                      <span className="text-xs text-stone-400 shrink-0">
                        {m.recargo ? `recargo ${m.tasa}%` : `comisión ${money(total * m.tasa / 100)}`}
                      </span>
                    )}
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

      {buscarCliente && (
        <BuscarCliente clientes={clientes} onCerrar={() => setBuscarCliente(false)}
          onElegir={(c) => { setCliente(c); setBuscarCliente(false); }}
          onCrear={(d) => { const nuevo = { ...d, id: "c" + uid() }; setClientes((cs) => [...cs, nuevo]); setCliente(nuevo); setBuscarCliente(false); toast(`${d.razonSocial} agregado.`); }} />
      )}

      {/* ---------- Ventana 2b: efectivo ---------- */}
      {paso === "monto" && (
        <Overlay ancho="max-w-lg">
          <div className="bg-stone-900 text-white px-6 py-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Efectivo · total</div>
            <div className="f-d text-4xl mt-0.5">{money(totalFinal)}</div>
          </div>
          <div className="p-5">
            <label className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">¿Con cuánto paga?</label>
            <input ref={inpMonto} value={recibe} onChange={(e) => setRecibe(e.target.value.replace(/\D/g, ""))}
              placeholder="Dejalo vacío si paga justo"
              className="f-m w-full text-right text-3xl border-2 border-stone-200 rounded-xl px-4 py-3 mt-2 outline-none focus:border-orange-400" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {rapidos.filter((r) => r >= totalFinal).slice(0, 4).map((r) => (
                <button key={r} onClick={() => setRecibe(String(r))} className="f-m text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700">{money(r)}</button>
              ))}
              <button onClick={() => setRecibe(String(Math.ceil(totalFinal / 1000) * 1000))} className="f-m text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700">
                {money(Math.ceil(totalFinal / 1000) * 1000)}
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
              <Boton size="lg" onClick={() => { if (recibe && Number(recibe) < totalFinal) return toast("El importe recibido es menor al total.", "mal"); finalizar("efectivo", recibe ? Number(recibe) : null); }}>
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
                    <span className="flex-1">{medioPorK(ajustes, p.medio).n}</span>
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
                  {medios.map((m, i) => (
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
                  Agregar {money(Number(montoMix) || falta)} en {medios[medioSel].n} <Tecla>Enter</Tecla>
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
              {(ticket.pagos || [{ medio: ticket.medio, monto: ticket.total }]).map((p) => `${medioPorK(ajustes, p.medio).n} ${money(p.monto)}`).join(" + ")} · {ticket.nro}
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
              {[[Printer, "Imprimir", "I", () => imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ticket.fiscal ? ticket.cae : null, toast)],
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
              <Comandera lineas={ticketVenta(ticket, ajustes, W)} ancho={ajustes.ancho} qr={ticket.fiscal ? ticket.cae : null} className="py-2 shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3 no-print">
              <Boton variant="ghost" onClick={() => imprimirComandera(ticketVenta(ticket, ajustes, W), ajustes.ancho, ticket.fiscal ? ticket.cae : null, toast)}><Printer size={15} /> Imprimir</Boton>
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
    { i: Printer, n: "Imprimir", fn: () => imprimirComandera(ticketVenta(t, ajustes, W), ajustes.ancho, t.fiscal ? t.cae : null, toast) },
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
            qr={t.fiscal ? t.cae : null} className="py-2 shadow-sm" />
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

function FormProducto({ abierto, inicial, productos, provs, ajustes0, onGuardar, onClose }) {
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
          <Campo label="Margen">
            <div className={`${inputCls} f-m text-right bg-stone-50 ${margen > 0 && margen < 0.12 ? "text-red-600" : ""}`}>{precio ? pct(margen) : "—"}</div>
          </Campo>
          <Campo label="IVA">
            <select value={d.iva} onChange={(e) => set("iva", Number(e.target.value))} className={inputCls}>
              <option value={21}>21%</option><option value={10.5}>10,5%</option><option value={0}>Exento</option>
            </select>
          </Campo>
        </div>
        {(provs && ajustes0.listas ? ajustes0.listas : []).filter((l) => l.activa !== false).length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Otras listas de precio</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
              {ajustes0.listas.filter((l) => l.activa !== false).map((l) => {
                const v = Number((d.precios || {})[l.id]) || 0;
                return (
                  <label key={l.id} className="block">
                    <span className="text-[10px] text-stone-500">{l.nombre} · desde {l.umbral}</span>
                    <input value={(d.precios || {})[l.id] || ""}
                      onChange={(e) => set("precios", { ...(d.precios || {}), [l.id]: e.target.value.replace(/\D/g, "") })}
                      placeholder="—" className={`${inputCls} f-m text-right`} />
                    {v > 0 && v <= costo && <span className="text-[11px] text-red-600">bajo el costo</span>}
                    {v > costo && <span className="text-[11px] text-stone-400">margen {pct((v - costo) / v, 0)}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

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

function Productos({ productos, setProductos, toast, focoInicial, provs, ajustes }) {
  const [alta, setAlta] = useState(null);
  const [planilla, setPlanilla] = useState(null);   // resumen previo a aplicar
  const [modoPrecios, setModoPrecios] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const archivo = useRef(null);
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

  /* Un cambio de costo no es un dato más: alimenta el historial y de ahí sale
     el diagnóstico de caída de margen. Si se pisa sin registrar, el sistema
     deja de poder explicar por qué bajó la ganancia. */
  const actualizar = (id, cambios, msg) => {
    setProductos((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      const nuevo = { ...p, ...cambios };
      if (cambios.costo != null && Number(cambios.costo) !== p.costo && Number(cambios.costo) > 0) {
        nuevo.historial = [...p.historial, { fecha: HOY, costo: Number(cambios.costo) }];
      }
      return nuevo;
    }));
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
        {modoPrecios && (
          <span className="text-xs text-stone-500 basis-full sm:basis-auto">
            Editando precios: cada cambio se guarda solo. El porcentaje debajo es el margen.
          </span>
        )}
        <Boton size="sm" variant={modoPrecios ? "dark" : "ghost"} onClick={() => setModoPrecios((v) => !v)}>
          <Percent size={14} /> <span className="hidden sm:inline">{modoPrecios ? "Salir de precios" : "Editar precios"}</span>
        </Boton>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <input ref={archivo} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={async (e) => {
              const f = e.target.files[0]; e.target.value = "";
              if (!f) return;
              setLeyendo(true);
              try {
                const filas = await leerPlanilla(f);
                if (!filas.length) throw new Error("La planilla no tiene filas.");
                setPlanilla({ nombre: f.name, ...analizarPlanilla(filas, productos, ajustes.listas || []) });
              } catch (err) { toast(err.message, "mal"); }
              setLeyendo(false);
            }} />
          <Boton size="sm" variant="ghost" onClick={() => exportarCatalogo(productos, ajustes.listas || [], toast)}>
            <Upload size={14} className="rotate-180" /> <span className="hidden sm:inline">Exportar</span>
          </Boton>
          <Boton size="sm" variant="ghost" disabled={leyendo} onClick={() => archivo.current && archivo.current.click()}>
            {leyendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} <span className="hidden sm:inline">Importar</span>
          </Boton>
          <Boton size="sm" onClick={() => setAlta({})}><Plus size={14} /> <span className="hidden sm:inline">Nuevo producto</span><span className="sm:hidden">Nuevo</span></Boton>
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Siete columnas no entran en un celular: mismos datos, otra forma */}
        <ul className={`${modoPrecios ? "hidden" : "md:hidden"} divide-y divide-stone-100`}>
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
                      {Object.keys(p.precios || {}).length > 0 && (
                        <div className="text-[10px] text-emerald-600">{Object.keys(p.precios).length} lista{Object.keys(p.precios).length > 1 ? "s" : ""} más</div>
                      )}
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
        {modoPrecios ? (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-200 bg-stone-50">
                  <th className="px-4 py-2.5 font-semibold">Producto</th>
                  <th className="px-2 py-2.5 font-semibold text-right w-24">Costo</th>
                  <th className="px-2 py-2.5 font-semibold text-right w-32">General</th>
                  {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
                    <th key={l.id} className="px-2 py-2.5 font-semibold text-right w-32">
                      {l.nombre}<div className="font-normal normal-case text-[10px] text-stone-400">desde {l.umbral} u</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((p) => {
                  const mg = (v) => (Number(v) > 0 ? (Number(v) - p.costo) / Number(v) : null);
                  const celda = (valor, alGuardar) => {
                    const m2 = mg(valor);
                    return (
                      <td className="px-2 py-1.5 text-right">
                        <input value={valor || ""} onChange={(e) => alGuardar(Number(e.target.value.replace(/\D/g, "")))}
                          placeholder="—"
                          className={`f-m w-24 text-right border rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400 ${
                            m2 != null && m2 < 0.08 ? "border-red-300 bg-red-50" : "border-stone-200"}`} />
                        {m2 != null && <div className={`text-[10px] ${m2 < 0.08 ? "text-red-600" : "text-stone-400"}`}>{pct(m2, 0)}</div>}
                      </td>
                    );
                  };
                  return (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="px-4 py-1.5">
                        <div className="font-medium text-stone-900">{p.nombre}</div>
                        <div className="f-m text-[11px] text-stone-400">{p.categoria}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input value={p.costo || ""} onChange={(e) => actualizar(p.id, { costo: Number(e.target.value.replace(/\D/g, "")) })}
                          className="f-m w-24 text-right border border-stone-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400 bg-stone-50" />
                      </td>
                      {celda(p.precio, (n) => actualizar(p.id, { precio: n }))}
                      {(ajustes.listas || []).filter((l) => l.activa !== false).map((l) => (
                        <React.Fragment key={l.id}>
                          {celda((p.precios || {})[l.id], (n) => {
                            const cp = { ...(p.precios || {}) };
                            if (n > 0) cp[l.id] = n; else delete cp[l.id];
                            actualizar(p.id, { precios: cp });
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(ajustes.listas || []).filter((l) => l.activa !== false).length === 0 && (
              <Vacio>No hay listas creadas. Creá una en Ajustes para poder cargarle precios.</Vacio>
            )}
          </div>
        ) : (
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
                      {Object.entries(p.precios || {}).slice(0, 2).map(([k, v]) => (
                        <div key={k} className="text-[10px] text-emerald-600 font-normal">{money(v)}</div>
                      ))}
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
        )}
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

      <FichaProducto p={productos.find((x) => x.id === abierto)} onClose={() => setAbierto(null)} actualizar={actualizar} ajustes={ajustes} editar={(p) => { setAbierto(null); setAlta(p); }} />

      <ImportarPlanilla resumen={planilla} listas={ajustes.listas || []} onCerrar={() => setPlanilla(null)}
        onAplicar={() => {
          const { nuevos, cambios } = planilla;
          const num = (v) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")); return isNaN(n) ? null : n; };
          setProductos((ps) => {
            let acc = ps.map((p) => {
              const c = cambios.find((x) => x.p.id === p.id);
              if (!c) return p;
              const f = c.datos;
              const precios = { ...(p.precios || {}) };
              for (const l of (ajustes.listas || [])) {
                const col = `precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
                if (String(f[col] ?? "").trim() === "") continue;
                const v = num(f[col]);
                if (v > 0) precios[l.id] = v; else delete precios[l.id];
              }
              const tomar = (col, actual) => (String(f[col] ?? "").trim() === "" ? actual : (num(f[col]) ?? actual));
              const costoNuevo = tomar("costo", p.costo);
              return {
                ...p,
                nombre: String(f.nombre || "").trim() || p.nombre,
                costo: costoNuevo,
                precio: tomar("precio", p.precio),
                stock: tomar("stock", p.stock),
                stockMin: tomar("stock_minimo", p.stockMin),
                precios,
                historial: costoNuevo !== p.costo ? [...p.historial, { fecha: HOY, costo: costoNuevo }] : p.historial,
              };
            });
            for (const n of nuevos) {
              const f = n.datos;
              const precios = {};
              for (const l of (ajustes.listas || [])) {
                const col = `precio_${l.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
                const v = num(f[col]);
                if (v > 0) precios[l.id] = v;
              }
              acc = [...acc, productoNuevo({
                nombre: f.nombre, barcode: String(f.codigo || "").replace(/\D/g, ""),
                categoria: f.rubro, marca: f.marca, proveedor: f.proveedor,
                unidad: f.unidad === "kg" ? "kg" : "un", iva: num(f.iva) || 21, bulto: num(f.bulto) || 1,
                stock: num(f.stock) || 0, stockMin: num(f.stock_minimo) || 0,
                costo: num(f.costo) || 0, precio: num(f.precio) || 0, precios,
              }, acc)];
            }
            return acc;
          });
          toast(`Planilla aplicada: ${cambios.length} actualizados, ${nuevos.length} nuevos.`);
          setPlanilla(null);
        }} />

      <FormProducto abierto={!!alta} inicial={alta} productos={productos} provs={provs} ajustes0={ajustes} onClose={() => setAlta(null)}
        onGuardar={(d, faltan) => {
          if (d.id) {
            setProductos((ps) => ps.map((p) => (p.id === d.id ? {
              ...p, ...d,
              historial: Number(d.costo) > 0 && Number(d.costo) !== p.costo
                ? [...p.historial, { fecha: HOY, costo: Number(d.costo) }] : p.historial,
              costo: Number(d.costo) || 0, precio: Number(d.precio) || 0,
              stock: Number(d.stock) || 0, stockMin: Number(d.stockMin) || 0, bulto: Number(d.bulto) || 1,
              barcode: String(d.barcode || "").replace(/\D/g, ""),
              precios: Object.fromEntries(Object.entries(d.precios || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
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

/* Pantalla previa a aplicar una planilla. Se muestra exactamente qué va a
   cambiar antes de tocar el catálogo: una importación a ciegas sobre 900
   productos es irreversible y no hay forma de darse cuenta del error. */
function ImportarPlanilla({ resumen, listas, onAplicar, onCerrar }) {
  if (!resumen) return null;
  const { nuevos, cambios, errores, nombre } = resumen;
  const total = nuevos.length + cambios.length;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">Revisá antes de aplicar</h3>
          <p className="text-xs text-stone-500">{nombre}</p>
        </div>
        <button onClick={onCerrar} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[["Se actualizan", cambios.length, "text-amber-700 bg-amber-50 border-amber-200"],
            ["Se crean", nuevos.length, "text-emerald-700 bg-emerald-50 border-emerald-200"],
            ["Con problemas", errores.length, errores.length ? "text-red-700 bg-red-50 border-red-200" : "text-stone-500 bg-stone-50 border-stone-200"]]
            .map(([t, n, cls]) => (
            <div key={t} className={`rounded-xl border p-3 text-center ${cls}`}>
              <div className="f-d text-2xl">{nf.format(n)}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold">{t}</div>
            </div>
          ))}
        </div>

        {errores.length > 0 && (
          <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="font-semibold">Estas filas no se van a aplicar:</p>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">{errores.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}</ul>
            {errores.length > 6 && <p className="mt-1">y {errores.length - 6} más.</p>}
          </div>
        )}

        {cambios.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Qué cambia</div>
            <ul className="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-64 overflow-auto text-sm">
              {cambios.slice(0, 40).map((c) => (
                <li key={c.fila} className="px-3 py-2">
                  <div className="font-medium truncate">{c.p.nombre}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {c.dif.map((d, i) => (
                      <span key={i} className="f-m text-[11px] text-stone-500">
                        {d.campo}: <span className="line-through text-stone-400">{typeof d.antes === "number" ? nf.format(d.antes) : String(d.antes).slice(0, 22)}</span>
                        {" → "}
                        <span className="text-stone-900">{typeof d.ahora === "number" ? nf.format(d.ahora) : String(d.ahora).slice(0, 22)}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {cambios.length > 40 && <p className="text-xs text-stone-400 mt-1">Se muestran los primeros 40 de {cambios.length}.</p>}
          </div>
        )}

        {nuevos.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Productos nuevos</div>
            <ul className="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-40 overflow-auto text-sm">
              {nuevos.slice(0, 20).map((n) => (
                <li key={n.fila} className="px-3 py-1.5 flex justify-between gap-3">
                  <span className="truncate">{n.datos.nombre}</span>
                  <span className="f-m text-xs text-stone-400 shrink-0">{n.datos.precio ? money(Number(n.datos.precio)) : "sin precio"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-stone-500">
          Las columnas vacías no se tocan: si borrás el contenido de una celda, ese dato queda como estaba.
          Para quitar el precio de una lista, poné un cero.
        </p>

        <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={onAplicar} disabled={total === 0}><Check size={15} /> Aplicar {nf.format(total)} cambios</Boton>
        </div>
      </div>
    </Modal>
  );
}

function FichaProducto({ p, onClose, actualizar, editar, ajustes }) {
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  useEffect(() => { if (p) { setPrecio(String(p.precio)); setCosto(String(p.costo)); } }, [p && p.id]);
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
            ["Otras listas", Object.keys(p.precios || {}).length || "—"], ["Margen", pct(m)]].map(([l, v]) => (
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

        {(ajustes && ajustes.listas ? ajustes.listas : []).filter((l) => l.activa !== false).length > 0 && (
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Precios por lista</div>
            <ul className="divide-y divide-stone-100">
              <li className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Precio general</div>
                  <div className="text-[11px] text-stone-400">siempre · margen {pct(m, 0)}</div>
                </div>
                <span className="f-m text-sm w-28 text-right">{money(p.precio)}</span>
              </li>
              {ajustes.listas.filter((l) => l.activa !== false).map((l) => {
                const v = (p.precios || {})[l.id] || "";
                const sug = Math.round((p.precio * (1 - (ajustes.desc2 || 10) / 100)) / 10) * 10;
                const mv = Number(v) > 0 ? (Number(v) - p.costo) / Number(v) : null;
                return (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.nombre}</div>
                      <div className="text-[11px] text-stone-400">
                        desde {l.umbral} u
                        {mv != null && <span className={mv < 0.08 ? " text-red-600" : ""}> · margen {pct(mv, 0)}</span>}
                        {!v && p.precio > 0 && (
                          <button onClick={() => actualizar(p.id, { precios: { ...(p.precios || {}), [l.id]: sug } }, `${l.nombre}: ${money(sug)}`)}
                            className="ml-1 font-semibold text-orange-600 hover:underline">poner {money(sug)}</button>
                        )}
                      </div>
                    </div>
                    <input value={v}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, ""));
                        const cp = { ...(p.precios || {}) };
                        if (n > 0) cp[l.id] = n; else delete cp[l.id];
                        actualizar(p.id, { precios: cp });
                      }}
                      placeholder="—"
                      className="f-m w-28 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-stone-400 mt-2">Vacío significa que este producto no entra en esa lista.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-stone-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Costo y precio general</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-stone-500">Costo</span>
                <input value={costo} onChange={(e) => setCosto(e.target.value.replace(/\D/g, ""))}
                  className="f-m w-full text-right border border-stone-200 rounded-lg px-3 py-2 text-sm mt-0.5 outline-none focus:border-orange-400" />
              </label>
              <label className="block">
                <span className="text-[11px] text-stone-500">Precio</span>
                <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
                  className="f-m w-full text-right border border-stone-200 rounded-lg px-3 py-2 text-sm mt-0.5 outline-none focus:border-orange-400" />
              </label>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Margen resultante: <strong>{pct(((Number(precio) || p.precio) - (Number(costo) || p.costo)) / (Number(precio) || p.precio))}</strong>
              {Number(costo) > 0 && Number(costo) !== p.costo && (
                <span className="block text-amber-700 mt-1">
                  El costo pasa de {money(p.costo)} a {money(Number(costo))}: queda registrado en el historial.
                </span>
              )}
            </p>
            <Boton size="sm" className="w-full mt-2" onClick={() => actualizar(p.id, {
              precio: Number(precio) || p.precio,
              costo: Number(costo) || p.costo,
            }, "Costo y precio actualizados.")}>Guardar</Boton>
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
    const { precio, lista, nombre } = precioAplicado(p ? { ...p, precio: l.precio } : { precio: l.precio, precios: {} }, l.preparado, ajustes);
    return { ...l, unit: precio, lista, listaNombre: nombre };
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
      return { pid: l.pid, qty: l.preparado, precio: l.unit, costo: p ? p.costo : 0, nombre: l.nombre, unidad: l.unidad, lista: l.lista, listaNombre: l.listaNombre };
    });
    const t = cobrar({ items: lineas, sub: monto, desc: 0, total: monto, medio, fiscal: !!ajustes.arca,
      ganancia: monto - lineas.reduce((s, l) => s + l.costo * l.qty, 0) });
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
                      {(conPrecio.find((x) => x.pid === l.pid) || {}).lista && <span className="block text-[9px] text-emerald-600 font-bold uppercase">{(conPrecio.find((x) => x.pid === l.pid) || {}).listaNombre}</span>}
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
                    {(conPrecio.find((x) => x.pid === l.pid) || {}).lista && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 uppercase">{(conPrecio.find((x) => x.pid === l.pid) || {}).listaNombre}</span>}
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
              {mediosDe(ajustes).map((m) => <Boton key={m.k} size="sm" variant="ghost" onClick={() => cobrarPedido(m.k)}>{m.n}</Boton>)}
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
   9 ter. CLIENTES
   ============================================================ */

function FormCliente({ abierto, inicial, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD({ tipoDoc: "CUIT", condicion: "CF", ...(inicial || {}) }); }, [abierto, inicial]);
  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const necesitaCuit = d.condicion === "RI" || d.condicion === "MONOTRIBUTO" || d.condicion === "EXENTO";
  const faltaCuit = necesitaCuit && (!d.doc || d.tipoDoc !== "CUIT");

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.id ? "Editar cliente" : "Nuevo cliente"}</h3>
        <div className="space-y-3 mt-4">
          <Campo label="Razón social o nombre">
            <input value={d.razonSocial || ""} onChange={(e) => set("razonSocial", e.target.value)} autoFocus className={inputCls} />
          </Campo>
          <Campo label="Condición frente al IVA">
            <select value={d.condicion} onChange={(e) => set("condicion", e.target.value)} className={inputCls}>
              {CONDICIONES.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo">
              <select value={d.tipoDoc} onChange={(e) => set("tipoDoc", e.target.value)} className={inputCls}>
                <option>CUIT</option><option>DNI</option><option>CUIL</option>
              </select>
            </Campo>
            <label className="block col-span-2">
              <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Número</span>
              <input value={d.doc || ""} onChange={(e) => set("doc", e.target.value)} className={`${inputCls} f-m`} />
            </label>
          </div>
          <Campo label="Domicilio"><input value={d.domicilio || ""} onChange={(e) => set("domicilio", e.target.value)} className={inputCls} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Email"><input value={d.email || ""} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Campo>
            <Campo label="Teléfono"><input value={d.tel || ""} onChange={(e) => set("tel", e.target.value)} className={`${inputCls} f-m`} /></Campo>
          </div>
        </div>

        {faltaCuit && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
            Un {condicionNombre(d.condicion).toLowerCase()} necesita CUIT para que la factura sea válida.
            Sin eso, la venta va a salir como Factura B.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d)} disabled={!d.razonSocial}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

function Clientes({ clientes, setClientes, tickets, ajustes, toast }) {
  const [q, setQ] = useState("");
  const [alta, setAlta] = useState(null);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lista = q.trim().length >= 2
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q.trim()))
    : clientes;
  const emisor = (ajustes.fiscal || FISCAL_INICIAL).condicion;

  const facturadoA = (id) => tickets.filter((t) => t.cliente && t.cliente.id === id).reduce((s, t) => s + t.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o CUIT"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl outline-none focus:border-orange-400 bg-white" />
        </div>
        <Boton size="sm" onClick={() => setAlta({})}><Plus size={14} /> Nuevo cliente</Boton>
      </div>

      <Card className="overflow-hidden">
        {lista.length === 0 ? <Vacio>No hay clientes cargados. Los necesitás solo para emitir facturas: la venta al mostrador no requiere ninguno.</Vacio> : (
          <ul className="divide-y divide-stone-100">
            {lista.map((c) => {
              const letra = letraComprobante(emisor, c.condicion);
              const total = facturadoA(c.id);
              return (
                <li key={c.id}>
                  <button onClick={() => setAlta(c)} className="w-full text-left px-4 py-3 hover:bg-stone-50 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-900">{c.razonSocial}</div>
                      <div className="f-m text-[11px] text-stone-400">
                        {c.tipoDoc} {c.doc || "sin número"} · {condicionNombre(c.condicion)}
                        {c.tel ? ` · ${c.tel}` : ""}
                      </div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                      letra === "A" ? "bg-stone-900 text-white border-stone-900" : "bg-stone-100 text-stone-600 border-stone-200"}`}>
                      Factura {letra}
                    </span>
                    {total > 0 && <span className="f-m text-sm text-stone-500">{money(total)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-stone-500">
        La letra la calcula el sistema: sos <strong>{condicionNombre(emisor)}</strong>, así que a un responsable inscripto
        le emitís {letraComprobante(emisor, "RI")} y al resto {letraComprobante(emisor, "CF")}.
        Se cambia en Ajustes, en Datos fiscales.
      </p>

      <FormCliente abierto={!!alta} inicial={alta} onCerrar={() => setAlta(null)}
        onGuardar={(d) => {
          if (d.id) setClientes((cs) => cs.map((c) => (c.id === d.id ? { ...c, ...d } : c)));
          else setClientes((cs) => [...cs, { ...d, id: "c" + uid() }]);
          setAlta(null);
          toast(`${d.razonSocial} guardado.`);
        }} />
    </div>
  );
}

/* ============================================================
   10. CAJA
   ============================================================ */

function Caja({ caja, movCaja, cerrarCaja, abrirCaja, toast, ajustes }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ monto: "", detalle: "", medio: "efectivo" });
  const [contado, setContado] = useState("");

  const porMedio = mediosDe(ajustes).map((m) => {
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
                    <div className="text-[11px] text-stone-400">{m.hora} · {medioPorK(ajustes, m.medio).n}</div>
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
                  {m.tasa > 0 && m.ing > 0 && <div className="text-[10px] text-stone-400 mt-0.5">Comisión estimada {money(m.ing * m.tasa / 100)}</div>}
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 mt-3 pt-3 text-xs text-stone-500">
              Las comisiones de tarjeta te descuentan <strong>{money(porMedio.reduce((s, m) => s + m.ing * m.tasa / 100, 0))}</strong> hoy. No aparecen en el ticket pero sí en tu ganancia.
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
            {mediosDe(ajustes).map((m) => (
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

function Ajustes({ ajustes, setAjustes, productos, setProductos, toast, mp, setMp, simularCobro }) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const setFiscal = (cambios) => setAjustes({ ...ajustes, fiscal: { ...f, ...cambios } });
  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <h3 className="f-d text-lg">Datos fiscales</h3>
        <p className="text-sm text-stone-500 mt-1">
          Tu condición determina qué comprobantes podés emitir, y el sistema la aplica sola.
          Un monotributista emite siempre Factura C. Un responsable inscripto emite A cuando le vende a otro
          responsable inscripto, y B en los demás casos.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <Campo label="Nombre en la factura">
            <input value={f.nombreFactura || ""} onChange={(e) => setFiscal({ nombreFactura: e.target.value })} className={inputCls} />
          </Campo>
          <Campo label="Razón social">
            <input value={f.razonSocial || ""} onChange={(e) => setFiscal({ razonSocial: e.target.value })} className={inputCls} />
          </Campo>
          <Campo label="Condición frente al IVA">
            <select value={f.condicion} onChange={(e) => setFiscal({ condicion: e.target.value })} className={inputCls}>
              {CONDICIONES.filter((c) => c.k !== "CF").map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
            </select>
          </Campo>
          <Campo label="CUIT">
            <input value={f.cuit || ""} onChange={(e) => setFiscal({ cuit: e.target.value })} className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Ingresos Brutos">
            <input value={f.iibb || ""} onChange={(e) => setFiscal({ iibb: e.target.value })} className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Inicio de actividades">
            <input value={f.inicio || ""} onChange={(e) => setFiscal({ inicio: e.target.value })} placeholder="01/03/2019" className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Punto de venta">
            <input value={f.puntoVenta || ""} onChange={(e) => setFiscal({ puntoVenta: e.target.value })} className={`${inputCls} f-m`} />
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Domicilio comercial">
              <input value={f.domicilio || ""} onChange={(e) => setFiscal({ domicilio: e.target.value })} className={inputCls} />
            </Campo>
          </div>
          <div className="md:col-span-2">
            <Campo label="Nombre en pantalla (no sale en los comprobantes)">
              <input value={ajustes.negocio} onChange={(e) => setAjustes({ ...ajustes, negocio: e.target.value })} className={inputCls} />
            </Campo>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold mb-1.5">Qué vas a emitir</div>
          <ul className="space-y-1 text-stone-600">
            <li>A un <strong>responsable inscripto</strong>: Factura <strong>{letraComprobante(f.condicion, "RI")}</strong>
              {discriminaIVA(letraComprobante(f.condicion, "RI")) ? ", con IVA discriminado al pie." : ", con IVA incluido en el precio."}</li>
            <li>A un <strong>consumidor final</strong> o monotributista: Factura <strong>{letraComprobante(f.condicion, "CF")}</strong>, con IVA incluido.</li>
          </ul>
          {f.condicion !== "RI" && (
            <p className="text-xs text-stone-500 mt-2">
              Como {condicionNombre(f.condicion).toLowerCase()} no discriminás IVA, así que la Factura A no aplica
              aunque el cliente sea responsable inscripto.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Medios de pago</h3>
            <p className="text-sm text-stone-500 mt-1">
              El porcentaje puede funcionar de dos formas. Como <strong>comisión</strong>, lo absorbe el negocio: el cliente paga
              el mismo total y la diferencia sale de tu ganancia. Como <strong>recargo</strong>, se le suma al cliente y cambia el
              total de la venta.
            </p>
          </div>
          <Boton size="sm" className="shrink-0" onClick={() => setAjustes({ ...ajustes, medios: [...(ajustes.medios || []), { k: "m" + uid(), n: "Nuevo medio", tasa: 0, recargo: false, activo: true }] })}>
            <Plus size={14} /> Agregar
          </Boton>
        </div>

        <div className="mt-4 space-y-2">
          {(ajustes.medios || []).map((m, i) => {
            const cambiar = (campo, valor) => setAjustes({ ...ajustes, medios: ajustes.medios.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)) });
            return (
              <div key={m.k} className={`border rounded-xl p-3 ${m.activo === false ? "bg-stone-50 opacity-70 border-stone-200" : "border-stone-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={m.n} onChange={(e) => cambiar("n", e.target.value)}
                    className="flex-1 min-w-[140px] border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-orange-400" />
                  <label className="flex items-center gap-1.5 text-xs text-stone-500">
                    <input value={m.tasa} onChange={(e) => cambiar("tasa", Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                      className="f-m w-16 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
                    %
                  </label>
                  <button onClick={() => cambiar("recargo", !m.recargo)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${m.recargo ? "border-amber-300 bg-amber-50 text-amber-800" : "border-stone-200 text-stone-500"}`}>
                    {m.recargo ? "Lo paga el cliente" : "Lo absorbe el negocio"}
                  </button>
                  <button onClick={() => cambiar("activo", m.activo === false)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${m.activo === false ? "border-stone-200 text-stone-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {m.activo === false ? "Apagado" : "Activo"}
                  </button>
                  <button onClick={() => {
                    if (!window.confirm(`¿Eliminar "${m.n}"? Las ventas ya cobradas con este medio no se modifican.`)) return;
                    setAjustes({ ...ajustes, medios: ajustes.medios.filter((_, j) => j !== i) });
                  }} className="text-stone-300 hover:text-red-600 p-1.5"><Trash2 size={16} /></button>
                </div>
                {m.tasa > 0 && (
                  <p className="text-[11px] text-stone-400 mt-1.5">
                    {m.recargo
                      ? `Una venta de ${money(10000)} se cobra ${money(conRecargo(10000, m).total)}.`
                      : `Una venta de ${money(10000)} deja ${money(10000 - 10000 * m.tasa / 100)} después de la comisión.`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-stone-400 mt-3">
          En el cobro, cada medio se elige con su número. Apagar uno lo saca de la caja sin borrar el historial.
        </p>
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
        <p className="text-xs text-stone-400 mt-3">
          Esto define con qué opción arranca cada venta. En la pantalla de cobro se puede cambiar venta por venta,
          con el selector Ticket / Factura. En esta demo el CAE es simulado: sirve para ver el flujo, no tiene validez fiscal.
        </p>
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Listas de precio</h3>
            <p className="text-sm text-stone-500 mt-1">
              Cada lista tiene una cantidad mínima y se activa sola cuando un renglón del ticket la alcanza, solo en ese renglón.
              Si un producto entra en varias, se cobra la de mayor cantidad que el cliente alcance.
            </p>
          </div>
          <Boton size="sm" className="shrink-0" onClick={() => {
            const n = (ajustes.listas || []).length + 2;
            setAjustes({ ...ajustes, listas: [...(ajustes.listas || []), { id: "l" + uid(), nombre: `Lista ${n}`, umbral: 6, activa: true }] });
          }}><Plus size={14} /> Nueva lista</Boton>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-sm font-semibold flex-1">Precio general</span>
            <span className="text-xs text-stone-500">siempre · es el precio de la ficha</span>
          </div>

          {(ajustes.listas || []).length === 0 && (
            <p className="text-sm text-stone-400 px-1">No hay listas adicionales. Todo se cobra al precio general.</p>
          )}

          {(ajustes.listas || []).map((l, i) => {
            const cuantos = productos.filter((p) => (p.precios || {})[l.id] > 0).length;
            const cambiar = (campo, valor) => setAjustes({
              ...ajustes,
              listas: ajustes.listas.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)),
            });
            return (
              <div key={l.id} className={`border rounded-xl p-3 ${l.activa === false ? "border-stone-200 bg-stone-50 opacity-70" : "border-stone-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={l.nombre} onChange={(e) => cambiar("nombre", e.target.value)}
                    className="flex-1 min-w-[140px] border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-orange-400" />
                  <label className="flex items-center gap-1.5 text-xs text-stone-500">
                    desde
                    <input value={l.umbral} onChange={(e) => cambiar("umbral", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                      className="f-m w-14 text-right border border-stone-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
                    u
                  </label>
                  <button onClick={() => cambiar("activa", l.activa === false)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${l.activa === false ? "border-stone-200 text-stone-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {l.activa === false ? "Apagada" : "Activa"}
                  </button>
                  <button onClick={() => {
                    if (cuantos > 0 && !window.confirm(`"${l.nombre}" tiene precio en ${cuantos} productos. Al borrarla se pierden esos precios. ¿Seguro?`)) return;
                    setAjustes({ ...ajustes, listas: ajustes.listas.filter((_, j) => j !== i) });
                    setProductos((ps) => ps.map((p) => {
                      if (!(p.precios || {})[l.id]) return p;
                      const cp = { ...p.precios }; delete cp[l.id];
                      return { ...p, precios: cp };
                    }));
                    toast(`Lista "${l.nombre}" eliminada.`);
                  }} className="text-stone-300 hover:text-red-600 p-1.5" title="Eliminar lista"><Trash2 size={16} /></button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  {cuantos > 0 ? `${nf.format(cuantos)} productos con precio en esta lista` : "Ningún producto tiene precio en esta lista todavía"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-stone-100">
          <span className="text-sm text-stone-500 shrink-0">Descuento sugerido al cargar</span>
          <input type="range" min="3" max="30" value={ajustes.desc2}
            onChange={(e) => setAjustes({ ...ajustes, desc2: Number(e.target.value) })} className="flex-1 accent-orange-500" />
          <span className="f-m text-lg w-16 text-right">{ajustes.desc2}%</span>
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Los precios de cada lista se cargan producto por producto, o de una vez con la planilla desde el catálogo.
        </p>
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

/* ============================================================
   0. GENEZ · plataforma, comercios, roles y permisos
   ============================================================

   El sistema del comercio es un inquilino dentro de Genez. Quién entra
   determina a qué comercio accede, qué módulos ve y qué puede hacer adentro.

   Hoy los datos viven en memoria: alcanza para mostrar el producto completo,
   pero la validación real tiene que correr en el servidor. Mientras eso no
   exista, no repartir credenciales fuera de una demo acompañada.           */

const MODULOS = [
  { k: "cobro", n: "Cobro", d: "Punto de venta, tickets y vuelto", base: true },
  { k: "caja", n: "Caja", d: "Arqueo, gastos y cierre", base: true },
  { k: "ajustes", n: "Ajustes", d: "Configuración del negocio", base: true },
  { k: "productos", n: "Productos", d: "Catálogo, precios y listas" },
  { k: "stock", n: "Stock", d: "Alertas, vencimientos e inventario" },
  { k: "compras", n: "Compras", d: "Remitos, costos y proveedores" },
  { k: "pedidos", n: "Pedidos", d: "Preparación con pistola" },
  { k: "clientes", n: "Clientes", d: "Facturación A, B y C" },
  { k: "reportes", n: "Informes", d: "Ventas, márgenes y rubros" },
  { k: "asistente", n: "Asistente", d: "Diagnóstico y consultas" },
];

const MODULOS_BASE = MODULOS.filter((m) => m.base).map((m) => m.k);

/* Cada rol define qué módulos alcanza y qué acciones puede ejecutar.
   "todos" evita tener que actualizar el rol del dueño cada vez que se agrega
   un módulo nuevo. */
const ROLES = [
  {
    k: "dueno", n: "Dueño", d: "Acceso completo al comercio",
    modulos: "todos",
    permisos: { verCostos: true, descuentos: true, anular: true, cerrarCaja: true, cambiarPrecios: true, ajustes: true },
  },
  {
    k: "encargado", n: "Encargado", d: "Todo menos la configuración",
    modulos: ["cobro", "caja", "productos", "stock", "compras", "pedidos", "clientes", "reportes", "asistente"],
    permisos: { verCostos: true, descuentos: true, anular: true, cerrarCaja: true, cambiarPrecios: true, ajustes: false },
  },
  {
    k: "cajero", n: "Cajero", d: "Cobra, sin ver costos ni ganancias",
    modulos: ["cobro", "caja", "pedidos", "clientes"],
    permisos: { verCostos: false, descuentos: false, anular: false, cerrarCaja: false, cambiarPrecios: false, ajustes: false },
  },
  {
    k: "repositor", n: "Repositor", d: "Stock y preparación de pedidos",
    modulos: ["stock", "pedidos", "productos"],
    permisos: { verCostos: false, descuentos: false, anular: false, cerrarCaja: false, cambiarPrecios: false, ajustes: false },
  },
];

const rolPorK = (k) => ROLES.find((r) => r.k === k) || ROLES[ROLES.length - 1];

/* Lo que puede hacer una sesión: cruce entre lo que el comercio contrató y lo
   que el rol habilita. Un módulo no contratado no lo ve ni el dueño. */
function permisosDe(sesion) {
  if (!sesion) return { modulos: [], permisos: {}, esPlataforma: false };
  if (sesion.tipo === "plataforma") {
    return { modulos: MODULOS.map((m) => m.k), permisos: rolPorK("dueno").permisos, esPlataforma: true };
  }
  const rol = rolPorK(sesion.rol);
  const contratados = sesion.comercio.modulos || [];
  const delRol = rol.modulos === "todos" ? contratados : rol.modulos;
  return {
    modulos: contratados.filter((k) => delRol.includes(k)),
    permisos: rol.permisos,
    esPlataforma: false,
  };
}

const COMERCIOS_INICIALES = [
  {
    id: "cm1", nombre: "Super 25", plan: "Completo",
    modulos: MODULOS.map((m) => m.k), alta: "09/2025", activo: true,
    usuarios: [
      { id: "u1", nombre: "Axel Gonzalez", usuario: "axel", clave: "super25", rol: "dueno" },
      { id: "u2", nombre: "Cristian Barrios", usuario: "cristian", clave: "caja2026", rol: "cajero" },
    ],
  },
  {
    id: "cm2", nombre: "Despensa La Esquina", plan: "Mostrador",
    modulos: [...MODULOS_BASE, "productos", "stock"], alta: "01/2026", activo: true,
    usuarios: [
      { id: "u3", nombre: "Ana Puig", usuario: "ana", clave: "esquina01", rol: "dueno" },
    ],
  },
];

const DUENO_PLATAFORMA = { usuario: "Nehuen", clave: "Coronado01", nombre: "Nehuen González" };

function FormUsuario({ abierto, inicial, modulosComercio, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD({ rol: "cajero", ...(inicial || {}) }); }, [abierto, inicial]);
  if (!abierto) return null;
  const rol = rolPorK(d.rol);
  const alcance = rol.modulos === "todos" ? modulosComercio : modulosComercio.filter((k) => rol.modulos.includes(k));

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.id ? "Editar acceso" : "Nuevo acceso"}</h3>
        <div className="space-y-3 mt-4">
          <Campo label="Nombre de la persona">
            <input value={d.nombre || ""} onChange={(e) => setD({ ...d, nombre: e.target.value })} autoFocus className={inputCls} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Usuario">
              <input value={d.usuario || ""} onChange={(e) => setD({ ...d, usuario: e.target.value.replace(/\s/g, "").toLowerCase() })} className={`${inputCls} f-m`} />
            </Campo>
            <Campo label="Contraseña">
              <input value={d.clave || ""} onChange={(e) => setD({ ...d, clave: e.target.value })} className={`${inputCls} f-m`} />
            </Campo>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Rol</span>
            <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
              {ROLES.map((r) => (
                <button key={r.k} onClick={() => setD({ ...d, rol: r.k })}
                  className={`text-left px-3 py-2 rounded-xl border ${d.rol === r.k ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
                  <div className="text-sm font-semibold">{r.n}</div>
                  <div className="text-[11px] text-stone-500">{r.d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold mb-2">Con este rol va a ver</div>
          <div className="flex flex-wrap gap-1.5">
            {alcance.length === 0 && <span className="text-sm text-stone-400">Ningún módulo: el comercio no tiene contratado nada de lo que este rol alcanza.</span>}
            {alcance.map((k) => (
              <span key={k} className="text-[11px] px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700">{(MODULOS.find((m) => m.k === k) || {}).n}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-stone-500">
            {[["verCostos", "Ver costos y márgenes"], ["descuentos", "Dar descuentos"], ["anular", "Anular ventas"],
              ["cerrarCaja", "Cerrar caja"], ["cambiarPrecios", "Cambiar precios"], ["ajustes", "Configuración"]].map(([k, n]) => (
              <span key={k} className={rol.permisos[k] ? "text-emerald-700 font-semibold" : "text-stone-400 line-through"}>{n}</span>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d)} disabled={!d.nombre || !d.usuario || !d.clave}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

function PanelGenez({ sesion, comercios, setComercios, onEntrarComo, onSalir, tema, setTema, imagenFondo, setImagenFondo }) {
  const [abierto, setAbierto] = useState(null);       // comercio en detalle
  const [altaUsuario, setAltaUsuario] = useState(null);
  const [altaComercio, setAltaComercio] = useState(false);
  const archivoFondo = useRef(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const c = comercios.find((x) => x.id === abierto) || null;

  const actualizar = (id, cambios) => setComercios((cs) => cs.map((x) => (x.id === id ? { ...x, ...cambios } : x)));

  const alternarModulo = (k) => {
    if (MODULOS_BASE.includes(k)) return;             // el piso mínimo no se saca
    const tiene = c.modulos.includes(k);
    actualizar(c.id, { modulos: tiene ? c.modulos.filter((x) => x !== k) : [...c.modulos, k] });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <header className="border-b border-stone-800 px-4 md:px-6 py-3 flex items-center gap-3">
        <LogoGenez size={34} claro conNombre />
        <span className="text-[10px] uppercase tracking-widest text-orange-400 font-bold border border-orange-500/40 rounded px-1.5 py-0.5">Administración</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-stone-400 hidden sm:block">{sesion.nombre}</span>
          <BotonTema tema={tema} setTema={setTema} oscuroFijo />
          <button onClick={onSalir} className="text-sm text-stone-400 hover:text-white">Salir</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {!c ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <h1 className="f-d text-2xl">Comercios</h1>
                <p className="text-sm text-stone-400">{comercios.length} cuentas · {comercios.filter((x) => x.activo).length} activas</p>
              </div>
              <button onClick={() => { setAltaComercio(true); setNombreNuevo(""); }}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold rounded-xl px-3.5 py-2 text-sm">
                <Plus size={15} /> Nuevo comercio
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {comercios.map((x) => (
                <button key={x.id} onClick={() => setAbierto(x.id)}
                  className="text-left bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{x.nombre}</div>
                      <div className="text-[11px] text-stone-500">Alta {x.alta} · {x.usuarios.length} usuario{x.usuarios.length !== 1 ? "s" : ""}</div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border shrink-0 ${
                      x.activo ? "border-emerald-500/40 text-emerald-400" : "border-stone-700 text-stone-500"}`}>
                      {x.activo ? "Activo" : "Suspendido"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {x.modulos.filter((k) => !MODULOS_BASE.includes(k)).map((k) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">{(MODULOS.find((m) => m.k === k) || {}).n}</span>
                    ))}
                    {x.modulos.filter((k) => !MODULOS_BASE.includes(k)).length === 0 && (
                      <span className="text-[11px] text-stone-500">Solo los módulos base</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <section className="mt-8">
              <h2 className="text-[11px] uppercase tracking-widest text-stone-500 font-bold mb-2">Imagen del login</h2>
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-40 h-28 rounded-xl overflow-hidden border border-stone-800 shrink-0 relative bg-stone-950">
                    {imagenFondo
                      ? <img src={imagenFondo} alt="Fondo del login" className="w-full h-full object-cover" />
                      : <div className="absolute inset-0 flex items-center justify-center text-[11px] text-stone-600 text-center px-2">Panel generado por el sistema</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-400">
                      Podés reemplazar el panel izquierdo del login por una imagen propia. Se recorta al centro,
                      así que dejá los bordes sin nada importante.
                    </p>
                    <ul className="text-[11px] text-stone-500 mt-2 space-y-0.5">
                      <li><strong className="text-stone-400">Medida ideal:</strong> 1400 × 2000 px (vertical, proporción 7:10).</li>
                      <li><strong className="text-stone-400">Zona segura:</strong> los 200 px del borde derecho se funden con el fondo.</li>
                      <li><strong className="text-stone-400">Peso:</strong> hasta 2 MB. JPG o PNG.</li>
                      <li>En celular no se muestra: ahí el login va a pantalla completa.</li>
                    </ul>
                    <div className="flex items-center gap-2 mt-3">
                      <input ref={archivoFondo} type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files[0]; e.target.value = "";
                          if (!f) return;
                          if (f.size > 2 * 1024 * 1024) return alert("La imagen supera los 2 MB. Reducila y volvé a intentar.");
                          const lector = new FileReader();
                          lector.onload = () => setImagenFondo(lector.result);
                          lector.readAsDataURL(f);
                        }} />
                      <button onClick={() => archivoFondo.current && archivoFondo.current.click()}
                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold rounded-xl px-3.5 py-2 text-sm">
                        <Upload size={15} /> Cargar imagen
                      </button>
                      {imagenFondo && (
                        <button onClick={() => setImagenFondo(null)}
                          className="text-sm text-stone-400 hover:text-white px-2">Volver al panel del sistema</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <button onClick={() => setAbierto(null)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-white mb-4">
              <ChevronLeft size={16} /> Todos los comercios
            </button>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="f-d text-2xl">{c.nombre}</h1>
                <p className="text-sm text-stone-400">Alta {c.alta}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => actualizar(c.id, { activo: !c.activo })}
                  className={`text-sm font-semibold rounded-xl px-3 py-2 border ${c.activo ? "border-stone-700 text-stone-300 hover:bg-stone-900" : "border-emerald-500/40 text-emerald-400"}`}>
                  {c.activo ? "Suspender" : "Reactivar"}
                </button>
                <button onClick={() => onEntrarComo(c)}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold rounded-xl px-3.5 py-2 text-sm">
                  Entrar al sistema <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <section className="mt-6">
              <h2 className="text-[11px] uppercase tracking-widest text-stone-500 font-bold mb-2">Módulos contratados</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {MODULOS.map((m) => {
                  const tiene = c.modulos.includes(m.k);
                  return (
                    <button key={m.k} onClick={() => alternarModulo(m.k)} disabled={m.base}
                      className={`text-left px-3.5 py-2.5 rounded-xl border flex items-center gap-3 ${
                        m.base ? "border-stone-800 bg-stone-900/50 cursor-default"
                        : tiene ? "border-orange-500/50 bg-orange-500/10" : "border-stone-800 bg-stone-900 hover:border-stone-700"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{m.n}</div>
                        <div className="text-[11px] text-stone-500">{m.d}</div>
                      </div>
                      {m.base
                        ? <span className="text-[10px] uppercase tracking-wider text-stone-500 shrink-0">incluido</span>
                        : <span className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${tiene ? "bg-orange-500" : "bg-stone-700"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tiene ? "left-4.5" : "left-0.5"}`} style={{ left: tiene ? 18 : 2 }} />
                          </span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] uppercase tracking-widest text-stone-500 font-bold">Accesos</h2>
                <button onClick={() => setAltaUsuario({})} className="text-sm font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1">
                  <Plus size={14} /> Nuevo acceso
                </button>
              </div>
              <ul className="bg-stone-900 border border-stone-800 rounded-2xl divide-y divide-stone-800 overflow-hidden">
                {c.usuarios.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{u.nombre}</div>
                      <div className="f-m text-[11px] text-stone-500">{u.usuario} · {rolPorK(u.rol).n}</div>
                    </div>
                    <button onClick={() => setAltaUsuario(u)} className="text-xs text-stone-400 hover:text-white">Editar</button>
                    <button onClick={() => actualizar(c.id, { usuarios: c.usuarios.filter((x) => x.id !== u.id) })}
                      className="text-xs text-stone-600 hover:text-red-400">Quitar</button>
                  </li>
                ))}
                {c.usuarios.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-500">Sin accesos: nadie puede entrar todavía.</li>}
              </ul>
              <p className="text-[11px] text-stone-600 mt-2">
                El dueño del comercio puede crear los suyos desde adentro del sistema.
              </p>
            </section>
          </>
        )}
      </main>

      <FormUsuario abierto={!!altaUsuario} inicial={altaUsuario} modulosComercio={c ? c.modulos : []}
        onCerrar={() => setAltaUsuario(null)}
        onGuardar={(d) => {
          if (d.id) actualizar(c.id, { usuarios: c.usuarios.map((u) => (u.id === d.id ? { ...u, ...d } : u)) });
          else actualizar(c.id, { usuarios: [...c.usuarios, { ...d, id: "u" + uid() }] });
          setAltaUsuario(null);
        }} />

      <Modal open={altaComercio} onClose={() => setAltaComercio(false)} ancho="max-w-md">
        <div className="p-5">
          <h3 className="f-d text-lg">Nuevo comercio</h3>
          <p className="text-sm text-stone-500 mt-1">Arranca con los módulos base. Los demás se activan después.</p>
          <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} autoFocus placeholder="Nombre del comercio"
            className={`${inputCls} mt-3`} />
          <div className="flex justify-end gap-2 mt-4">
            <Boton variant="quiet" onClick={() => setAltaComercio(false)}>Cancelar</Boton>
            <Boton disabled={!nombreNuevo.trim()} onClick={() => {
              const nuevo = {
                id: "cm" + uid(), nombre: nombreNuevo.trim(), plan: "Base", modulos: [...MODULOS_BASE],
                alta: `${String(HOY.getMonth() + 1).padStart(2, "0")}/${HOY.getFullYear()}`, activo: true, usuarios: [],
              };
              setComercios((cs) => [...cs, nuevo]);
              setAltaComercio(false); setAbierto(nuevo.id);
            }}><Check size={15} /> Crear</Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BotonTema({ tema, setTema, oscuroFijo = false }) {
  const oscuro = tema === "oscuro";
  return (
    <button
      onClick={() => setTema(oscuro ? "claro" : "oscuro")}
      title={oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro"}
      aria-label={oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro"}
      className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
        oscuroFijo
          ? "border-stone-700 text-stone-400 hover:text-white hover:border-stone-600"
          : "border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50"}`}>
      {oscuro ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* El isotipo va incrustado como imagen para no depender de archivos sueltos
   que se puedan perder al mover el proyecto. Dos versiones del mismo trazo:
   oscura para fondos claros y clara para fondos oscuros. La palabra GENEZ va
   como texto, así se mantiene nítida a cualquier tamaño. */
const GENEZ_OSCURO = "data:image/png;base64,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";
const GENEZ_CLARO = "data:image/png;base64,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";

/* La palabra también sale del logo original: escribirla con otra tipografía
   rompía la identidad de la marca. Proporción 537x56 del archivo. */
const PALABRA_OSCURO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAhkAAAA4CAYAAABQdeoxAAALK0lEQVR42u2dP4gbSRaHf/0s8KzBRTOw3GVObCawLxIGJ5dssMFEZhMxPswwszjy4gs2ceTAkTm4ZFhHizWI4dYo28iB00sMRtFFYpw4HnYQbbBlGL++QFWaljyzI6mrpe7q3wfG/6Xurq7qr1+9ehXBI3Ec31DVO5k/6qAabIvIm8FgcIiAse3TD/X8RASq2hORe6G2pTHmpYi0VHXmeztJkoMSn8/9eccJ286lPzdP/fXpnO1duf4KYC+Udkx3sTb+zVW8xwm+RZ1o4AgfcM39NmpjGOXtBACgqk8BXAfQFJHx31elY9ibvQ4DVj/0e9y2ZTdJki0KxulAniTJ7TIKhoh0Fh0n7FizEaJQuv6aEaqgXwzKeH8uKhlRG8P0IXbQwLNaSgYAHOCv+AOIIqSNHG8fm6raEhHX2aGqQXeIKmPfiOrSPtfZ4qeiLyJNY8zbECM89gVnK8S2q1F/DYaojaH95Quc1PACOKm6i8tRNLoWMq9d28GqIyKtrFhUtTM4QRKRN+wiJGTRUNXfeDVISSX4Pq9GmMwkGVYuXtrwXTOkiIU9j43Q8zGSJNniWxEH8ziO/2eMeckrQghZBhdOlxhj7qtqx4XuQnlQufMRkeAFw4kiJYOiAeCmiNw0xiDEvBVCSMmetRcJBmzmd0gPqLoJBiHTsiEiLUY0CCErk4xFlpZVbJClYBCKBkWDELJsybBLU4MTjEySJwWDUDQyouGWoxNCSKGSYXMwgqynwAgGIWeLhqr2KRqEeMLViyCTkhFqBGN8shQMQs4TDQCgaBDig7oV4TpDrtJ1RKM/mhxsCinYlK0CukIoGOG05UXHuMaWml80LP04jtlX2F+Xee/1QiorHrUxRIT/4BK+xwm+XVpUY9Vi487zE64AAO7iMtoYjiXDLnH0ViN/qgpob4Wn/k5EnnDQ9DcglF0wVPVfbKlcbUzRYH9d5gvBXjAX/O84QRvARzzAVbxf+rTJRd9XlIg0cIQTPMYnvIzaGKYpoihCOhHJ8BXFyNTT6AJ4FfJ+IHV7IwppjwFy4QsCRYP9lcxJtDMqJm7Li/9lmd+dPsTOhaXMG3jmXTYaOMIXvI6eYx+w0ZxoXF59JBl2HrblSTC6jBwQUum3X/fLvjGmy6JdhMz5wF9HhLu4vFTBsQ/5P5UQn4LhoiYneBw9x77bgTazf8upZLgohgfB2GbkgpCg3ohbrA5KyJwP/GOkmHrYFi422W3m3XG0MUx3sTbedt7Xpm1OMD7gmvuO6JzzbdiB5JYHwehSMMrLYDA4NMbwQpC5yNTSoGgQUmaxsQ95F0WZEAyfzCEYACC2sufNPFMldiB6wmYuL9zlkHgQDVYHJaQiwpE+xM5YMHzmYHzB61kFY+QkOXFRDOZglJ5HRSxPJrUTDUY0CCkhExGMn3AwXkLrC7uCJPrFJniOVpBcOCUkADY9JHwyikFIfUSDEQ1CyiQYmaTLQgXDJnim66dLVGfwA2nlHHh6bGJCqkHeBG8nGnEcK6fgCCmHYERtDKNjpN4Fo4GjacFw3zXzR+SJYtjw+x6nSurxFgugWZK3WNZfWby/dgG08kyduTLkItKx0ydsiwD667wRaVW9A2CT/XVFcrGOCP/GpWjH5l9E+M67YHzBa3zEg6iNYbqOKFpgxUyDTUXmfFC1Vn0Mqtriw21xQbMPk35e0bD3A0UjkP6qqq0FPn+Wf9Yyxmwyl8evYETHSLGDEztV8gKXcORbMKJfcD8bLVnso0qCLWv+VERuqepwRYexx8FytodLCd7INwGwrRZgMBgcxnG8oar9vMnA9v92jDGPWF2yfv111s+3U2ws0uhDMOwDP93FGr7BFoAXAPyuIPmAa/gdn88rsFU5ybBzux1nxSvc1KdD4yYUjYXEr2mMeSsi9/ggIWfJSBU2a6uUYJwuT/XLJ1yZdXnqTGNDSa7dprsRV/nDcp23MgmdOI5vDAaDQxHZsFsB+HiINFX1N24XT0gxgjGOLlzBr16jFy7B07NglEkyysQ7XgJSh0iG+zlJki3fosErTIj/CAbu4jKu4FfvCZ4neDxPgS1KBiFkLnyLhjHmLSMahPgTjHEFzwIEI3qO/SIEg5JBCClENAA0VbXPwl2ELCgXKaIJwWjgmd3kzLtgpLtYK0IwRl9DCCEZ0TDGQERaPlYmsBQ5IQsIxi7WbMnuScHwJRcAipoeoWQQQmYWjUxkYiG45wkhcwqGLXo1TvBM8Y9VbNHuC06XEELOFA1V3VbVnq9S5Jw6IeQCwdjFWnSM1NbA+IhL+N5jSGFSMBas4EnJICRAVpFEmSTJQZIktwsUjUfcFZiQqfwLJxgNjxU8AXy1gmSO/UcoGaRW2AfTq5qd8x1feRILyIZv0VArTU3ezeFj75ttFmk7P3qBHzNbtJ8W2covGC56Afw4XkGypAjG6SEQMuNAYR8SG6s+ljoOViLyZpXfnyTJbVvRs+mhDDlUtc9eVXh/7YnIvRKJBjlDMNwDv5AdVDOCke6jgZ/xZVkRjFJJhog8UdVXADq87UpNj28j9cWXaBAKOZkqEV5Ega3pDc52sJI9wRoedmLsIOdGVbYjHOb9HGPMfRHpcAAkoWGnSygahIQkGJP1L3yFDsaC4WODs9xBBFXtsckJKTci8sZHoSxPx3JPVbcZAidkTrlYnyqwBbzwmtwJoEyCAYwSP/fyDBYi4nZRJYQURJnC3na/kwOKBiFzCEaKKDpGOhHB8M0nXHGCEbUxXLVgOMnwwSPeQoTUC4oGITMKxqiCZ5ruYs17BGN6B9V9NMogFxOS4aGiXyk2RFp1Bj4hdRYNygYh5wiGS/C8ivdeIxhn7aC64y27w88hJklyYIx5lCeRa2qL59urOhlVferhY66zWxAyn2gYYwBgc1W1PAgppWBkS4T7rH+REYzoOfadzGR/LgW/47NbwvoOOQvjZCIaCqArIk+WNY9sc0J8DXB77BqEzC8aAA58bq5GSBARjGz+hecKnk4wgNUneJ7vQhjVqQDQ8hBJgP28lqq2jDHLWrnSzLMUN3v8drAkZ7dt0xjztuSH+m6Zgku+ko0tigb766yIyBqAH0Lrr2cuUfVNhO/SfxaQPOqLL3iNj3jQAEbZ4saYrq+BISMbzWV1KF8DWhzHN/iA+tNBoeyloJsAbgH4G1uLosH+Wvr+ClXtx3G8Ecq4m+6jgf8ChQoGAK+bpxV1fFfxvjE1MLQ83zxV6oxQ1S4Fo9ptattxyJaiaJBqjMG2z97BqCBj5SMY+BmfcReNQgUDQKGf7YsGjqbTwWu7HM3mlDzhsESIP9FQ1S6vBKkT0TFSfIMtXomRCMnUoFDnde+MYhBSgGi4TfW4xJUELxinyZcvKhFpWAJf9Xpbvrg2A4I9z16SJDRPUnYqubx6MBgcUjQIoWRMDAh1EQ07Z8llq6TU2M3/KrspmY0SbjA/g5CaS8aUaHRDreTnzklENrhslVTgfq18NVtGNAihZEwMCDZxa1tVeyENCjabuQdgm3kYhCxXNJIkEe55QkjNJcORJMmB3dq58lENd+yq2k2S5DYjGISsBptk3qVokCBp4IgXYUbJyLx9uKjGWDaqIB3ZY7THvsEkT1I1bB2B0ERjK09Ew1boZV8m5YMrS+aTjOzbh+3UG24axU2llEU4po6lZ49x28lFjadH6pTc2gyuo9pVXwGKxsLL5kOPgtQhSdZtBxFKVDlNEY0jGYxmAIC9IDmxG5Q5Oiu+YbsAXrkBjE38VTt1Qj5Hew9sh9j2edqv7NfFntvMu0G7vh5yJCOO4xuq2md/rZBkZHdAvYr3tY5oNHCED7j2f9cSkF6603BXAAAAAElFTkSuQmCC";
const PALABRA_CLARO = "data:image/png;base64,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";

/* Quién está adentro y cómo salir. En un mostrador se turnan varias personas
   en el mismo equipo: si no hay forma visible de cerrar sesión, el que llega
   después queda trabajando con el usuario del anterior. */
function Sesion({ sesion, onSalir, oscuro = false }) {
  const rol = sesion.comoAdmin ? "Administrador de Genez" : rolPorK(sesion.rol).n;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="text-right leading-tight hidden sm:block">
        <div className={`text-xs font-semibold ${oscuro ? "text-white" : "text-stone-700"}`}>{sesion.nombre}</div>
        <div className="text-[10px] text-stone-400">{rol}</div>
      </div>
      <button onClick={onSalir} title="Cerrar sesión"
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2.5 py-2 border ${
          oscuro ? "border-white/20 text-white/80 hover:text-white hover:border-white/40"
                 : "border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50"}`}>
        <LogOut size={15} /> <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}

function LogoGenez({ size = 40, claro = false, conNombre = false }) {
  const marca = (
    <img src={claro ? GENEZ_CLARO : GENEZ_OSCURO} alt="Genez"
      width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />
  );
  if (!conNombre) return marca;
  // La palabra es muy alargada (537x56), así que a igual altura ocupa mucho
  // más ancho que el símbolo. Con 0.30 queda equilibrada al lado del isotipo.
  const altoPalabra = Math.round(size * 0.30);
  return (
    <span className="flex items-center" style={{ gap: size * 0.2 }}>
      {marca}
      <img src={claro ? PALABRA_CLARO : PALABRA_OSCURO} alt="Genez" aria-hidden="true"
        style={{ height: altoPalabra, width: altoPalabra * (537 / 56) }} />
    </span>
  );
}

/* Panel hexagonal del login.
   El relieve se logra con dos cosas: un degradado diagonal por celda (claro
   arriba-izquierda, oscuro abajo-derecha para los salientes, invertido para
   los hundidos) y una sombra propia en el borde inferior. Cada hexágono
   recibe una profundidad al azar pero estable, así el panel no "baila" entre
   recargas.
   Se puede reemplazar por una imagen propia desde Ajustes de la plataforma. */
function FondoHexagonal({ imagen }) {
  if (imagen) {
    return <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imagen})` }} aria-hidden="true" />;
  }

  const filas = 11, columnas = 8, r = 62;
  const anchoHex = Math.sqrt(3) * r, altoHex = 2 * r;
  const centro = { x: 200, y: 520 };
  const rnd = mulberry32(7);

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const x = c * anchoHex + (f % 2 ? anchoHex / 2 : 0);
      const y = f * altoHex * 0.75;
      const d = Math.hypot(x - centro.x, y - centro.y);
      const luz = Math.pow(Math.max(0, 1 - d / 380), 2);
      const v = rnd();
      // Tres alturas: hundido, al ras y saliente. Da la textura irregular.
      const rel = v < 0.34 ? -1 : v < 0.62 ? 0 : 1;
      celdas.push({ x, y, luz, rel, esc: rel === 1 ? 0.985 : 0.955 });
    }
  }

  const puntos = (x, y, k) => Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(x + r * k * Math.cos(a)).toFixed(1)},${(y + r * k * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 760 1080" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="caraAlta" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#2A2A2A" /><stop offset="55%" stopColor="#181818" /><stop offset="100%" stopColor="#0E0E0E" />
        </linearGradient>
        <linearGradient id="caraBaja" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#070707" /><stop offset="45%" stopColor="#101010" /><stop offset="100%" stopColor="#1E1E1E" />
        </linearGradient>
        <linearGradient id="caraPlana" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#1A1A1A" /><stop offset="100%" stopColor="#121212" />
        </linearGradient>
        <radialGradient id="halo" cx={centro.x / 760} cy={centro.y / 1080} r="0.4">
          <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.34" />
          <stop offset="60%" stopColor="#FF6B00" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
        </radialGradient>
        <filter id="difuso" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <rect width="760" height="1080" fill="#070707" />

      {/* Sombra propia: lo que da la sensación de que la pieza está apoyada */}
      {celdas.filter((h) => h.rel === 1).map((h, k) => (
        <polygon key={"s" + k} points={puntos(h.x + 3, h.y + 5, h.esc)} fill="#000" opacity="0.75" />
      ))}

      {celdas.map((h, k) => (
        <g key={k}>
          <polygon points={puntos(h.x, h.y, h.esc)}
            fill={h.rel === 1 ? "url(#caraAlta)" : h.rel === -1 ? "url(#caraBaja)" : "url(#caraPlana)"} />
          {/* Filo superior claro: el canto que devuelve la luz */}
          <polygon points={puntos(h.x, h.y, h.esc)} fill="none"
            stroke={h.rel === 1 ? "#3A3A3A" : "#000"} strokeOpacity={h.rel === 0 ? 0.5 : 0.9} strokeWidth="1" />
          {h.luz > 0.02 && (
            <>
              <polygon points={puntos(h.x, h.y, h.esc)} fill="none" stroke="#FF6B00"
                strokeOpacity={Math.min(1, 0.2 + h.luz * 1.9)} strokeWidth={h.luz > 0.45 ? 2.6 : 1.7} />
              {h.luz > 0.3 && (
                <polygon points={puntos(h.x, h.y, h.esc)} fill="none" stroke="#FFA24D"
                  strokeOpacity={h.luz} strokeWidth="3.5" filter="url(#difuso)" />
              )}
            </>
          )}
        </g>
      ))}

      <rect width="760" height="1080" fill="url(#halo)" />
    </svg>
  );
}

function Login({ comercios, onEntrar, imagenFondo }) {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");

  const entrar = () => {
    const u = usuario.trim();
    if (!u || !clave) return setError("Completá usuario y contraseña.");

    if (u.toLowerCase() === DUENO_PLATAFORMA.usuario.toLowerCase() && clave === DUENO_PLATAFORMA.clave) {
      return onEntrar({ tipo: "plataforma", nombre: DUENO_PLATAFORMA.nombre, usuario: DUENO_PLATAFORMA.usuario });
    }
    for (const c of comercios) {
      const encontrado = (c.usuarios || []).find((x) => x.usuario.toLowerCase() === u.toLowerCase() && x.clave === clave);
      if (encontrado) {
        if (!c.activo) return setError("Esta cuenta está suspendida. Contactate con el administrador.");
        return onEntrar({ tipo: "comercio", comercio: c, rol: encontrado.rol, nombre: encontrado.nombre, usuario: encontrado.usuario });
      }
    }
    // Un mensaje único: decir cuál de los dos está mal le sirve a quien prueba
    // credenciales, no a quien se equivocó tipeando.
    setError("Usuario o contraseña incorrectos.");
  };

  const campo = "w-full bg-transparent border rounded-xl px-4 py-3.5 text-base mt-2 outline-none text-white transition-colors";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex">
      {/* El panel decorativo se esconde en celular: ahí manda el formulario */}
      <div className="hidden lg:block relative w-[46%] max-w-[680px] overflow-hidden">
        <FondoHexagonal imagen={imagenFondo} />
        {/* Degradado de salida: sin esto se ve un borde recto entre el panel
            y el formulario, y el conjunto parece dos piezas pegadas. */}
        <div className="absolute inset-y-0 right-0 w-56 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(10,10,10,0) 0%, rgba(10,10,10,0.75) 55%, #0A0A0A 100%)" }} />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <LogoGenez size={64} claro conNombre />
            <p className="text-stone-400 mt-4">Sistemas de gestión para comercios.</p>

            <div className="mt-9 space-y-5">
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Usuario</span>
                <input value={usuario} onChange={(e) => { setUsuario(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && entrar()} autoFocus autoCapitalize="none" autoCorrect="off"
                  className={`${campo} border-orange-500/70 focus:border-orange-500`} />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Contraseña</span>
                <input type="password" value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && entrar()}
                  className={`${campo} bg-white/5 border-white/10 focus:border-orange-500`} />
              </label>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/60 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={15} className="shrink-0" /> {error}
                </div>
              )}

              <button onClick={entrar}
                className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-stone-950 font-bold rounded-xl px-4 py-4 text-lg transition-colors">
                Entrar
              </button>
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 text-center text-[11px] text-stone-600">
          Entorno de demostración · las credenciales todavía no se validan en un servidor
        </footer>
      </div>
    </div>
  );
}

const NAV = [
  { k: "inicio", n: "Inicio", i: LayoutDashboard },
  { k: "pedidos", n: "Pedidos", i: ClipboardList },
  { k: "clientes", n: "Clientes", i: Users },
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
  clientes: ["Clientes", "Para emitir facturas A, B o C según corresponda"],
  productos: ["Productos", "Costos, precios y margen de todo tu catálogo"],
  stock: ["Stock", "Qué reponer, qué vence y qué no se mueve"],
  compras: ["Compras", "Cargar remitos, pedidos sugeridos y proveedores"],
  caja: ["Caja", "Ingresos, egresos y arqueo del día"],
  reportes: ["Informes", "Qué se vende, qué deja plata y qué cambió"],
  asistente: ["Asistente", "Tus datos explicados y qué conviene hacer"],
  ajustes: ["Ajustes", "Configuración del negocio y del sistema"],
};

function Sistema({ sesion, onSalir, setComercios, tema, setTema }) {
  const { modulos, permisos, esPlataforma } = permisosDe(sesion);
  const puedeVer = (k) => k === "inicio" || modulos.includes(k);
  const [vista, setVista] = useState(modulos.includes("cobro") ? "cobro" : "panel");
  const [tab, setTab] = useState("inicio");
  const [foco, setFoco] = useState(null);
  const [productos, setProductos] = useState(DATA.productos);
  const [tickets, setTickets] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pedidosCli, setPedidosCli] = useState(PEDIDOS_INICIALES);
  const [provs, setProvs] = useState(PROV_INFO);
  const [clientes, setClientes] = useState(CLIENTES_INICIALES);
  const [altaProd, setAltaProd] = useState(null);
  const [ajustes, setAjustes] = useState({ negocio: "Super 25", cuit: "20-41564841-0", arca: false, medios: MEDIOS_INICIALES, fiscal: FISCAL_INICIAL, cobertura: 14, ancho: 80, sonido: true, listas: LISTAS_INICIALES, desc2: 10 });
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

  const cobrar = ({ items, sub, desc, total, medio, ganancia, recibe, pagos, recargo, recargoNombre, fiscal, cliente }) => {
    const nro = `0001-${String(48210 + tickets.length + 1).padStart(8, "0")}`;
    const ps = pagos && pagos.length ? pagos : [{ medio, monto: total }];
    const t = {
      id: uid(), nro, cae: String(74300000000000 + tickets.length * 137),
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      items, sub, desc, total, medio: ps[0].medio, pagos: ps, ganancia, recibe: recibe || null,
      recargo: recargo || 0, recargoNombre: recargoNombre || "", fiscal: fiscal != null ? fiscal : !!ajustes.arca,
      cliente: cliente || null,
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

        /* --- Modo oscuro -------------------------------------------------
           El sistema tiene miles de clases de color escritas a mano. En vez
           de duplicarlas todas, se remapean acá los tonos que realmente se
           usan. Un solo lugar para mantener, y el resto del código no se
           entera de que existe un tema.                                    */
        .tema-oscuro { color-scheme: dark; }
        .tema-oscuro .bg-stone-50, .tema-oscuro .hover\:bg-stone-50:hover { background-color: #1c1917 !important; }
        .tema-oscuro .bg-white { background-color: #1c1917 !important; }
        .tema-oscuro .bg-stone-100, .tema-oscuro .hover\:bg-stone-200:hover { background-color: #292524 !important; }
        .tema-oscuro .bg-stone-200 { background-color: #44403c !important; }
        .tema-oscuro .text-stone-900 { color: #fafaf9 !important; }
        .tema-oscuro .text-stone-800, .tema-oscuro .text-stone-700 { color: #e7e5e4 !important; }
        .tema-oscuro .text-stone-600, .tema-oscuro .text-stone-500 { color: #a8a29e !important; }
        .tema-oscuro .text-stone-400, .tema-oscuro .text-stone-300 { color: #78716c !important; }
        .tema-oscuro .border-stone-200, .tema-oscuro .border-stone-100 { border-color: #292524 !important; }
        .tema-oscuro .divide-stone-100 > * + *, .tema-oscuro .divide-stone-200 > * + * { border-color: #292524 !important; }
        .tema-oscuro .focus\:border-orange-400:focus { border-color: #fb923c !important; }
        /* Los fondos suaves de aviso pierden contraste en oscuro */
        .tema-oscuro .bg-amber-50 { background-color: #2b1f0a !important; }
        .tema-oscuro .bg-emerald-50 { background-color: #04231a !important; }
        .tema-oscuro .bg-red-50 { background-color: #2a0f0f !important; }
        .tema-oscuro .bg-orange-50 { background-color: #2a1608 !important; }
        .tema-oscuro .text-amber-800, .tema-oscuro .text-amber-700 { color: #fcd34d !important; }
        .tema-oscuro .text-emerald-800, .tema-oscuro .text-emerald-700 { color: #6ee7b7 !important; }
        .tema-oscuro .text-red-800, .tema-oscuro .text-red-700, .tema-oscuro .text-red-600 { color: #fca5a5 !important; }
        .tema-oscuro .border-amber-200 { border-color: #78350f !important; }
        .tema-oscuro .border-emerald-200 { border-color: #065f46 !important; }
        .tema-oscuro .border-red-200 { border-color: #7f1d1d !important; }
        .tema-oscuro .border-orange-200 { border-color: #7c2d12 !important; }
        .tema-oscuro .shadow-sm, .tema-oscuro .shadow-lg, .tema-oscuro .shadow-xl { box-shadow: 0 1px 3px rgba(0,0,0,.5) !important; }
        .tema-oscuro body, .tema-oscuro .bg-stone-25 { background-color: #0c0a09 !important; }
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

              <div className="order-2 md:order-4">
                <Sesion sesion={sesion} onSalir={onSalir} oscuro />
              </div>
            </div>
          </header>

          <main className="flex-1 p-3 md:p-5">
            <POS productos={productos} setProductos={setProductos} cobrar={cobrar} ajustes={ajustes}
              toast={toast} ir={ir} pendiente={pendientePOS} setPendiente={setPendientePOS}
              aPanel={() => { setVista("panel"); setTab("inicio"); }} clientes={clientes} setClientes={setClientes} permisos={permisos} />
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
            {NAV.filter((n) => puedeVer(n.k)).map((n) => (
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
            {NAV.filter((n) => puedeVer(n.k)).map((n) => (
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
              <BotonTema tema={tema} setTema={setTema} />
              <Boton size="sm" variant="dark" className="md:hidden" onClick={cobrar_}><Barcode size={14} /> Cobrar</Boton>
              <Sesion sesion={sesion} onSalir={onSalir} />
            </div>
          </header>

          {tab === "inicio" && <Inicio k={k} ins={ins} ventasHoy={ventasHoy} ticketsHoy={ticketsHoy} ir={ir} negocio={ajustes.negocio} aCobrar={cobrar_} />}
          {tab === "pedidos" && <Picking pedidos={pedidosCli} setPedidos={setPedidosCli} productos={productos} setProductos={setProductos} cobrar={cobrar} ajustes={ajustes} toast={toast} />}
          {tab === "clientes" && <Clientes clientes={clientes} setClientes={setClientes} tickets={tickets} ajustes={ajustes} toast={toast} />}
          {tab === "productos" && <Productos key={foco || "todos"} productos={productos} setProductos={setProductos} toast={toast} focoInicial={foco} provs={provs} ajustes={ajustes} />}
          {tab === "stock" && <Stock productos={productos} setProductos={setProductos} k={k} toast={toast} />}
          {tab === "compras" && <Compras productos={productos} setProductos={setProductos} k={k} pedidos={pedidos} setPedidos={setPedidos} movCaja={movCaja} toast={toast} cobertura={ajustes.cobertura} provs={provs} setProvs={setProvs} />}
          {tab === "caja" && (
            <Caja caja={caja} movCaja={movCaja} toast={toast} ajustes={ajustes}
              abrirCaja={(s) => setCaja((c) => ({ ...c, abierta: true, saldoInicial: s, movimientos: [], hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }))}
              cerrarCaja={(esperado, contado) => setCaja((c) => ({ ...c, abierta: false, cierres: [{ fecha: HOY, esperado, contado, dif: contado - esperado }, ...c.cierres] }))} />
          )}
          {tab === "reportes" && <Reportes productos={productos} k={k} ir={ir} />}
          {tab === "asistente" && <Asistente k={k} ins={ins} ir={ir} negocio={ajustes.negocio} />}
          {tab === "ajustes" && <Ajustes ajustes={ajustes} setAjustes={setAjustes} productos={productos} setProductos={setProductos} toast={toast} mp={mp} setMp={setMp} simularCobro={simularCobro} />}
        </main>
      </div>
      )}

      <AvisoCobro cobros={cobrosMP} onCerrar={(id) => setCobrosMP((x) => x.filter((c) => c.id !== id))} />

      <FormProducto abierto={!!altaProd} inicial={altaProd} productos={productos} provs={provs} ajustes0={ajustes}
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

/* ============================================================
   15. RAÍZ · quién entró decide qué se ve
   ============================================================ */

export default function App() {
  const [comercios, setComercios] = useState(COMERCIOS_INICIALES);
  const [sesion, setSesion] = useState(null);
  const [tema, setTema] = useState("claro");
  const [imagenFondo, setImagenFondo] = useState(null);   // fondo propio del login
  const envolver = (hijo) => <div className={tema === "oscuro" ? "tema-oscuro min-h-screen bg-stone-950" : ""}>{hijo}</div>;

  if (!sesion) return envolver(<Login comercios={comercios} onEntrar={setSesion} imagenFondo={imagenFondo} />);

  if (sesion.tipo === "plataforma" && !sesion.viendo) {
    return envolver(
      <PanelGenez
        tema={tema} setTema={setTema}
        imagenFondo={imagenFondo} setImagenFondo={setImagenFondo}
        sesion={sesion}
        comercios={comercios}
        setComercios={setComercios}
        onSalir={() => setSesion(null)}
        onEntrarComo={(c) => setSesion({ ...sesion, viendo: c })}
      />
    );
  }

  // El comercio que se está mirando: el propio, o el que abrió la plataforma.
  const comercio = sesion.viendo || sesion.comercio;
  const sesionSistema = sesion.viendo
    ? { tipo: "comercio", comercio, rol: "dueno", nombre: sesion.nombre, usuario: sesion.usuario, comoAdmin: true }
    : sesion;

  return envolver(
    <Sistema
      key={comercio.id}
      tema={tema} setTema={setTema}
      sesion={sesionSistema}
      setComercios={setComercios}
      onSalir={() => setSesion(sesion.viendo ? { ...sesion, viendo: null } : null)}
    />
  );
}
