-- =============================================================================
-- Portail client — détail d'un devis et réponse du client
-- =============================================================================
--
-- La liste des devis affichait « En attente de votre réponse » sans offrir de
-- réponse. Deux fonctions comblent ce manque, avec la même discipline que le
-- reste du portail : colonnes choisies, zéro ligne hors session, décision
-- prise ici et nulle part ailleurs.
--
--   portal_quote_detail(uuid)         → en-tête + lignes + totaux, ou NULL
--   portal_respond_quote(uuid, text)  → accepte ou refuse un devis « envoyé »
--
-- La réponse est datée dans `quotes.client_responded_at` : c'est ce qui
-- permet à l'entreprise d'être prévenue (notification) sans qu'aucune ligne
-- d'audit ne serve d'écran.
-- =============================================================================

alter table public.quotes
  add column if not exists client_responded_at timestamptz;

comment on column public.quotes.client_responded_at is
  'Date à laquelle le client a accepté ou refusé depuis son espace client. NULL si la décision vient de l''entreprise.';

-- -----------------------------------------------------------------------------
-- Détail
-- -----------------------------------------------------------------------------

create or replace function public.portal_quote_detail(p_quote_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'organization_id', q.organization_id,
    'reference', q.reference,
    'title', q.title,
    'status', q.status::text,
    'notes', q.notes,
    'valid_until', q.valid_until,
    'vat_rate', q.vat_rate,
    'created_at', q.created_at,
    'client_responded_at', q.client_responded_at,
    'site_name', q.site_name,
    'subtotal_cents', coalesce(t.subtotal_cents, 0),
    'vat_cents', coalesce(t.vat_cents, 0),
    'total_cents', coalesce(t.total_cents, 0),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'unit', i.unit,
        'quantity', i.quantity,
        'unit_price_cents', i.unit_price_cents,
        'line_total_cents', round(i.quantity * i.unit_price_cents)::bigint
      ) order by i.position, i.created_at)
      from public.quote_items i where i.quote_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotes q
  left join public.quote_totals t on t.quote_id = q.id
  where app.is_portal_contact()
    and app.org_has_feature(q.organization_id, 'quotes')
    and q.id = p_quote_id
    and q.customer_id in (select app.portal_customer_ids())
    and q.status <> 'draft';
$$;

revoke all on function public.portal_quote_detail(uuid) from public, anon;
grant execute on function public.portal_quote_detail(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Réponse
-- -----------------------------------------------------------------------------

create or replace function public.portal_respond_quote(p_quote_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote   public.quotes%rowtype;
  v_contact uuid;
begin
  perform app.assert_portal_contact();

  if p_decision not in ('accepted', 'refused') then
    raise exception 'Décision inconnue.' using errcode = 'check_violation';
  end if;

  -- Verrouillée : deux réponses simultanées ne se croisent pas.
  select * into v_quote
  from public.quotes q
  where q.id = p_quote_id
    and q.customer_id in (select app.portal_customer_ids())
    and app.org_has_feature(q.organization_id, 'quotes')
  for update;

  if v_quote.id is null then
    -- Introuvable et interdit se confondent, à dessein.
    raise exception 'Devis introuvable.' using errcode = 'no_data_found';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'Ce devis n''attend plus de réponse.' using errcode = 'check_violation';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'Ce devis a expiré : demandez-en une mise à jour.' using errcode = 'check_violation';
  end if;

  update public.quotes
     set status = p_decision::public.quote_status,
         client_responded_at = now()
   where id = v_quote.id;

  select id into v_contact from public.customer_contacts
   where id in (select app.my_portal_contact_ids()) and customer_id = v_quote.customer_id
   limit 1;

  perform app.write_audit_log(
    v_quote.organization_id,
    case p_decision when 'accepted' then 'portal.quote_accepted' else 'portal.quote_refused' end,
    'quote',
    v_quote.id,
    jsonb_build_object('reference', v_quote.reference, 'contact_id', v_contact)
  );

  return public.portal_quote_detail(v_quote.id);
end;
$$;

revoke all on function public.portal_respond_quote(uuid, text) from public, anon;
grant execute on function public.portal_respond_quote(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
begin
  if public.portal_quote_detail(gen_random_uuid()) is not null then
    raise exception 'portal_quote_detail renvoie un document hors session.';
  end if;
end
$$;
