export interface AiCustomer {
  id: string;
  name: string;
  reference: string | null;
  city: string | null;
  status: string | null;
  created_at: string | null;
}

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * La chronologie client est une donnée métier : elle ne doit jamais dépendre
 * de l'ordre implicite choisi par PostgreSQL/PostgREST.
 */
export function sortCustomersByCreation(customers: AiCustomer[]): AiCustomer[] {
  return [...customers].sort((left, right) => {
    if (left.created_at === null && right.created_at !== null) return 1;
    if (left.created_at !== null && right.created_at === null) return -1;

    const dateOrder = (left.created_at ?? '').localeCompare(right.created_at ?? '');
    return dateOrder !== 0 ? dateOrder : left.id.localeCompare(right.id);
  });
}

/** Répond sans modèle aux questions factuelles sur le premier client créé. */
export function answerFirstCustomerQuestion(query: string, customers: AiCustomer[]): string | null {
  const normalized = normalizeQuestion(query);
  const asksForFirst =
    normalized.includes('client') &&
    (/\bpremier(e)?\b/.test(normalized) || /\bplus ancien(ne)?\b/.test(normalized));

  if (!asksForFirst) return null;

  const orderedCustomers = sortCustomersByCreation(customers);
  const first = orderedCustomers[0];
  if (!first) {
    return "Aucun client n'est encore répertorié dans votre base.";
  }

  const reference = first.reference ? ` (réf. \`${first.reference}\`)` : '';
  const next = orderedCustomers[1];
  const chronology = next ? ` Il a été enregistré avant **${next.name}**.` : '';

  return `Votre premier client enregistré est **${first.name}**${reference}.${chronology}`;
}
