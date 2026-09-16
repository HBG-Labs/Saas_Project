import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import type { ProspectSourceProvider, RawProspect } from '../_shared/prospecting-provider.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

/**
 * Détection minimale — Phase 3, secteurs réels et zones multiples — Phase 4.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAS de CRON branché sur ce worker pour l'instant (Phase 10). Il est appelé à
 * la main, avec un échantillon volontairement petit (`MAX_SAMPLE_PER_RUN`),
 * pour valider la connexion à la source et le chemin d'écriture avant toute
 * synchronisation de masse — conformément à la demande explicite de ne pas
 * lancer de récupération massive dès cette phase.
 *
 * `prospecting_sectors` est peuplée depuis la Phase 4 (20260919090000) : ce
 * worker se rabat dessus (secteurs actifs) si `apeCodes` n'est pas fourni
 * explicitement dans la requête — utile pour tester un code isolé sans
 * toucher à la configuration. Le score n'est jamais calculé ici (Phase 5) :
 * `opportunity_score` reste à sa valeur par défaut (0), fixée par
 * `upsert_prospect`.
 *
 * ZONES : toutes les zones ACTIVES sont traitées dans le même run (plus une
 * seule, comme en Phase 3), chacune apportant sa part au même plafond global
 * `limit` — activer une seconde zone (ex. Guadeloupe) n'échappe donc jamais
 * au plafond de sécurité, elle se contente de se partager l'échantillon.
 *
 * PRIORISATION DES ENTREPRISES RÉCENTES (objectif n°1 du cahier des charges) :
 * l'API Recherche d'Entreprises n'offre AUCUN filtre ni tri par date de
 * création (vérifié contre sa spécification OpenAPI — seul `sort_by_size`
 * existe). Un paramètre `date_creation` envoyé à cette API est silencieusement
 * ignoré : c'est ce qui s'est produit en usage réel avant d'être remarqué.
 * Le seul levier disponible est donc de demander systématiquement une page
 * pleine (25, le maximum de l'API) par zone × code NAF — jamais moins, même
 * si le plafond global restant est plus petit — puis de la trier par date de
 * création décroissante avant de ne garder que ce qu'il reste de budget. Ça
 * ne garantit pas de capter les entreprises les plus récentes parmi TOUTES
 * celles qui existent (l'API ne renvoie qu'une page à la fois, dans un ordre
 * qui lui est propre), mais ça priorise correctement ce qui EST reçu — sans
 * réclamer plus de résultats par appel que ce que l'API rend déjà.
 *
 * DÉDOUBLONNAGE : une entreprise n'a qu'une seule activité principale, donc
 * elle ne peut apparaître que sous UN SEUL code NAF ciblé au sein d'un même
 * run — aucun risque de double traitement apeCode×apeCode. Le SIREN reste la
 * clé d'identité de l'entreprise (`prospects`), le SIRET celle de
 * l'établissement retenu pour la zone (`prospect_establishments`) : jamais
 * confondus, jamais fusionnés.
 *
 * L'écriture passe exclusivement par `upsert_prospect`/`upsert_prospect_establishment`
 * (RPC SECURITY DEFINER, 20260918090000) : ce fichier ne peut PAS toucher au
 * statut commercial, à l'assignation ni au score d'un prospect existant, même
 * par erreur — la garantie est posée en base, pas seulement ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const MAX_SAMPLE_PER_RUN = 25;

export interface ProspectingWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  provider: ProspectSourceProvider;
  fetch?: typeof fetch;
  now?: () => Date;
}

interface RequestBody {
  zoneCode?: string;
  apeCodes?: string[];
  limit?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const APE_FORMAT = /^\d{2}\.\d{2}[A-Z]$/;

export function createProspectingWorkerHandler(config: ProspectingWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    let body: RequestBody;
    try {
      body = request.headers.get('content-length') === '0' ? {} : ((await request.json()) as RequestBody);
    } catch {
      return json({ error: 'Corps JSON invalide.' }, 400);
    }

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });

    interface Zone {
      id: string;
      code: string;
      department_code: string | null;
      active: boolean;
    }

    let zones: Zone[];
    if (body.zoneCode) {
      const { data: zone, error: zoneError } = await admin
        .from('prospecting_zones')
        .select('id, code, department_code, active')
        .eq('code', body.zoneCode)
        .maybeSingle();
      if (zoneError) return json({ error: 'Zones de prospection illisibles.' }, 503);
      zones = zone ? [zone as Zone] : [];
    } else {
      const { data: activeZones, error: zonesError } = await admin
        .from('prospecting_zones')
        .select('id, code, department_code, active')
        .eq('active', true)
        .order('priority', { ascending: true });
      if (zonesError) return json({ error: 'Zones de prospection illisibles.' }, 503);
      zones = (activeZones ?? []) as Zone[];
    }
    zones = zones.filter((zone) => zone.active && zone.department_code);
    if (zones.length === 0) {
      return json({ error: 'Aucune zone active correspondante (activez-la dans prospecting_zones).' }, 400);
    }

    let apeCodes = body.apeCodes ?? [];
    if (apeCodes.length === 0) {
      const { data: sectors, error: sectorsError } = await admin
        .from('prospecting_sectors')
        .select('ape_code')
        .eq('active', true);
      if (sectorsError) return json({ error: 'Secteurs de prospection illisibles.' }, 503);
      apeCodes = (sectors ?? []).map((row) => row.ape_code as string);
    }
    if (apeCodes.length === 0) {
      return json(
        { error: "Aucun secteur actif (Phase 4 non faite) : fournissez apeCodes dans le corps pour un test." },
        400,
      );
    }
    const invalidApeCode = apeCodes.find((code) => !APE_FORMAT.test(code));
    if (invalidApeCode) return json({ error: `Code NAF invalide : ${invalidApeCode}` }, 400);

    const limit = Math.min(Math.max(body.limit ?? MAX_SAMPLE_PER_RUN, 1), MAX_SAMPLE_PER_RUN);

    const clock = config.now ?? (() => new Date());
    const { data: run, error: runError } = await admin
      .from('prospecting_runs')
      .insert({ source: config.provider.name, status: 'running' })
      .select('id')
      .single();
    if (runError || !run) return json({ error: 'Impossible de créer le run de prospection.' }, 503);

    const stats = { fetched: 0, filtered: 0, created: 0, updated: 0, ignored: 0, errors: 0 };
    const errors: string[] = [];
    const candidates: Array<{ raw: RawProspect; zoneId: string }> = [];

    try {
      // Chaque zone × code NAF est interrogée une fois, page pleine (25) —
      // JAMAIS de page 2 : le coût reste borné par
      // `nombre de zones actives × nombre de secteurs actifs`, un nombre
      // petit et connu à l'avance, pas une pagination qui pourrait s'emballer.
      // Le tri par recence ne peut porter que sur ce qui a été rassemblé :
      // le limiter zone×NAF par zone×NAF (comme le faisait la première
      // version de cette Phase) revenait à ne jamais trier que la toute
      // première page non vide, puisqu'elle seule suffit déjà à remplir le
      // budget — constaté en usage réel (run `4c9ef8e5-...`, 18/09/2026).
      for (const zone of zones) {
        for (const apeCode of apeCodes) {
          const { results } = await config.provider.search({
            departmentCode: zone.department_code!,
            apeCode,
            perPage: MAX_SAMPLE_PER_RUN,
          });
          stats.fetched += results.length;
          for (const raw of results) candidates.push({ raw, zoneId: zone.id });
        }
      }

      // Priorisation des entreprises récentes (objectif n°1 du cahier des
      // charges) : l'API ne l'offre pas elle-même (voir le commentaire
      // d'en-tête) — c'est fait ici, une seule fois, sur l'ensemble rassemblé,
      // puis tronqué au budget global.
      candidates.sort((a, b) => {
        if (a.raw.createdOn === null) return 1;
        if (b.raw.createdOn === null) return -1;
        return b.raw.createdOn.localeCompare(a.raw.createdOn);
      });
      const collected = candidates.slice(0, limit);

      const { data: sectorRows } = await admin.from('prospecting_sectors').select('id, ape_code');
      const sectorBySector = new Map((sectorRows ?? []).map((row) => [row.ape_code as string, row.id as string]));

      for (const { raw, zoneId } of collected) {
        stats.filtered += 1;
        try {
          const { data: upserted, error: upsertError } = await admin
            .rpc('upsert_prospect', {
              p_siren: raw.siren,
              p_raison_sociale: raw.raisonSociale,
              p_nom_commercial: raw.nomCommercial,
              p_forme_juridique: raw.formeJuridique,
              p_ape_code: raw.apeCode,
              p_sector_id: sectorBySector.get(raw.apeCode) ?? null,
              p_created_on: raw.createdOn,
              p_statut_administratif: raw.statutAdministratif,
              p_tranche_effectif: raw.trancheEffectif,
              p_commune: raw.establishment?.commune ?? null,
              p_code_postal: raw.establishment?.codePostal ?? null,
              p_departement: raw.departement,
              p_region: raw.region,
              p_zone_id: zoneId,
            })
            .single();
          if (upsertError) throw new Error(upsertError.message);

          if ((upserted as { inserted: boolean }).inserted) stats.created += 1;
          else stats.updated += 1;

          if (raw.establishment) {
            await admin.rpc('upsert_prospect_establishment', {
              p_siret: raw.establishment.siret,
              p_siren: raw.siren,
              p_enseigne: raw.establishment.enseigne,
              p_is_headquarters: raw.establishment.isHeadquarters,
              p_adresse_line: raw.establishment.adresseLine,
              p_code_postal: raw.establishment.codePostal,
              p_commune: raw.establishment.commune,
            });
          }
        } catch (failure) {
          stats.errors += 1;
          stats.ignored += 1;
          errors.push(`${raw.siren}: ${failure instanceof Error ? failure.message : String(failure)}`);
        }
      }

      await admin
        .from('prospecting_runs')
        .update({
          status: stats.errors > 0 ? 'completed_with_errors' : 'completed',
          completed_at: clock().toISOString(),
          fetched: stats.fetched,
          filtered: stats.filtered,
          created: stats.created,
          updated: stats.updated,
          ignored: stats.ignored,
          errors: stats.errors,
          error_message: errors.length > 0 ? errors.slice(0, 20).join(' | ').slice(0, 2000) : null,
        })
        .eq('id', run.id);

      return json({ runId: run.id, zones: zones.map((zone) => zone.code), apeCodes, ...stats });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      await admin
        .from('prospecting_runs')
        .update({ status: 'failed', completed_at: clock().toISOString(), error_message: message.slice(0, 2000), ...stats })
        .eq('id', run.id);
      return json({ error: message, runId: run.id }, 502);
    }
  };
}
