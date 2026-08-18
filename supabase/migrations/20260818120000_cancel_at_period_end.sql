-- =============================================================================
-- Résilier : une sortie qui existe, et qui ne punit pas
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran de facturation propose « Gérer mon abonnement », qui ouvre le portail
-- Stripe — où l'on change sa carte, récupère ses factures et résilie. Mais ce
-- bouton exige un client Stripe, et une entreprise en période d'essai n'en a
-- pas. Il était donc grisé, avec une infobulle pour toute explication.
--
-- Résultat : pendant les quatorze jours où l'entreprise se décide, elle n'a
-- AUCUN moyen de dire non. C'est le moment précis où la sortie doit être la plus
-- visible : un produit dont on ne sait pas sortir est un produit dans lequel on
-- n'entre pas.
--
-- POURQUOI UNE COLONNE PLUTÔT QUE `canceled_at`
--
-- `canceled_at` existe déjà, mais le webhook l'écrit TOUJOURS avec
-- `status = 'canceled'` : il date une résiliation effective. S'en servir seul
-- pour dire « résiliation programmée » lui donnerait deux sens selon la valeur
-- d'une autre colonne. Ce dépôt a déjà payé le prix d'une donnée à double
-- lecture ; on prend le nom que Stripe emploie lui-même,
-- `cancel_at_period_end`, ce qui rend en prime le miroir évident le jour où le
-- webhook le synchronise.
--
-- CE QUE LA RÉSILIATION FAIT, ET NE FAIT PAS
--
-- Elle ne coupe rien. Elle lève un drapeau ; l'accès s'éteint tout seul à
-- `current_period_end`, parce que `app.org_plan_code` exige déjà que cette date
-- soit dans le futur. Le mécanisme d'expiration n'est pas modifié — il est
-- simplement laissé à son travail, et c'est justement celui qu'on a remis en
-- état ce matin.
--
-- Deux conséquences, toutes deux voulues :
--
--   • l'entreprise garde jusqu'au dernier jour ce qui lui a été promis, comme
--     le fait Stripe. Un clic malheureux ne fait pas disparaître sept missions ;
--   • la décision est réversible tant qu'elle n'a pas pris effet, d'où
--     `resume_organization_subscription`. Une résiliation qu'on ne peut pas
--     annuler avant sa date est un piège, pas une sortie.
--
-- CE QUI RESTE À STRIPE
--
-- Quand `provider_subscription_id` est renseigné, Stripe fait autorité : le
-- prestataire encaisse, lui seul sait ce qui a été payé, et sa prochaine
-- notification écraserait de toute façon une décision prise ici. La fonction
-- refuse alors explicitement et renvoie vers le portail, plutôt que d'écrire une
-- valeur qui serait défaite dans la minute.
-- =============================================================================

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.subscriptions.cancel_at_period_end is
  'Résiliation demandée : l''accès court jusqu''à current_period_end, puis retombe sur Free. '
  'Même nom et même sens que le champ Stripe correspondant.';

-- -----------------------------------------------------------------------------
-- Résilier
-- -----------------------------------------------------------------------------

create or replace function public.cancel_organization_subscription(p_organization_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  -- Le droit de résilier est celui de gérer la facturation : réservé au
  -- propriétaire. `has_org_permission` lit la matrice qui fait autorité — la
  -- réécrire ici la ferait diverger au premier changement de rôle.
  if not app.has_org_permission(p_organization_id, 'billing.manage') then
    raise exception 'Seul le propriétaire peut résilier l''abonnement.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_sub
  from public.subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('trialing', 'active', 'past_due')
    and (s.current_period_end is null or s.current_period_end > now())
  order by s.created_at desc
  limit 1;

  if not found then
    raise exception 'Aucun abonnement en cours à résilier.';
  end if;

  if v_sub.provider_subscription_id is not null then
    raise exception
      'Cet abonnement est géré par Stripe : résiliez-le depuis le portail de facturation.';
  end if;

  -- Ni le statut ni la période ne bougent : c'est l'échéance déjà inscrite qui
  -- fera cesser l'accès, par le chemin habituel.
  update public.subscriptions
     set cancel_at_period_end = true,
         updated_at           = now()
   where id = v_sub.id;

  insert into public.audit_logs (
    organization_id, user_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    'subscription.cancellation_scheduled',
    'subscription',
    v_sub.id,
    jsonb_build_object(
      'plan_code', v_sub.plan_code,
      'status', v_sub.status,
      'access_until', v_sub.current_period_end
    )
  );

  return v_sub.current_period_end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Se raviser
-- -----------------------------------------------------------------------------

create or replace function public.resume_organization_subscription(p_organization_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  if not app.has_org_permission(p_organization_id, 'billing.manage') then
    raise exception 'Seul le propriétaire peut reprendre l''abonnement.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_sub
  from public.subscriptions s
  where s.organization_id = p_organization_id
    and s.cancel_at_period_end
    and s.status in ('trialing', 'active', 'past_due')
    and (s.current_period_end is null or s.current_period_end > now())
  order by s.created_at desc
  limit 1;

  -- Passée l'échéance, il n'y a plus rien à reprendre : il faut souscrire. Le
  -- dire vaut mieux que de lever un drapeau sur un abonnement déjà éteint.
  if not found then
    raise exception 'Aucune résiliation en attente sur un abonnement encore actif.';
  end if;

  if v_sub.provider_subscription_id is not null then
    raise exception
      'Cet abonnement est géré par Stripe : reprenez-le depuis le portail de facturation.';
  end if;

  update public.subscriptions
     set cancel_at_period_end = false,
         updated_at           = now()
   where id = v_sub.id;

  insert into public.audit_logs (
    organization_id, user_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    'subscription.cancellation_revoked',
    'subscription',
    v_sub.id,
    jsonb_build_object('plan_code', v_sub.plan_code, 'status', v_sub.status)
  );
end;
$$;

revoke all on function public.cancel_organization_subscription(uuid) from public, anon;
revoke all on function public.resume_organization_subscription(uuid) from public, anon;
grant execute on function public.cancel_organization_subscription(uuid) to authenticated;
grant execute on function public.resume_organization_subscription(uuid) to authenticated;
