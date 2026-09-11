-- =============================================================================
-- Deux métiers de plus : Mécanique et Transport
-- =============================================================================
--
-- Un métier s'ajoute par migration de données, jamais par du code : c'est la
-- règle posée par `20260815100000_industries.sql`, et elle tient ici aussi.
-- Aucune table du cœur ne change, aucune contrainte n'est touchée —
-- `organizations_industry_fkey` accepte ces valeurs du seul fait qu'elles
-- existent dans le référentiel.
--
-- RANGS 62 ET 64, ET POURQUOI PAS UNE RENUMÉROTATION
--
-- Les deux métiers doivent apparaître entre Chauffage (60) et Dératisation
-- (70). Renuméroter l'ensemble par pas de dix aurait touché huit lignes pour
-- n'en insérer que deux, et fait diverger la base de ce que le semis d'origine
-- décrit. Deux rangs intercalaires suffisent et ne modifient rien d'existant.
--
-- LE VOCABULAIRE RESTE CELUI DE LA MAJORITÉ
--
-- « Mission » et « Intervention », comme huit des onze métiers déjà semés. Un
-- transporteur dirait sans doute « Livraison » ou « Tournée » — mais ces termes
-- demandent un accord en genre que `isFeminineNoun` ne sait pas encore produire
-- pour « Livraison », et cette migration n'a pas à entraîner un changement de
-- code. Le vocabulaire s'affine plus tard, par une autre migration de données.
--
-- `on conflict do nothing` : rejouable sans effet de bord, comme le semis dont
-- cette migration prolonge la table.
-- =============================================================================

insert into public.industries (code, label, description, icon, sort_order, vocabulary)
values
  ('mechanics', 'Mécanique',
   'Entretien, réparation et diagnostic de véhicules, engins et matériels.',
   'wrench', 62,
   jsonb_build_object('worker', 'Mécanicien', 'job', 'Mission', 'visit', 'Intervention')),

  ('transport', 'Transport',
   'Livraison, messagerie, affrètement et logistique du dernier kilomètre.',
   'truck', 64,
   jsonb_build_object('worker', 'Chauffeur', 'job', 'Mission', 'visit', 'Intervention'))
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
declare
  v_rang_chauffage  integer;
  v_rang_mecanique  integer;
  v_rang_transport  integer;
  v_rang_deratisation integer;
  v_total integer;
begin
  select sort_order into v_rang_chauffage    from public.industries where code = 'heating';
  select sort_order into v_rang_mecanique    from public.industries where code = 'mechanics';
  select sort_order into v_rang_transport    from public.industries where code = 'transport';
  select sort_order into v_rang_deratisation from public.industries where code = 'pest_control';

  if v_rang_mecanique is null or v_rang_transport is null then
    raise exception 'Les métiers Mécanique et Transport n''ont pas été semés.';
  end if;

  -- L'ordre demandé : Chauffage, Mécanique, Transport, Dératisation.
  if not (v_rang_chauffage < v_rang_mecanique
          and v_rang_mecanique < v_rang_transport
          and v_rang_transport < v_rang_deratisation) then
    raise exception 'Ordre d''affichage inattendu : chauffage=%, mecanique=%, transport=%, deratisation=%.',
      v_rang_chauffage, v_rang_mecanique, v_rang_transport, v_rang_deratisation;
  end if;

  -- Aucun métier existant ne doit avoir disparu : onze semés, deux ajoutés.
  select count(*) into v_total from public.industries;
  if v_total <> 13 then
    raise exception 'Le référentiel compte % métiers au lieu de 13.', v_total;
  end if;

  -- Le vocabulaire est obligatoire : sans lui, `useLabel()` retombe sur le
  -- vocabulaire par défaut sans que rien ne le signale.
  if exists (
    select 1 from public.industries
    where code in ('mechanics', 'transport')
      and (vocabulary is null
           or vocabulary->>'worker' is null
           or vocabulary->>'job' is null
           or vocabulary->>'visit' is null)
  ) then
    raise exception 'Vocabulaire incomplet sur un des deux nouveaux métiers.';
  end if;
end
$$;
