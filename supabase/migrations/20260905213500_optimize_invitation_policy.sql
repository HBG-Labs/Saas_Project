-- Évalue le courriel du JWT une seule fois par requête au lieu de rappeler
-- auth.jwt() pour chaque invitation examinée.
alter policy "organization_invitations_select"
  on public.organization_invitations
  using (
    (select app.has_org_permission(organization_id, 'member.invite'))
    or lower(email) = (select lower(auth.jwt() ->> 'email'))
  );
