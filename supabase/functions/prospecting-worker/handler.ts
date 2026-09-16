import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import type { ProspectSourceProvider, RawProspect } from '../_shared/prospecting-provider.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

/**
 * Détection minimale — Phase 3.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAS de CRON branché sur ce worker pour l'instant (Phase 10). Il est appelé à
 * la main, avec un échantillon volontairement petit (`MAX_SAMPLE_PER_RUN`),
 * pour valider la connexion à la source et le chemin d'écriture avant toute
 * synchronisation de masse — conformément à la demande explicite de ne pas
 * lancer de récupération massive dès cette phase.
 *
 * `prospecting_sectors` est vide tant que la Phase 4 n'a pas choisi les codes
 * NAF à cibler : ce worker accepte donc un `apeCodes` explicite dans la
 * requête pour ce test, et se rabat sur les secteurs actifs en base s'il n'en
 * reçoit pas. Le score n'est jamais calculé ici (Phase 5) : `opportunity_score`
 * reste à sa valeur par défaut (0), fixée par `upsert_prospect`.
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
  createdAfter?: string;
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

    const zoneQuery = body.zoneCode
      ? admin.from('prospecting_zones').select('id, code, department_code, active').eq('code', body.zoneCode).maybeSingle()
      : admin
          .from('prospecting_zones')
          .select('id, code, department_code, active')
          .eq('active', true)
          .order('priority', { ascending: true })
          .limit(1)
          .maybeSingle();
    const { data: zone, error: zoneError } = await zoneQuery;
    if (zoneError) return json({ error: 'Zones de prospection illisibles.' }, 503);
    if (!zone || !zone.active || !zone.department_code) {
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
    const collected: RawProspect[] = [];

    try {
      for (const apeCode of apeCodes) {
        if (collected.length >= limit) break;
        const { results } = await config.provider.search({
          departmentCode: zone.department_code,
          apeCode,
          createdAfter: body.createdAfter,
          perPage: Math.min(limit - collected.length, MAX_SAMPLE_PER_RUN),
        });
        stats.fetched += results.length;
        for (const raw of results) {
          if (collected.length >= limit) break;
          collected.push(raw);
        }
      }

      const { data: sectorRows } = await admin.from('prospecting_sectors').select('id, ape_code');
      const sectorBySector = new Map((sectorRows ?? []).map((row) => [row.ape_code as string, row.id as string]));

      for (const raw of collected) {
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
              p_zone_id: zone.id,
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

      return json({ runId: run.id, zone: zone.code, apeCodes, ...stats });
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
