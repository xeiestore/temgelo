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

// Freeze labels in Portuguese
const FREEZE_LABELS = {
  muito_congelado: "Muito congelado",
  parcial: "Parcialmente congelado",
  fraco: "Fraco / a derreter"
};

// Helper: is still "fresh" (updated in last 24 hours)
function isFresh(updatedAt) {
  if (!updatedAt) return false;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs < 24 * 60 * 60 * 1000;
}

// Effective availability (respects 24h rule)
function isEffectivelyAvailable(seller) {
  return seller.available && isFresh(seller.updatedAt) && seller.buckets > 0;
}
