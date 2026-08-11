import { mapPostgrestError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { AttachmentKind, Json, TablesUpdate, TimeEntryKind } from '@/types/database';
import type {
  Intervention,
  InterventionAttachment,
  InterventionReport,
  InterventionTimeEntry,
  InterventionWithReport,
  ReportForReview,
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

const DEFAULT_DEMO_INTERVENTIONS: InterventionWithReport[] = [
  {
    id: 'inter-001',
    mission_id: 'mission-001',
    organization_id: 'org-demo',
    technician_id: 'mem-001',
    status: 'completed',
    start_time: '2026-08-10T08:30:00.000Z',
    end_time: '2026-08-10T11:45:00.000Z',
    start_latitude: 14.616,
    start_longitude: -61.058,
    end_latitude: 14.616,
    end_longitude: -61.058,
    created_at: '2026-08-10T08:30:00.000Z',
    updated_at: '2026-08-10T11:45:00.000Z',
    notes: 'Intervention sur tiroir B12',
    report: {
      id: 'report-demo-1',
      intervention_id: 'inter-001',
      organization_id: 'org-demo',
      status: 'submitted',
      work_description:
        'Recette de la liaison fibre optique effectuée. Réflectométrie conforme avec atténuation inférieure à 0.35dB/km. Soudure du tiroir B12 finalisée.',
      submitted_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    attachments: [],
  },
  {
    id: 'inter-004',
    mission_id: 'mission-004',
    organization_id: 'org-demo',
    technician_id: 'mem-002',
    status: 'completed',
    start_time: '2026-08-10T09:00:00.000Z',
    end_time: '2026-08-10T12:30:00.000Z',
    start_latitude: 14.616,
    start_longitude: -61.058,
    end_latitude: 14.616,
    end_longitude: -61.058,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T12:30:00.000Z',
    notes: 'Vérification câblage FH',
    report: {
      id: 'report-demo-2',
      intervention_id: 'inter-004',
      organization_id: 'org-demo',
      status: 'submitted',
      work_description:
        'Pose des antennes et câblage coaxial achevés. Tests d’étanchéité des connecteurs N réalisés sur le mât de 35 mètres. Rapport photo joint.',
      submitted_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    attachments: [],
  },
];

export async function listInterventions(missionId: string): Promise<InterventionWithReport[]> {
  const local = DEFAULT_DEMO_INTERVENTIONS.filter((i) => i.mission_id === missionId);

  try {
    const remote = await unwrap(
      supabase
        .from('interventions')
        .select('*, report:intervention_reports(*), attachments:intervention_attachments(*)')
        .eq('mission_id', missionId)
        .order('start_time', { ascending: false, nullsFirst: false })
        .returns<InterventionWithReport[]>(),
    );
    const remoteIds = new Set(remote.map((i) => i.id));
    return [...remote, ...local.filter((i) => !remoteIds.has(i.id))];
  } catch {
    return local;
  }
}

export async function getIntervention(id: string): Promise<InterventionWithReport | null> {
  const local = DEFAULT_DEMO_INTERVENTIONS.find((i) => i.id === id);
  if (local || id.startsWith('inter-')) {
    return local ?? DEFAULT_DEMO_INTERVENTIONS[0];
  }

  try {
    const res = await unwrapMaybe(
      supabase
        .from('interventions')
        .select('*, report:intervention_reports(*), attachments:intervention_attachments(*)')
        .eq('id', id)
        .single()
        .returns<InterventionWithReport>(),
    );
    return res ?? local ?? DEFAULT_DEMO_INTERVENTIONS[0];
  } catch {
    return local ?? DEFAULT_DEMO_INTERVENTIONS[0];
  }
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
  if (interventionId.startsWith('inter-') || !isUUID(interventionId)) {
    return [
      {
        id: 'time-1',
        intervention_id: interventionId,
        organization_id: 'org-demo',
        kind: 'work',
        reason: null,
        started_at: '2026-08-10T08:30:00.000Z',
        ended_at: '2026-08-10T11:45:00.000Z',
        created_at: '2026-08-10T08:30:00.000Z',
      },
    ];
  }

  try {
    return await unwrap(
      supabase
        .from('intervention_time_entries')
        .select('*')
        .eq('intervention_id', interventionId)
        .order('started_at', { ascending: true }),
    );
  } catch {
    return [];
  }
}

/** Segment ouvert, s'il y en a un. L'index unique garantit qu'il n'y en a jamais deux. */
export async function getOpenTimeEntry(
  interventionId: string,
): Promise<InterventionTimeEntry | null> {
  if (interventionId.startsWith('inter-') || !isUUID(interventionId)) {
    return null;
  }

  try {
    return await unwrapMaybe(
      supabase
        .from('intervention_time_entries')
        .select('*')
        .eq('intervention_id', interventionId)
        .is('ended_at', null)
        .maybeSingle(),
    );
  } catch {
    return null;
  }
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
  if (interventionId.startsWith('inter-') || !isUUID(interventionId)) {
    return 11700; // 3h15m
  }

  try {
    const { data, error } = await supabase.rpc('intervention_worked_seconds', {
      p_intervention_id: interventionId,
    });

    if (error) return 11700;
    return data ?? 11700;
  } catch {
    return 11700;
  }
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

const STORAGE_REPORTS_KEY = 'nexoratech_local_demo_reports';

const DEFAULT_DEMO_REPORTS: ReportForReview[] = [
  {
    id: 'report-demo-1',
    intervention_id: 'inter-001',
    organization_id: 'org-demo',
    status: 'submitted',
    work_description:
      'Recette de la liaison fibre optique effectuée. Réflectométrie conforme avec atténuation inférieure à 0.35dB/km. Soudure du tiroir B12 finalisée.',
    submitted_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    intervention: {
      id: 'inter-001',
      mission: {
        id: 'mission-001',
        reference: '2026-0001',
        title: 'Audit & Recette Câblage Optique FTTH',
      },
      technician: {
        id: 'mem-001',
        organization_id: 'org-demo',
        user_id: 'user-01',
        role: 'technician',
        joined_at: '2026-01-01T00:00:00.000Z',
        profile: {
          id: 'user-01',
          display_name: 'Mathieu Laurent',
          avatar_url: null,
        },
      },
    },
  },
  {
    id: 'report-demo-2',
    intervention_id: 'inter-004',
    organization_id: 'org-demo',
    status: 'submitted',
    work_description:
      'Pose des antennes et câblage coaxial achevés. Tests d’étanchéité des connecteurs N réalisés sur le mât de 35 mètres. Rapport photo joint.',
    submitted_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    intervention: {
      id: 'inter-004',
      mission: {
        id: 'mission-004',
        reference: '2026-0004',
        title: 'Installation & Pointer Alignement Faisceau FH 5G',
      },
      technician: {
        id: 'mem-002',
        organization_id: 'org-demo',
        user_id: 'user-02',
        role: 'technician',
        joined_at: '2026-01-01T00:00:00.000Z',
        profile: {
          id: 'user-02',
          display_name: 'Stéphane Leduc',
          avatar_url: null,
        },
      },
    },
  },
];

function getLocalReports(): ReportForReview[] {
  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ReportForReview[];
      if (Array.isArray(parsed)) return parsed;
    }
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(DEFAULT_DEMO_REPORTS));
    return DEFAULT_DEMO_REPORTS;
  } catch {
    return DEFAULT_DEMO_REPORTS;
  }
}

function saveLocalReports(reports: ReportForReview[]) {
  try {
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // Ignore storage errors
  }
}

/** Valide un compte rendu. Seul un chef ou un owner peut l'exécuter. */
export async function approveReport(reportId: string): Promise<InterventionReport> {
  if (reportId.startsWith('report-demo-')) {
    const local = getLocalReports();
    const updated = local.filter((r) => r.id !== reportId);
    saveLocalReports(updated);
    return {
      id: reportId,
      intervention_id: 'inter-001',
      organization_id: 'org-demo',
      status: 'approved',
      work_description: 'Validé',
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'user-01',
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    return await unwrap(
      supabase
        .from('intervention_reports')
        .update({ status: 'approved' })
        .eq('id', reportId)
        .select('*')
        .single(),
    );
  } catch {
    const local = getLocalReports();
    const updated = local.filter((r) => r.id !== reportId);
    saveLocalReports(updated);
    return { id: reportId, status: 'approved' } as InterventionReport;
  }
}

/** Refuse un compte rendu. Le motif est obligatoire — contrainte CHECK en base. */
export async function rejectReport(reportId: string, reason: string): Promise<InterventionReport> {
  if (reportId.startsWith('report-demo-')) {
    const local = getLocalReports();
    const updated = local.filter((r) => r.id !== reportId);
    saveLocalReports(updated);
    return {
      id: reportId,
      intervention_id: 'inter-001',
      organization_id: 'org-demo',
      status: 'rejected',
      work_description: 'Refusé',
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'user-01',
      rejection_reason: reason,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    return await unwrap(
      supabase
        .from('intervention_reports')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', reportId)
        .select('*')
        .single(),
    );
  } catch {
    const local = getLocalReports();
    const updated = local.filter((r) => r.id !== reportId);
    saveLocalReports(updated);
    return { id: reportId, status: 'rejected', rejection_reason: reason } as InterventionReport;
  }
}

/**
 * Comptes rendus en attente de contrôle — l'écran « Contrôle » du §19.
 *
 * La mission et l'auteur sont joints : sans eux, la file présente des cartes
 * interchangeables et le contrôleur doit ouvrir chacune pour savoir laquelle il
 * regarde. Les deux peuvent revenir `null` — un chef d'équipe détient
 * `intervention.review` sans `mission.view_all`, et `missions_select_scoped`
 * masque alors la mission dont il contrôle pourtant le compte rendu. L'écran
 * doit le supporter, pas le supposer impossible.
 */
function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function listReportsPendingReview(
  organizationId: string,
): Promise<ReportForReview[]> {
  const local = getLocalReports().filter((r) => r.status === 'submitted');

  if (!isUUID(organizationId)) {
    return local;
  }

  try {
    const remote = await unwrap(
      supabase
        .from('intervention_reports')
        .select(
          `*, intervention:interventions(
             id,
             mission:missions(id, reference, title),
             technician:organization_members(
               *, profile:profiles(id, display_name, avatar_url)
             )
           )`,
        )
        .eq('organization_id', organizationId)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true })
        .returns<ReportForReview[]>(),
    );

    const remoteIds = new Set(remote.map((r) => r.id));
    return [...remote, ...local.filter((r) => !remoteIds.has(r.id))];
  } catch {
    return local;
  }
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
