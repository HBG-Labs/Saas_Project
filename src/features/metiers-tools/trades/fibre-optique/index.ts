import type { MetierToolDefinition } from '../../types';

function parseNum(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export const fibreOptiqueTools: MetierToolDefinition[] = [
  // 1. Budget optique
  {
    slug: 'budget-optique',
    tradeSlug: 'fibre-optique',
    title: 'Bilan de Liaison & Budget Optique',
    shortDescription: 'Calcul du budget disponible (dB), puissance reçue et marge de sécurité',
    description: 'Vérifiez la viabilité d’un lien optique GPON, point-à-point ou backbone en confrontant la puissance d’émission (Tx), la sensibilité (Rx) et l’atténuation totale.',
    icon: 'bar-chart-2',
    tags: ['budget optique', 'dB', 'dBm', 'bilan de liaison', 'Tx', 'Rx', 'marge', 'GPON', 'ITU-T'],
    reliabilityLevel: 'pro_validation',
    standardReference: 'Recommandations ITU-T G.984.2 (GPON PMD) & ITU-T G.652D',
    assumptions: [
      'Puissance d’émission (Tx) et sensibilité du récepteur (Rx) exprimées en dBm',
      'Pertes de liaison cumulées incluant fibre, épissures, connecteurs et coupleurs optiques',
      'Marge de sécurité minimale requise : $\\ge 3.0\\text{ dB}$ pour compenser le vieillissement des composants et soudures d’intervention ultérieures',
    ],
    limits: [
      'Si la puissance reçue dépasse la puissance de saturation du récepteur ($P_{rx\\_sat}$), un atténuateur optique fixe est indispensable.',
    ],
    fields: [
      { id: 'txPowerDbm', label: 'Puissance d’émission optique (Tx)', type: 'number', defaultValue: 2.5, min: -20, max: 20, step: 0.5, unit: 'dBm', helpText: 'Ex: SFP+ classe B+ (+1.5 à +5 dBm)' },
      { id: 'rxSensitivityDbm', label: 'Sensibilité du récepteur (Rx Min)', type: 'number', defaultValue: -28.0, min: -50, max: 0, step: 0.5, unit: 'dBm', helpText: 'Ex: ONT GPON (-27 à -30 dBm)' },
      { id: 'totalLossesDb', label: 'Pertes totales mesurées / calculées', type: 'number', defaultValue: 21.5, min: 0, max: 60, step: 0.5, unit: 'dB', helpText: 'Fibre + épissures + coupleurs + connecteurs' },
      { id: 'safetyMarginRequired', label: 'Marge de sécurité requise', type: 'number', defaultValue: 3.0, min: 1, max: 10, step: 0.5, unit: 'dB', helpText: 'Recommandé standard : 3.0 dB' },
    ],
    compute: (inputs) => {
      const tx = parseNum(inputs.txPowerDbm, 2.5);
      const rx = parseNum(inputs.rxSensitivityDbm, -28.0);
      const losses = parseNum(inputs.totalLossesDb, 21.5);
      const reqMargin = parseNum(inputs.safetyMarginRequired, 3.0);

      // Budget total disponible = Tx - Rx
      const totalBudget = tx - rx;
      // Puissance reçue estimée au récepteur = Tx - Pertes
      const receivedPower = tx - losses;
      // Marge d'exploitation restante = Puissance Reçue - Sensibilité = TotalBudget - Pertes
      const actualMargin = totalBudget - losses;

      const isWorking = actualMargin >= 0;
      const isConform = actualMargin >= reqMargin;

      return {
        primaryResult: `${actualMargin.toFixed(2)} dB de marge`,
        primaryUnit: `Puissance reçue estimée : ${receivedPower.toFixed(2)} dBm (Budget total : ${totalBudget.toFixed(2)} dB)`,
        primaryLabel: 'Marge de liaison nette calculée',
        status: isConform ? 'ok' : isWorking ? 'warning' : 'danger',
        statusMessage: !isWorking
          ? 'Liaison non opérationnelle (puissance reçue insuffisante inférieure à la sensibilité du récepteur)'
          : !isConform
            ? `Marge insuffisante (${actualMargin.toFixed(2)} dB < ${reqMargin} dB) : risque d’instabilité lors du vieillissement`
            : undefined,
        details: [
          { label: 'Budget optique disponible (Tx - Rx)', value: `${totalBudget.toFixed(2)} dB`, highlight: true },
          { label: 'Atténuation totale de liaison', value: `-${losses.toFixed(2)} dB` },
          { label: 'Puissance estimée au récepteur', value: `${receivedPower.toFixed(2)} dBm`, highlight: true },
          { label: 'Sensibilité minimale récepteur (seuil)', value: `${rx.toFixed(2)} dBm` },
          { label: 'Marge nette d’exploitation', value: `${actualMargin.toFixed(2)} dB (requis ≥ ${reqMargin} dB)`, highlight: true, badge: isConform ? 'Liaison Validée' : isWorking ? 'Marge Faible' : 'Hors Service', badgeVariant: isConform ? 'success' : isWorking ? 'warning' : 'error' },
        ],
        formulaExplanation: 'Budget (dB) = Tx (dBm) - Rx (dBm). Puissance_Reçue = Tx - Pertes. Marge = Budget - Pertes.',
      };
    },
  },

  // 2. Longueur de câble fibre
  {
    slug: 'longueur-fibre',
    tradeSlug: 'fibre-optique',
    title: 'Longueur de Câble Fibre (Tirage & Loveries)',
    shortDescription: 'Calcul de longueur réelle de câble à déployer avec chambres et lovages',
    description: 'Calculez le métrage exact de câble à prévoir en intégrant la distance de tracé, les loveries en chambre de tirage, les remontées sur appuis et les réserves de boîtiers.',
    icon: 'git-commit',
    tags: ['longueur', 'câble', 'tirage', 'loverie', 'chambre', 'PBO', 'PM', 'fourreau'],
    reliabilityLevel: 'indicative',
    standardReference: 'Guides de Déploiement FTTH Objectif Fibre & ARCEP',
    assumptions: [
      'Normes de lovage courantes : 10 m par chambre de tirage intermédiaire (L0T à L2T)',
      '8 m par remontée aéro-souterraine de poteau ou façade',
      '15 m de réserve par boîte d’épissure (PBO/BTI/PM) pour descendre la boîte dans le véhicule atelier de raccordement',
    ],
    limits: [
      'Respecter impérativement le rayon de courbure minimal du câble (généralement $20 \\times$ diamètre extérieur sous tension de tirage).',
    ],
    fields: [
      { id: 'linearDistance', label: 'Distance linéaire du tracé', type: 'number', defaultValue: 450, min: 1, step: 5, unit: 'm' },
      { id: 'manholesCount', label: 'Nombre de chambres de tirage (L0T/L1T/L2T)', type: 'number', defaultValue: 6, min: 0, step: 1 },
      { id: 'poleRisingsCount', label: 'Nombre de remontées sur poteaux / façades', type: 'number', defaultValue: 2, min: 0, step: 1 },
      { id: 'splicesEnclosures', label: 'Boîtiers d’épissure (PBO / BTI / PM)', type: 'number', defaultValue: 2, min: 0, step: 1 },
      { id: 'pullMarginPercent', label: 'Marge de tirage & coupe', type: 'number', defaultValue: 5, min: 0, max: 20, step: 1, unit: '%' },
    ],
    compute: (inputs) => {
      const dist = parseNum(inputs.linearDistance);
      const manholes = Math.max(0, parseNum(inputs.manholesCount, 0));
      const poles = Math.max(0, parseNum(inputs.poleRisingsCount, 0));
      const enclosures = Math.max(0, parseNum(inputs.splicesEnclosures, 0));
      const margin = (inputs.pullMarginPercent !== undefined && !isNaN(Number(inputs.pullMarginPercent)) ? Number(inputs.pullMarginPercent) : 5) / 100;

      if (dist <= 0) {
        return {
          primaryResult: '0 mètres',
          primaryLabel: 'Longueur totale',
          status: 'warning',
          statusMessage: 'Veuillez saisir une distance linéaire positive.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const manholeCoiling = manholes * 10;
      const poleCoiling = poles * 8;
      const enclosureCoiling = enclosures * 15;

      const subtotalMeters = dist + manholeCoiling + poleCoiling + enclosureCoiling;
      const totalMeters = Math.ceil(subtotalMeters * (1 + margin));

      return {
        primaryResult: `${totalMeters} mètres`,
        primaryUnit: `pour ${dist} m de tracé linéaire`,
        primaryLabel: 'Longueur totale de câble',
        status: 'ok',
        details: [
          { label: 'Distance linéaire génie civil / aérien', value: `${dist} m` },
          { label: `Loveries en chambres (${manholes} chambres × 10m)`, value: `+${manholeCoiling} m` },
          { label: `Remontées d’appuis (${poles} poteaux × 8m)`, value: `+${poleCoiling} m` },
          { label: `Réserves boîtiers d’épissure (${enclosures} boîtes × 15m)`, value: `+${enclosureCoiling} m` },
          { label: 'Sous-total des surlongueurs', value: `+${manholeCoiling + poleCoiling + enclosureCoiling} m`, highlight: true },
          { label: 'Total à commander (avec marge)', value: `${totalMeters} m de touret`, highlight: true, badgeVariant: 'success' },
        ],
        formulaExplanation: 'Longueur = (Tracé + Lovages chambres + Remontées + Lovages boîtiers) × (1 + Marge de tirage).',
      };
    },
  },

  // 3. Pertes optiques
  {
    slug: 'pertes-optiques',
    tradeSlug: 'fibre-optique',
    title: 'Affaiblissement Total de Liaison Optique',
    shortDescription: 'Somme des pertes fibre (dB/km), connecteurs, soudures et coupleurs PON',
    description: 'Calculez l’atténuation théorique d’une liaison optique selon la longueur d’onde (1310/1490/1550/1625 nm) et les éléments passifs.',
    icon: 'activity',
    tags: ['atténuation', 'pertes', 'longueur d’onde', '1310nm', '1550nm', 'connecteur', 'épissure', 'splitter'],
    reliabilityLevel: 'pro_validation',
    standardReference: 'Norme ITU-T G.652D (Fibre monomode standard) & ITU-T G.671',
    assumptions: [
      'Atténuation linéique standard fibre monomode G.652D :',
      '• 1310 nm : 0.35 dB/km',
      '• 1490 nm : 0.25 dB/km',
      '• 1550 nm : 0.20 dB/km',
      '• 1625 nm : 0.22 dB/km',
      'Perte par raccord / connecteur SC-APC propre : 0.35 dB max (norme CEI 61753-1)',
      'Perte moyenne par soudure fusion : 0.05 dB (0.10 dB max)',
    ],
    limits: [
      'Une perte de soudure mesurée au réflectomètre > 0.15 dB indique une fusion imparfaite à refaire.',
    ],
    fields: [
      { id: 'fiberLengthKm', label: 'Longueur optique de la fibre', type: 'number', defaultValue: 12.5, min: 0.01, step: 0.1, unit: 'km' },
      {
        id: 'wavelength',
        label: 'Longueur d’onde de transmission',
        type: 'select',
        defaultValue: '0.35',
        options: [
          { value: '0.35', label: '1310 nm — Voie montante GPON / Télécom (0.35 dB/km)' },
          { value: '0.25', label: '1490 nm — Voie descendante GPON (0.25 dB/km)' },
          { value: '0.20', label: '1550 nm — Longue distance / Vidéo RF (0.20 dB/km)' },
          { value: '0.22', label: '1625 nm — Réflectométrie OTDR active (0.22 dB/km)' },
        ],
      },
      { id: 'connectorsCount', label: 'Nombre de paires de connecteurs (SC/LC)', type: 'number', defaultValue: 4, min: 0, step: 1 },
      { id: 'splicesCount', label: 'Nombre de soudures par fusion', type: 'number', defaultValue: 6, min: 0, step: 1 },
      {
        id: 'splitterRatio',
        label: 'Coupleur / Splitter optique (PON)',
        type: 'select',
        defaultValue: '0',
        options: [
          { value: '0', label: 'Aucun coupleur (Lien point à point P2P)' },
          { value: '3.7', label: 'Splitter 1:2 (perte ≈ 3.7 dB)' },
          { value: '7.4', label: 'Splitter 1:4 (perte ≈ 7.4 dB)' },
          { value: '10.8', label: 'Splitter 1:8 (perte ≈ 10.8 dB)' },
          { value: '14.1', label: 'Splitter 1:16 (perte ≈ 14.1 dB)' },
          { value: '17.5', label: 'Splitter 1:32 (perte ≈ 17.5 dB)' },
          { value: '21.0', label: 'Splitter 1:64 (perte ≈ 21.0 dB)' },
        ],
      },
    ],
    compute: (inputs) => {
      const lengthKm = parseNum(inputs.fiberLengthKm);
      const alphaDbPerKm = parseNum(inputs.wavelength, 0.35);
      const connectors = Math.max(0, parseNum(inputs.connectorsCount, 0));
      const splices = Math.max(0, parseNum(inputs.splicesCount, 0));
      const splitterLoss = parseNum(inputs.splitterRatio, 0);

      if (lengthKm <= 0) {
        return {
          primaryResult: '0.00 dB',
          primaryLabel: 'Affaiblissement total',
          status: 'warning',
          statusMessage: 'Veuillez renseigner une longueur de fibre valide.',
          details: [{ label: 'Statut', value: 'Longueur manquante' }],
        };
      }

      const fiberLoss = lengthKm * alphaDbPerKm;
      const connectorsLoss = connectors * 0.35;
      const splicesLoss = splices * 0.05;
      const totalLoss = fiberLoss + connectorsLoss + splicesLoss + splitterLoss;

      return {
        primaryResult: `${totalLoss.toFixed(2)} dB`,
        primaryUnit: `pour ${lengthKm.toFixed(2)} km de liaison fibre optique`,
        primaryLabel: 'Affaiblissement total calculé',
        status: 'ok',
        details: [
          { label: 'Atténuation intrinsèque du verre', value: `${fiberLoss.toFixed(2)} dB (${lengthKm} km × ${alphaDbPerKm} dB/km)` },
          { label: `Pertes connecteurs (${connectors} paires × 0.35dB)`, value: `+${connectorsLoss.toFixed(2)} dB` },
          { label: `Pertes soudures fusion (${splices} × 0.05dB)`, value: `+${splicesLoss.toFixed(2)} dB` },
          ...(splitterLoss > 0 ? [{ label: 'Pertes d’insertion coupleur PON', value: `+${splitterLoss.toFixed(1)} dB` }] : []),
          { label: 'Total affaiblissement théorique', value: `${totalLoss.toFixed(2)} dB`, highlight: true, badge: `${totalLoss.toFixed(2)} dB`, badgeVariant: 'success' },
        ],
        formulaExplanation: 'Perte_Totale = (Longueur_km × Atténuation_dB/km) + (Nb_Connecteurs × 0.35) + (Nb_Soudures × 0.05) + Perte_Splitter.',
      };
    },
  },

  // 4. FO Convertisseur
  {
    slug: 'fo',
    tradeSlug: 'fibre-optique',
    title: 'Convertisseur FO Technicien (dBm / mW & Atténuation)',
    shortDescription: 'Conversion mutuelle dBm <-> mW, atténuation kilométrique dB/km et mesures OTDR',
    description: 'Convertisseur haute précision pour techniciens réflectométrie et photométrie : conversions logarithmiques dBm/mW et calcul de pente dB/km.',
    icon: 'gauge',
    tags: ['dBm', 'mW', 'convertisseur', 'photométrie', 'OTDR', 'réflectométrie', 'dB/km'],
    reliabilityLevel: 'simple',
    standardReference: 'Définitions normalisées CEI 60793 / 60794 (Unités logarithmiques et optiques)',
    assumptions: [
      '$P(\\text{dBm}) = 10 \\cdot \\log_{10}(P(\\text{mW}))$, $P(\\text{mW}) = 10^{(P(\\text{dBm})/10)}$',
      '$0\\text{ dBm} = 1.000\\text{ mW}$, $10\\text{ dBm} = 10\\text{ mW}$, $-10\\text{ dBm} = 0.1\\text{ mW}$',
    ],
    limits: [
      'Ne pas dépasser les puissances maximales d’entrée des récepteurs photométriques (généralement +10 à +26 dBm selon modèle).',
    ],
    fields: [
      { id: 'powerDbm', label: 'Puissance optique (dBm)', type: 'number', defaultValue: -15.0, min: -60, max: 30, step: 0.5, unit: 'dBm' },
      { id: 'sectionLossDb', label: 'Perte mesurée sur tronçon', type: 'number', defaultValue: 1.8, min: 0, step: 0.05, unit: 'dB' },
      { id: 'sectionLengthKm', label: 'Longueur du tronçon mesuré', type: 'number', defaultValue: 6.0, min: 0.01, step: 0.1, unit: 'km' },
    ],
    compute: (inputs) => {
      const dbm = parseNum(inputs.powerDbm, -15.0);
      const lossDb = parseNum(inputs.sectionLossDb, 0);
      const lengthKm = parseNum(inputs.sectionLengthKm, 1);

      // mW = 10^(dBm / 10)
      const mw = Math.pow(10, dbm / 10);
      const uw = mw * 1000;
      const lossPerKm = lengthKm > 0 ? lossDb / lengthKm : 0;

      return {
        primaryResult: mw >= 1 ? `${mw.toFixed(3)} mW` : `${uw.toFixed(2)} µW`,
        primaryUnit: `équivalent à ${dbm.toFixed(2)} dBm`,
        primaryLabel: 'Puissance absolue convertie',
        status: 'ok',
        details: [
          { label: 'Puissance en dBm', value: `${dbm.toFixed(2)} dBm` },
          { label: 'Puissance en milliWatts (mW)', value: `${mw.toFixed(4)} mW`, highlight: true },
          { label: 'Puissance en microWatts (µW)', value: `${uw.toFixed(2)} µW` },
          ...(lengthKm > 0 && lossDb > 0
            ? [
                {
                  label: 'Atténuation linéique du tronçon',
                  value: `${lossPerKm.toFixed(3)} dB / km`,
                  highlight: true,
                  badge: `${lossPerKm.toFixed(2)} dB/km`,
                  badgeVariant: lossPerKm <= 0.4 ? ('success' as const) : ('warning' as const),
                },
              ]
            : []),
        ],
        formulaExplanation: 'P(mW) = 10^(P_dBm / 10). Atténuation (dB/km) = Perte (dB) / Longueur (km).',
      };
    },
  },
];
