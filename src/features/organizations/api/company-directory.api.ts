const COMPANY_DIRECTORY_ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search';

export interface FrenchCompanyCandidate {
  id: string;
  name: string;
  legalName: string;
  siret: string;
  commercialName?: string;
  city?: string;
  postalCode?: string;
}

interface DirectoryEstablishment {
  siret?: unknown;
  nom_commercial?: unknown;
  libelle_commune?: unknown;
  code_postal?: unknown;
}

interface DirectoryResult {
  siren?: unknown;
  nom_complet?: unknown;
  nom_raison_sociale?: unknown;
  siege?: DirectoryEstablishment | null;
  matching_etablissements?: DirectoryEstablishment[] | null;
}

interface DirectoryPayload {
  results?: DirectoryResult[];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Recherche publique dans l'Annuaire des entreprises de l'État.
 *
 * L'API ne demande aucun jeton : l'appel peut donc partir du navigateur sans
 * exposer de secret. Le composant appelant temporise la saisie pour respecter
 * la limite publique et annule systématiquement la requête devenue obsolète.
 */
export async function searchFrenchCompanies(
  rawQuery: string,
  signal?: AbortSignal,
): Promise<FrenchCompanyCandidate[]> {
  const query = rawQuery.trim();
  if (query === '') return [];

  const params = new URLSearchParams({
    q: query,
    page: '1',
    per_page: '6',
    minimal: 'true',
    include: 'siege,matching_etablissements',
    limite_matching_etablissements: '3',
    etat_administratif: 'A',
  });

  const response = await fetch(`${COMPANY_DIRECTORY_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Recherche d’entreprise indisponible (${response.status})`);
  }

  const payload = (await response.json()) as DirectoryPayload;
  const exactIdentifier = digits(query);
  const isExactSiret = exactIdentifier.length === 14;

  const candidates = (payload.results ?? []).flatMap((result) => {
    const matches = Array.isArray(result.matching_etablissements)
      ? result.matching_etablissements
      : [];
    const exactEstablishment = isExactSiret
      ? matches.find((item) => text(item.siret) === exactIdentifier)
      : undefined;
    const establishment = exactEstablishment ?? result.siege ?? matches[0];
    const siret = text(establishment?.siret);
    const name = text(result.nom_complet) ?? text(result.nom_raison_sociale);
    const legalName = text(result.nom_raison_sociale) ?? name;
    if (!name || !legalName || !siret) return [];

    const commercialName = text(establishment?.nom_commercial);
    const city = text(establishment?.libelle_commune);
    const postalCode = text(establishment?.code_postal);

    return [
      {
        id: siret,
        name,
        legalName,
        siret,
        ...(commercialName ? { commercialName } : {}),
        ...(city ? { city } : {}),
        ...(postalCode ? { postalCode } : {}),
      },
    ];
  });

  return candidates.filter(
    (candidate, index) => candidates.findIndex((item) => item.id === candidate.id) === index,
  );
}
