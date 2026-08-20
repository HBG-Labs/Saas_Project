export type PowerUnit = 'w' | 'kw' | 'mw' | 'va' | 'kva' | 'hp' | 'btuh';

export const POWER_UNITS: Record<PowerUnit, { name: string; symbol: string; toWatts: number }> = {
  w: { name: 'Watt', symbol: 'W', toWatts: 1 },
  kw: { name: 'Kilowatt', symbol: 'kW', toWatts: 1000 },
  mw: { name: 'Mégawatt', symbol: 'MW', toWatts: 1_000_000 },
  va: { name: 'Volt-Ampère', symbol: 'VA', toWatts: 1 },
  kva: { name: 'Kilovolt-Ampère', symbol: 'kVA', toWatts: 1000 },
  hp: { name: 'Cheval-Vapeur (ch/hp)', symbol: 'ch', toWatts: 735.49875 },
  btuh: { name: 'BTU par heure', symbol: 'BTU/h', toWatts: 0.293071 },
};

/**
 * Calcul des conversions de puissance
 */
export function computePowerConversions(value: number, unit: PowerUnit = 'kw') {
  if (isNaN(value)) {
    return {
      valueInWatts: 0,
      conversions: [],
    };
  }

  const valueInWatts = value * POWER_UNITS[unit].toWatts;

  const conversions = Object.entries(POWER_UNITS).map(([k, u]) => {
    const val = valueInWatts / u.toWatts;
    return {
      unit: k as PowerUnit,
      name: u.name,
      symbol: u.symbol,
      value: val,
      formatted: formatPowerNumber(val),
    };
  });

  return {
    valueInWatts,
    conversions,
  };
}

/**
 * Calcul de l'énergie consommée E = P * t
 */
export function computeEnergyConsumption(
  powerValue: number,
  powerUnit: PowerUnit = 'kw',
  durationHours: number = 1,
) {
  if (isNaN(powerValue) || isNaN(durationHours) || powerValue < 0 || durationHours < 0) {
    return {
      kwh: 0,
      formattedKwh: '0 kWh',
      wh: 0,
      formattedWh: '0 Wh',
      joules: 0,
      formattedJoules: '0 J',
    };
  }

  const watts = powerValue * POWER_UNITS[powerUnit].toWatts;
  const wh = watts * durationHours;
  const kwh = wh / 1000;
  const joules = watts * (durationHours * 3600);

  return {
    kwh,
    formattedKwh: `${formatPowerNumber(kwh)} kWh`,
    wh,
    formattedWh: `${formatPowerNumber(wh)} Wh`,
    joules,
    formattedJoules: `${formatPowerNumber(joules)} J`,
  };
}

function formatPowerNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(3));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}
