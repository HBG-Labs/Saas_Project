/** La série et la date d’émission sont basées sur l’horloge UTC de la base. */
export function invoiceCalendarDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/** Une date de document ne change pas avec le fuseau du lecteur. */
export function formatInvoiceDate(value: string): string {
  const calendar = invoiceCalendarDate(value);
  return calendar ? calendar.split('-').reverse().join('/') : '';
}
