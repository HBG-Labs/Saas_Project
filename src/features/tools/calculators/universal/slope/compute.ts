export type SlopeMode = 'direct' | 'inverse_percent' | 'inverse_degrees';

export interface SlopeDirectParams {
  heightDifference: number; // Dénivelé (H)
  horizontalDistance: number; // Distance horizontale (D)
}

export interface SlopeInversePercentParams {
  slopePercent: number; // Pente en %
  horizontalDistance: number; // Distance horizontale (D)
}

export interface SlopeInverseDegreesParams {
  angleDegrees: number; // Angle en °
  horizontalDistance: number; // Distance horizontale (D)
}

export function computeSlopeDirect({
  heightDifference,
  horizontalDistance,
}: SlopeDirectParams) {
  if (horizontalDistance <= 0 || isNaN(horizontalDistance) || isNaN(heightDifference)) {
    return {
      slopePercent: 0,
      formattedSlopePercent: '0 %',
      angleDegrees: 0,
      formattedAngleDegrees: '0°',
      slopeLength: 0,
      formattedSlopeLength: '0 m',
      ratio: '1 : ∞',
      isValid: false,
    };
  }

  const slopePercent = (heightDifference / horizontalDistance) * 100;
  const angleRad = Math.atan(heightDifference / horizontalDistance);
  const angleDegrees = (angleRad * 180) / Math.PI;
  const slopeLength = Math.sqrt(
    heightDifference * heightDifference + horizontalDistance * horizontalDistance,
  );

  const ratio1OverX = heightDifference > 0 ? (horizontalDistance / heightDifference).toFixed(1) : '∞';

  return {
    slopePercent,
    formattedSlopePercent: `${formatSlopeNumber(slopePercent)} %`,
    angleDegrees,
    formattedAngleDegrees: `${formatSlopeNumber(angleDegrees)}°`,
    slopeLength,
    formattedSlopeLength: `${formatSlopeNumber(slopeLength)} m`,
    ratio: `1 : ${ratio1OverX}`,
    isValid: true,
  };
}

export function computeSlopeInversePercent({
  slopePercent,
  horizontalDistance,
}: SlopeInversePercentParams) {
  if (horizontalDistance <= 0 || isNaN(horizontalDistance) || isNaN(slopePercent)) {
    return {
      heightDifference: 0,
      formattedHeightDifference: '0 m',
      angleDegrees: 0,
      formattedAngleDegrees: '0°',
      slopeLength: 0,
      formattedSlopeLength: '0 m',
    };
  }

  const heightDifference = (slopePercent / 100) * horizontalDistance;
  const angleRad = Math.atan(slopePercent / 100);
  const angleDegrees = (angleRad * 180) / Math.PI;
  const slopeLength = Math.sqrt(
    heightDifference * heightDifference + horizontalDistance * horizontalDistance,
  );

  return {
    heightDifference,
    formattedHeightDifference: `${formatSlopeNumber(heightDifference)} m`,
    angleDegrees,
    formattedAngleDegrees: `${formatSlopeNumber(angleDegrees)}°`,
    slopeLength,
    formattedSlopeLength: `${formatSlopeNumber(slopeLength)} m`,
  };
}

export function computeSlopeInverseDegrees({
  angleDegrees,
  horizontalDistance,
}: SlopeInverseDegreesParams) {
  if (horizontalDistance <= 0 || isNaN(horizontalDistance) || isNaN(angleDegrees)) {
    return {
      heightDifference: 0,
      formattedHeightDifference: '0 m',
      slopePercent: 0,
      formattedSlopePercent: '0 %',
      slopeLength: 0,
      formattedSlopeLength: '0 m',
    };
  }

  const angleRad = (angleDegrees * Math.PI) / 180;
  const heightDifference = Math.tan(angleRad) * horizontalDistance;
  const slopePercent = Math.tan(angleRad) * 100;
  const slopeLength = horizontalDistance / Math.cos(angleRad);

  return {
    heightDifference,
    formattedHeightDifference: `${formatSlopeNumber(heightDifference)} m`,
    slopePercent,
    formattedSlopePercent: `${formatSlopeNumber(slopePercent)} %`,
    slopeLength,
    formattedSlopeLength: `${formatSlopeNumber(slopeLength)} m`,
  };
}

function formatSlopeNumber(val: number): string {
  if (val === 0) return '0';
  const rounded = Number(val.toFixed(2));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
