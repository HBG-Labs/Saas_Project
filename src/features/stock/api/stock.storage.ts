import type {
  ConsumableInput,
  StockConsumable,
  StockMovement,
  StockMovementInput,
} from '../types/stock.types';

const STORAGE_PREFIX_CONSUMABLES = 'rezo_stock_consumables_';
const STORAGE_PREFIX_MOVEMENTS = 'rezo_stock_movements_';

function getStorageKeyConsumables(orgId: string): string {
  return `${STORAGE_PREFIX_CONSUMABLES}${orgId}`;
}

function getStorageKeyMovements(orgId: string): string {
  return `${STORAGE_PREFIX_MOVEMENTS}${orgId}`;
}

const DEFAULT_SEEDED_CONSUMABLES: Omit<StockConsumable, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>[] = [
  {
    reference: 'FBR-CAB-4FO',
    name: 'Câble Fibre Optique 4 FO G.657.A2 (Touret 500m)',
    category: 'Câblage & Fibre',
    unit: 'm',
    quantityInStock: 850,
    minThreshold: 300,
    unitPriceEur: 0.45,
    sellingPriceEur: 0.90,
    location: 'Dépôt Central - Rack A1',
    supplier: 'Foliatec Telecom',
    notes: 'Pour raccordements abonnés FTTH standard',
  },
  {
    reference: 'FBR-PTO-01',
    name: 'Prise Terminale Optique (PTO) 4 ports SC/APC',
    category: 'Câblage & Fibre',
    unit: 'pièce',
    quantityInStock: 18,
    minThreshold: 25,
    unitPriceEur: 6.20,
    sellingPriceEur: 12.50,
    location: 'Dépôt Central - Bac B3',
    supplier: 'Foliatec Telecom',
    notes: 'Seuil bas atteint - À commander rapidement',
  },
  {
    reference: 'ELEC-DISJ-16A',
    name: 'Disjoncteur Ph+N 16A Courbe C 4.5kA',
    category: 'Appareillage & Électricité',
    unit: 'pièce',
    quantityInStock: 45,
    minThreshold: 20,
    unitPriceEur: 4.80,
    sellingPriceEur: 9.50,
    location: 'Dépôt Central - Allée Elec',
    supplier: 'Rexel France',
    notes: 'Conforme NF C 15-100',
  },
  {
    reference: 'ELEC-WAGO-3P',
    name: 'Bornes de connexion rapide 3 conducteurs (Boîte de 100)',
    category: 'Appareillage & Électricité',
    unit: 'boîte',
    quantityInStock: 8,
    minThreshold: 10,
    unitPriceEur: 14.50,
    sellingPriceEur: 22.00,
    location: 'Dépôt Central - Rayon Quincaillerie',
    supplier: 'Sonepar',
    notes: 'Modèle Wago 221-413',
  },
  {
    reference: 'PLOMB-RACC-14',
    name: 'Raccord cuivre à sertir femelle 1/2" Ø14',
    category: 'Plomberie & Tuyauterie',
    unit: 'pièce',
    quantityInStock: 32,
    minThreshold: 15,
    unitPriceEur: 2.10,
    sellingPriceEur: 4.80,
    location: 'Atelier - Étagère Plomberie',
    supplier: 'CEDEO',
    notes: 'Pour installations sanitaires et chauffage',
  },
  {
    reference: 'CVC-FLUIDE-R32',
    name: 'Bouteille Fluide Frigorigène R32 (Charge 5kg)',
    category: 'CVC & Fluides Frigo',
    unit: 'bouteille',
    quantityInStock: 3,
    minThreshold: 5,
    unitPriceEur: 95.00,
    sellingPriceEur: 160.00,
    location: 'Dépôt Sécurisé - Zone Gaz',
    supplier: 'Climalife',
    notes: 'Traçabilité F-Gaz obligatoire à chaque sortie',
  },
  {
    reference: 'SEC-GANTS-ELEC',
    name: 'Gants isolants composite 1000V Classe 0 (Taille 10)',
    category: 'EPI & Sécurité',
    unit: 'paire',
    quantityInStock: 12,
    minThreshold: 6,
    unitPriceEur: 28.00,
    sellingPriceEur: 45.00,
    location: 'Armoire EPI',
    supplier: 'Wurth',
    notes: 'Vérification périodique 6 mois requise',
  },
];

