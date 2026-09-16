-- =============================================================================
-- Correctif de performance RLS — auth.uid() réévalué ligne par ligne
-- =============================================================================
-- L'audit de sécurité Supabase (`auth_rls_initplan`) relève que les policies
-- `platform_admins_select_self` et `platform_admin_permissions_select_self`
-- (20260917090000) appellent `auth.uid()` nu plutôt que `(select auth.uid())`.
-- Postgres ne peut alors pas mettre le résultat en cache pour la requête : la
-- fonction est réévaluée à CHAQUE ligne examinée, au lieu d'une fois. Sans
-- impact fonctionnel (ces tables ne contiennent que quelques lignes), mais
-- c'est le patron déjà suivi ailleurs (`app.write_audit_log`, entre autres) :
-- autant le respecter dès l'origine plutôt que de laisser deux exceptions.
--
-- La migration d'origine ne peut pas être modifiée (immuable, déjà appliquée) :
-- on dépose les policies fautives et on les repose, à l'identique sauf ce
-- point précis.
-- =============================================================================

drop policy "platform_admins_select_self" on public.platform_admins;
create policy "platform_admins_select_self"
  on public.platform_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy "platform_admin_permissions_select_self" on public.platform_admin_permissions;
create policy "platform_admin_permissions_select_self"
  on public.platform_admin_permissions for select
  to authenticated
  using (user_id = (select auth.uid()));
