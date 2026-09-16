/**
 * Abstraction de la SOURCE de détection (§ validation Phase 2, point 2) :
 * `prospecting-worker` ne connaît que `ProspectSourceProvider`. Remplacer ou
 * compléter la source plus tard (une autre API, un futur flux payant validé
 * explicitement) ne touche pas au worker — seulement à l'implémentation ici.
 *
 * V1 : `RechercheEntreprisesProvider`, sur recherche-entreprises.api.gouv.fr
 * (Sirene/RNE, public, sans clé). Ne fournit ni e-mail ni téléphone ni site —
 * c'est un choix délibéré de l'API elle-même, pas une limite de ce fichier :
 * l'enrichissement reste un chantier séparé (Phase 11), non branché.
 */

export interface RawProspectEstablishment {
  siret: string;
  isHeadquarters: boolean;
  enseigne: string | null;
  adresseLine: string | null;
  codePostal: string | null;
  commune: string | null;
}

export interface RawProspect {
  siren: string;
  raisonSociale: string;
  nomCommercial: string | null;
  formeJuridique: string | null;
  apeCode: string;
  createdOn: string | null;
  statutAdministratif: 'actif' | 'cesse';
  trancheEffectif: string | null;
  /** L'établissement retenu pour représenter la présence dans la zone ciblée. */
  establishment: RawProspectEstablishment | null;
  departement: string | null;
  region: string | null;
}

export interface ProspectSearchCriteria {
  /** Code département (ex. « 972 »). */
  departmentCode: string;
  apeCode: string;
  /** Ne retourner que les entreprises créées à partir de cette date (incluse). */
  createdAfter?: string;
  perPage: number;
  page?: number;
}

export interface ProspectSearchResult {
  results: RawProspect[];
  totalResults: number;
}

export interface ProspectSourceProvider {
  readonly name: string;
  search(criteria: ProspectSearchCriteria): Promise<ProspectSearchResult>;
}

/** « 97232 » → « 972 » (DOM/TOM) ; « 13015 » → « 13 » (métropole). */
export function departmentFromPostalCode(codePostal: string | null | undefined): string | null {
  if (!codePostal) return null;
  const digits = codePostal.trim();
  if (/^97[1-6]/.test(digits) || /^98[6-9]/.test(digits)) return digits.slice(0, 3);
  if (/^\d{5}$/.test(digits)) return digits.slice(0, 2);
  return null;
}

interface ApiEtablissement {
  siret: string;
  est_siege?: boolean;
  nom_commercial?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  departement?: string | null;
  region?: string | null;
}

interface ApiCompany {
  siren: string;
  nom_raison_sociale?: string | null;
  nom_complet?: string | null;
  activite_principale?: string | null;
  nature_juridique?: string | null;
  date_creation?: string | null;
  etat_administratif?: string | null;
  tranche_effectif_salarie?: string | null;
  siege?: ApiEtablissement | null;
  matching_etablissements?: ApiEtablissement[] | null;
}

function pickEstablishment(company: ApiCompany, departmentCode: string): ApiEtablissement | null {
  const candidates = [company.siege, ...(company.matching_etablissements ?? [])].filter(
    (candidate): candidate is ApiEtablissement => candidate != null,
  );
  const inZone = candidates.find(
    (candidate) => (candidate.departement ?? departmentFromPostalCode(candidate.code_postal)) === departmentCode,
  );
  return inZone ?? company.siege ?? candidates[0] ?? null;
}

function mapCompany(company: ApiCompany, departmentCode: string): RawProspect | null {
  const apeCode = company.activite_principale ?? null;
  const raisonSociale = company.nom_raison_sociale ?? company.nom_complet ?? null;
  if (!company.siren || !apeCode || !raisonSociale) return null;

  const chosen = pickEstablishment(company, departmentCode);
  const establishment: RawProspectEstablishment | null = chosen?.siret
    ? {
        siret: chosen.siret,
        isHeadquarters: chosen.est_siege ?? false,
        enseigne: chosen.nom_commercial ?? null,
        adresseLine: chosen.adresse ?? null,
        codePostal: chosen.code_postal ?? null,
        commune: chosen.libelle_commune ?? null,
      }
    : null;

  return {
    siren: company.siren,
    raisonSociale,
    nomCommercial: chosen?.nom_commercial ?? null,
    formeJuridique: company.nature_juridique ?? null,
    apeCode,
    createdOn: company.date_creation ?? null,
    statutAdministratif: company.etat_administratif === 'A' ? 'actif' : 'cesse',
    trancheEffectif: company.tranche_effectif_salarie ?? null,
    establishment,
    departement: chosen?.departement ?? departmentFromPostalCode(chosen?.code_postal) ?? null,
    region: chosen?.region ?? null,
  };
}

export function createRechercheEntreprisesProvider(fetchImpl: typeof fetch = fetch): ProspectSourceProvider {
  return {
    name: 'recherche_entreprises',
    async search(criteria: ProspectSearchCriteria): Promise<ProspectSearchResult> {
      const params = new URLSearchParams({
        departement: criteria.departmentCode,
        activite_principale: criteria.apeCode,
        per_page: String(criteria.perPage),
        page: String(criteria.page ?? 1),
        // Sirene/RNE uniquement, jamais un fournisseur tiers ni un score de
        // solvabilité — on ne demande que ce dont Prospect Radar a l'usage.
        minimal: 'false',
      });
      if (criteria.createdAfter) params.set('date_creation', criteria.createdAfter);

      const response = await fetchImpl(`https://recherche-entreprises.api.gouv.fr/search?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`API Recherche d'Entreprises : HTTP ${response.status}`);
      }
      const body = (await response.json()) as { results?: ApiCompany[]; total_results?: number };
      const results = (body.results ?? [])
        .map((company) => mapCompany(company, criteria.departmentCode))
        .filter((company): company is RawProspect => company !== null);

      return { results, totalResults: body.total_results ?? results.length };
    },
  };
}
