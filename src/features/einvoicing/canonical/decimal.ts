/** Arithmétique décimale exacte, identique aux arrondis NUMERIC de PostgreSQL. */
export function scaledDecimal(value: number | string, decimals: number): bigint {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Nombre positif invalide.');
  const [whole = '0', fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error('Précision décimale non prise en charge.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}
export function safeInteger(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Montant trop grand pour un export fiable.');
  return Number(value);
}
export function roundPositive(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Montant invalide.');
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
