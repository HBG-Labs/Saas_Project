/** Format checks only: these do not verify registration with Sirene or VIES. */
export const normalizeBusinessIdentifier = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s/g, '').toUpperCase();

export function frenchRegistrationError(
  value: string | null | undefined,
  country: string | null | undefined,
): string | undefined {
  const identifier = normalizeBusinessIdentifier(value);
  if (country?.trim().toUpperCase() === 'FR' && identifier && !/^(\d{9}|\d{14})$/.test(identifier))
    return 'Indiquez un SIREN de 9 chiffres ou un SIRET de 14 chiffres.';
  return undefined;
}

export function frenchVatError(
  value: string | null | undefined,
  country: string | null | undefined,
): string | undefined {
  const identifier = normalizeBusinessIdentifier(value);
  if (
    country?.trim().toUpperCase() === 'FR' &&
    identifier &&
    !/^FR[A-Z0-9]{2}\d{9}$/.test(identifier)
  )
    return 'Format attendu : FR, une clé de 2 caractères et les 9 chiffres du SIREN.';
  return undefined;
}
