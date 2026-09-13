-- =============================================================================
-- Portail client — demande d'accès : la porte, vue du serveur
-- =============================================================================
--
-- La fonction Edge `portal-request-access` n'a pas d'utilisateur : la personne
-- qui demande un code n'est pas encore connectée. Elle ne peut donc pas
-- interroger `app.my_portal_contact_ids()`, qui raisonne sur `auth.jwt()`.
--
-- Cette fonction pose LA MÊME question — qui a accès au portail pour cette
-- adresse ? — avec les MÊMES conditions, mais depuis une adresse donnée en
-- paramètre. Les deux définitions doivent rester alignées : si l'une change,
-- l'autre aussi. Elle est réservée au rôle de service ; ni `anon` ni
-- `authenticated` ne peuvent l'appeler, sans quoi elle servirait à savoir qui
-- est client de qui.
-- =============================================================================

create or replace function public.portal_gate_for_email(p_email text)
returns table (
  contact_id        uuid,
  organization_id   uuid,
  organization_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.organization_id,
    coalesce(nullif(s.display_name, ''), o.name)
  from public.customer_contacts c
  join public.client_portal_settings s
    on s.organization_id = c.organization_id and s.enabled
  join public.organizations o on o.id = c.organization_id
  where c.portal_enabled
    and c.email is not null
    and lower(c.email) = lower(trim(p_email))
    and app.org_has_feature(c.organization_id, 'client_portal')
  order by c.created_at
  limit 1;
$$;

revoke all on function public.portal_gate_for_email(text) from public, anon, authenticated;
grant execute on function public.portal_gate_for_email(text) to service_role;

comment on function public.portal_gate_for_email(text) is
  'Contact autorisé au portail pour une adresse — réservé au rôle de service (fonction Edge portal-request-access).';

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.role_routine_grants
    where routine_schema = 'public' and routine_name = 'portal_gate_for_email'
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'portal_gate_for_email ne doit pas être appelable par anon ou authenticated.';
  end if;
end;
$$;
