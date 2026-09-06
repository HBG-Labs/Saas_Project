import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
import { sha256Hex } from '../../../src/features/einvoicing/provider/superpdp-contract.ts';
import {
  usableSuperPdpAccessToken,
  type SuperPdpConnectionRow,
  type SuperPdpServerConfig,
} from '../_shared/superpdp-connection.ts';
import {
  COLONNES_TRANSMISSION,
  deposerTransmission,
  errorMessage,
  marquerEchec,
  reserverTransmission,
  serverConfig,
  syncEvents,
  type TransmissionRow,
} from '../_shared/superpdp-transmission.ts';

/**
 * Ordonnanceur des transmissions SUPER PDP.
 *
 * POURQUOI UNE FONCTION SEPAREE
 *
 * `superpdp-invoice` exige un JWT utilisateur, puis evalue
 * `can_transmit_invoice` SOUS L'IDENTITE DE L'APPELANT. C'est ce qui garantit
 * qu'une facture ne part que sur decision d'une personne habilitee.
 *
 * Un ordonnanceur n'a pas d'utilisateur. Lui ouvrir une branche `service_role`
 * dans cette fonction ferait cohabiter deux regimes d'autorisation dans le
 * fichier le plus sensible du domaine. Il vit donc a part et n'expose aucune
 * action utilisateur.
 *
 * CE QU'IL NE FAIT PAS : il ne depose jamais une facture de sa propre
 * initiative. Une transmission `queued` n'a pas d'echeance, donc il ne la voit
 * pas. Le premier depot reste un geste humain.
 */

const LOT_SYNCHRONISATION = 25;
const LOT_REPRISE = 10;
/** Marge sous la limite d'execution : mieux vaut finir un lot au tour suivant. */
const BUDGET_MS = 50_000;

const COLONNES_CONNEXION =
  'organization_id,provider_code,status,provider_environment,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type';

export interface WorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  /** Les tests isolent le reseau et les identifiants partenaire par ici. */
  fetch?: typeof fetch;
  superPdp?: SuperPdpServerConfig;
  now?: () => Date;
}

const json = (valeur: unknown, status = 200) =>
  new Response(JSON.stringify(valeur), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/**
 * Compare deux secrets sans fuite de temps NI de longueur.
 *
 * Les empreintes font toujours 64 caracteres : la duree de la comparaison ne
 * dit donc rien du secret attendu, pas meme sa taille.
 */
export async function secretValide(fourni: string, attendu: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(fourni), sha256Hex(attendu)]);
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

export function createWorkerHandler(config: WorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Methode non autorisee.' }, 405);

    const fourni = request.headers.get('x-worker-secret') ?? '';
    // Ferme par defaut : sans secret configure, l'ordonnanceur refuse de
    // tourner plutot que de s'ouvrir a tout le monde.
    if (!config.secret || !fourni || !(await secretValide(fourni, config.secret)))
      return json({ error: 'Acces refuse.' }, 401);

    const maintenant = config.now ?? (() => new Date());
    const debut = maintenant().getTime();
    const reste = () => maintenant().getTime() - debut < BUDGET_MS;
    const bilan = { organisations: 0, synchronisees: 0, reprises: 0, echecs: 0 };

    let partenaire: SuperPdpServerConfig;
    try {
      partenaire = config.superPdp ?? serverConfig();
    } catch (error) {
      return json({ error: errorMessage(error) }, 503);
    }

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: connexions, error: erreurConnexions } = await admin
      .from('einvoicing_provider_connections')
      .select(COLONNES_CONNEXION)
      .eq('status', 'connected');
    if (erreurConnexions) return json({ error: 'Connexions illisibles.' }, 503);

    for (const connexion of (connexions ?? []) as unknown as SuperPdpConnectionRow[]) {
      if (!reste()) break;
      bilan.organisations += 1;
      const organisation = connexion.organization_id;

      let accessToken: string;
      try {
        accessToken = await usableSuperPdpAccessToken(admin, connexion, partenaire);
      } catch (error) {
        // Une session expiree concerne UNE organisation. Les autres continuent.
        console.warn('superpdp worker: jeton indisponible', errorMessage(error).slice(0, 200));
        continue;
      }

      // File de synchronisation : etats non terminaux deja deposes, dont le
      // sort se decide chez le partenaire.
      const { data: aSynchroniser } = await admin
        .from('invoice_transmissions')
        .select(COLONNES_TRANSMISSION)
        .eq('organization_id', organisation)
        .in('status', ['submitted', 'delivered'])
        .not('provider_submission_id', 'is', null)
        // Un identifiant de depot n'existe que dans l'environnement qui l'a
        // attribue. Interroger le partenaire pour un depot fait ailleurs
        // rapporte un 404 — indefiniment, puisque rien ne le resoudra. Les
        // lignes anterieures au suivi de l'environnement gardent `null` et
        // restent traitees comme avant.
        .or(
          `provider_environment.is.null,provider_environment.eq.${connexion.provider_environment ?? 'production'}`,
        )
        .order('updated_at', { ascending: true })
        .limit(LOT_SYNCHRONISATION);

      for (const ligne of (aSynchroniser ?? []) as unknown as TransmissionRow[]) {
        if (!reste()) break;
        try {
          await syncEvents(admin, ligne, accessToken);
          bilan.synchronisees += 1;
        } catch (error) {
          // Un document recalcitrant ne prive pas les autres de leur mise a jour.
          bilan.echecs += 1;
          console.warn('superpdp worker: synchronisation', errorMessage(error).slice(0, 200));
        }
      }

      // File de reprise : uniquement les echecs TECHNIQUES dont l'echeance est
      // echue. Un refus metier est terminal, et un echec anterieur a la
      // politique n'a pas d'echeance : ni l'un ni l'autre ne repartent ici.
      const { data: aReprendre } = await admin
        .from('invoice_transmissions')
        .select(COLONNES_TRANSMISSION)
        .eq('organization_id', organisation)
        .eq('status', 'failed')
        .eq('last_error_code', 'submission_failed')
        .not('next_attempt_at', 'is', null)
        .lte('next_attempt_at', maintenant().toISOString())
        .order('next_attempt_at', { ascending: true })
        .limit(LOT_REPRISE);

      for (const ligne of (aReprendre ?? []) as unknown as TransmissionRow[]) {
        if (!reste()) break;
        const reservee = await reserverTransmission(admin, ligne, maintenant());
        // Nulle si une autre execution, ou un utilisateur, l'a prise entre-temps.
        if (!reservee) continue;
        try {
          await deposerTransmission(
            admin,
            reservee,
            reservee.invoice_id,
            accessToken,
            connexion.provider_environment,
          );
          bilan.reprises += 1;
        } catch (error) {
          await marquerEchec(admin, reservee, errorMessage(error), maintenant());
          bilan.echecs += 1;
        }
      }
    }

    // Battement de coeur. Sans lui, un ordonnanceur muet est indiscernable d'un
    // ordonnanceur qui n'a rien a faire. Son echec ne doit jamais annuler le
    // travail reellement accompli.
    try {
      const { error } = await admin.from('einvoicing_worker_runs').insert({
        ran_at: maintenant().toISOString(),
        organizations: bilan.organisations,
        synchronized: bilan.synchronisees,
        retried: bilan.reprises,
        failures: bilan.echecs,
        duration_ms: maintenant().getTime() - debut,
      });
      if (error) throw error;
    } catch (error) {
      console.warn('superpdp worker: battement de coeur', errorMessage(error).slice(0, 200));
    }

    return json({ ...bilan, dureeMs: maintenant().getTime() - debut });
  };
}
