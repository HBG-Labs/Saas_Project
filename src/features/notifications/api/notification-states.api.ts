import { supabase, unwrap } from '@/services/supabase';

/**
 * L'état lu / écarté d'une notification, tel que la base le porte.
 *
 * La base ne connaît pas les notifications — elles sont dérivées côté client
 * depuis l'état réel (missions, congés, stock…). Elle ne connaît que ce qu'une
 * personne en a fait : une clé, et jusqu'à deux dates.
 */
export interface NotificationStateRow {
  notification_key: string;
  read_at: string | null;
  dismissed_at: string | null;
}

export interface NotificationStatePatch {
  notification_key: string;
  read_at?: string;
  dismissed_at?: string;
}

/** Les états de la personne connectée dans cette organisation. La RLS filtre. */
export async function listNotificationStates(
  organizationId: string,
): Promise<NotificationStateRow[]> {
  return unwrap(
    supabase
      .from('notification_states')
      .select('notification_key, read_at, dismissed_at')
      .eq('organization_id', organizationId),
  );
}

/**
 * Pose ou complète des états.
 *
 * `on conflict … do update` sur la clé composite : une notification déjà lue
 * qu'on écarte garde sa date de lecture, et inversement. Ne jamais écraser
 * une date par `null` — un état ne se retire qu'en supprimant la ligne.
 */
export async function upsertNotificationStates(
  userId: string,
  organizationId: string,
  patches: readonly NotificationStatePatch[],
): Promise<void> {
  /*
    DEUX LOTS, JAMAIS UN

    PostgREST fusionne colonne par colonne : une colonne absente du corps n'est
    pas touchée. C'est ce qu'il faut — sinon marquer « lue » une notification
    déjà écartée remettrait `dismissed_at` à NULL. Mais il exige aussi que
    toutes les lignes d'un même envoi aient les mêmes clés (PGRST102).

    D'où deux lots homogènes : les lectures ne portent que `read_at`, les
    rejets que `dismissed_at`. Une notification lue ET écartée passe dans les
    deux ; le second `upsert` complète la ligne posée par le premier.
  */
  const lus = patches
    .filter((p): p is NotificationStatePatch & { read_at: string } => p.read_at !== undefined)
    .map((p) => ({
      user_id: userId,
      organization_id: organizationId,
      notification_key: p.notification_key,
      read_at: p.read_at,
    }));

  const ecartes = patches
    .filter(
      (p): p is NotificationStatePatch & { dismissed_at: string } => p.dismissed_at !== undefined,
    )
    .map((p) => ({
      user_id: userId,
      organization_id: organizationId,
      notification_key: p.notification_key,
      dismissed_at: p.dismissed_at,
    }));

  const conflit = { onConflict: 'user_id,organization_id,notification_key' } as const;

  if (lus.length > 0) {
    await unwrap(
      supabase.from('notification_states').upsert(lus, conflit).select('notification_key'),
    );
  }
  if (ecartes.length > 0) {
    await unwrap(
      supabase.from('notification_states').upsert(ecartes, conflit).select('notification_key'),
    );
  }
}
