export type UnitCategory =
  | 'length'
  | 'area'
  | 'volume'
  | 'weight'
  | 'temperature'
  | 'pressure'
  | 'speed'
  | 'flow'
  | 'energy'
  | 'power';

export interface UnitOption {
  id: string;
  name: string;
  symbol: string;
  toBase: (val: number) => number;
  fromBase: (baseVal: number) => number;
}

export const UNIT_CATEGORIES: Record<
  UnitCategory,
  { label: string; icon: string; units: Record<string, UnitOption> }
> = {
  length: {
    label: 'Longueur',
    icon: 'Ruler',
    units: {
      mm: { id: 'mm', name: 'Millimètre', symbol: 'mm', toBase: (v) => v / 1000, fromBase: (b) => b * 1000 },
      cm: { id: 'cm', name: 'Centimètre', symbol: 'cm', toBase: (v) => v / 100, fromBase: (b) => b * 100 },
      m: { id: 'm', name: 'Mètre', symbol: 'm', toBase: (v) => v, fromBase: (b) => b },
      km: { id: 'km', name: 'Kilomètre', symbol: 'km', toBase: (v) => v * 1000, fromBase: (b) => b / 1000 },
      in: { id: 'in', name: 'Pouce (inch)', symbol: 'in', toBase: (v) => v * 0.0254, fromBase: (b) => b / 0.0254 },
      ft: { id: 'ft', name: 'Pied (foot)', symbol: 'ft', toBase: (v) => v * 0.3048, fromBase: (b) => b / 0.3048 },
    },
  },
  area: {
    label: 'Surface',
    icon: 'Square',
    units: {
      mm2: { id: 'mm2', name: 'Millimètre carré', symbol: 'mm²', toBase: (v) => v / 1_000_000, fromBase: (b) => b * 1_000_000 },
      cm2: { id: 'cm2', name: 'Centimètre carré', symbol: 'cm²', toBase: (v) => v / 10_000, fromBase: (b) => b * 10_000 },
      m2: { id: 'm2', name: 'Mètre carré', symbol: 'm²', toBase: (v) => v, fromBase: (b) => b },
      ha: { id: 'ha', name: 'Hectare', symbol: 'ha', toBase: (v) => v * 10_000, fromBase: (b) => b / 10_000 },
      km2: { id: 'km2', name: 'Kilomètre carré', symbol: 'km²', toBase: (v) => v * 1_000_000, fromBase: (b) => b / 1_000_000 },
    },
  },
  volume: {
    label: 'Volume & Capacité',
    icon: 'Box',
    units: {
      ml: { id: 'ml', name: 'Millilitre', symbol: 'mL', toBase: (v) => v / 1000, fromBase: (b) => b * 1000 },
      l: { id: 'l', name: 'Litre', symbol: 'L', toBase: (v) => v, fromBase: (b) => b },
      cm3: { id: 'cm3', name: 'Centimètre cube', symbol: 'cm³', toBase: (v) => v / 1000, fromBase: (b) => b * 1000 },
      m3: { id: 'm3', name: 'Mètre cube', symbol: 'm³', toBase: (v) => v * 1000, fromBase: (b) => b / 1000 },
    },
  },
  weight: {
    label: 'Poids & Masse',
    icon: 'Scale',
    units: {
      g: { id: 'g', name: 'Gramme', symbol: 'g', toBase: (v) => v / 1000, fromBase: (b) => b * 1000 },
      kg: { id: 'kg', name: 'Kilogramme', symbol: 'kg', toBase: (v) => v, fromBase: (b) => b },
      t: { id: 't', name: 'Tonne', symbol: 't', toBase: (v) => v * 1000, fromBase: (b) => b / 1000 },
      lb: { id: 'lb', name: 'Livre (pound)', symbol: 'lb', toBase: (v) => v * 0.45359237, fromBase: (b) => b / 0.45359237 },
    },
  },
  temperature: {
    label: 'Température',
    icon: 'Thermometer',
    units: {
      c: { id: 'c', name: 'Celsius', symbol: '°C', toBase: (v) => v, fromBase: (b) => b },
      f: { id: 'f', name: 'Fahrenheit', symbol: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (b) => (b * 9) / 5 + 32 },
      k: { id: 'k', name: 'Kelvin', symbol: 'K', toBase: (v) => v - 273.15, fromBase: (b) => b + 273.15 },
    },
  },
  pressure: {
    label: 'Pression',
    icon: 'Gauge',
    units: {
      pa: { id: 'pa', name: 'Pascal', symbol: 'Pa', toBase: (v) => v, fromBase: (b) => b },
      kpa: { id: 'kpa', name: 'Kilopascal', symbol: 'kPa', toBase: (v) => v * 1000, fromBase: (b) => b / 1000 },
      bar: { id: 'bar', name: 'Bar', symbol: 'bar', toBase: (v) => v * 100_000, fromBase: (b) => b / 100_000 },
      mbar: { id: 'mbar', name: 'Millibar', symbol: 'mbar', toBase: (v) => v * 100, fromBase: (b) => b / 100 },
      psi: { id: 'psi', name: 'PSI (Pounds/sq in)', symbol: 'PSI', toBase: (v) => v * 6894.757, fromBase: (b) => b / 6894.757 },
    },
  },
  speed: {
    label: 'Vitesse',
    icon: 'Gauge',
    units: {
      ms: { id: 'ms', name: 'Mètre par seconde', symbol: 'm/s', toBase: (v) => v, fromBase: (b) => b },
      kmh: { id: 'kmh', name: 'Kilomètre par heure', symbol: 'km/h', toBase: (v) => v / 3.6, fromBase: (b) => b * 3.6 },
      mph: { id: 'mph', name: 'Miles par heure', symbol: 'mph', toBase: (v) => v * 0.44704, fromBase: (b) => b / 0.44704 },
    },
  },
  flow: {
    label: 'Débit',
    icon: 'Droplets',
    units: {
      lmin: { id: 'lmin', name: 'Litre par minute', symbol: 'L/min', toBase: (v) => v, fromBase: (b) => b },
      lh: { id: 'lh', name: 'Litre par heure', symbol: 'L/h', toBase: (v) => v / 60, fromBase: (b) => b * 60 },
      m3h: { id: 'm3h', name: 'Mètre cube par heure', symbol: 'm³/h', toBase: (v) => (v * 1000) / 60, fromBase: (b) => (b * 60) / 1000 },
    },
  },
  energy: {
    label: 'Énergie',
    icon: 'Zap',
    units: {
      j: { id: 'j', name: 'Joule', symbol: 'J', toBase: (v) => v, fromBase: (b) => b },
      wh: { id: 'wh', name: 'Watt-heure', symbol: 'Wh', toBase: (v) => v * 3600, fromBase: (b) => b / 3600 },
      kwh: { id: 'kwh', name: 'Kilowatt-heure', symbol: 'kWh', toBase: (v) => v * 3_600_000, fromBase: (b) => b / 3_600_000 },
    },
  },
  power: {
    label: 'Puissance',
    icon: 'Activity',
    units: {
      w: { id: 'w', name: 'Watt', symbol: 'W', toBase: (v) => v, fromBase: (b) => b },
      kw: { id: 'kw', name: 'Kilowatt', symbol: 'kW', toBase: (v) => v * 1000, fromBase: (b) => b / 1000 },
      mw: { id: 'mw', name: 'Mégawatt', symbol: 'MW', toBase: (v) => v * 1_000_000, fromBase: (b) => b / 1_000_000 },
      va: { id: 'va', name: 'Volt-Ampère', symbol: 'VA', toBase: (v) => v, fromBase: (b) => b },
      kva: { id: 'kva', name: 'Kilovolt-Ampère', symbol: 'kVA', toBase: (v) => v * 1000, fromBase: (b) => b / 1000 },
    },
  },
};

