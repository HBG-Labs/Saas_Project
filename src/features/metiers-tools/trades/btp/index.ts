import type { MetierToolDefinition } from '../../types';

// Helper de validation sécurisée des entrées numériques
function parseNum(val: unknown, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export const btpTools: MetierToolDefinition[] = [
  // 1. Béton
  {
    slug: 'beton',
    tradeSlug: 'btp',
    title: 'Dosage & Volume de Béton',
    shortDescription: 'Calcul du volume m³, sacs de ciment (35/25kg), sable, gravier et eau',
    description: 'Calculez le volume exact de béton requis pour une dalle, terrasse ou semelle, ainsi que la quantité de ciment, sable, gravier et eau selon le dosage prescrit.',
    icon: 'boxes',
    tags: ['béton', 'dalle', 'ciment', 'dosage', 'fondation', 'sable', 'gravier', 'm³'],
    reliabilityLevel: 'indicative',
    standardReference: 'NF EN 206+A2/CN & Eurocode 2 (NF EN 1992)',
    assumptions: [
      'Béton non armé ou faiblement armé confectionné sur chantier',
      'Granulométrie standard 0/20 ou 0/16 mm',
      'Masse volumique moyenne du béton durci : 2400 kg/m³',
      'Masse d’un m³ de sable sec ≈ 1500 kg, gravier ≈ 1600 kg',
    ],
    limits: [
      'Ne remplace pas un calcul d’ingénieur béton armé pour éléments porteurs complexes ou sous-pressions',
      'Le dosage dépend de la classe d’exposition environnementale (XC1 à XF4)',
    ],
    fields: [
      { id: 'length', label: 'Longueur', type: 'number', defaultValue: 6, min: 0.1, step: 0.1, unit: 'm', helpText: 'Longueur de l’ouvrage' },
      { id: 'width', label: 'Largeur', type: 'number', defaultValue: 4, min: 0.1, step: 0.1, unit: 'm', helpText: 'Largeur de l’ouvrage' },
      { id: 'thickness', label: 'Épaisseur', type: 'number', defaultValue: 15, min: 1, max: 100, step: 1, unit: 'cm', helpText: 'Épaisseur de la dalle' },
      { id: 'margin', label: 'Marge de sécurité / pertes', type: 'number', defaultValue: 10, min: 0, max: 30, step: 1, unit: '%', helpText: 'Recommandé 5 à 10%' },
      {
        id: 'dosage',
        label: 'Dosage en ciment souhaité',
        type: 'select',
        defaultValue: '350',
        options: [
          { value: '300', label: '300 kg/m³ — Dalle piétonne, terrasse légère' },
          { value: '350', label: '350 kg/m³ — Standard dalle carrossable, fondation' },
          { value: '400', label: '400 kg/m³ — Ouvrage armé étanche, béton armé' },
        ],
      },
      {
        id: 'bagWeight',
        label: 'Conditionnement sacs de ciment',
        type: 'select',
        defaultValue: '35',
        options: [
          { value: '35', label: 'Sacs de 35 kg (Standard chantier)' },
          { value: '25', label: 'Sacs de 25 kg (Maniable)' },
        ],
      },
    ],
    compute: (inputs) => {
      const length = parseNum(inputs.length);
      const width = parseNum(inputs.width);
      const thicknessCm = parseNum(inputs.thickness);
      const marginPct = parseNum(inputs.margin);
      const dosageKg = parseNum(inputs.dosage, 350);
      const bagWeight = parseNum(inputs.bagWeight, 35);

      if (length <= 0 || width <= 0 || thicknessCm <= 0) {
        return {
          primaryResult: '0.00 m³',
          primaryLabel: 'Volume requis',
          status: 'warning',
          statusMessage: 'Veuillez saisir des dimensions strictement positives.',
          details: [{ label: 'Statut', value: 'Données dimensionnelles incomplètes' }],
        };
      }

      const thicknessM = thicknessCm / 100;
      const rawVolume = length * width * thicknessM;
      const totalVolume = rawVolume * (1 + marginPct / 100);

      const totalCementKg = totalVolume * dosageKg;
      const bagsCount = Math.ceil(totalCementKg / (bagWeight > 0 ? bagWeight : 35));

      const sandKg = totalVolume * 800;
      const sandTons = sandKg / 1000;
      const gravelKg = totalVolume * 1100;
      const gravelTons = gravelKg / 1000;
      const waterLiters = totalVolume * 175;

      return {
        primaryResult: `${totalVolume.toFixed(2)} m³`,
        primaryUnit: `pour une surface de ${(length * width).toFixed(1)} m²`,
        primaryLabel: 'Volume total de béton (avec marge)',
        status: 'ok',
        details: [
          { label: 'Surface au sol', value: `${(length * width).toFixed(2)} m²` },
          { label: 'Volume brut géométrique', value: `${rawVolume.toFixed(2)} m³` },
          { label: 'Marge appliquée', value: `+${marginPct}% (${(totalVolume - rawVolume).toFixed(2)} m³)` },
          { label: `Sacs de ciment (${bagWeight} kg)`, value: `${bagsCount} sacs (${Math.round(totalCementKg)} kg)`, highlight: true, badge: `${bagsCount} sacs`, badgeVariant: 'success' },
          { label: 'Sable 0/4 nécessaire', value: `${sandTons.toFixed(2)} tonnes (${Math.round(sandKg)} kg)` },
          { label: 'Gravier 4/20 nécessaire', value: `${gravelTons.toFixed(2)} tonnes (${Math.round(gravelKg)} kg)` },
          { label: 'Volume d’eau indicatif', value: `${Math.round(waterLiters)} Litres (E/C ≈ 0.5)` },
        ],
        formulaExplanation: 'Volume = Longueur (m) × Largeur (m) × Épaisseur (m) × (1 + Marge/100). Sacs = ceil(Volume × Dosage / Poids_Sac).',
        advice: [
          'Pour une toupie à béton, prévoyez un accès dégagé (camion 32t, passage mini 3m).',
          'Par temps chaud (> 25°C), curez le béton par humidification ou produit de cure pour éviter la fissuration.',
        ],
      };
    },
  },

  // 2. Tranchée
  {
    slug: 'tranchee',
    tradeSlug: 'btp',
    title: 'Excavation & Volume de Tranchée',
    shortDescription: 'Calcul du volume excavé en place et foisonné, nombre de camions bennes',
    description: 'Estimez le volume de terre à décaisser pour vos tranchées techniques (réseaux, canalisations, fondations) et le volume foisonné à évacuer en décharge.',
    icon: 'pickaxe',
    tags: ['tranchée', 'terrassement', 'excavation', 'foisonnement', 'évacuation', 'benne', 'm³'],
    reliabilityLevel: 'indicative',
    standardReference: 'Fascicule 70 du CCTG & Guide Technique Terrassement SETRA',
    assumptions: [
      'Section rectangulaire simplifiée de la tranchée',
      'Coefficient de foisonnement moyen selon la nature géotechnique du sol',
      'Capacité nominale d’un camion bi-benne standard : 8 m³ utiles',
    ],
    limits: [
      'Pour tranchées de profondeur > 1.30 m, blindage ou talutage obligatoire (R. 4534-24 Code du Travail)',
    ],
    fields: [
      { id: 'length', label: 'Longueur de la tranchée', type: 'number', defaultValue: 25, min: 0.5, step: 0.5, unit: 'm' },
      { id: 'width', label: 'Largeur de la tranchée', type: 'number', defaultValue: 0.6, min: 0.2, max: 5, step: 0.05, unit: 'm' },
      { id: 'depth', label: 'Profondeur moyenne', type: 'number', defaultValue: 0.9, min: 0.1, max: 10, step: 0.05, unit: 'm' },
      {
        id: 'soilType',
        label: 'Nature du terrain (Coefficient de foisonnement)',
        type: 'select',
        defaultValue: '1.25',
        options: [
          { value: '1.15', label: 'Sable / Gravier meuble (foisonnement +15%)' },
          { value: '1.25', label: 'Terre végétale / Sol ordinaire (foisonnement +25%)' },
          { value: '1.40', label: 'Argile compacte / Marne (foisonnement +40%)' },
          { value: '1.60', label: 'Roche / Enrochement concassé (foisonnement +60%)' },
        ],
      },
    ],
    compute: (inputs) => {
      const length = parseNum(inputs.length);
      const width = parseNum(inputs.width);
      const depth = parseNum(inputs.depth);
      const swellFactor = parseNum(inputs.soilType, 1.25);

      if (length <= 0 || width <= 0 || depth <= 0) {
        return {
          primaryResult: '0.00 m³',
          primaryLabel: 'Volume en place',
          status: 'warning',
          statusMessage: 'Veuillez saisir des dimensions strictement positives.',
          details: [{ label: 'Statut', value: 'Dimensions manquantes' }],
        };
      }

      const inSituVolume = length * width * depth;
      const swellVolume = inSituVolume * (swellFactor > 0 ? swellFactor : 1.25);
      const trucks8m3 = Math.ceil(swellVolume / 8);

      return {
        primaryResult: `${inSituVolume.toFixed(2)} m³`,
        primaryUnit: `volume géométrique en place (${length}m × ${width}m × ${depth}m)`,
        primaryLabel: 'Volume en place décaissé',
        status: 'ok',
        details: [
          { label: 'Surface de tranchée au sol', value: `${(length * width).toFixed(2)} m²` },
          { label: 'Volume en place (in situ)', value: `${inSituVolume.toFixed(2)} m³` },
          { label: 'Coefficient de foisonnement', value: `×${swellFactor.toFixed(2)}` },
          { label: 'Volume réel foisonné à évacuer', value: `${swellVolume.toFixed(2)} m³`, highlight: true, badge: `${swellVolume.toFixed(1)} m³ foisonnés`, badgeVariant: 'warning' },
          { label: 'Camions bennes 8 m³ à prévoir', value: `${trucks8m3} rotation${trucks8m3 > 1 ? 's' : ''}`, highlight: true },
        ],
        formulaExplanation: 'V_en_place = L × l × h. V_foisonné = V_en_place × Coeff_foisonnement. Rotations = ceil(V_foisonné / 8 m³).',
        advice: [
          'Déposez les déblais à au moins 0,60 m du bord de fouille pour éviter les éboulements.',
          'Prévoyez un grillage avertisseur normalisé à 20 cm au-dessus des gaines (Bleu: Eau, Rouge: Élec, Jaune: Gaz, Vert: Télécom).',
        ],
      };
    },
  },

  // 3. Fondations
  {
    slug: 'fondation',
    tradeSlug: 'btp',
    title: 'Fondations & Semelles Filantes',
    shortDescription: 'Cubage de semelles filantes, isolées ou radiers et estimations des armatures',
    description: 'Calculez le cubage de béton pour fondations de maisons individuelles, murs de clôture ou extensions et estimez le ferraillage associé.',
    icon: 'mountain',
    tags: ['fondation', 'semelle', 'filante', 'béton', 'ferraillage', 'radier', 'DTU 13.12'],
    reliabilityLevel: 'pro_validation',
    standardReference: 'DTU 13.12 (Règles pour le calcul des fondations superficielles) & Eurocode 2',
    assumptions: [
      'Sol réputé homogène et hors d’eau (pas de nappe phréatique affleurante)',
      'Profondeur hors-gel respectée selon le département (50 à 90 cm en France métropolitaine)',
      'Densité d’armatures standard semelle filante : ≈ 40 à 60 kg d’acier par m³ de béton',
    ],
    limits: [
      'Étude géotechnique préalable (G2 AVP/PRO selon loi ÉLAN) requise pour toute construction neuve en zone d’aléa retrait-gonflement des argiles',
    ],
    fields: [
      {
        id: 'type',
        label: 'Type de fondation',
        type: 'select',
        defaultValue: 'filante',
        options: [
          { value: 'filante', label: 'Semelle filante (mur porteur, clôture)' },
          { value: 'isolee', label: 'Semelles isolées (plots sous poteaux)' },
          { value: 'radier', label: 'Radier généralisé' },
        ],
      },
      { id: 'length', label: 'Longueur cumulée (ou dimension X)', type: 'number', defaultValue: 40, min: 0.5, step: 0.5, unit: 'm' },
      { id: 'width', label: 'Largeur (l)', type: 'number', defaultValue: 0.5, min: 0.2, step: 0.05, unit: 'm' },
      { id: 'height', label: 'Hauteur / Épaisseur (h)', type: 'number', defaultValue: 0.35, min: 0.1, step: 0.05, unit: 'm' },
      { id: 'count', label: 'Nombre d’éléments identiques (pour plots)', type: 'number', defaultValue: 1, min: 1, step: 1 },
      { id: 'margin', label: 'Marge de coulage / hors profil', type: 'number', defaultValue: 5, min: 0, max: 20, step: 1, unit: '%' },
    ],
    compute: (inputs) => {
      const type = String(inputs.type || 'filante');
      const length = parseNum(inputs.length);
      const width = parseNum(inputs.width);
      const height = parseNum(inputs.height);
      const count = Math.max(1, Math.floor(parseNum(inputs.count, 1)));
      const margin = parseNum(inputs.margin, 5) / 100;

      if (length <= 0 || width <= 0 || height <= 0) {
        return {
          primaryResult: '0.00 m³',
          primaryLabel: 'Volume de béton',
          status: 'warning',
          statusMessage: 'Veuillez renseigner des dimensions valides.',
          details: [{ label: 'Statut', value: 'Dimensions manquantes' }],
        };
      }

      const unitVolume = length * width * height;
      const totalRaw = unitVolume * count;
      const totalWithMargin = totalRaw * (1 + margin);
      const steelEstKg = totalWithMargin * 50; // ~50 kg/m³ en moyenne

      return {
        primaryResult: `${totalWithMargin.toFixed(2)} m³`,
        primaryUnit: `pour ${count > 1 ? `${count} éléments` : `${length} m linéaire`}`,
        primaryLabel: 'Volume de béton armé requis',
        status: 'ok',
        details: [
          { label: 'Type de fondation', value: type === 'filante' ? 'Semelle filante' : type === 'isolee' ? 'Plots isolés' : 'Radier' },
          { label: 'Volume géométrique brut', value: `${totalRaw.toFixed(2)} m³` },
          { label: 'Marge de coulage intégrée', value: `+${(margin * 100).toFixed(0)}%` },
          { label: 'Volume total à commander', value: `${totalWithMargin.toFixed(2)} m³`, highlight: true },
          { label: 'Armatures indicatives (fers/semelles)', value: `≈ ${Math.round(steelEstKg)} kg d’aciers FeE500` },
        ],
        formulaExplanation: 'V = Longueur × Largeur × Hauteur × Nb_Éléments × (1 + Marge). Aciers estimés à 50 kg/m³.',
        advice: [
          'Assurez un enrobage minimal des armatures d’au moins 4 à 5 cm contre terre (Eurocode 2).',
          'Vérifiez la profondeur de mise hors-gel locale avant coulage.',
        ],
      };
    },
  },

  // 4. Parpaings
  {
    slug: 'parpaings',
    tradeSlug: 'btp',
    title: 'Murs & Quantité de Parpaings',
    shortDescription: 'Calcul du nombre de blocs béton creux (20x20x50), déduction des ouvertures et mortier',
    description: 'Calculez le nombre précis de parpaings et sacs de mortier de pose pour monter un mur ou une clôture en déduisant portes et fenêtres.',
    icon: 'home',
    tags: ['parpaing', 'bloc béton', 'mur', 'maçonnerie', 'mortier', 'clôture', 'DTU 20.1'],
    reliabilityLevel: 'simple',
    standardReference: 'DTU 20.1 (Ouvrages en maçonnerie de petits éléments)',
    assumptions: [
      'Blocs béton creux standard de 20 × 20 × 50 cm (soit 10 blocs par m² de surface vue)',
      'Joints de mortier horizontaux et verticaux de 10 à 15 mm d’épaisseur',
      'Consommation moyenne de mortier : ≈ 20 kg de mortier prêt à l’emploi par m² de mur en blocs de 20',
    ],
    limits: [
      'Au-delà de 2.60 m de hauteur sans raidisseurs, étude de stabilité requise selon règles NV65/Eurocode 1',
    ],
    fields: [
      { id: 'wallLength', label: 'Longueur du mur', type: 'number', defaultValue: 15, min: 0.5, step: 0.5, unit: 'm' },
      { id: 'wallHeight', label: 'Hauteur du mur', type: 'number', defaultValue: 2.2, min: 0.2, step: 0.1, unit: 'm' },
      { id: 'openingsArea', label: 'Surface des ouvertures à déduire', type: 'number', defaultValue: 0, min: 0, step: 0.5, unit: 'm²', helpText: 'Portes, fenêtres, baies' },
      { id: 'margin', label: 'Marge pour découpes et casses', type: 'number', defaultValue: 5, min: 0, max: 20, step: 1, unit: '%' },
    ],
    compute: (inputs) => {
      const length = parseNum(inputs.wallLength);
      const height = parseNum(inputs.wallHeight);
      const openings = parseNum(inputs.openingsArea);
      const margin = parseNum(inputs.margin, 5) / 100;

      if (length <= 0 || height <= 0) {
        return {
          primaryResult: '0 parpaings',
          primaryLabel: 'Quantité de parpaings',
          status: 'warning',
          statusMessage: 'Veuillez renseigner les dimensions du mur.',
          details: [{ label: 'Statut', value: 'Longueur ou hauteur manquante' }],
        };
      }

      const rawArea = length * height;
      const netArea = Math.max(0, rawArea - openings);
      const blocksCount = Math.ceil(netArea * 10 * (1 + margin));
      const mortarBags35kg = Math.ceil((netArea * 20 * (1 + margin)) / 35);

      return {
        primaryResult: `${blocksCount} parpaings`,
        primaryUnit: `pour une surface nette de ${netArea.toFixed(2)} m²`,
        primaryLabel: 'Nombre de parpaings 20x20x50',
        status: 'ok',
        details: [
          { label: 'Surface brute du mur', value: `${rawArea.toFixed(2)} m²` },
          { label: 'Ouvertures déduites', value: `-${openings.toFixed(2)} m²` },
          { label: 'Surface nette de maçonnerie', value: `${netArea.toFixed(2)} m²` },
          { label: 'Nombre de blocs (avec marge)', value: `${blocksCount} unités`, highlight: true },
          { label: 'Sacs de mortier de montage (35 kg)', value: `${mortarBags35kg} sacs (${mortarBags35kg * 35} kg)` },
        ],
        formulaExplanation: 'Nb_Blocs = ceil((Surface_Brute - Ouvertures) × 10 blocs/m² × (1 + Marge)). Mortier = ceil(Surface_Nette × 20 kg/m² / 35).',
        advice: [
          'Prévoyez des raidisseurs verticaux (poteaux d’angle) tous les 4 mètres ou aux extrémités de panneaux.',
          'N’oubliez pas le chaînage horizontal en couronnement et au niveau des planchers.',
        ],
      };
    },
  },

  // 5. Sable
  {
    slug: 'sable',
    tradeSlug: 'btp',
    title: 'Volume & Tonnage de Sable',
    shortDescription: 'Calcul du volume en m³ et conversion en tonnage (densité 1.6 t/m³) et big bags',
    description: 'Déterminez la quantité de sable en mètres cubes et en tonnes nécessaire pour un lit de pose, remblai ou maçonnerie.',
    icon: 'layers',
    tags: ['sable', 'tonnage', 'm³', 'lit de pose', 'terrassement', 'big bag'],
    reliabilityLevel: 'simple',
    standardReference: 'NF P 18-545 (Granulats pour chaussées et maçonneries)',
    assumptions: [
      'Masse volumique apparente du sable sec standard : 1.60 tonne/m³ (1600 kg/m³)',
      'Conditionnement big bag standard : 1 tonne (environ 0.625 m³)',
    ],
    limits: [
      'Le sable humide peut gonfler en volume (foisonnement hydrique jusqu’à +20%) tout en conservant son poids sec.',
    ],
    fields: [
      { id: 'area', label: 'Surface à recouvrir', type: 'number', defaultValue: 30, min: 0.5, step: 0.5, unit: 'm²' },
      { id: 'thickness', label: 'Épaisseur du lit de sable', type: 'number', defaultValue: 5, min: 1, max: 100, step: 0.5, unit: 'cm' },
      { id: 'density', label: 'Densité du sable', type: 'number', defaultValue: 1.6, min: 1.2, max: 2.0, step: 0.05, unit: 't/m³' },
      { id: 'margin', label: 'Marge de sécurité / tassement', type: 'number', defaultValue: 5, min: 0, max: 25, step: 1, unit: '%' },
    ],
    compute: (inputs) => {
      const area = parseNum(inputs.area);
      const thicknessCm = parseNum(inputs.thickness);
      const density = parseNum(inputs.density, 1.6);
      const margin = parseNum(inputs.margin, 5) / 100;

      if (area <= 0 || thicknessCm <= 0) {
        return {
          primaryResult: '0.00 tonnes',
          primaryLabel: 'Masse de sable',
          status: 'warning',
          statusMessage: 'Veuillez saisir une surface et une épaisseur valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const volumeM3 = area * (thicknessCm / 100) * (1 + margin);
      const tonnage = volumeM3 * (density > 0 ? density : 1.6);
      const bigBagsCount = Math.ceil(tonnage);

      return {
        primaryResult: `${tonnage.toFixed(2)} tonnes`,
        primaryUnit: `soit ${volumeM3.toFixed(2)} m³ de sable`,
        primaryLabel: 'Poids total de sable à commander',
        status: 'ok',
        details: [
          { label: 'Surface couverte', value: `${area.toFixed(2)} m²` },
          { label: 'Épaisseur appliquée', value: `${thicknessCm.toFixed(1)} cm` },
          { label: 'Volume réel (avec marge)', value: `${volumeM3.toFixed(2)} m³` },
          { label: 'Poids total (tonnage)', value: `${tonnage.toFixed(2)} tonnes`, highlight: true },
          { label: 'Équivalent en Big Bags (1t)', value: `${bigBagsCount} Big Bag${bigBagsCount > 1 ? 's' : ''}` },
        ],
        formulaExplanation: 'Volume = Surface × (Épaisseur/100) × (1 + Marge). Tonnage = Volume × Densité.',
      };
    },
  },

  // 6. Gravier
  {
    slug: 'gravier',
    tradeSlug: 'btp',
    title: 'Gravier & Tout-Venant (Allées / Parkings)',
    shortDescription: 'Calcul du tonnage et des big bags selon la surface, épaisseur et granulométrie',
    description: 'Calculez le tonnage de graviers décoratifs, concassés ou tout-venant de fondation pour cours, allées et parkings carrossables.',
    icon: 'grid',
    tags: ['gravier', 'concassé', 'tout-venant', 'allée', 'parking', 'GNT', 'géotextile'],
    reliabilityLevel: 'simple',
    standardReference: 'NF EN 13242 (Granulats pour matériaux traités aux liants hydrauliques et non traités)',
    assumptions: [
      'Masse volumique moyenne : 1.50 t/m³ (gravier roulé/décoratif) ou 1.80 t/m³ (GNT tout-venant compacté)',
    ],
    limits: [
      'Pour une allée carrossable, prévoir une sous-couche GNT 0/31.5 de 15 à 20 cm compactée avant la couche de finition 4 à 5 cm.',
    ],
    fields: [
      { id: 'area', label: 'Surface de l’allée / cour', type: 'number', defaultValue: 50, min: 1, step: 1, unit: 'm²' },
      { id: 'thickness', label: 'Épaisseur de la couche', type: 'number', defaultValue: 6, min: 1, max: 50, step: 0.5, unit: 'cm' },
      {
        id: 'gravelType',
        label: 'Type de gravier & densité',
        type: 'select',
        defaultValue: '1.5',
        options: [
          { value: '1.5', label: 'Gravier décoratif / Roulé 6/14 (densité 1.5 t/m³)' },
          { value: '1.6', label: 'Gravier concassé calcaire 10/20 (densité 1.6 t/m³)' },
          { value: '1.8', label: 'Tout-venant GNT 0/31.5 compacté (densité 1.8 t/m³)' },
        ],
      },
      { id: 'margin', label: 'Marge tassement / nivellement', type: 'number', defaultValue: 5, min: 0, max: 20, step: 1, unit: '%' },
    ],
    compute: (inputs) => {
      const area = parseNum(inputs.area);
      const thicknessCm = parseNum(inputs.thickness);
      const density = parseNum(inputs.gravelType, 1.5);
      const margin = parseNum(inputs.margin, 5) / 100;

      if (area <= 0 || thicknessCm <= 0) {
        return {
          primaryResult: '0.00 tonnes',
          primaryLabel: 'Tonnage de gravier',
          status: 'warning',
          statusMessage: 'Veuillez saisir des dimensions valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const volumeM3 = area * (thicknessCm / 100) * (1 + margin);
      const tonnage = volumeM3 * density;
      const geotextileM2 = Math.ceil(area * 1.15); // +15% pour recouvrements

      return {
        primaryResult: `${tonnage.toFixed(2)} tonnes`,
        primaryUnit: `soit ${volumeM3.toFixed(2)} m³ de matériau`,
        primaryLabel: 'Poids total de gravier requis',
        status: 'ok',
        details: [
          { label: 'Surface du projet', value: `${area.toFixed(1)} m²` },
          { label: 'Épaisseur', value: `${thicknessCm} cm` },
          { label: 'Volume utile calculé', value: `${volumeM3.toFixed(2)} m³` },
          { label: 'Poids total à commander', value: `${tonnage.toFixed(2)} tonnes`, highlight: true },
          { label: 'Géotextile anti-repousse conseillé', value: `${geotextileM2} m² (avec recouvrements)` },
        ],
        formulaExplanation: 'Volume = Surface × (Épaisseur/100) × (1 + Marge). Tonnage = Volume × Densité.',
      };
    },
  },

  // 7. Pente & Dénivelé
  {
    slug: 'pente',
    tradeSlug: 'btp',
    title: 'Pente, Dénivelé & Accessibilité PMR',
    shortDescription: 'Calcul de pente en %, angle en degrés et vérification des normes PMR',
    description: 'Calculez la pente d’une rampe, allée ou toiture à partir de la distance et du dénivelé, et vérifiez la conformité d’accessibilité PMR.',
    icon: 'trending-up',
    tags: ['pente', 'pourcentage', 'angle', 'dénivelé', 'PMR', 'rampe', 'accessibilité'],
    reliabilityLevel: 'simple',
    standardReference: 'Arrêté du 20 avril 2017 relatif à l’accessibilité aux personnes handicapées',
    assumptions: [
      'Pente standard PMR : ≤ 5% sur toute longueur',
      'Tolérance PMR exceptionnelle : jusqu’à 8% sur ≤ 2.00 m, jusqu’à 10% sur ≤ 0.50 m',
      'Palier de repos horizontal (1.40 × 1.20 m) obligatoire tous les 10 mètres pour pente ≥ 4%',
    ],
    limits: [
      'Toute pente > 10% est strictement interdite pour les rampes d’accès PMR permanentes.',
    ],
    fields: [
      { id: 'horizontalDist', label: 'Distance horizontale (L)', type: 'number', defaultValue: 12, min: 0.1, step: 0.5, unit: 'm' },
      { id: 'drop', label: 'Dénivelé vertical (H)', type: 'number', defaultValue: 0.6, min: 0.01, step: 0.05, unit: 'm' },
    ],
    compute: (inputs) => {
      const dist = parseNum(inputs.horizontalDist);
      const drop = parseNum(inputs.drop);

      if (dist <= 0 || drop <= 0) {
        return {
          primaryResult: '0.00 %',
          primaryLabel: 'Pente',
          status: 'warning',
          statusMessage: 'Veuillez saisir une distance et un dénivelé positifs.',
          details: [{ label: 'Statut', value: 'Données incomplètes' }],
        };
      }

      const slopePercent = (drop / dist) * 100;
      const angleRad = Math.atan(drop / dist);
      const angleDeg = (angleRad * 180) / Math.PI;
      const rampLength = Math.sqrt(dist * dist + drop * drop);

      let pmrStatus = 'Conforme PMR standard (≤ 5%)';
      let pmrBadgeVariant: 'success' | 'warning' | 'error' = 'success';

      if (slopePercent <= 5.01) {
        pmrStatus = 'Conforme PMR standard (≤ 5% sans restriction)';
        pmrBadgeVariant = 'success';
      } else if (slopePercent <= 8.01 && dist <= 2.05) {
        pmrStatus = 'Toléré PMR (≤ 8% sur longueur max 2.0 m)';
        pmrBadgeVariant = 'warning';
      } else if (slopePercent <= 10.01 && dist <= 0.55) {
        pmrStatus = 'Toléré PMR court (≤ 10% sur longueur max 0.5 m)';
        pmrBadgeVariant = 'warning';
      } else {
        pmrStatus = 'Non conforme PMR (pente excessive > 5%)';
        pmrBadgeVariant = 'error';
      }

      return {
        primaryResult: `${slopePercent.toFixed(2)} %`,
        primaryUnit: `pour un dénivelé de ${(drop * 100).toFixed(0)} cm sur ${dist} m`,
        primaryLabel: 'Pente calculée',
        status: pmrBadgeVariant === 'error' ? 'warning' : 'ok',
        details: [
          { label: 'Pente en pourcentage', value: `${slopePercent.toFixed(2)} %`, highlight: true },
          { label: 'Angle d’inclinaison', value: `${angleDeg.toFixed(2)} °` },
          { label: 'Longueur réelle de la rampe', value: `${rampLength.toFixed(2)} m` },
          { label: 'Dénivelé par mètre linéaire', value: `${(drop / dist * 100).toFixed(1)} cm / m` },
          { label: 'Verdict accessibilité PMR', value: pmrStatus, highlight: true, badge: pmrBadgeVariant === 'success' ? 'Conforme PMR' : 'Vérification requise', badgeVariant: pmrBadgeVariant },
        ],
        formulaExplanation: 'Pente (%) = (Dénivelé / Distance) × 100. Angle (°) = arctan(Dénivelé / Distance) × (180 / π). Longueur rampe = √(L² + H²).',
      };
    },
  },

  // 8. Escalier (Loi de Blondel)
  {
    slug: 'escalier',
    tradeSlug: 'btp',
    title: 'Dimensionnement d’Escalier (Loi de Blondel)',
    shortDescription: 'Calcul du nombre de marches, hauteur, giron et conformité 2H + G',
    description: 'Vérifiez la praticabilité et le confort d’un escalier droit selon la loi de Blondel (60 à 64 cm), avec calcul du giron et du reculement.',
    icon: 'footprints',
    tags: ['escalier', 'blondel', 'marche', 'giron', 'hauteur', 'reculement', 'confort'],
    reliabilityLevel: 'indicative',
    standardReference: 'Loi de François Blondel (1675) & Norme NF P 01-012 (Garde-corps et escaliers)',
    assumptions: [
      'Escalier droit sans palier intermédiaire',
      'Pas idéal de Blondel : 2 × H + G compris strictement entre 58 et 64 cm (idéal à 63 cm)',
      'Hauteur de marche confortable pour habitation : entre 16 et 18 cm',
      'Giron confortable : entre 26 et 30 cm',
    ],
    limits: [
      'Pour escaliers tournants ou hélicoïdaux, le giron se mesure sur la ligne de foulée située à 50 cm de la rampe intérieure.',
    ],
    fields: [
      { id: 'totalHeight', label: 'Hauteur totale à franchir sol à sol', type: 'number', defaultValue: 275, min: 50, max: 1000, step: 1, unit: 'cm' },
      { id: 'targetStepHeight', label: 'Hauteur de marche souhaitée', type: 'number', defaultValue: 17.5, min: 12, max: 25, step: 0.5, unit: 'cm' },
      { id: 'treadWidth', label: 'Giron souhaité (profondeur marche)', type: 'number', defaultValue: 28, min: 18, max: 40, step: 0.5, unit: 'cm' },
    ],
    compute: (inputs) => {
      const height = parseNum(inputs.totalHeight);
      const targetStep = parseNum(inputs.targetStepHeight, 17.5);
      const tread = parseNum(inputs.treadWidth, 28);

      if (height <= 0 || targetStep <= 0 || tread <= 0) {
        return {
          primaryResult: '0 marches',
          primaryLabel: 'Nombre de marches',
          status: 'warning',
          statusMessage: 'Veuillez renseigner des hauteurs valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const stepsCount = Math.max(1, Math.round(height / targetStep));
      const exactStepHeight = height / stepsCount;
      const blondel = 2 * exactStepHeight + tread;
      const totalReculementM = ((stepsCount - 1) * tread) / 100;
      const slopeAngle = (Math.atan(exactStepHeight / tread) * 180) / Math.PI;

      const isComfortable = blondel >= 58 && blondel <= 64;

      return {
        primaryResult: `${stepsCount} marches`,
        primaryUnit: `de ${exactStepHeight.toFixed(1)} cm de hauteur`,
        primaryLabel: 'Nombre de marches recommandées',
        status: isComfortable ? 'ok' : 'warning',
        statusMessage: isComfortable ? undefined : `Pas de Blondel (${blondel.toFixed(1)} cm) hors plage idéale [58-64 cm]`,
        details: [
          { label: 'Hauteur exacte d’une marche (H)', value: `${exactStepHeight.toFixed(2)} cm`, highlight: true },
          { label: 'Giron retenu (G)', value: `${tread.toFixed(1)} cm` },
          { label: 'Loi de Blondel (2H + G)', value: `${blondel.toFixed(1)} cm`, highlight: true, badge: isComfortable ? 'Confort optimal' : 'À ajuster', badgeVariant: isComfortable ? 'success' : 'warning' },
          { label: 'Reculement total au sol', value: `${totalReculementM.toFixed(2)} m` },
          { label: 'Pente de l’escalier', value: `${slopeAngle.toFixed(1)} °` },
        ],
        formulaExplanation: 'Nb_Marches = round(Hauteur / H_Cible). H_Reelle = Hauteur / Nb_Marches. Blondel = 2 × H_Reelle + Giron. Reculement = (Nb_Marches - 1) × Giron.',
      };
    },
  },

  // 9. Toiture
  {
    slug: 'toiture',
    tradeSlug: 'btp',
    title: 'Surface Réelle de Toiture & Tuiles',
    shortDescription: 'Calcul de la surface développée avec pente et débords, quantité de tuiles',
    description: 'Calculez la surface réelle projetée d’une toiture 1 ou 2 pans en intégrant la pente et les débords de toit, ainsi que le nombre de tuiles au m².',
    icon: 'home',
    tags: ['toiture', 'surface', 'pente', 'tuile', 'couverture', 'charpente', 'DTU 40'],
    reliabilityLevel: 'indicative',
    standardReference: 'DTU Séries 40 (Couverture)',
    assumptions: [
      'Toiture symétrique 1 ou 2 versants rectangulaires',
      'Pente exprimée en pourcentage (%)',
      'Facteur multiplicateur de pente : $\\sqrt{1 + (\\text{Pente}/100)^2}$',
    ],
    limits: [
      'Pour toitures complexes (noues, arêtiers, lucarnes, tourelles), ajouter 10 à 15% de marge pour les coupes.',
    ],
    fields: [
      { id: 'groundLength', label: 'Longueur au sol du bâtiment', type: 'number', defaultValue: 10, min: 1, step: 0.5, unit: 'm' },
      { id: 'groundWidth', label: 'Largeur au sol du bâtiment', type: 'number', defaultValue: 8, min: 1, step: 0.5, unit: 'm' },
      { id: 'overhang', label: 'Débord de toiture (égout et pignon)', type: 'number', defaultValue: 0.4, min: 0, max: 2, step: 0.05, unit: 'm' },
      { id: 'slopePercent', label: 'Pente du toit', type: 'number', defaultValue: 35, min: 5, max: 150, step: 1, unit: '%' },
      { id: 'tilesPerM2', label: 'Pureau / Nb de tuiles au m²', type: 'number', defaultValue: 13, min: 5, max: 60, step: 1, unit: 'tuiles/m²' },
    ],
    compute: (inputs) => {
      const length = parseNum(inputs.groundLength);
      const width = parseNum(inputs.groundWidth);
      const overhang = parseNum(inputs.overhang, 0);
      const slope = parseNum(inputs.slopePercent, 35);
      const tilesM2 = parseNum(inputs.tilesPerM2, 13);

      if (length <= 0 || width <= 0) {
        return {
          primaryResult: '0.00 m²',
          primaryLabel: 'Surface de toiture',
          status: 'warning',
          statusMessage: 'Veuillez saisir des dimensions de bâtiment valides.',
          details: [{ label: 'Statut', value: 'Dimensions manquantes' }],
        };
      }

      const totalLength = length + 2 * overhang;
      const totalWidth = width + 2 * overhang;
      const flatArea = totalLength * totalWidth;
      const slopeFactor = Math.sqrt(1 + Math.pow(slope / 100, 2));
      const realRoofArea = flatArea * slopeFactor;
      const totalTiles = Math.ceil(realRoofArea * (tilesM2 > 0 ? tilesM2 : 13) * 1.05); // +5% casse

      return {
        primaryResult: `${realRoofArea.toFixed(2)} m²`,
        primaryUnit: `pour une emprise couverte de ${flatArea.toFixed(1)} m²`,
        primaryLabel: 'Surface développée réelle de toiture',
        status: 'ok',
        details: [
          { label: 'Surface projetée horizontale', value: `${flatArea.toFixed(2)} m²` },
          { label: 'Coefficient de développement pente', value: `×${slopeFactor.toFixed(3)}` },
          { label: 'Surface réelle de couverture', value: `${realRoofArea.toFixed(2)} m²`, highlight: true },
          { label: `Estimation tuiles (${tilesM2} u/m² + 5% casse)`, value: `${totalTiles} tuiles`, highlight: true, badge: `${totalTiles} tuiles`, badgeVariant: 'success' },
        ],
        formulaExplanation: 'Surface_Développée = (L + 2×Débord) × (l + 2×Débord) × √(1 + (Pente/100)²). Tuiles = ceil(Surface × Nb_Tuiles/m² × 1.05).',
      };
    },
  },

  // 10. Peinture
  {
    slug: 'peinture',
    tradeSlug: 'btp',
    title: 'Peinture & Revêtements Muraux',
    shortDescription: 'Calcul des litres de peinture, nombre de pots (2.5L/10L) et coût estimé',
    description: 'Estimez précisément le litrage de peinture nécessaire pour vos pièces selon le nombre de couches, le rendement du fabricant et les ouvertures.',
    icon: 'paintbrush',
    tags: ['peinture', 'murs', 'plafond', 'litres', 'rendement', 'pots', 'couches', 'finition'],
    reliabilityLevel: 'simple',
    standardReference: 'DTU 59.1 (Travaux de peinture des bâtiments)',
    assumptions: [
      'Rendement moyen d’une peinture murale acrylique standard : 10 m²/Lre par couche',
      'Application recommandée en 2 couches croisées sur support imprimé',
    ],
    limits: [
      'Sur support brut très absorbant (plâtre neuf, béton cellulaire), prévoir une sous-couche d’impression préalable.',
    ],
    fields: [
      { id: 'wallArea', label: 'Surface brute totale (murs ou plafonds)', type: 'number', defaultValue: 60, min: 1, step: 1, unit: 'm²' },
      { id: 'openings', label: 'Surface des ouvertures (portes/fenêtres)', type: 'number', defaultValue: 8, min: 0, step: 0.5, unit: 'm²' },
      { id: 'layers', label: 'Nombre de couches', type: 'number', defaultValue: 2, min: 1, max: 4, step: 1 },
      { id: 'yieldPerLiter', label: 'Rendement de la peinture', type: 'number', defaultValue: 10, min: 4, max: 20, step: 0.5, unit: 'm²/L' },
      { id: 'pricePerLiter', label: 'Prix moyen au Litre (facultatif)', type: 'number', defaultValue: 15, min: 0, step: 1, unit: '€/L' },
    ],
    compute: (inputs) => {
      const grossArea = parseNum(inputs.wallArea);
      const openings = parseNum(inputs.openings);
      const layers = Math.max(1, parseNum(inputs.layers, 2));
      const paintYield = parseNum(inputs.yieldPerLiter, 10);
      const pricePerL = parseNum(inputs.pricePerLiter, 0);

      if (grossArea <= 0) {
        return {
          primaryResult: '0.0 Litres',
          primaryLabel: 'Volume de peinture',
          status: 'warning',
          statusMessage: 'Veuillez saisir une surface brute valide.',
          details: [{ label: 'Statut', value: 'Surface manquante' }],
        };
      }

      const netArea = Math.max(0, grossArea - openings);
      const totalCoverArea = netArea * layers;
      const litersNeeded = (totalCoverArea / (paintYield > 0 ? paintYield : 10)) * 1.1; // +10% marge
      const pots10L = Math.floor(litersNeeded / 10);
      const remLiters = litersNeeded % 10;
      const pots25L = Math.ceil(remLiters / 2.5);
      const costEst = litersNeeded * pricePerL;

      return {
        primaryResult: `${litersNeeded.toFixed(1)} Litres`,
        primaryUnit: `pour ${netArea.toFixed(1)} m² en ${layers} couches`,
        primaryLabel: 'Volume de peinture requis (+10% marge)',
        status: 'ok',
        details: [
          { label: 'Surface nette à peindre', value: `${netArea.toFixed(2)} m²` },
          { label: 'Surface développée totale', value: `${totalCoverArea.toFixed(2)} m² (${layers} couches)` },
          { label: 'Litrage total nécessaire', value: `${litersNeeded.toFixed(1)} L`, highlight: true },
          { label: 'Conditionnement optimisé', value: `${pots10L > 0 ? `${pots10L} pot(s) de 10L` : ''}${pots10L > 0 && pots25L > 0 ? ' + ' : ''}${pots25L > 0 ? `${pots25L} pot(s) de 2.5L` : ''}` },
          ...(pricePerL > 0 ? [{ label: 'Budget peinture estimé', value: `${costEst.toFixed(2)} € TTC` }] : []),
        ],
        formulaExplanation: 'Litres = ((Surface_Brute - Ouvertures) × Nb_Couches / Rendement) × 1.10.',
      };
    },
  },

  // 11. Carrelage
  {
    slug: 'carrelage',
    tradeSlug: 'btp',
    title: 'Quantité de Carrelage, Colle & Joint',
    shortDescription: 'Calcul du nombre de carreaux, surface de paquets, colle et mortier joint',
    description: 'Calculez le nombre de carreaux et paquets selon les dimensions du carreau et le type de pose (droite ou diagonale), ainsi que la colle et les joints.',
    icon: 'table',
    tags: ['carrelage', 'sol', 'faïence', 'colle', 'joint', 'paquet', 'découpe', 'DTU 52.2'],
    reliabilityLevel: 'simple',
    standardReference: 'DTU 52.2 (Pose collée des revêtements céramiques et assimilés)',
    assumptions: [
      'Pose droite standard : +7% de marge pour les découpes périphériques',
      'Pose diagonale ou décalée (1/3 - 2/3) : +12 à +15% de marge pour les chutes',
      'Consommation moyenne de colle : 4.5 kg/m² en simple encollage, 6 kg/m² en double encollage',
      'Consommation moyenne de mortier joint (joint 3-4 mm) : ≈ 0.5 kg/m²',
    ],
    limits: [
      'Pour carreaux grand format (> 60×60 cm ou surface > 3600 cm²), le double encollage est obligatoire selon le DTU 52.2.',
    ],
    fields: [
      { id: 'area', label: 'Surface de la pièce à carreler', type: 'number', defaultValue: 35, min: 0.5, step: 0.5, unit: 'm²' },
      { id: 'tileLength', label: 'Longueur du carreau', type: 'number', defaultValue: 60, min: 5, max: 160, step: 1, unit: 'cm' },
      { id: 'tileWidth', label: 'Largeur du carreau', type: 'number', defaultValue: 60, min: 5, max: 160, step: 1, unit: 'cm' },
      {
        id: 'poseType',
        label: 'Type de pose & marge découpes',
        type: 'select',
        defaultValue: '7',
        options: [
          { value: '7', label: 'Pose droite standard (+7% chutes)' },
          { value: '12', label: 'Pose décalée / joints de pierre (+12% chutes)' },
          { value: '15', label: 'Pose en diagonale (+15% chutes)' },
        ],
      },
      { id: 'm2PerBox', label: 'Surface par paquet / boîte', type: 'number', defaultValue: 1.44, min: 0.2, max: 5, step: 0.01, unit: 'm²/boîte' },
    ],
    compute: (inputs) => {
      const area = parseNum(inputs.area);
      const lCm = parseNum(inputs.tileLength);
      const wCm = parseNum(inputs.tileWidth);
      const marginPct = parseNum(inputs.poseType, 7);
      const m2Box = parseNum(inputs.m2PerBox, 1.44);

      if (area <= 0 || lCm <= 0 || wCm <= 0) {
        return {
          primaryResult: '0 carreaux',
          primaryLabel: 'Quantité de carrelage',
          status: 'warning',
          statusMessage: 'Veuillez renseigner des dimensions valides.',
          details: [{ label: 'Statut', value: 'Paramètres manquants' }],
        };
      }

      const tileAreaM2 = (lCm / 100) * (wCm / 100);
      const totalAreaToOrder = area * (1 + marginPct / 100);
      const totalTiles = Math.ceil(totalAreaToOrder / (tileAreaM2 > 0 ? tileAreaM2 : 0.36));
      const boxesCount = Math.ceil(totalAreaToOrder / (m2Box > 0 ? m2Box : 1.44));

      const isLargeFormat = lCm * wCm >= 3600;
      const glueKgPerM2 = isLargeFormat ? 6 : 4.5;
      const glueBags25kg = Math.ceil((area * glueKgPerM2) / 25);
      const jointBags5kg = Math.ceil((area * 0.5) / 5);

      return {
        primaryResult: `${totalTiles} carreaux`,
        primaryUnit: `soit ${boxesCount} boîtes (${(boxesCount * m2Box).toFixed(2)} m²)`,
        primaryLabel: 'Nombre total de carreaux (avec marge)',
        status: 'ok',
        details: [
          { label: 'Surface réelle de la pièce', value: `${area.toFixed(2)} m²` },
          { label: 'Surface à commander (+ marge)', value: `${totalAreaToOrder.toFixed(2)} m²` },
          { label: 'Nombre de boîtes à acheter', value: `${boxesCount} boîtes`, highlight: true },
          { label: `Sacs de mortier-colle (${isLargeFormat ? 'Double encollage 6kg/m²' : 'Simple 4.5kg/m²'})`, value: `${glueBags25kg} sacs de 25 kg` },
          { label: 'Mortier pour joints (sacs 5kg)', value: `${jointBags5kg} sac(s) de 5 kg` },
        ],
        formulaExplanation: 'Surface_Achat = Surface × (1 + Marge/100). Nb_Carreaux = ceil(Surface_Achat / Aire_Carreau). Nb_Boites = ceil(Surface_Achat / M2_Boite).',
      };
    },
  },

  // 12. Matériaux
  {
    slug: 'materiaux',
    tradeSlug: 'btp',
    title: 'Chiffrage de Matériaux Multi-postes',
    shortDescription: 'Calculateur multi-postes avec marge de perte, TVA et totaux HT / TTC',
    description: 'Chiffrez rapidement vos fournitures et matériels sur 4 postes principaux avec application automatique des taux de TVA et marge de chantier.',
    icon: 'calculator',
    tags: ['chiffrage', 'matériaux', 'fournitures', 'devis', 'prix', 'TVA', 'HT', 'TTC'],
    reliabilityLevel: 'simple',
    standardReference: 'Code Général des Impôts (Art. 278-0 bis & 279-0 bis A pour taux de TVA applicables au bâtiment)',
    assumptions: [
      'TVA 20% : Taux normal (construction neuve, fournitures seules)',
      'TVA 10% : Taux intermédiaire (rénovation amélioration dans logement > 2 ans)',
      'TVA 5.5% : Taux réduit (travaux d’amélioration énergétique)',
    ],
    limits: [
      'Les taux réduits à 10% et 5.5% nécessitent l’attestation fiscale cerfa n°13948 signée par le client.',
    ],
    fields: [
      { id: 'qty1', label: 'Poste 1 — Quantité', type: 'number', defaultValue: 10, min: 0, step: 1 },
      { id: 'price1', label: 'Poste 1 — Prix unitaire HT (€)', type: 'number', defaultValue: 25, min: 0, step: 0.5, unit: '€' },
      { id: 'qty2', label: 'Poste 2 — Quantité', type: 'number', defaultValue: 5, min: 0, step: 1 },
      { id: 'price2', label: 'Poste 2 — Prix unitaire HT (€)', type: 'number', defaultValue: 80, min: 0, step: 1, unit: '€' },
      { id: 'qty3', label: 'Poste 3 — Quantité', type: 'number', defaultValue: 0, min: 0, step: 1 },
      { id: 'price3', label: 'Poste 3 — Prix unitaire HT (€)', type: 'number', defaultValue: 0, min: 0, step: 1, unit: '€' },
      { id: 'lossMargin', label: 'Marge de perte / imprévus chantier', type: 'number', defaultValue: 5, min: 0, max: 30, step: 1, unit: '%' },
      {
        id: 'tvaRate',
        label: 'Taux de TVA applicable',
        type: 'select',
        defaultValue: '20',
        options: [
          { value: '20', label: '20.0% — Taux normal (Neuf / Matériaux)' },
          { value: '10', label: '10.0% — Taux intermédiaire (Rénovation > 2 ans)' },
          { value: '5.5', label: '5.5% — Taux réduit (Rénovation énergétique)' },
          { value: '0', label: '0.0% — Exonéré (Autoliquidation / Export)' },
        ],
      },
    ],
    compute: (inputs) => {
      const q1 = Math.max(0, parseNum(inputs.qty1));
      const p1 = Math.max(0, parseNum(inputs.price1));
      const q2 = Math.max(0, parseNum(inputs.qty2));
      const p2 = Math.max(0, parseNum(inputs.price2));
      const q3 = Math.max(0, parseNum(inputs.qty3));
      const p3 = Math.max(0, parseNum(inputs.price3));
      const loss = Math.max(0, parseNum(inputs.lossMargin, 0)) / 100;
      const tva = Math.max(0, parseNum(inputs.tvaRate, 20)) / 100;

      const subtotalNetHT = q1 * p1 + q2 * p2 + q3 * p3;
      const totalHT = subtotalNetHT * (1 + loss);
      const tvaAmount = totalHT * tva;
      const totalTTC = totalHT + tvaAmount;

      return {
        primaryResult: `${totalTTC.toFixed(2)} € TTC`,
        primaryUnit: `soit ${totalHT.toFixed(2)} € HT (TVA ${(tva * 100).toFixed(1)}%)`,
        primaryLabel: 'Montant Total TTC estimé',
        status: 'ok',
        details: [
          { label: 'Sous-total net fournitures HT', value: `${subtotalNetHT.toFixed(2)} €` },
          { label: `Marge de pertes (+${(loss * 100).toFixed(0)}%)`, value: `+${(totalHT - subtotalNetHT).toFixed(2)} €` },
          { label: 'Total Fournitures HT', value: `${totalHT.toFixed(2)} €`, highlight: true },
          { label: `Montant TVA (${(tva * 100).toFixed(1)}%)`, value: `${tvaAmount.toFixed(2)} €` },
          { label: 'Total Général TTC', value: `${totalTTC.toFixed(2)} €`, highlight: true, badgeVariant: 'success' },
        ],
        formulaExplanation: 'Total_HT = Σ(Qté_i × Prix_i) × (1 + Marge_Perte). Total_TTC = Total_HT × (1 + Taux_TVA).',
      };
    },
  },

  // 13. Devis BTP
  {
    slug: 'devis',
    tradeSlug: 'btp',
    title: 'Générateur Rapide de Devis BTP',
    shortDescription: 'Fournitures, main d’œuvre (heures x taux), marge bénéficiaire et TVA',
    description: 'Structurez un chiffrage complet pour vos chantiers : coût des matériaux, main d’œuvre, frais de déplacement, marge de l’entreprise et calcul de la TVA.',
    icon: 'calculator',
    tags: ['devis', 'chiffrage', 'main d’oeuvre', 'marge', 'rentabilité', 'TVA', 'facturation'],
    reliabilityLevel: 'simple',
    standardReference: 'Code de la Consommation (Mentions obligatoires devis bâtiment & arrêté du 24 janvier 2017)',
    assumptions: [
      'Marge commerciale appliquée sur le coût d’achat des fournitures',
      'Taux horaire de main d’œuvre incluant salaires, charges sociales et frais généraux de l’artisan',
    ],
    limits: [
      'Ne remplace pas un logiciel comptable certifié NF 525 pour l’émission définitive de factures.',
    ],
    fields: [
      { id: 'materialsCost', label: 'Coût des fournitures / matériaux HT', type: 'number', defaultValue: 1200, min: 0, step: 50, unit: '€ HT' },
      { id: 'marginPercent', label: 'Marge commerciale sur fournitures', type: 'number', defaultValue: 20, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'laborHours', label: 'Temps de main d’œuvre estimé', type: 'number', defaultValue: 16, min: 0, step: 0.5, unit: 'heures' },
      { id: 'hourlyRate', label: 'Taux horaire de main d’œuvre', type: 'number', defaultValue: 48, min: 15, max: 200, step: 1, unit: '€ HT/h' },
      { id: 'travelCost', label: 'Frais de déplacement / transport', type: 'number', defaultValue: 80, min: 0, step: 10, unit: '€ HT' },
      {
        id: 'tvaRate',
        label: 'Taux de TVA applicable',
        type: 'select',
        defaultValue: '20',
        options: [
          { value: '20', label: '20.0% — Neuf / Fournitures seules' },
          { value: '10', label: '10.0% — Rénovation locaux d’habitation > 2 ans' },
          { value: '5.5', label: '5.5% — Travaux d’amélioration énergétique' },
        ],
      },
    ],
    compute: (inputs) => {
      const mat = Math.max(0, parseNum(inputs.materialsCost));
      const margin = Math.max(0, parseNum(inputs.marginPercent, 20)) / 100;
      const hours = Math.max(0, parseNum(inputs.laborHours));
      const rate = Math.max(0, parseNum(inputs.hourlyRate, 48));
      const travel = Math.max(0, parseNum(inputs.travelCost));
      const tva = Math.max(0, parseNum(inputs.tvaRate, 20)) / 100;

      const billedMaterials = mat * (1 + margin);
      const laborTotal = hours * rate;
      const totalHT = billedMaterials + laborTotal + travel;
      const tvaAmount = totalHT * tva;
      const totalTTC = totalHT + tvaAmount;

      return {
        primaryResult: `${totalTTC.toFixed(2)} € TTC`,
        primaryUnit: `Total HT : ${totalHT.toFixed(2)} € (TVA ${(tva * 100).toFixed(1)}% = ${tvaAmount.toFixed(2)} €)`,
        primaryLabel: 'Montant Total Devis TTC',
        status: 'ok',
        details: [
          { label: 'Fournitures facturées (avec marge)', value: `${billedMaterials.toFixed(2)} € HT (marge +${(margin * 100).toFixed(0)}%)` },
          { label: `Main d’œuvre (${hours}h × ${rate}€/h)`, value: `${laborTotal.toFixed(2)} € HT` },
          { label: 'Frais de déplacement', value: `${travel.toFixed(2)} € HT` },
          { label: 'Sous-total Devis HT', value: `${totalHT.toFixed(2)} €`, highlight: true },
          { label: `TVA (${(tva * 100).toFixed(1)}%)`, value: `${tvaAmount.toFixed(2)} €` },
          { label: 'Total TTC Devis', value: `${totalTTC.toFixed(2)} €`, highlight: true, badgeVariant: 'success' },
        ],
        formulaExplanation: 'Total_HT = (Matériaux × (1 + Marge)) + (Heures × Taux_Horaire) + Déplacement. Total_TTC = Total_HT × (1 + Taux_TVA).',
      };
    },
  },
];
