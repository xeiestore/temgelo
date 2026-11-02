// Default / seed sellers for Tem Gelo?
// This is overwritten by live catalog.json when available.

const DEFAULT_SELLERS = [
  {
    id: "s001",
    name: "João – Viana",
    lat: -8.9050,
    lng: 13.3700,
    available: true,
    buckets: 8,
    freeze: "muito_congelado", // muito_congelado | parcial | fraco
    price: "1500",
    whatsapp: "244923000001",
    neighborhood: "Viana",
    notes: "Baldes grandes, bom para festas",
    updatedAt: new Date().toISOString()
  },
  {
    id: "s002",
    name: "Maria – Talatona",
    lat: -8.9200,
    lng: 13.1800,
    available: true,
    buckets: 15,
    freeze: "muito_congelado",
    price: "1800",
    whatsapp: "244923000002",
    neighborhood: "Talatona",
    notes: "Entrega rápida na zona",
    updatedAt: new Date().toISOString()
  },
  {
    id: "s003",
    name: "Carlos – Cazenga",
    lat: -8.8500,
    lng: 13.2800,
    available: false,
    buckets: 0,
    freeze: "parcial",
    price: "1200",
    whatsapp: "244923000003",
    neighborhood: "Cazenga",
    notes: "",
    updatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() // 30h ago → should show red
  },
  {
    id: "s004",
    name: "Ana – Maianga",
    lat: -8.8250,
    lng: 13.2400,
    available: true,
    buckets: 5,
    freeze: "parcial",
    price: "1400",
    whatsapp: "244923000004",
    neighborhood: "Maianga",
    notes: "Perto do mercado",
    updatedAt: new Date().toISOString()
  },
  {
    id: "s005",
    name: "Pedro – Benfica",
    lat: -8.8800,
    lng: 13.2000,
    available: true,
    buckets: 10,
    freeze: "muito_congelado",
    price: "1600",
    whatsapp: "244923000005",
    neighborhood: "Benfica",
    notes: "Disponível até às 22h",
    updatedAt: new Date().toISOString()
  }
];

// Freeze labels in Portuguese (defaults; overridden by catalog.texts)
const FREEZE_LABELS = {
  muito_congelado: "Muito congelado",
  parcial: "Parcialmente congelado",
  fraco: "Fraco / a derreter"
};

// Default site texts (overridden by catalog.texts when published)
const DEFAULT_TEXTS = {
  pageTitle: "Tem Gelo? – Angola",
  pageDescription: "Tem Gelo? Encontre baldes de gelo perto de si em Angola.",
  legendOk: "Tem gelo",
  legendNo: "Sem gelo / expirado",
  safetyTitle: "Atenção de Segurança:",
  safetyBody:
    "Se uma zona ou bairro parecer suspeito, não entre. Criminosos podem usar a app para atrair pessoas. Confirme sempre por telefone/WhatsApp antes de ir e prefira zonas conhecidas.",
  statusOk: "Tem gelo",
  statusNo: "Sem gelo / expirado",
  labelBuckets: "Baldes",
  labelKg: "kg",
  labelUnit: "Unidade",
  unitBaldes: "Baldes",
  unitKg: "Quilos (kg)",
  labelFreeze: "Congelamento",
  labelPrice: "Preço",
  labelUpdated: "Atualizado",
  btnWhatsApp: "Contactar no WhatsApp",
  btnCall: "Ligar",
  btnReport: "Reportar este vendedor",
  noContact: "Sem contacto público — só localização no mapa",
  waMessage: "Olá! Vi no Tem Gelo? que tem baldes de gelo. Ainda tem disponível?",
  reportMessage: "Quero reportar o vendedor \"{name}\" (ID: {id}) no Tem Gelo?. Motivo: ",
  countFormat: "{available} de {total} com gelo",
  adminWhatsApp: "244900000000",
  adTitle: "Negócio angolano?",
  adBody:
    "Coloque a sua marca aqui — lojas, serviços, entregas. Quem procura gelo em Angola já está a ver este espaço.",
  adCta: "Quero anunciar",
  adWaMessage:
    "Olá! Vi o espaço de anúncios no Tem Gelo? e quero anunciar o meu negócio/serviço.",
  freezeMuito: "Muito congelado",
  freezeParcial: "Parcialmente congelado",
  freezeFraco: "Fraco / a derreter",
  menuLogin: "Entrar",
  menuRegister: "Criar conta",
  menuSafety: "Segurança",
  menuReport: "Reportar um problema",
  menuSellerSection: "Área do vendedor",
  menuStock: "Meu stock",
  menuProfile: "Perfil",
  menuPanel: "Painel",
  menuLogout: "Sair",
  menuInstall: "Instalar app"
};

// Optional helper (no longer gates the public map)
function isFresh(updatedAt) {
  if (!updatedAt) return false;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
}

// Stock unit: baldes (default) or kg (packaged ice)
function normalizeStockUnit(unit) {
  return unit === "kg" ? "kg" : "baldes";
}

function stockUnitLabel(unit, textsObj) {
  const t = textsObj || (typeof texts !== "undefined" ? texts : null) || DEFAULT_TEXTS;
  return normalizeStockUnit(unit) === "kg"
    ? t.labelKg || "kg"
    : t.labelBuckets || "Baldes";
}

/** Human-readable quantity, e.g. "10 baldes" or "25 kg" */
function formatStockQty(seller, textsObj) {
  const n = Number(seller && seller.buckets) || 0;
  const u = normalizeStockUnit(seller && seller.unit);
  if (u === "kg") return n + " kg";
  return n + " " + (stockUnitLabel("baldes", textsObj) || "baldes").toLowerCase();
}

/** packages: [{ amount, unit: "kg"|"baldes", price }] — multi size/price list */
function normalizePackages(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const amount = parseFloat(row.amount);
    const price = String(row.price ?? "").trim();
    if (!(amount > 0) || !price) continue;
    out.push({
      amount,
      unit: row.unit === "kg" ? "kg" : "baldes",
      price
    });
    if (out.length >= 12) break; // keep popup readable
  }
  return out;
}

function formatPackageLine(pkg) {
  const u = pkg.unit === "kg" ? "kg" : "balde" + (Number(pkg.amount) === 1 ? "" : "s");
  return pkg.amount + " " + u + " — " + pkg.price + " Kz";
}

// Map pin: green when available and (qty > 0 OR has price packages)
function isEffectivelyAvailable(seller) {
  if (!seller || !seller.available) return false;
  if (Number(seller.buckets) > 0) return true;
  return normalizePackages(seller.packages).length > 0;
}