/**
 * Fonction pure de conversion universelle
 */
export function convertUnit({
  category,
  value,
  fromUnitId,
  toUnitId,
}: {
  category: UnitCategory;
  value: number;
  fromUnitId: string;
  toUnitId: string;
}): {
  result: number;
  formattedResult: string;
  fromSymbol: string;
  toSymbol: string;
  allConversions: { unitId: string; symbol: string; name: string; value: number; formatted: string }[];
} {
  const cat = UNIT_CATEGORIES[category];
  if (!cat) {
    throw new Error(`Catégorie inconnue : ${category}`);
  }

  const fromUnit = cat.units[fromUnitId];
  const toUnit = cat.units[toUnitId];

  if (!fromUnit || !toUnit) {
    throw new Error(`Unités invalides : ${fromUnitId} -> ${toUnitId}`);
  }

  if (isNaN(value)) {
    return {
      result: 0,
      formattedResult: '0',
      fromSymbol: fromUnit.symbol,
      toSymbol: toUnit.symbol,
      allConversions: [],
    };
  }

  // 1. Convertir vers l'unité de base
  const baseValue = fromUnit.toBase(value);

  // 2. Convertir de la base vers l'unité cible
  const result = toUnit.fromBase(baseValue);

  // 3. Calculer toutes les conversions disponibles dans la catégorie
  const allConversions = Object.values(cat.units).map((u) => {
    const val = u.fromBase(baseValue);
    return {
      unitId: u.id,
      symbol: u.symbol,
      name: u.name,
      value: val,
      formatted: formatSmartNumber(val),
    };
  });

  return {
    result,
    formattedResult: formatSmartNumber(result),
    fromSymbol: fromUnit.symbol,
    toSymbol: toUnit.symbol,
    allConversions,
  };
}

export function formatSmartNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.0001 && Math.abs(val) > 0)) {
    return val.toExponential(4).replace('.', ',');
  }
  // Arrondi intelligent jusqu'à 6 décimales significatives
  const rounded = Number(val.toFixed(6));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
}
