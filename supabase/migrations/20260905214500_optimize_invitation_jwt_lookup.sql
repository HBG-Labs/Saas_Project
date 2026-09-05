-- Place l'appel auth.jwt() lui-même dans l'initplan afin qu'il soit évalué
-- une seule fois. L'extraction du courriel reste ensuite une opération locale.
alter policy "organization_invitations_select"
  on public.organization_invitations
  using (
    (select app.has_org_permission(organization_id, 'member.invite'))
    or lower(email) = lower((select auth.jwt()) ->> 'email')
  );
