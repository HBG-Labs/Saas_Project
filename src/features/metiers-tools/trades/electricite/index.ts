import type { MetierToolDefinition } from '../../types';

function parseNum(val: unknown, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export const electriciteTools: MetierToolDefinition[] = [
  // 1. Loi d'Ohm
  {
    slug: 'loi-ohm',
    tradeSlug: 'electricite',
    title: 'Loi d’Ohm Universelle (U, I, R, P)',
    shortDescription: 'Calcul instantané de U, I, R et P à partir de 2 grandeurs connues',
    description: 'Résolvez toutes les équations fondamentales de l’électricité continue ou alternative purement résistive ($U = R \\cdot I$, $P = U \\cdot I$, $P = R \\cdot I^2$, $P = U^2 / R$).',
    icon: 'zap',
    tags: ['loi d’ohm', 'tension', 'intensité', 'résistance', 'puissance', 'volts', 'ampères', 'watts', 'ohms'],
    reliabilityLevel: 'simple',
    standardReference: 'Loi d’Ohm (Georg Ohm, 1827) & Loi de Joule',
    assumptions: [
      'Circuit à courant continu (DC) ou circuit alternatif monophasé purement résistif (facteur de puissance $\\cos\\varphi = 1.0$)',
      'Température du conducteur stabilisée',
    ],
    limits: [
      'Pour charges inductives (moteurs, transformateurs), intégrer le facteur de puissance avec l’outil « Puissance Électrique ».',
    ],
    fields: [
      {
        id: 'knownPair',
        label: 'Grandeurs connues',
        type: 'select',
        defaultValue: 'UI',
        options: [
          { value: 'UI', label: 'Tension (U) et Intensité (I)' },
          { value: 'UR', label: 'Tension (U) et Résistance (R)' },
          { value: 'UP', label: 'Tension (U) et Puissance (P)' },
          { value: 'IR', label: 'Intensité (I) et Résistance (R)' },
          { value: 'IP', label: 'Intensité (I) et Puissance (P)' },
          { value: 'RP', label: 'Résistance (R) et Puissance (P)' },
        ],
      },
      { id: 'val1', label: 'Première valeur', type: 'number', defaultValue: 230, min: 0.001, step: 1, unit: 'Valeur 1' },
      { id: 'val2', label: 'Deuxième valeur', type: 'number', defaultValue: 16, min: 0.001, step: 0.5, unit: 'Valeur 2' },
    ],
    compute: (inputs) => {
      const pair = String(inputs.knownPair || 'UI');
      const v1 = parseNum(inputs.val1);
      const v2 = parseNum(inputs.val2);

      if (v1 <= 0 || v2 <= 0) {
        return {
          primaryResult: '0.0 W',
          primaryLabel: 'Puissance (P)',
          status: 'warning',
          statusMessage: 'Veuillez saisir deux valeurs strictement positives.',
          details: [{ label: 'Statut', value: 'Valeurs nulles ou invalides' }],
        };
      }

      let u = 0;
      let i = 0;
      let r = 0;
      let p = 0;

      if (pair === 'UI') {
        u = v1;
        i = v2;
        r = u / i;
        p = u * i;
      } else if (pair === 'UR') {
        u = v1;
        r = v2;
        i = u / r;
        p = (u * u) / r;
      } else if (pair === 'UP') {
        u = v1;
        p = v2;
        i = p / u;
        r = (u * u) / p;
      } else if (pair === 'IR') {
        i = v1;
        r = v2;
        u = r * i;
        p = r * i * i;
      } else if (pair === 'IP') {
        i = v1;
        p = v2;
        u = p / i;
        r = p / (i * i);
      } else if (pair === 'RP') {
        r = v1;
        p = v2;
        i = Math.sqrt(p / r);
        u = Math.sqrt(p * r);
      }

      return {
        primaryResult: `${p.toFixed(1)} W`,
        primaryUnit: `Tension: ${u.toFixed(1)} V | Courant: ${i.toFixed(2)} A | Résistance: ${r.toFixed(2)} Ω`,
        primaryLabel: 'Puissance dissipée (P)',
        status: 'ok',
        details: [
          { label: 'Tension (U)', value: `${u.toFixed(2)} V (Volts)`, highlight: pair.includes('U') },
          { label: 'Intensité (I)', value: `${i.toFixed(3)} A (Ampères)`, highlight: pair.includes('I') },
          { label: 'Résistance (R)', value: `${r.toFixed(3)} Ω (Ohms)`, highlight: pair.includes('R') },
          { label: 'Puissance (P)', value: `${p.toFixed(2)} W (${(p / 1000).toFixed(3)} kW)`, highlight: pair.includes('P'), badge: `${p.toFixed(0)} W`, badgeVariant: 'success' },
        ],
        formulaExplanation: 'U = R × I | P = U × I | P = R × I² | P = U² / R.',
      };
    },
  },

  // 2. Puissance
  {
    slug: 'puissance',
    tradeSlug: 'electricite',
    title: 'Puissance Électrique (Monophasé & Triphasé)',
    shortDescription: 'Calcul des puissances active (W), apparente (VA) et réactive (VAR) avec cos φ',
    description: 'Calculez la puissance active en kW et apparente en kVA en monophasé 230V ou triphasé 400V en tenant compte du déphasage.',
    icon: 'battery-charging',
    tags: ['puissance', 'monophasé', 'triphasé', 'kW', 'kVA', 'cos phi', 'facteur de puissance', 'VAR'],
    reliabilityLevel: 'simple',
    standardReference: 'NF C 15-100 & Électrotechnique générale (Formules de Boucherot)',
    assumptions: [
      'Tensions nominales normalisées France : 230 V (phase-neutre) / 400 V (entre phases)',
      'Réseau alternatif sinusoïdal équilibré en triphasé',
    ],
    limits: [
      'En présence d’harmoniques fortes (variateurs de vitesse, alimentations à découpage), la puissance déformante D doit être prise en compte.',
    ],
    fields: [
      {
        id: 'systemType',
        label: 'Type de raccordement',
        type: 'select',
        defaultValue: 'mono',
        options: [
          { value: 'mono', label: 'Monophasé 230 V' },
          { value: 'tri', label: 'Triphasé 400 V (équilibré)' },
        ],
      },
      { id: 'voltage', label: 'Tension (U)', type: 'number', defaultValue: 230, min: 12, max: 1000, step: 10, unit: 'V' },
      { id: 'current', label: 'Intensité consommée (I)', type: 'number', defaultValue: 16, min: 0.1, max: 1000, step: 0.5, unit: 'A' },
      { id: 'cosPhi', label: 'Facteur de puissance (cos φ)', type: 'number', defaultValue: 0.85, min: 0.1, max: 1.0, step: 0.05, unit: 'cos φ' },
    ],
    compute: (inputs) => {
      const isTri = inputs.systemType === 'tri';
      const u = parseNum(inputs.voltage, isTri ? 400 : 230);
      const i = parseNum(inputs.current);
      const cosPhi = Math.min(1.0, Math.max(0.1, parseNum(inputs.cosPhi, 0.85)));

      if (u <= 0 || i <= 0) {
        return {
          primaryResult: '0.00 kW',
          primaryLabel: 'Puissance active',
          status: 'warning',
          statusMessage: 'Veuillez saisir une tension et une intensité valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      // S (Apparente VA) = U * I (mono) ou √3 * U * I (tri)
      const apparentVa = isTri ? Math.sqrt(3) * u * i : u * i;
      // P (Active W) = S * cosPhi
      const activeWatts = apparentVa * cosPhi;
      // Q (Réactive VAR) = √(S² - P²)
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const reactiveVar = apparentVa * sinPhi;

      return {
        primaryResult: `${(activeWatts / 1000).toFixed(2)} kW`,
        primaryUnit: `Puissance apparente : ${(apparentVa / 1000).toFixed(2)} kVA (${isTri ? 'Triphasé 400V' : 'Monophasé 230V'})`,
        primaryLabel: 'Puissance Active Réelle (P)',
        status: 'ok',
        details: [
          { label: 'Puissance Active (P)', value: `${activeWatts.toFixed(0)} W (${(activeWatts / 1000).toFixed(2)} kW)`, highlight: true },
          { label: 'Puissance Apparente (S - abonnement)', value: `${apparentVa.toFixed(0)} VA (${(apparentVa / 1000).toFixed(2)} kVA)`, highlight: true },
          { label: 'Puissance Réactive (Q)', value: `${reactiveVar.toFixed(0)} VAR (${(reactiveVar / 1000).toFixed(2)} kVAR)` },
          { label: 'Facteur de puissance appliqué', value: `cos φ = ${cosPhi.toFixed(2)}` },
        ],
        formulaExplanation: isTri ? 'Triphasé : P = √3 × U × I × cos φ. S = √3 × U × I.' : 'Monophasé : P = U × I × cos φ. S = U × I.',
      };
    },
  },

  // 3. Intensité & Disjoncteur
  {
    slug: 'intensite',
    tradeSlug: 'electricite',
    title: 'Intensité & Calibre Disjoncteur',
    shortDescription: 'Calcul du courant nominal (A) et calibre normalisé de disjoncteur divisionnaire',
    description: 'Déterminez l’ampérage absorbé par un appareil ou un groupe de récepteurs et sélectionnez le calibre de disjoncteur magnéto-thermique approprié.',
    icon: 'activity',
    tags: ['intensité', 'ampères', 'disjoncteur', 'calibre', 'tableau', 'protection', 'NF C 15-100'],
    reliabilityLevel: 'simple',
    standardReference: 'NF C 15-100 Tableau 771F (Dispositifs de protection et sections minimales)',
    assumptions: [
      'Calibres normalisés modulaires pour tableau d’abonnés : 2A, 10A, 16A, 20A, 25A, 32A, 40A, 63A',
      'Règle de coordination : Courant nominal d’emploi $I_b \\le I_n \\le I_z$ (courant admissible dans le câble)',
    ],
    limits: [
      'Ne dispense pas du respect des calibres imposés par la NF C 15-100 pour usages dédiés (ex: éclairage max 16A, prises 16/20A, plaque 32A).',
    ],
    fields: [
      { id: 'powerWatts', label: 'Puissance cumulée des récepteurs', type: 'number', defaultValue: 3500, min: 10, max: 100000, step: 50, unit: 'Watts' },
      { id: 'voltage', label: 'Tension d’alimentation', type: 'number', defaultValue: 230, min: 12, max: 1000, step: 10, unit: 'V' },
      { id: 'cosPhi', label: 'Facteur de puissance (cos φ)', type: 'number', defaultValue: 1.0, min: 0.1, max: 1.0, step: 0.05 },
      { id: 'isTri', label: 'Alimentation triphasée (400V)', type: 'boolean', defaultValue: false },
    ],
    compute: (inputs) => {
      const p = parseNum(inputs.powerWatts);
      const isTri = Boolean(inputs.isTri);
      const u = parseNum(inputs.voltage, isTri ? 400 : 230);
      const cosPhi = Math.min(1.0, Math.max(0.1, parseNum(inputs.cosPhi, 1.0)));

      if (p <= 0 || u <= 0) {
        return {
          primaryResult: '0.00 A',
          primaryLabel: 'Intensité nominale',
          status: 'warning',
          statusMessage: 'Veuillez saisir une puissance valide.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const current = isTri ? p / (Math.sqrt(3) * u * cosPhi) : p / (u * cosPhi);

      // Calibres normalisés : 2, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125 A
      const standardBreakers = [2, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
      const recommendedBreaker = standardBreakers.find((b) => b >= current * 1.1) ?? standardBreakers[standardBreakers.length - 1] ?? 125;

      return {
        primaryResult: `${current.toFixed(2)} A`,
        primaryUnit: `pour une puissance de ${p} W sous ${u} V`,
        primaryLabel: 'Intensité nominale calculée (Ib)',
        status: 'ok',
        details: [
          { label: 'Courant de service (Ib)', value: `${current.toFixed(2)} A`, highlight: true },
          { label: 'Disjoncteur recommandé (In)', value: `${recommendedBreaker} A (Courbe C standard)`, highlight: true, badge: `${recommendedBreaker} A`, badgeVariant: 'success' },
          { label: 'Marge de sécurité du calibre', value: `+${(((recommendedBreaker - current) / current) * 100).toFixed(0)}%` },
        ],
        formulaExplanation: isTri ? 'I = P / (√3 × U × cos φ)' : 'I = P / (U × cos φ). Calibre = disjoncteur normalisé supérieur à 1.1 × I.',
      };
    },
  },

  // 4. Chute de tension
  {
    slug: 'chute-tension',
    tradeSlug: 'electricite',
    title: 'Chute de Tension en Ligne (NFC 15-100)',
    shortDescription: 'Calcul de ΔU en V et % avec vérification stricte NFC 15-100 (3% / 5%)',
    description: 'Vérifiez si la chute de tension le long d’un câble d’alimentation respecte les seuils normatifs NFC 15-100 (3% éclairage, 5% autres usages).',
    icon: 'trending-down',
    tags: ['chute de tension', 'NFC 15-100', 'câble', 'volts', 'pourcentage', 'section', 'longueur'],
    reliabilityLevel: 'pro_validation',
    standardReference: 'NF C 15-100 § 525 (Chute de tension dans les installations des utilisateurs)',
    assumptions: [
      'Résistivité thermique du cuivre à température maximale de service (70°C) : $\\rho = 0.023\\ \\Omega\\cdot\\text{mm}^2/\\text{m}$ (selon guide UTE C 15-105)',
      'Résistivité de l’aluminium à 70°C : $\\rho = 0.037\\ \\Omega\\cdot\\text{mm}^2/\\text{m}$',
      'Modèle de calcul résistif simplifié pour conducteurs de section $\\le 35\\text{ mm}^2$',
      'Seuils maximaux admissibles : 3% pour circuits d’éclairage, 5% pour circuits de prises et force motrice',
    ],
    limits: [
      'Pour conducteurs de section > 35 mm², la réactance linéique ($X \\approx 0.08\\text{ m}\\Omega/\\text{m}$) doit être combinée à l’impédance complexe.',
    ],
    fields: [
      { id: 'length', label: 'Longueur simple de la ligne', type: 'number', defaultValue: 35, min: 1, max: 1000, step: 1, unit: 'm' },
      { id: 'current', label: 'Intensité maximale transportée (I)', type: 'number', defaultValue: 16, min: 0.5, max: 200, step: 0.5, unit: 'A' },
      {
        id: 'section',
        label: 'Section du câble conducteur',
        type: 'select',
        defaultValue: '2.5',
        options: [
          { value: '1.5', label: '1.5 mm² (Cuivre)' },
          { value: '2.5', label: '2.5 mm² (Cuivre)' },
          { value: '4', label: '4.0 mm² (Cuivre)' },
          { value: '6', label: '6.0 mm² (Cuivre)' },
          { value: '10', label: '10 mm² (Cuivre)' },
          { value: '16', label: '16 mm² (Cuivre)' },
          { value: '25', label: '25 mm² (Cuivre)' },
          { value: '35', label: '35 mm² (Cuivre)' },
          { value: '50', label: '50 mm² (Cuivre)' },
          { value: '70', label: '70 mm² (Cuivre)' },
        ],
      },
      {
        id: 'material',
        label: 'Matériau du conducteur',
        type: 'select',
        defaultValue: '0.023',
        options: [
          { value: '0.023', label: 'Cuivre sous charge (ρ = 0.023 Ω·mm²/m)' },
          { value: '0.037', label: 'Aluminium sous charge (ρ = 0.037 Ω·mm²/m)' },
        ],
      },
      { id: 'voltage', label: 'Tension nominale du circuit', type: 'number', defaultValue: 230, min: 12, max: 1000, step: 10, unit: 'V' },
      {
        id: 'circuitType',
        label: 'Type d’usage & limite NF C 15-100',
        type: 'select',
        defaultValue: '5',
        options: [
          { value: '3', label: 'Éclairage — Max 3% (ΔU max 6.9 V sous 230V)' },
          { value: '5', label: 'Prises & Autres usages — Max 5% (ΔU max 11.5 V sous 230V)' },
          { value: '8', label: 'Branchement tarif bleu Enedis long — Max 8%' },
        ],
      },
    ],
    compute: (inputs) => {
      const l = parseNum(inputs.length);
      const i = parseNum(inputs.current);
      const s = parseNum(inputs.section, 2.5);
      const rho = parseNum(inputs.material, 0.023);
      const u = parseNum(inputs.voltage, 230);
      const maxAllowedPercent = parseNum(inputs.circuitType, 5);

      if (l <= 0 || i <= 0 || s <= 0 || u <= 0) {
        return {
          primaryResult: '0.00 %',
          primaryLabel: 'Chute de tension',
          status: 'warning',
          statusMessage: 'Veuillez renseigner des paramètres valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      // En monophasé : boucle aller-retour (facteur 2)
      // ΔU = (2 × ρ × L × I) / S
      const deltaUVolts = (2 * rho * l * i) / s;
      const deltaUPercent = (deltaUVolts / u) * 100;
      const isConform = deltaUPercent <= maxAllowedPercent;

      return {
        primaryResult: `${deltaUPercent.toFixed(2)} % (${deltaUVolts.toFixed(2)} V)`,
        primaryUnit: `Limite autorisée NFC 15-100 : ${maxAllowedPercent}% (${((u * maxAllowedPercent) / 100).toFixed(1)} V)`,
        primaryLabel: 'Chute de tension en ligne (ΔU)',
        status: isConform ? 'ok' : 'danger',
        statusMessage: isConform ? undefined : `Dépassement de la norme NF C 15-100 (${deltaUPercent.toFixed(2)}% > ${maxAllowedPercent}%) : augmentez la section de câble !`,
        details: [
          { label: 'Chute de tension en Volts (ΔU)', value: `${deltaUVolts.toFixed(2)} V`, highlight: true },
          { label: 'Chute de tension en pourcentage', value: `${deltaUPercent.toFixed(2)} %`, highlight: true },
          { label: 'Tension finale disponible au récepteur', value: `${(u - deltaUVolts).toFixed(1)} V` },
          { label: 'Verdict de conformité NFC 15-100', value: isConform ? `Conforme (≤ ${maxAllowedPercent}%)` : `Non conforme (> ${maxAllowedPercent}%)`, highlight: true, badge: isConform ? 'Conforme' : 'Non conforme', badgeVariant: isConform ? 'success' : 'error' },
        ],
        formulaExplanation: 'ΔU (V) = (2 × ρ × Longueur × Courant) / Section. ΔU (%) = (ΔU / U_Nominal) × 100.',
        advice: [
          'Pour les grandes longueurs (> 30 m), augmentez la section d’un cran même si le disjoncteur nominal autorise une section inférieure.',
        ],
      };
    },
  },

  // 5. Section de câble
  {
    slug: 'section-cable',
    tradeSlug: 'electricite',
    title: 'Section Minimale de Câble Électrique',
    shortDescription: 'Dimensionnement de la section normalisée Cuivre (1.5 à 70 mm²) selon distance et courant',
    description: 'Calculez la section minimale requise pour respecter simultanément la chute de tension maximale admise et l’échauffement admissible.',
    icon: 'cable',
    tags: ['section', 'câble', 'dimensionnement', 'cuivre', 'mm²', 'distance', 'NF C 15-100'],
    reliabilityLevel: 'pro_validation',
    standardReference: 'NF C 15-100 § 524 & UTE C 15-105',
    assumptions: [
      'Conducteur cuivre sous charge thermique maximale 70 °C (ρ = 0,023 Ω·mm²/m)',
      'Sections normalisées du commerce : 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70 mm²',
    ],
    limits: [
      'Pour câbles enterrés ou posés en faisceau avec d’autres circuits, appliquer les facteurs de déclassement $k_1, k_2, k_3$ selon la NF C 15-100.',
    ],
    fields: [
      { id: 'distance', label: 'Distance de la ligne', type: 'number', defaultValue: 40, min: 1, max: 500, step: 1, unit: 'm' },
      { id: 'maxCurrent', label: 'Intensité maximale / Calibre (A)', type: 'number', defaultValue: 32, min: 1, max: 200, step: 1, unit: 'A' },
      { id: 'maxDropPercent', label: 'Chute de tension maximale tolérée', type: 'number', defaultValue: 3, min: 1, max: 10, step: 0.5, unit: '%' },
      { id: 'voltage', label: 'Tension réseau', type: 'number', defaultValue: 230, min: 12, max: 1000, step: 10, unit: 'V' },
    ],
    compute: (inputs) => {
      const dist = parseNum(inputs.distance);
      const current = parseNum(inputs.maxCurrent);
      const maxDrop = parseNum(inputs.maxDropPercent, 3);
      const voltage = parseNum(inputs.voltage, 230);

      if (dist <= 0 || current <= 0 || maxDrop <= 0) {
        return {
          primaryResult: '0 mm²',
          primaryLabel: 'Section requise',
          status: 'warning',
          statusMessage: 'Veuillez saisir des paramètres valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      // ΔU_max (V) = (maxDrop / 100) * voltage
      // S_min = (2 * rho * dist * current) / ΔU_max
      const maxDeltaUVolts = (maxDrop / 100) * voltage;
      const exactSection = (2 * 0.023 * dist * current) / maxDeltaUVolts;

      const standardSections = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70];
      const recommendedSection = standardSections.find((s) => s >= exactSection) ?? 70;

      const realDeltaU = (2 * 0.023 * dist * current) / recommendedSection;
      const realDropPercent = (realDeltaU / voltage) * 100;

      return {
        primaryResult: `${recommendedSection} mm²`,
        primaryUnit: `Section normalisée cuivre pour ${current} A sur ${dist} m`,
        primaryLabel: 'Section de câble recommandée',
        status: exactSection > 70 ? 'warning' : 'ok',
        statusMessage: exactSection > 70 ? 'Section théorique > 70 mm² : prévoyez un doublement de câbles ou passage en triphasé' : undefined,
        details: [
          { label: 'Section théorique calculée', value: `${exactSection.toFixed(2)} mm²` },
          { label: 'Section normalisée retenue', value: `${recommendedSection} mm² (Cuivre)`, highlight: true, badge: `${recommendedSection} mm²`, badgeVariant: 'success' },
          { label: 'Chute de tension résultante réelle', value: `${realDropPercent.toFixed(2)} % (${realDeltaU.toFixed(2)} V)` },
          { label: 'Chute de tension maximale tolérée', value: `${maxDrop}% (${maxDeltaUVolts.toFixed(1)} V)` },
        ],
        formulaExplanation: 'Section_Théorique (mm²) = (2 × 0.023 × Distance × Courant) / ΔU_Max(V). Choix de la section normalisée supérieure.',
      };
    },
  },
];