export function loadConsumablesFromStorage(orgId: string): StockConsumable[] {
  try {
    const raw = localStorage.getItem(getStorageKeyConsumables(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Erreur de lecture
  }

  // Initialisation avec des données par défaut
  const now = new Date().toISOString();
  const seeded: StockConsumable[] = DEFAULT_SEEDED_CONSUMABLES.map((item, idx) => ({
    ...item,
    id: `cons-${idx + 1}-${Date.now()}`,
    organizationId: orgId,
    createdAt: now,
    updatedAt: now,
  }));

  try {
    localStorage.setItem(getStorageKeyConsumables(orgId), JSON.stringify(seeded));
  } catch {
    // Quota ou indisponibilité
  }

  return seeded;
}

export function saveConsumablesToStorage(orgId: string, items: StockConsumable[]): void {
  try {
    localStorage.setItem(getStorageKeyConsumables(orgId), JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save consumables to storage', err);
  }
}

export function loadMovementsFromStorage(orgId: string): StockMovement[] {
  try {
    const raw = localStorage.getItem(getStorageKeyMovements(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Erreur de lecture
  }

  // Génération de mouvements de départ réalistes
  const now = new Date();
  const d1 = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const d2 = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const d3 = new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const initialMovements: StockMovement[] = [
    {
      id: `mov-1-${Date.now()}`,
      organizationId: orgId,
      consumableId: 'cons-1',
      consumableName: 'Câble Fibre Optique 4 FO G.657.A2 (Touret 500m)',
      consumableReference: 'FBR-CAB-4FO',
      type: 'in',
      quantity: 500,
      reason: 'Réception commande fournisseur CMD-2026-042 (BL-9842)',
      date: d3,
      locationTo: 'Dépôt Central - Rack A1',
      createdAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: `mov-2-${Date.now()}`,
      organizationId: orgId,
      consumableId: 'cons-2',
      consumableName: 'Prise Terminale Optique (PTO) 4 ports SC/APC',
      consumableReference: 'FBR-PTO-01',
      type: 'out',
      quantity: 4,
      reason: 'Raccordement pavillon client Dupont',
      technicianName: 'Thomas Martin',
      interventionRef: 'INT-2026-081',
      date: d2,
      locationFrom: 'Véhicule Renault Trafic AB-123-CD',
      createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: `mov-3-${Date.now()}`,
      organizationId: orgId,
      consumableId: 'cons-3',
      consumableName: 'Disjoncteur Ph+N 16A Courbe C 4.5kA',
      consumableReference: 'ELEC-DISJ-16A',
      type: 'transfer',
      quantity: 10,
      reason: 'Dotation hebdomadaire technicien',
      technicianName: 'Sophie Bernard',
      locationFrom: 'Dépôt Central',
      locationTo: 'Véhicule Peugeot Partner EF-456-GH',
      date: d1,
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  try {
    localStorage.setItem(getStorageKeyMovements(orgId), JSON.stringify(initialMovements));
  } catch {
    // Quota ou indisponibilité
  }

  return initialMovements;
}

export function saveMovementsToStorage(orgId: string, items: StockMovement[]): void {
  try {
    localStorage.setItem(getStorageKeyMovements(orgId), JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save stock movements to storage', err);
  }
}

// -----------------------------------------------------------------------------
// Opérations métier
// -----------------------------------------------------------------------------

export function createConsumableInStorage(
  orgId: string,
  input: ConsumableInput,
): StockConsumable {
  const current = loadConsumablesFromStorage(orgId);
  const now = new Date().toISOString();

  const newArticle: StockConsumable = {
    ...input,
    id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: orgId,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newArticle, ...current];
  saveConsumablesToStorage(orgId, updated);
  return newArticle;
}

export function updateConsumableInStorage(
  orgId: string,
  consumableId: string,
  patch: Partial<ConsumableInput>,
): StockConsumable {
  const current = loadConsumablesFromStorage(orgId);
  const index = current.findIndex((c) => c.id === consumableId);

  if (index === -1) {
    throw new Error(`Article introuvable (${consumableId})`);
  }

  const existing = current[index];
  if (!existing) {
    throw new Error(`Article introuvable (${consumableId})`);
  }

  const updatedItem: StockConsumable = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  current[index] = updatedItem;
  saveConsumablesToStorage(orgId, current);
  return updatedItem;
}

export function deleteConsumableInStorage(orgId: string, consumableId: string): void {
  const current = loadConsumablesFromStorage(orgId);
  const filtered = current.filter((c) => c.id !== consumableId);
  saveConsumablesToStorage(orgId, filtered);
}

export function recordMovementInStorage(
  orgId: string,
  input: StockMovementInput,
): { movement: StockMovement; updatedConsumable: StockConsumable } {
  const consumables = loadConsumablesFromStorage(orgId);
  const consumable = consumables.find((c) => c.id === input.consumableId);

  if (!consumable) {
    throw new Error(`Article introuvable pour ce mouvement (${input.consumableId})`);
  }

  // Calcul du nouveau stock
  let newQuantity = consumable.quantityInStock;
  const qty = Number(input.quantity) || 0;

  if (input.type === 'in') {
    newQuantity += qty;
  } else if (input.type === 'out') {
    newQuantity = Math.max(0, newQuantity - qty);
  } else if (input.type === 'adjustment') {
    // Si ajustement direct, la quantité peut être le nouveau total ou le delta
    newQuantity = qty;
  }
  // Pour transfer, le stock global reste le même, mais les emplacements changent

  const now = new Date().toISOString();
  const updatedConsumable: StockConsumable = {
    ...consumable,
    quantityInStock: newQuantity,
    updatedAt: now,
  };

  // Enregistrer la mise à jour de l'article
  const updatedConsumables = consumables.map((c) =>
    c.id === consumable.id ? updatedConsumable : c,
  );
  saveConsumablesToStorage(orgId, updatedConsumables);

  // Créer l'entrée de journal de mouvement
  const movement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: orgId,
    consumableId: consumable.id,
    consumableName: consumable.name,
    consumableReference: consumable.reference,
    type: input.type,
    quantity: qty,
    reason: input.reason,
    technicianName: input.technicianName,
    technicianId: input.technicianId,
    interventionRef: input.interventionRef,
    locationFrom: input.locationFrom || consumable.location,
    locationTo: input.locationTo,
    date: new Date().toISOString().slice(0, 10),
    createdAt: now,
  };

  const currentMovements = loadMovementsFromStorage(orgId);
  saveMovementsToStorage(orgId, [movement, ...currentMovements]);

  return { movement, updatedConsumable };
}
