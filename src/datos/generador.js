/* ============================================================
   1. GENERADOR DE DATOS  (catálogo, historial, proveedores)
   ============================================================ */

export function mulberry32(a) {
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
export const uid = () => Math.random().toString(36).slice(2, 9);

export const HOY = new Date(2026, 7, 9);
export const dayMs = 86400000;
export const addDays = (d, n) => new Date(d.getTime() + n * dayMs);
export const fdate = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
export const fdatel = (d) => `${fdate(d)}/${String(d.getFullYear()).slice(2)}`;

export const PROVS = {
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

export const PROV_INFO = {
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

export function generar() {
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

export const DATA = generar();

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
/* Vacío a propósito. Estos pedidos apuntaban a los productos del
   generador, cuyos ids son enteros y no existen en la base: cobrar uno
   hacía que la venta entera fuera rechazada y se perdiera la plata. La
   función se conserva porque sirve para volver a armar datos de
   demostración cuando apunten a productos de verdad. */
export const PEDIDOS_INICIALES = [];
