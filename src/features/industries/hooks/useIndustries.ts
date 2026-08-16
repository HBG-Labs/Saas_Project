import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  DEFAULT_INDUSTRY,
  DEFAULT_VOCABULARY,
  isIndustryCode,
  pluralize,
  type IndustryCode,
  type IndustryVocabulary,
} from '@/config/industries';
import { useCurrentOrganization } from '@/features/organizations';
import { qk } from '@/lib/query-keys';

import {
  listEquipmentCategories,
  listIndustries,
  listInterventionTypes,
  type Industry,
} from '../api/industries.api';

/**
 * Le référentiel complet, pour les écrans qui font choisir un métier.
 *
 * `staleTime` très long : cette liste change à peine plus souvent que le code
 * lui-même — elle n'évolue que par migration. La rafraîchir à chaque montage
 * serait une requête pour rien.
 */
export function useIndustries() {
  return useQuery({
    queryKey: qk.industries.all,
    queryFn: listIndustries,
    staleTime: 60 * 60_000,
  });
}

export interface CurrentIndustry {
  /** Toujours défini : `general` quand l'organisation n'en déclare aucun. */
  code: IndustryCode;
  label: string;
  icon: string;
  vocabulary: IndustryVocabulary;
  /**
   * Clés brutes du `vocabulary` en base, au-delà des trois termes typés.
   *
   * Sert aujourd'hui aux pluriels irréguliers (`job_plural`), et évite d'avoir
   * à migrer le schéma le jour où un métier en apportera un.
   */
  overrides: Record<string, string>;
  /** `false` tant que le référentiel n'est pas chargé, ou hors organisation. */
  isResolved: boolean;
}

/**
 * Le métier de l'organisation courante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE HOOK NE RENVOIE JAMAIS `null`
 *
 * Chaque appelant devrait sinon décider quoi faire en l'absence de métier, et
 * ils décideraient différemment : l'un masquerait tout, l'autre afficherait
 * tout. `general` est un métier à part entière — le cœur sans spécialisation —
 * et le traiter comme tel supprime une branche conditionnelle partout.
 *
 * `isResolved` reste disponible pour le seul cas qui le justifie : éviter un
 * clignotement pendant le chargement du référentiel.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useCurrentIndustry(): CurrentIndustry {
  const { organization } = useCurrentOrganization();
  const industries = useIndustries();

  return useMemo(() => {
    const code = isIndustryCode(organization?.industry) ? organization.industry : DEFAULT_INDUSTRY;
    const match: Industry | undefined = industries.data?.find((item) => item.code === code);

    if (match === undefined) {
      return {
        code,
        // Le code sert de libellé de repli plutôt qu'une chaîne vide : voir
        // « general » à l'écran informe mieux qu'un espace, et signale un
        // référentiel non chargé au lieu de le masquer.
        label: code,
        icon: 'briefcase',
        vocabulary: DEFAULT_VOCABULARY,
        overrides: {},
        isResolved: false,
      };
    }

    return {
      code: match.code,
      label: match.label,
      icon: match.icon,
      vocabulary: match.vocabulary,
      overrides: match.overrides,
      isResolved: true,
    };
  }, [organization, industries.data]);
}

/**
 * Un mot du vocabulaire métier.
 *
 * `useLabel('job')` rend « Mission » chez un fibreur et « Chantier » chez un
 * paysagiste. Passer par ce hook plutôt que par un texte en dur dès la première
 * étiquette variable : sans cette discipline, le vocabulaire se disséminera
 * dans les 335 fichiers du projet, et le jour où une bibliothèque
 * d'internationalisation entrera, il n'y aura plus rien de centralisé à lui
 * confier.
 */
export function useLabel(key: keyof IndustryVocabulary, plural = false): string {
  const { vocabulary, overrides } = useCurrentIndustry();
  const singular = vocabulary[key];

  return plural ? pluralize(singular, overrides[`${key}_plural`]) : singular;
}

/**
 * Types d'intervention du métier courant.
 *
 * La clé de cache porte le métier, pas l'organisation : deux entreprises du
 * même corps de métier partagent exactement la même liste, et la dupliquer en
 * cache n'apporterait rien.
 */
export function useInterventionTypes() {
  const { code, isResolved } = useCurrentIndustry();

  return useQuery({
    queryKey: [...qk.industries.all, 'intervention-types', code],
    queryFn: () => listInterventionTypes(code),
    enabled: isResolved,
    staleTime: 60 * 60_000,
  });
}

/**
 * Catégories de matériel du métier courant, communes comprises.
 *
 * Même mise en cache que les types : ce référentiel n'évolue que par migration.
 */
export function useEquipmentCategories() {
  const { code, isResolved } = useCurrentIndustry();

  return useQuery({
    queryKey: [...qk.industries.all, 'equipment-categories', code],
    queryFn: () => listEquipmentCategories(code),
    enabled: isResolved,
    staleTime: 60 * 60_000,
  });
}
