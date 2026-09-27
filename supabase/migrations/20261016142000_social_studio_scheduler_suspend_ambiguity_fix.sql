-- =============================================================================
-- Social Studio Phase F — correction suspension/reprise
-- =============================================================================
--
-- Migration additive : remplace uniquement la fonction de suspension pour
-- qualifier les colonnes qui portent le meme nom que ses colonnes de retour.
-- =============================================================================

create or replace function public.set_social_week_publishing_suspended(
  p_organization_id uuid,
  p_week_id uuid,
  p_suspended boolean
)
returns table (
  week_id uuid,
  suspended boolean,
  skipped_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := now();
  v_skipped integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if not (select app.can_use_pro_module(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (select app.has_org_permission(p_organization_id, 'social.publish')) then
    raise exception 'La suspension des publications exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  perform 1
  from public.social_weeks week
  where week.id = p_week_id
    and week.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Semaine Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if p_suspended then
    update public.social_weeks week
       set publishing_suspended_at = v_now,
           publishing_suspended_by = v_actor
     where week.id = p_week_id
       and week.organization_id = p_organization_id;

    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (p_organization_id, v_actor, 'social.week_suspended', 'social_week', p_week_id, '{}'::jsonb);
  else
    update public.social_posts post
       set status = 'failed',
           publish_state = 'skipped',
           publish_last_error_code = 'missed_while_suspended',
           publish_last_error_kind = 'permanent',
           last_error = 'Publication depassee pendant suspension : reprogrammation requise.',
           publish_next_attempt_at = null,
           publish_locked_at = null,
           publish_lock_token = null
     where post.organization_id = p_organization_id
       and post.week_id = p_week_id
       and post.status = 'scheduled'
       and post.publish_state = 'scheduled'
       and post.scheduled_at < v_now;

    get diagnostics v_skipped = row_count;

    update public.social_weeks week
       set publishing_suspended_at = null,
           publishing_suspended_by = null
     where week.id = p_week_id
       and week.organization_id = p_organization_id;

    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (
      p_organization_id,
      v_actor,
      'social.week_resumed',
      'social_week',
      p_week_id,
      jsonb_build_object('skipped_overdue_posts', v_skipped)
    );
  end if;

  return query select p_week_id, p_suspended, v_skipped;
end;
$$;

revoke all on function public.set_social_week_publishing_suspended(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_social_week_publishing_suspended(uuid, uuid, boolean)
  to authenticated;
