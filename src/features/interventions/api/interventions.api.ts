import { mapPostgrestError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { AttachmentKind, Json, TablesUpdate, TimeEntryKind } from '@/types/database';
import type {
  Intervention,
  InterventionAttachment,
  InterventionReport,
  InterventionTimeEntry,
  InterventionWithReport,
} from '@/types/domain';

/**
 * Accès aux interventions, comptes rendus et pièces jointes.
 *
 * Le workflow de contrôle (§9) est appliqué par les triggers :
 *   • `enforce_report_review_separation` — un intervenant ne valide jamais son
 *     propre compte rendu, et un CR ne se valide qu'après soumission ;
 *   • `sync_mission_from_report` — la mission suit l'état du compte rendu.
 *
 * Ces fonctions se contentent donc de déclencher les changements d'état.
 */

const BUCKET = 'intervention-attachments';

// -----------------------------------------------------------------------------
// Interventions
// -----------------------------------------------------------------------------

export async function listInterventions(missionId: string): Promise<InterventionWithReport[]> {
  return unwrap(
    supabase
      .from('interventions')
      .select('*, report:intervention_reports(*), attachments:intervention_attachments(*)')
      .eq('mission_id', missionId)
      .order('start_time', { ascending: false, nullsFirst: false })
      .returns<InterventionWithReport[]>(),
  );
}

export async function getIntervention(id: string): Promise<InterventionWithReport | null> {
  return unwrapMaybe(
    supabase
      .from('interventions')
      .select('*, report:intervention_reports(*), attachments:intervention_attachments(*)')
      .eq('id', id)
      .single()
      .returns<InterventionWithReport>(),
  );
}

/**
 * Démarre une intervention sur une mission.
 *
 * `organization_id` est omis volontairement : le trigger
 * `enforce_intervention_org` le dérive de la mission et écrase toute valeur
 * fournie. C'est ce qui rend la dénormalisation sûre — le client ne peut pas
 * rattacher son intervention à une autre entreprise.
 */
export async function startIntervention(input: {
  missionId: string;
  technicianId: string;
  latitude?: number;
  longitude?: number;
}): Promise<Intervention> {
  return unwrap(
    supabase
      .from('interventions')
      .insert({
        mission_id: input.missionId,
        technician_id: input.technicianId,
        status: 'in_progress',
        start_time: new Date().toISOString(),
        ...(input.latitude !== undefined ? { start_latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { start_longitude: input.longitude } : {}),
      })
      .select('*')
      .single(),
  );
}

/**
 * Termine l'intervention.
 *
 * `end_time` n'est plus envoyée : le trigger `enforce_intervention_scope` la
 * pose à `now()` au passage en `completed`, et ignorerait toute valeur fournie.
 * La transmettre laisserait croire qu'elle compte.
 */
export async function completeIntervention(
  interventionId: string,
  notes?: string,
): Promise<Intervention> {
  return unwrap(
    supabase
      .from('interventions')
      .update({
        status: 'completed',
        ...(notes !== undefined ? { notes } : {}),
      })
      .eq('id', interventionId)
      .select('*')
      .single(),
  );
}

// -----------------------------------------------------------------------------
// Temps d'intervention
// -----------------------------------------------------------------------------
//
// Le client déclare des ÉVÉNEMENTS, jamais des heures. Aucune de ces fonctions
// n'envoie d'horodatage : le trigger `enforce_time_entry` pose `now()` à
// l'ouverture comme à la clôture. Un relevé que l'intervenant peut antidater ne
// prouve rien — ni pour facturer, ni pour payer.

export async function listTimeEntries(interventionId: string): Promise<InterventionTimeEntry[]> {
  return unwrap(
    supabase
      .from('intervention_time_entries')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('started_at', { ascending: true }),
  );
}

/** Segment ouvert, s'il y en a un. L'index unique garantit qu'il n'y en a jamais deux. */
export async function getOpenTimeEntry(
  interventionId: string,
): Promise<InterventionTimeEntry | null> {
  return unwrapMaybe(
    supabase
      .from('intervention_time_entries')
      .select('*')
      .eq('intervention_id', interventionId)
      .is('ended_at', null)
      .maybeSingle(),
  );
}

async function openTimeEntry(
  interventionId: string,
  organizationId: string,
  kind: TimeEntryKind,
  reason?: string,
): Promise<InterventionTimeEntry> {
  return unwrap(
    supabase
      .from('intervention_time_entries')
      .insert({
        intervention_id: interventionId,
        // Écrasé par trigger depuis l'intervention ; exigé par la contrainte
        // `not null`, d'où sa présence.
        organization_id: organizationId,
        kind,
        ...(reason !== undefined ? { reason } : {}),
      })
      .select('*')
      .single(),
  );
}

async function closeTimeEntry(entryId: string): Promise<InterventionTimeEntry> {
  return unwrap(
    supabase
      .from('intervention_time_entries')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', entryId)
      .select('*')
      .single(),
  );
}

/**
 * Bascule entre travail et pause.
 *
 * Ferme le segment courant puis en ouvre un de l'autre nature. L'ordre est
 * imposé par l'index unique « un seul segment ouvert » : ouvrir avant de fermer
 * violerait la contrainte.
 *
 * Les deux écritures ne sont pas transactionnelles — PostgREST n'expose pas de
 * transaction au client. Si la seconde échoue, l'intervention se retrouve sans
 * segment ouvert : le chronomètre s'arrête, ce qui se voit et se corrige d'un
 * clic. L'ordre inverse produirait une erreur systématique.
 */
export async function switchTimeEntry(input: {
  interventionId: string;
  organizationId: string;
  openEntryId: string | null;
  to: TimeEntryKind;
  reason?: string;
}): Promise<InterventionTimeEntry> {
  if (input.openEntryId !== null) {
    await closeTimeEntry(input.openEntryId);
  }

  return input.reason === undefined
    ? openTimeEntry(input.interventionId, input.organizationId, input.to)
    : openTimeEntry(input.interventionId, input.organizationId, input.to, input.reason);
}

/** Ferme le segment en cours sans en rouvrir : la fin de l'intervention. */
export async function stopTimeTracking(openEntryId: string): Promise<InterventionTimeEntry> {
  return closeTimeEntry(openEntryId);
}

/**
 * Temps net travaillé, en secondes.
 *
 * Calculé par PostgreSQL, pas par le navigateur : c'est la même somme que celle
 * qui servira à facturer, et deux calculs séparés finiraient par diverger.
 * N'inclut que les segments CLOS — le compteur qui tourne à l'écran se déduit
 * de `started_at`, jamais stocké.
 */
export async function getWorkedSeconds(interventionId: string): Promise<number> {
  const { data, error } = await supabase.rpc('intervention_worked_seconds', {
    p_intervention_id: interventionId,
  });

  if (error) throw mapPostgrestError(error);
  return data ?? 0;
}

export async function updateIntervention(
  interventionId: string,
  patch: TablesUpdate<'interventions'>,
): Promise<Intervention> {
  return unwrap(
    supabase.from('interventions').update(patch).eq('id', interventionId).select('*').single(),
  );
}

// -----------------------------------------------------------------------------
// Comptes rendus
// -----------------------------------------------------------------------------

/** Crée le compte rendu en brouillon. Le technicien peut y revenir avant soumission. */
export async function createReport(input: {
  interventionId: string;
  workDescription?: string;
  observations?: string;
  materialsUsed?: Json;
  toolsUsed?: Json;
}): Promise<InterventionReport> {
  return unwrap(
    supabase
      .from('intervention_reports')
      .insert({
        intervention_id: input.interventionId,
        ...(input.workDescription !== undefined ? { work_description: input.workDescription } : {}),
        ...(input.observations !== undefined ? { observations: input.observations } : {}),
        ...(input.materialsUsed !== undefined ? { materials_used: input.materialsUsed } : {}),
        ...(input.toolsUsed !== undefined ? { tools_used: input.toolsUsed } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateReport(
  reportId: string,
  patch: TablesUpdate<'intervention_reports'>,
): Promise<InterventionReport> {
  return unwrap(
    supabase.from('intervention_reports').update(patch).eq('id', reportId).select('*').single(),
  );
}

/**
 * Soumet le compte rendu au contrôle.
 *
 * `submitted_at` n'est pas fourni : le trigger l'horodate. Le laisser au client
 * permettrait d'antidater une soumission, ce qui fausserait les délais
 * d'intervention — donnée souvent contractuelle.
 */
export async function submitReport(reportId: string): Promise<InterventionReport> {
  return unwrap(
    supabase
      .from('intervention_reports')
      .update({ status: 'submitted' })
      .eq('id', reportId)
      .select('*')
      .single(),
  );
}

/**
 * Valide un compte rendu.
 *
 * `reviewed_by` et `reviewed_at` sont renseignés par le trigger, qui vérifie
 * au passage que le validateur n'est pas l'intervenant. Une tentative
 * d'auto-validation échoue côté serveur avec un message explicite, quelle que
 * soit la façon dont la requête est formée.
 */
export async function approveReport(reportId: string): Promise<InterventionReport> {
  return unwrap(
    supabase
      .from('intervention_reports')
      .update({ status: 'approved' })
      .eq('id', reportId)
      .select('*')
      .single(),
  );
}

/** Refuse un compte rendu. Le motif est obligatoire — contrainte CHECK en base. */
export async function rejectReport(reportId: string, reason: string): Promise<InterventionReport> {
  return unwrap(
    supabase
      .from('intervention_reports')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', reportId)
      .select('*')
      .single(),
  );
}

/** Comptes rendus en attente de contrôle — l'écran « Contrôle » du §19. */
export async function listReportsPendingReview(
  organizationId: string,
): Promise<InterventionReport[]> {
  return unwrap(
    supabase
      .from('intervention_reports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true }),
  );
}

// -----------------------------------------------------------------------------
// Pièces jointes
// -----------------------------------------------------------------------------

/**
 * Construit le chemin de stockage.
 *
 * L'organisation DOIT être le premier segment : les policies du bucket n'ont
 * que le nom de l'objet pour décider, et c'est ce segment qu'elles lisent. Le
 * trigger `enforce_attachment_org` rejette tout enregistrement dont le chemin
 * ne respecte pas cette convention.
 */
export function buildAttachmentPath(input: {
  organizationId: string;
  missionId: string;
  interventionId: string;
  fileName: string;
}): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${input.organizationId}/${input.missionId}/${input.interventionId}/${crypto.randomUUID()}-${safeName}`;
}

/**
 * Dépose un fichier puis enregistre sa référence.
 *
 * En cas d'échec de l'enregistrement, le fichier déposé est retiré : sans ce
 * rattrapage, le bucket accumulerait des objets qu'aucune ligne ne référence,
 * invisibles et impossibles à nettoyer par la suite.
 */
export async function uploadAttachment(input: {
  organizationId: string;
  missionId: string;
  interventionId: string;
  file: File;
  kind?: AttachmentKind;
  caption?: string;
  uploadedBy: string;
}): Promise<InterventionAttachment> {
  const path = buildAttachmentPath({
    organizationId: input.organizationId,
    missionId: input.missionId,
    interventionId: input.interventionId,
    fileName: input.file.name,
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) throw uploadError;

  try {
    return await unwrap(
      supabase
        .from('intervention_attachments')
        .insert({
          intervention_id: input.interventionId,
          storage_path: path,
          file_name: input.file.name,
          mime_type: input.file.type,
          size_bytes: input.file.size,
          uploaded_by: input.uploadedBy,
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
        })
        .select('*')
        .single(),
    );
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

/**
 * URL temporaire de consultation.
 *
 * Le bucket est privé : sans signature, aucun fichier n'est accessible, même
 * avec son chemin exact. L'URL expire — une heure par défaut, largement
 * suffisant pour un affichage, trop court pour être partagée durablement.
 */
export async function getAttachmentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

export async function listAttachments(interventionId: string): Promise<InterventionAttachment[]> {
  return unwrap(
    supabase
      .from('intervention_attachments')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('created_at', { ascending: true }),
  );
}

export async function deleteAttachment(attachment: InterventionAttachment): Promise<void> {
  const { error } = await supabase
    .from('intervention_attachments')
    .delete()
    .eq('id', attachment.id);

  if (error) throw error;

  // La ligne partie, le fichier n'est plus référencé : on le retire aussi.
  await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
}
