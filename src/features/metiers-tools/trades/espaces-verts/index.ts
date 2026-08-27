import type { MetierToolDefinition } from '../../types';

function parseNum(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export const espacesVertsTools: MetierToolDefinition[] = [
  // 1. Plantation
  {
    slug: 'plantation',
    tradeSlug: 'espaces-verts',
    title: 'Densité & Nombre de Végétaux',
    shortDescription: 'Calcul du nombre de plants en massif (m²) ou haie linéaire (m) en carré ou quinconce',
    description: 'Calculez le nombre précis d’arbustes, vivaces ou couvre-sols pour massifs ou haies selon la distance de plantation et la disposition géométrique.',
    icon: 'flower',
    tags: ['plantation', 'massif', 'haie', 'arbuste', 'vivace', 'quinconce', 'densité', 'végétaux'],
    reliabilityLevel: 'simple',
    standardReference: 'Règles Professionnelles UNEP P.C.2-R0 (Travaux de plantation)',
    assumptions: [
      'Disposition en carré : $\\text{Plants/m}^2 = 1 / d^2$',
      'Disposition en quinconce : $\\text{Plants/m}^2 = 1 / (d^2 \\cdot \\sin(60^\\circ)) \\approx 1.155 / d^2$',
      'Haie linéaire : $\\text{Nb} = \\text{ceil}(\\text{Longueur} / d) + 1$',
    ],
    limits: [
      'Tenir compte du développement adulte des végétaux pour éviter l’étouffement racinaire.',
    ],
    fields: [
      {
        id: 'plantMode',
        label: 'Type de plantation',
        type: 'select',
        defaultValue: 'massif',
        options: [
          { value: 'massif', label: 'Massif / Surface (m²)' },
          { value: 'haie', label: 'Haie linéaire (mètre linéaire)' },
        ],
      },
      { id: 'dimension', label: 'Surface (m²) ou Longueur de haie (m)', type: 'number', defaultValue: 25, min: 0.5, step: 0.5, unit: 'm² ou m' },
      { id: 'spacingCm', label: 'Distance entre plants', type: 'number', defaultValue: 40, min: 10, max: 500, step: 5, unit: 'cm' },
      {
        id: 'layoutPattern',
        label: 'Disposition géométrique (pour massifs)',
        type: 'select',
        defaultValue: 'quinconce',
        options: [
          { value: 'carre', label: 'En carré / ligne droite (standard)' },
          { value: 'quinconce', label: 'En quinconce / triangle équilatéral (+15% densité)' },
        ],
      },
    ],
    compute: (inputs) => {
      const mode = String(inputs.plantMode || 'massif');
      const dim = parseNum(inputs.dimension);
      const spacingCm = parseNum(inputs.spacingCm, 40);
      const pattern = String(inputs.layoutPattern || 'quinconce');

      if (dim <= 0 || spacingCm <= 0) {
        return {
          primaryResult: '0 plants',
          primaryLabel: 'Nombre de plants',
          status: 'warning',
          statusMessage: 'Veuillez saisir des dimensions valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const spacingM = spacingCm / 100;
      let totalPlants = 0;

      if (mode === 'haie') {
        // En haie : Longueur / espacement + 1
        totalPlants = Math.ceil(dim / spacingM) + 1;
      } else {
        // En massif :
        const densityPerM2 = pattern === 'quinconce' ? 1.155 / (spacingM * spacingM) : 1 / (spacingM * spacingM);
        totalPlants = Math.ceil(dim * densityPerM2);
      }

      return {
        primaryResult: `${totalPlants} plants`,
        primaryUnit: mode === 'haie' ? `pour ${dim} m de haie (tous les ${spacingCm} cm)` : `pour ${dim} m² (${(totalPlants / dim).toFixed(1)} plants/m²)`,
        primaryLabel: 'Nombre total de végétaux requis',
        status: 'ok',
        details: [
          { label: 'Type d’aménagement', value: mode === 'haie' ? 'Haie linéaire' : `Massif en ${pattern === 'quinconce' ? 'quinconce' : 'carré'}` },
          { label: 'Espacement entre plants', value: `${spacingCm} cm (${spacingM} m)` },
          { label: 'Nombre total de godets / conteneurs', value: `${totalPlants} unités`, highlight: true, badge: `${totalPlants} plants`, badgeVariant: 'success' },
          ...(mode === 'massif' ? [{ label: 'Densité moyenne', value: `${(totalPlants / dim).toFixed(2)} plants / m²` }] : []),
        ],
        formulaExplanation: mode === 'haie' ? 'Nb_Plants = ceil(Longueur / Espacement) + 1' : `Nb_Plants = ceil(Surface × ${pattern === 'quinconce' ? '1.155' : '1.0'} / Espacement²)`,
      };
    },
  },

  // 2. Gazon
  {
    slug: 'gazon',
    tradeSlug: 'espaces-verts',
    title: 'Quantité de Gazon (Semis & Placage)',
    shortDescription: 'Calcul des semences (g/m²) ou surface de rouleaux de placage et engrais',
    description: 'Estimez le poids de graines de gazon selon l’usage (sport, ornement, rustique) ou le nombre de rouleaux de gazon précultivé.',
    icon: 'sprout',
    tags: ['gazon', 'pelouse', 'semences', 'rouleaux', 'placage', 'engrais', 'semis'],
    reliabilityLevel: 'simple',
    standardReference: 'Guide Technique Gazons & Semences GNIS / Plante & Cité',
    assumptions: [
      'Rouleaux de gazon standard : 1 rouleau = 0.80 m² à 1.00 m² (largeur 40 cm × longueur 2.50 m = 1.00 m²)',
      'Dose standard engrais starter de fond : 30 g/m²',
    ],
    limits: [
      'Périodes idéales de semis en France : automne (septembre-octobre) ou printemps (avril-mai).',
    ],
    fields: [
      { id: 'totalArea', label: 'Surface brute du terrain', type: 'number', defaultValue: 300, min: 1, step: 5, unit: 'm²' },
      { id: 'excludedArea', label: 'Massifs et allées à déduire', type: 'number', defaultValue: 40, min: 0, step: 5, unit: 'm²' },
      {
        id: 'dosageGPerM2',
        label: 'Type de gazon & dosage au m²',
        type: 'select',
        defaultValue: '35',
        options: [
          { value: '30', label: '30 g/m² — Gazon rustique / regarnissage' },
          { value: '35', label: '35 g/m² — Gazon standard sport et jeux' },
          { value: '40', label: '40 g/m² — Gazon d’ornement / fin' },
          { value: 'turf_roll', label: 'Gazon en rouleaux de placage (m² direct)' },
        ],
      },
    ],
    compute: (inputs) => {
      const gross = parseNum(inputs.totalArea);
      const excl = parseNum(inputs.excludedArea);
      const doseChoice = String(inputs.dosageGPerM2 || '35');

      if (gross <= 0) {
        return {
          primaryResult: '0 kg',
          primaryLabel: 'Semences',
          status: 'warning',
          statusMessage: 'Veuillez saisir une surface de terrain valide.',
          details: [{ label: 'Statut', value: 'Surface manquante' }],
        };
      }

      const netArea = Math.max(0, gross - excl);

      if (doseChoice === 'turf_roll') {
        const rollM2 = netArea * 1.08; // +8% chutes
        const rollsCount = Math.ceil(rollM2);
        return {
          primaryResult: `${rollsCount} m² de rouleaux`,
          primaryUnit: `pour une surface nette de ${netArea} m²`,
          primaryLabel: 'Gazon en plaques de placage (+8% chutes)',
          status: 'ok',
          details: [
            { label: 'Surface nette à plaquer', value: `${netArea} m²` },
            { label: 'Surface de rouleaux à commander', value: `${rollsCount} m² (soit ${rollsCount} rouleaux de 1m²)`, highlight: true },
            { label: 'Engrais starter recommandé (30g/m²)', value: `${((netArea * 30) / 1000).toFixed(1)} kg` },
          ],
          formulaExplanation: 'Rouleaux = ceil(Surface_Nette × 1.08).',
        };
      }

      const doseG = parseNum(doseChoice, 35);
      const totalKg = ((netArea * doseG) / 1000) * 1.1; // +10% marge
      const bags5kg = Math.ceil(totalKg / 5);
      const starterFertilizerKg = (netArea * 30) / 1000;

      return {
        primaryResult: `${totalKg.toFixed(1)} kg`,
        primaryUnit: `pour ${netArea} m² à raison de ${doseG} g/m² (+10% marge)`,
        primaryLabel: 'Poids total de semences de gazon',
        status: 'ok',
        details: [
          { label: 'Surface nette engazonnée', value: `${netArea.toFixed(1)} m²` },
          { label: 'Dosage de semis retenu', value: `${doseG} g / m²` },
          { label: 'Poids total de graines (+10% marge)', value: `${totalKg.toFixed(2)} kg`, highlight: true },
          { label: 'Sacs de 5 kg à prévoir', value: `${bags5kg} sac(s) (${bags5kg * 5} kg)` },
          { label: 'Engrais d’enracinement starter', value: `${starterFertilizerKg.toFixed(1)} kg (30 g/m²)` },
        ],
        formulaExplanation: 'Poids_Kg = (Surface_Nette × Dosage_g/m² / 1000) × 1.10.',
      };
    },
  },

  // 3. Semences
  {
    slug: 'semences',
    tradeSlug: 'espaces-verts',
    title: 'Calculateur Général de Semences & Engrais',
    shortDescription: 'Dosage au m² ou à l’hectare et nombre de sacs de conditionnement',
    description: 'Calculez le poids total de semences de prairies, engrais verts ou engrais de synthèse et le nombre de sacs de conditionnement.',
    icon: 'tree-pine',
    tags: ['semences', 'engrais', 'prairie', 'dosage', 'hectare', 'sacs', 'kg'],
    reliabilityLevel: 'simple',
    standardReference: 'Règles Professionnelles UNEP & Guides GNIS Prairies',
    assumptions: [
      'Répartition homogène des semences sur l’ensemble de la parcelle',
    ],
    limits: [
      'Pour surfaces agricoles (> 1 ha), calibrer précisément le semoir mécanique.',
    ],
    fields: [
      { id: 'areaM2', label: 'Surface de la parcelle', type: 'number', defaultValue: 1500, min: 1, step: 10, unit: 'm²' },
      { id: 'doseGPerM2', label: 'Dose recommandée', type: 'number', defaultValue: 25, min: 1, max: 500, step: 1, unit: 'g/m²' },
      { id: 'bagSizeKg', label: 'Poids d’un sac de conditionnement', type: 'number', defaultValue: 25, min: 1, max: 100, step: 1, unit: 'kg/sac' },
    ],
    compute: (inputs) => {
      const area = parseNum(inputs.areaM2);
      const dose = parseNum(inputs.doseGPerM2, 25);
      const bagSize = parseNum(inputs.bagSizeKg, 25);

      if (area <= 0 || dose <= 0 || bagSize <= 0) {
        return {
          primaryResult: '0.00 kg',
          primaryLabel: 'Poids total',
          status: 'warning',
          statusMessage: 'Veuillez saisir une surface et un dosage valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const totalKg = (area * dose) / 1000;
      const bagsCount = Math.ceil(totalKg / bagSize);

      return {
        primaryResult: `${totalKg.toFixed(2)} kg`,
        primaryUnit: `pour ${(area / 10000).toFixed(3)} hectare (${area} m²)`,
        primaryLabel: 'Poids total de produit requis',
        status: 'ok',
        details: [
          { label: 'Surface de la parcelle', value: `${area} m² (${(area / 10000).toFixed(2)} ha)` },
          { label: 'Dosage appliqué', value: `${dose} g / m² (${(dose * 10).toFixed(1)} kg / ha)` },
          { label: 'Poids total à commander', value: `${totalKg.toFixed(2)} kg`, highlight: true },
          { label: `Sacs de conditionnement (${bagSize} kg)`, value: `${bagsCount} sacs (${bagsCount * bagSize} kg livrés)` },
        ],
        formulaExplanation: 'Poids_Total = (Surface_m² × Dose_g/m²) / 1000. Nb_Sacs = ceil(Poids_Total / Poids_Sac).',
      };
    },
  },

  // 4. Arrosage
  {
    slug: 'arrosage',
    tradeSlug: 'espaces-verts',
    title: 'Arrosage & Débit de Réseau',
    shortDescription: 'Débit de pointe en m³/h, volume d’eau par cycle et coût annuel de l’eau',
    description: 'Dimensionnez un réseau d’arrosage automatique (goutte-à-goutte, tuyères, turbines) et maîtrisez vos consommations d’eau.',
    icon: 'droplet',
    tags: ['arrosage', 'goutte-à-goutte', 'tuyère', 'turbine', 'débit', 'm³/h', 'eau', 'consommation'],
    reliabilityLevel: 'simple',
    standardReference: 'Guide Technique Arrosage Automatique SYNPAA / Plante & Cité',
    assumptions: [
      'Goutteurs autorégulants : ≈ 2 à 4 L/h par point',
      'Tuyères escamotables (portée 3-5m) : ≈ 300 à 600 L/h par tuyère',
      'Turbines rotatives (portée 8-12m) : ≈ 600 à 1200 L/h par turbine',
    ],
    limits: [
      'Vérifier que le débit de pointe disponible au compteur est supérieur au débit cumulé par secteur d’arrosage.',
    ],
    fields: [
      {
        id: 'nozzleType',
        label: 'Type d’émetteurs d’arrosage',
        type: 'select',
        defaultValue: '4',
        options: [
          { value: '2', label: 'Goutte-à-goutte économe (2 L/h par goutteur)' },
          { value: '4', label: 'Goutte-à-goutte standard (4 L/h par goutteur)' },
          { value: '450', label: 'Tuyère de pelouse (450 L/h)' },
          { value: '900', label: 'Turbine longue portée (900 L/h)' },
        ],
      },
      { id: 'emittersCount', label: 'Nombre total d’émetteurs sur la zone', type: 'number', defaultValue: 80, min: 1, step: 1 },
      { id: 'durationMinutes', label: 'Durée d’un cycle d’arrosage', type: 'number', defaultValue: 45, min: 1, max: 300, step: 5, unit: 'minutes' },
      { id: 'timesPerWeek', label: 'Nombre de cycles par semaine', type: 'number', defaultValue: 3, min: 1, max: 7, step: 1 },
      { id: 'waterPricePerM3', label: 'Prix de l’eau au m³ (facultatif)', type: 'number', defaultValue: 4.2, min: 0, step: 0.1, unit: '€/m³' },
    ],
    compute: (inputs) => {
      const flowPerEmitter = parseNum(inputs.nozzleType, 4);
      const count = Math.max(1, parseNum(inputs.emittersCount, 1));
      const durationMin = parseNum(inputs.durationMinutes, 45);
      const perWeek = parseNum(inputs.timesPerWeek, 3);
      const waterPrice = parseNum(inputs.waterPricePerM3, 4.2);

      if (count <= 0 || durationMin <= 0) {
        return {
          primaryResult: '0 Litres / cycle',
          primaryLabel: 'Volume par cycle',
          status: 'warning',
          statusMessage: 'Veuillez saisir un nombre d’émetteurs et une durée valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const totalFlowPerHourLiters = flowPerEmitter * count;
      const peakFlowM3h = totalFlowPerHourLiters / 1000;
      const volumePerCycleLiters = (totalFlowPerHourLiters * durationMin) / 60;
      const volumePerCycleM3 = volumePerCycleLiters / 1000;

      const weeklyM3 = volumePerCycleM3 * perWeek;
      const seasonalM3 = weeklyM3 * 26; // Saison d’arrosage de 26 semaines (6 mois)
      const seasonalCost = seasonalM3 * waterPrice;

      return {
        primaryResult: `${Math.round(volumePerCycleLiters)} Litres / cycle`,
        primaryUnit: `Débit de pointe instantané requis : ${peakFlowM3h.toFixed(2)} m³/h (${Math.round(totalFlowPerHourLiters)} L/h)`,
        primaryLabel: 'Consommation d’eau par arrosage',
        status: 'ok',
        details: [
          { label: 'Débit instantané de la zone', value: `${peakFlowM3h.toFixed(2)} m³/h (${Math.round(totalFlowPerHourLiters)} L/h)`, highlight: true },
          { label: 'Volume d’eau par arrosage', value: `${Math.round(volumePerCycleLiters)} L (${volumePerCycleM3.toFixed(2)} m³)` },
          { label: `Consommation hebdomadaire (${perWeek}x/semaine)`, value: `${weeklyM3.toFixed(2)} m³ / semaine` },
          { label: 'Estimation budget saison (26 sem.)', value: `${seasonalCost.toFixed(2)} € (${seasonalM3.toFixed(1)} m³ à ${waterPrice}€/m³)` },
        ],
        formulaExplanation: 'Débit_Pointe (m³/h) = (Nb_Émetteurs × Débit_Unitaire_L/h) / 1000. Volume_Cycle (L) = Débit_Pointe × 1000 × (Durée_min / 60).',
      };
    },
  },

  // 5. Paillage
  {
    slug: 'paillage',
    tradeSlug: 'espaces-verts',
    title: 'Volume de Paillage & Mulch (Écorces/Chanvre)',
    shortDescription: 'Calcul du volume m³, conditionnements en sacs 50L/70L et big bags avec tassement',
    description: 'Calculez le volume de paillis végétal ou minéral nécessaire pour vos massifs selon l’épaisseur préconisée et le tassement naturel.',
    icon: 'box',
    tags: ['paillage', 'mulch', 'écorce', 'copeaux', 'chanvre', 'massif', 'sacs', 'm³'],
    reliabilityLevel: 'simple',
    standardReference: 'Règles Professionnelles UNEP P.C.2-R0 & Guide Plante & Cité',
    assumptions: [
      'Écorces de pin / copeaux de bois : épaisseur recommandée 7 à 10 cm (tassement naturel 15-20%)',
      'Paillis fins (chanvre, lin, cacao) : épaisseur 4 à 6 cm',
      'Paillis minéral (pouzzolane, ardoise) : épaisseur 5 à 7 cm',
    ],
    limits: [
      'Ne pas coller le paillage contre le collet des arbres pour éviter la pourriture fongique.',
    ],
    fields: [
      { id: 'area', label: 'Surface du massif à pailler', type: 'number', defaultValue: 30, min: 0.5, step: 0.5, unit: 'm²' },
      { id: 'thicknessCm', label: 'Épaisseur de couche souhaitée', type: 'number', defaultValue: 8, min: 2, max: 25, step: 0.5, unit: 'cm' },
      {
        id: 'settlement',
        label: 'Type de paillis & tassement naturel',
        type: 'select',
        defaultValue: '1.15',
        options: [
          { value: '1.15', label: 'Copeaux de bois / Écorces de pin (+15% tassement)' },
          { value: '1.20', label: 'Paille / Chanvre / Lin (+20% tassement)' },
          { value: '1.05', label: 'Paillis minéral (Pouzzolane/Ardoise, +5% tassement)' },
          { value: '1.0', label: 'Sans coefficient de tassement' },
        ],
      },
    ],
    compute: (inputs) => {
      const area = parseNum(inputs.area);
      const thickness = parseNum(inputs.thicknessCm, 8);
      const factor = parseNum(inputs.settlement, 1.15);

      if (area <= 0 || thickness <= 0) {
        return {
          primaryResult: '0.00 m³',
          primaryLabel: 'Volume de paillage',
          status: 'warning',
          statusMessage: 'Veuillez saisir une surface et une épaisseur valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const rawM3 = area * (thickness / 100);
      const totalM3 = rawM3 * factor;
      const totalLiters = totalM3 * 1000;

      const bags70L = Math.ceil(totalLiters / 70);
      const bags50L = Math.ceil(totalLiters / 50);
      const bigBags1m3 = Math.ceil(totalM3);

      return {
        primaryResult: `${totalM3.toFixed(2)} m³`,
        primaryUnit: `soit ${Math.round(totalLiters)} Litres de paillis pour ${area} m²`,
        primaryLabel: 'Volume total de paillage (avec tassement)',
        status: 'ok',
        details: [
          { label: 'Surface couverte', value: `${area.toFixed(1)} m²` },
          { label: 'Épaisseur étalée', value: `${thickness} cm` },
          { label: 'Volume total nécessaire', value: `${totalM3.toFixed(2)} m³ (${Math.round(totalLiters)} L)`, highlight: true },
          { label: 'Conditionnement en sacs de 70 Litres', value: `${bags70L} sacs` },
          { label: 'Conditionnement en sacs de 50 Litres', value: `${bags50L} sacs` },
          { label: 'Conditionnement en Big Bags (1 m³)', value: `${bigBags1m3} Big Bag${bigBags1m3 > 1 ? 's' : ''}` },
        ],
        formulaExplanation: 'Volume (m³) = Surface × (Épaisseur_cm / 100) × Coeff_Tassement. Litres = Volume_m³ × 1000.',
      };
    },
  },
];
