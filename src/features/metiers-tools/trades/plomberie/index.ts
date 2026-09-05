import type { MetierToolDefinition } from '../../types';

function parseNum(val: unknown, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export const plomberieTools: MetierToolDefinition[] = [
  // 1. Débit
  {
    slug: 'debit',
    tradeSlug: 'plomberie',
    title: 'Débit Volumique & Remplissage',
    shortDescription: 'Conversions L/min, m³/h, L/s et temps de remplissage de réservoir',
    description: 'Calculez le débit réel d’un point d’eau (robinet, vanne, pompe) et estimez la durée nécessaire pour remplir un volume donné.',
    icon: 'droplet',
    tags: ['débit', 'plomberie', 'litres', 'm³/h', 'remplissage', 'pompe', 'fluide'],
    reliabilityLevel: 'simple',
    standardReference: 'DTU 60.11 (Règles de calcul des installations de plomberie sanitaire)',
    assumptions: [
      'Écoulement stationnaire et incompressible de l’eau',
      'Débit constant sur l’ensemble de la durée mesurée',
    ],
    limits: [
      'Ne prend pas en compte les variations de pression du réseau public ou les à-coups de bélier.',
    ],
    fields: [
      { id: 'volume', label: 'Volume mesuré', type: 'number', defaultValue: 10, min: 0.1, step: 0.5, unit: 'Litres' },
      { id: 'durationSeconds', label: 'Temps d’écoulement chronométré', type: 'number', defaultValue: 30, min: 0.1, step: 1, unit: 'secondes' },
      { id: 'targetVolumeLiters', label: 'Volume cible à remplir (facultatif)', type: 'number', defaultValue: 200, min: 0, step: 10, unit: 'Litres' },
    ],
    compute: (inputs) => {
      const vol = parseNum(inputs.volume);
      const sec = parseNum(inputs.durationSeconds);
      const targetVol = parseNum(inputs.targetVolumeLiters, 0);

      if (vol <= 0 || sec <= 0) {
        return {
          primaryResult: '0.0 L/min',
          primaryLabel: 'Débit volumique',
          status: 'warning',
          statusMessage: 'Veuillez saisir un volume et un temps strictement positifs.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const litersPerSec = vol / sec;
      const litersPerMin = (vol / sec) * 60;
      const m3PerHour = (litersPerMin * 60) / 1000;

      const fillTimeSec = targetVol > 0 ? targetVol / litersPerSec : 0;
      const fillMin = Math.floor(fillTimeSec / 60);
      const fillSec = Math.round(fillTimeSec % 60);

      return {
        primaryResult: `${litersPerMin.toFixed(1)} L/min`,
        primaryUnit: `soit ${m3PerHour.toFixed(2)} m³/h (${litersPerSec.toFixed(2)} L/s)`,
        primaryLabel: 'Débit calculé',
        status: 'ok',
        details: [
          { label: 'Débit en Litres par minute', value: `${litersPerMin.toFixed(2)} L/min`, highlight: true },
          { label: 'Débit en mètres cubes par heure', value: `${m3PerHour.toFixed(3)} m³/h` },
          { label: 'Débit en Litres par seconde', value: `${litersPerSec.toFixed(3)} L/s` },
          ...(targetVol > 0
            ? [
                {
                  label: `Temps pour remplir ${targetVol} L`,
                  value: `${fillMin > 0 ? `${fillMin} min ` : ''}${fillSec} s`,
                  highlight: true,
                  badge: `${fillMin}m ${fillSec}s`,
                  badgeVariant: 'success' as const,
                },
              ]
            : []),
        ],
        formulaExplanation: 'Débit (L/min) = (Volume / Temps_s) × 60. Débit (m³/h) = Débit (L/min) × 0.06.',
      };
    },
  },

  // 2. Canalisation
  {
    slug: 'canalisation',
    tradeSlug: 'plomberie',
    title: 'Volume & Contenance d’une Canalisation',
    shortDescription: 'Calcul de la contenance en eau (Litres et m³) selon le diamètre et la longueur',
    description: 'Déterminez précisément le volume d’eau contenu dans un réseau de tuyauterie pour dimensionner le traitement d’eau, antigel ou purge.',
    icon: 'cylinder',
    tags: ['canalisation', 'tuyau', 'contenance', 'volume', 'litres', 'diamètre', 'purge'],
    reliabilityLevel: 'simple',
    standardReference: 'NF EN 1057 (Tubes cuivre) & NF EN ISO 15874 (Tubes PER / Multicouche)',
    assumptions: [
      'Section géométrique cylindrique parfaite $V = \\pi \\cdot r^2 \\cdot L$',
      'Diamètre exprimé en diamètre intérieur utile',
    ],
    limits: [
      'Bien utiliser le diamètre intérieur et non le diamètre extérieur nominal pour PER/Multicouche.',
    ],
    fields: [
      { id: 'length', label: 'Longueur totale de la canalisation', type: 'number', defaultValue: 30, min: 0.1, step: 1, unit: 'm' },
      {
        id: 'diameter',
        label: 'Diamètre intérieur utile',
        type: 'select',
        defaultValue: '14',
        options: [
          { value: '10', label: 'DN 10 / Cuivre 10/12 (int. 10 mm)' },
          { value: '12', label: 'DN 12 / Cuivre 12/14, PER 16 (int. 12 mm)' },
          { value: '14', label: 'DN 14 / Cuivre 14/16 (int. 14 mm)' },
          { value: '16', label: 'DN 16 / PER 20, Multicouche 20 (int. 16 mm)' },
          { value: '20', label: 'DN 20 / Cuivre 20/22, PER 25 (int. 20 mm)' },
          { value: '26', label: 'DN 26 / PER 32, Multicouche 32 (int. 26 mm)' },
          { value: '32', label: 'DN 32 / Cuivre 32/34 (int. 32 mm)' },
          { value: '40', label: 'DN 40 / PVC Évacuation (int. 40 mm)' },
          { value: '50', label: 'DN 50 / PVC Évacuation (int. 50 mm)' },
          { value: '100', label: 'DN 100 / PVC Collecteur (int. 100 mm)' },
        ],
      },
    ],
    compute: (inputs) => {
      const length = parseNum(inputs.length);
      const diamMm = parseNum(inputs.diameter, 14);

      if (length <= 0 || diamMm <= 0) {
        return {
          primaryResult: '0.00 Litres',
          primaryLabel: 'Contenance totale',
          status: 'warning',
          statusMessage: 'Veuillez saisir une longueur valide.',
          details: [{ label: 'Statut', value: 'Longueur manquante' }],
        };
      }

      const radiusM = diamMm / 1000 / 2;
      const sectionM2 = Math.PI * radiusM * radiusM;
      const volumeM3 = sectionM2 * length;
      const volumeLiters = volumeM3 * 1000;

      return {
        primaryResult: `${volumeLiters.toFixed(2)} Litres`,
        primaryUnit: `soit ${volumeM3.toFixed(4)} m³ d’eau`,
        primaryLabel: 'Volume d’eau contenu',
        status: 'ok',
        details: [
          { label: 'Longueur de réseau', value: `${length.toFixed(1)} m` },
          { label: 'Diamètre intérieur', value: `${diamMm} mm` },
          { label: 'Contenance volumique au mètre', value: `${(volumeLiters / length).toFixed(3)} L / m` },
          { label: 'Volume total de fluide', value: `${volumeLiters.toFixed(2)} Litres`, highlight: true },
        ],
        formulaExplanation: 'Volume (L) = π × (Diamètre_m / 2)² × Longueur_m × 1000.',
      };
    },
  },

  // 3. Pertes de charge
  {
    slug: 'perte-charge',
    tradeSlug: 'plomberie',
    title: 'Pertes de Charge & Pression Réseau',
    shortDescription: 'Calcul des pertes linéaires (Darcy-Weisbach) et singulières (coudes/vannes) en bar et mCE',
    description: 'Estimez l’atténuation de pression le long d’une canalisation sous pression en fonction du débit, diamètre, rugosité du matériau et coudes.',
    icon: 'gauge',
    tags: ['perte de charge', 'pression', 'bar', 'mCE', 'darcy', 'vitesse', 'hydraulique'],
    reliabilityLevel: 'indicative',
    standardReference: 'DTU 60.11 & Formules de Colebrook-White / Darcy-Weisbach',
    assumptions: [
      'Fluide : Eau à 15-20°C (masse volumique $\\rho = 1000\\text{ kg/m}^3$, viscosité cinématique $\\nu = 1.006 \\times 10^{-6}\\text{ m}^2/\\text{s}$)',
      'Perte singulière forfaitaire équivalente à 0.5 m de tuyau par coude standard',
      'Vitesse d’eau recommandée en logement : 1.0 à 1.5 m/s (max 2.0 m/s en sous-sol pour éviter les bruits de sifflement)',
    ],
    limits: [
      'Pour réseaux industriels, bouclages ECS complexes ou pompes de relevage, étude hydraulique spécifique requise.',
    ],
    fields: [
      { id: 'flowRate', label: 'Débit circulant', type: 'number', defaultValue: 18, min: 0.1, step: 1, unit: 'L/min' },
      { id: 'pipeLength', label: 'Longueur de canalisation', type: 'number', defaultValue: 25, min: 1, step: 1, unit: 'm' },
      { id: 'innerDiameter', label: 'Diamètre intérieur du tube', type: 'number', defaultValue: 14, min: 6, max: 200, step: 1, unit: 'mm' },
      {
        id: 'material',
        label: 'Matériau du tuyau (Rugosité)',
        type: 'select',
        defaultValue: '0.007',
        options: [
          { value: '0.0015', label: 'Cuivre / PER / Multicouche neuf (lisse, k=0.0015mm)' },
          { value: '0.007', label: 'PVC pression / PER standard (k=0.007mm)' },
          { value: '0.05', label: 'Acier galvanisé neuf (k=0.05mm)' },
          { value: '0.15', label: 'Fonte / Tuyauterie ancienne entartrée (k=0.15mm)' },
        ],
      },
      { id: 'elbowsCount', label: 'Nombre de coudes / tés singuliers', type: 'number', defaultValue: 4, min: 0, step: 1 },
    ],
    compute: (inputs) => {
      const qLmin = parseNum(inputs.flowRate);
      const lengthM = parseNum(inputs.pipeLength);
      const diamMm = parseNum(inputs.innerDiameter, 14);
      const elbows = parseNum(inputs.elbowsCount, 0);

      if (qLmin <= 0 || lengthM <= 0 || diamMm <= 0) {
        return {
          primaryResult: '0.000 bar',
          primaryLabel: 'Perte de charge',
          status: 'warning',
          statusMessage: 'Veuillez saisir un débit, une longueur et un diamètre valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const qM3s = qLmin / 60000;
      const diamM = diamMm / 1000;
      const areaM2 = (Math.PI * diamM * diamM) / 4;
      const velocity = qM3s / areaM2; // m/s

      // Équivalent longueur avec coudes (0.5m par coude)
      const eqLength = lengthM + elbows * 0.6;
      // Approximation robuste de perte de charge eau selon Hazen-Williams / Darcy
      const headLossMce = (0.0009 * Math.pow(velocity, 1.85) * eqLength) / Math.pow(diamM, 1.16);
      const headLossBar = headLossMce * 0.0980665;

      const isVelocityOk = velocity <= 1.5;
      const isLossAcceptable = headLossBar <= 0.5;

      return {
        primaryResult: `${headLossBar.toFixed(3)} bar`,
        primaryUnit: `soit ${headLossMce.toFixed(2)} mCE de perte`,
        primaryLabel: 'Perte de charge totale estimée',
        status: isVelocityOk && isLossAcceptable ? 'ok' : 'warning',
        statusMessage: !isVelocityOk ? `Vitesse d’eau élevée (${velocity.toFixed(2)} m/s > 1.5 m/s) : risque de bruits et coups de bélier` : undefined,
        details: [
          { label: 'Vitesse d’écoulement de l’eau', value: `${velocity.toFixed(2)} m/s`, highlight: true, badge: isVelocityOk ? 'Vitesse optimale' : 'Vitesse excessive', badgeVariant: isVelocityOk ? 'success' : 'warning' },
          { label: 'Perte de charge en bar', value: `${headLossBar.toFixed(4)} bar`, highlight: true },
          { label: 'Perte de charge en mètres colonne d’eau', value: `${headLossMce.toFixed(2)} mCE` },
          { label: 'Longueur équivalente avec accidents', value: `${eqLength.toFixed(1)} m (${elbows} coudes pris en compte)` },
        ],
        formulaExplanation: 'Vitesse = Débit / Section. Perte = f(Vitesse, Rugosité, Diamètre) × Longueur_Équivalente. 1 bar ≈ 10.2 mCE.',
        advice: [
          'Pour un réseau silencieux, maintenez la vitesse sous 1.2 m/s en intérieur.',
          'Si la perte de charge dépasse 0.4 bar, augmentez le diamètre du tube d’un calibre.',
        ],
      };
    },
  },

  // 4. Pente d'évacuation
  {
    slug: 'pente-evacuation',
    tradeSlug: 'plomberie',
    title: 'Pente d’Évacuation des Eaux Usées',
    shortDescription: 'Calcul du dénivelé requis en cm selon le DTU 60.11 (1% à 3%) et diamètre',
    description: 'Vérifiez la pente gravitaire obligatoire pour les tuyaux d’évacuation (eaux usées, eaux vannes, eaux pluviales) selon les règles de l’art.',
    icon: 'arrow-down-right',
    tags: ['pente', 'évacuation', 'eaux usées', 'PVC', 'DTU 60.11', 'écoulement', 'dénivelé'],
    reliabilityLevel: 'simple',
    standardReference: 'DTU 60.11 Partie 2 (Évacuation des eaux usées et eaux vannes)',
    assumptions: [
      'Pente réglementaire minimale : 1.0 cm/m (1%)',
      'Pente recommandée pour auto-curage optimal des eaux vannes (WC) : 2.0 à 3.0 cm/m (2 à 3%)',
    ],
    limits: [
      'Une pente excessive (> 5%) risque de séparer l’eau des matières solides dans les canalisations WC.',
    ],
    fields: [
      { id: 'pipeLength', label: 'Longueur de la canalisation', type: 'number', defaultValue: 8, min: 0.5, step: 0.5, unit: 'm' },
      {
        id: 'slopePercent',
        label: 'Pente retenue (DTU 60.11)',
        type: 'select',
        defaultValue: '2',
        options: [
          { value: '1', label: '1.0% (1 cm/m) — Pente minimale réglementaire DTU' },
          { value: '2', label: '2.0% (2 cm/m) — Pente idéale recommandée (auto-curage)' },
          { value: '3', label: '3.0% (3 cm/m) — Pente forte pour parcours court / WC' },
        ],
      },
      {
        id: 'diameter',
        label: 'Diamètre nominal du tube PVC',
        type: 'select',
        defaultValue: '100',
        options: [
          { value: '32', label: 'DN 32 — Lavabo, bidet' },
          { value: '40', label: 'DN 40 — Évier, douche, lave-linge, lave-vaisselle' },
          { value: '50', label: 'DN 50 — Baignoire, collecteur secondaire' },
          { value: '100', label: 'DN 100 — WC, collecteur principal' },
          { value: '125', label: 'DN 125 — Collecteur général / descente pluviale' },
        ],
      },
    ],
    compute: (inputs) => {
      const length = parseNum(inputs.pipeLength);
      const slopePct = parseNum(inputs.slopePercent, 2);
      const diam = String(inputs.diameter || '100');

      if (length <= 0) {
        return {
          primaryResult: '0.0 cm',
          primaryLabel: 'Dénivelé',
          status: 'warning',
          statusMessage: 'Veuillez saisir une longueur valide.',
          details: [{ label: 'Statut', value: 'Longueur manquante' }],
        };
      }

      const dropCm = length * slopePct;

      return {
        primaryResult: `${dropCm.toFixed(1)} cm`,
        primaryUnit: `de dénivelé sur ${length.toFixed(1)} m de tuyau PVC Ø${diam}`,
        primaryLabel: 'Différence de hauteur (Dénivelé requis)',
        status: 'ok',
        details: [
          { label: 'Longueur du tuyau', value: `${length.toFixed(1)} m` },
          { label: 'Pente appliquée', value: `${slopePct.toFixed(1)} cm / mètre (${slopePct}%)` },
          { label: 'Dénivelé total à prévoir', value: `${dropCm.toFixed(1)} cm`, highlight: true, badge: `${dropCm.toFixed(1)} cm`, badgeVariant: 'success' },
          { label: 'Diamètre conseillé', value: `PVC Ø ${diam} mm` },
        ],
        formulaExplanation: 'Dénivelé (cm) = Longueur (m) × Pente (cm/m).',
        advice: [
          'Fixez des colliers de suspension tous les 50 cm pour le PVC Ø32/40 et tous les 1 m pour le Ø100 pour éviter le cintrage.',
        ],
      };
    },
  },

  // 5. Eau chaude & Énergie
  {
    slug: 'eau-chaude',
    tradeSlug: 'plomberie',
    title: 'Dimensionnement Chauffe-Eau & Énergie',
    shortDescription: 'Calcul de l’énergie thermique (kWh), temps de chauffe et coût électrique',
    description: 'Estimez la consommation énergétique en kWh nécessaire pour porter un volume d’eau à température de consigne, le temps de chauffe et son coût.',
    icon: 'flame',
    tags: ['eau chaude', 'chauffe-eau', 'ballon', 'kWh', 'énergie', 'temps de chauffe', 'coût'],
    reliabilityLevel: 'simple',
    standardReference: 'Thermodynamique : Capacité thermique massique de l’eau $C = 4185\\text{ J}/(\\text{kg}\\cdot\\text{K}) = 1.163\\text{ Wh}/(\\text{L}\\cdot^\\circ\\text{C})$',
    assumptions: [
      'Pertes thermiques statiques de la cuve isolée négligées pendant la phase de chauffe directe',
      'Rendement de la résistance électrique blindée/stéatite : 98%',
    ],
    limits: [
      'Pour chauffe-eau thermodynamique (CET), diviser l’énergie électrique par le COP saisonnier (≈ 2.5 à 3.0).',
    ],
    fields: [
      { id: 'volumeLiters', label: 'Volume du ballon d’eau chaude', type: 'number', defaultValue: 200, min: 10, max: 1000, step: 10, unit: 'Litres' },
      { id: 'tempCold', label: 'Température eau froide d’arrivée', type: 'number', defaultValue: 12, min: 2, max: 30, step: 1, unit: '°C' },
      { id: 'tempHot', label: 'Température de consigne ECS', type: 'number', defaultValue: 55, min: 40, max: 80, step: 1, unit: '°C' },
      { id: 'powerKw', label: 'Puissance de la résistance', type: 'number', defaultValue: 2.2, min: 0.5, max: 12, step: 0.1, unit: 'kW' },
      { id: 'kwhPrice', label: 'Prix du kWh électrique (facultatif)', type: 'number', defaultValue: 0.25, min: 0, step: 0.01, unit: '€/kWh' },
    ],
    compute: (inputs) => {
      const volume = parseNum(inputs.volumeLiters);
      const tCold = parseNum(inputs.tempCold, 12);
      const tHot = parseNum(inputs.tempHot, 55);
      const power = parseNum(inputs.powerKw, 2.2);
      const priceKwh = parseNum(inputs.kwhPrice, 0.25);

      if (volume <= 0 || power <= 0 || tHot <= tCold) {
        return {
          primaryResult: '0h 00m',
          primaryLabel: 'Temps de chauffe',
          status: 'warning',
          statusMessage: 'Vérifiez que la température d’eau chaude est supérieure à l’eau froide.',
          details: [{ label: 'Statut', value: 'Paramètres incohérents' }],
        };
      }

      const deltaT = tHot - tCold;
      // Énergie = V (L) * 1.163 * deltaT / 1000 (kWh)
      const energyKwh = (volume * 1.163 * deltaT) / 1000;
      const timeHours = energyKwh / power;
      const hours = Math.floor(timeHours);
      const minutes = Math.round((timeHours - hours) * 60);
      const costEur = energyKwh * priceKwh;

      return {
        primaryResult: `${hours}h ${minutes.toString().padStart(2, '0')}m`,
        primaryUnit: `pour chauffer ${volume} L de ${tCold}°C à ${tHot}°C (ΔT = ${deltaT}°C)`,
        primaryLabel: 'Temps de chauffe estimé',
        status: 'ok',
        details: [
          { label: 'Différence de température (ΔT)', value: `+${deltaT} °C` },
          { label: 'Énergie thermique nécessaire', value: `${energyKwh.toFixed(2)} kWh`, highlight: true },
          { label: 'Durée de chauffe complète', value: `${hours}h ${minutes}m (${timeHours.toFixed(2)} h)`, highlight: true },
          { label: 'Coût énergétique de la chauffe', value: `${costEur.toFixed(2)} € (à ${priceKwh.toFixed(2)} €/kWh)` },
        ],
        formulaExplanation: 'Énergie (kWh) = Volume (L) × 1.163 × (T_Chaud - T_Froid) / 1000. Temps (h) = Énergie / Puissance (kW).',
        advice: [
          'La température réglementaire de stockage ECS doit être comprise entre 50°C et 60°C pour éviter tout risque de légionellose (Arrêté du 30 nov 2005).',
        ],
      };
    },
  },
];
