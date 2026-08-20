export type FlowUnit = 'lmin' | 'lh' | 'm3h' | 'm3s';

export const FLOW_UNITS: Record<FlowUnit, { name: string; symbol: string; toLitersPerMin: number }> = {
  lmin: { name: 'Litre par minute', symbol: 'L/min', toLitersPerMin: 1 },
  lh: { name: 'Litre par heure', symbol: 'L/h', toLitersPerMin: 1 / 60 },
  m3h: { name: 'Mètre cube par heure', symbol: 'm³/h', toLitersPerMin: 1000 / 60 },
  m3s: { name: 'Mètre cube par seconde', symbol: 'm³/s', toLitersPerMin: 60000 },
};

/**
 * Calcul du débit à partir d'un volume et d'un temps
 * Ex: 500 L en 30 min -> 16.67 L/min
 */
export function computeFlowFromVolumeAndTime(
  volumeLiters: number,
  timeMinutes: number,
) {
  if (timeMinutes <= 0 || isNaN(timeMinutes) || isNaN(volumeLiters)) {
    return {
      flowLmin: 0,
      formattedLmin: '0 L/min',
      flowM3h: 0,
      formattedM3h: '0 m³/h',
      conversions: [],
    };
  }

  const flowLmin = volumeLiters / timeMinutes;
  const flowM3h = (flowLmin * 60) / 1000;

  const conversions = Object.entries(FLOW_UNITS).map(([k, u]) => {
    const val = flowLmin / u.toLitersPerMin;
    return {
      unit: k as FlowUnit,
      name: u.name,
      symbol: u.symbol,
      value: val,
      formatted: formatFlowNumber(val),
    };
  });

  return {
    flowLmin,
    formattedLmin: `${formatFlowNumber(flowLmin)} L/min`,
    flowM3h,
    formattedM3h: `${formatFlowNumber(flowM3h)} m³/h`,
    conversions,
  };
}

/**
 * Calcul du temps de remplissage / vidange à partir d'un volume et d'un débit
 * Ex: 1000 L à 20 L/min -> 50 min
 */
export function computeFillingTime(
  volumeLiters: number,
  flowLmin: number,
) {
  if (flowLmin <= 0 || isNaN(flowLmin) || isNaN(volumeLiters)) {
    return {
      totalMinutes: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedTime: '0 min',
    };
  }

  const totalMinutes = volumeLiters / flowLmin;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);

  const formattedTime =
    hours > 0
      ? `${hours} h ${minutes.toString().padStart(2, '0')} min`
      : `${minutes} min ${seconds > 0 ? `${seconds} s` : ''}`.trim();

  return {
    totalMinutes,
    hours,
    minutes,
    seconds,
    formattedTime,
  };
}

function formatFlowNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(2));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
