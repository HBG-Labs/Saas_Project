-- =============================================================================
-- Tenir les deux colonnes de catégorie ensemble, le temps de la bascule
-- =============================================================================
--
-- CE QUE LA MIGRATION PRÉCÉDENTE A OUBLIÉ
--
-- Elle a reporté `equipment.category` vers `category_id` en un `update` unique.
-- Correct pour l'existant — et sans effet sur la suite : l'interface continue
-- d'écrire l'enum, donc tout matériel créé après aurait `category_id` à NULL.
--
-- Le report n'aurait tenu qu'un instant. C'est le piège classique d'une
-- migration de colonne menée en un seul coup : on vérifie le lendemain, tout
-- est juste ; on revient un mois plus tard, la moitié des lignes sont vides.
--
-- LA RÈGLE PENDANT LA TRANSITION
--
-- Les deux colonnes disent la même chose, et un trigger s'en assure :
--
--   • si seul l'enum est fourni — ce que fait l'interface aujourd'hui — le
--     trigger en déduit `category_id` ;
--   • si seul `category_id` est fourni — ce que fera l'interface demain — le
--     trigger renseigne l'enum, en retombant sur `autre` pour une catégorie
--     qui n'a pas d'équivalent, ce qui est le cas de la plupart des nouvelles.
--
-- Le sens de la vérité s'inversera sans rien casser : quand l'interface aura
-- basculé, l'enum ne sera plus qu'un vestige, et sa suppression deviendra une
-- formalité.
-- =============================================================================

create or replace function app.sync_equipment_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code     text;
  v_industry text;
begin
  -- Sens 1 : l'enum est fourni, la référence manque.
  if new.category_id is null then
    -- Correspondance identique à celle du report initial, pour que le résultat
    -- soit le même qu'une ligne créée avant ou après cette migration.
    case new.category
      when 'optique'     then v_code := 'optical';  v_industry := 'fiber_telecom';
      when 'radio'       then v_code := 'radio';    v_industry := 'fiber_telecom';
      when 'electricite' then v_code := 'testing';  v_industry := 'electrical';
      when 'securite'    then v_code := 'safety';   v_industry := null;
      else                    v_code := 'other';    v_industry := null;
    end case;

    select c.id into new.category_id
    from public.equipment_categories c
    where c.code = v_code
      and c.industry_code is not distinct from v_industry
    limit 1;

    return new;
  end if;

  -- Sens 2 : la référence est fournie, l'enum doit suivre.
  --
  -- `category` est NOT NULL et vaut `autre` par défaut : on ne le laisse donc
  -- jamais incohérent. Les catégories sans équivalent dans l'ancien jeu —
  -- « Fluides & récupération », « Motoculture » — retombent sur `autre`, ce qui
  -- est exact : l'enum n'a jamais su les exprimer.
  select case c.code
           when 'optical' then 'optique'
           when 'radio'   then 'radio'
           when 'testing' then 'electricite'
           when 'safety'  then 'securite'
           else 'autre'
         end
    into v_code
  from public.equipment_categories c
  where c.id = new.category_id;

  new.category := coalesce(v_code, 'autre')::public.equipment_category;

  return new;
end;
$$;

drop trigger if exists equipment_sync_category on public.equipment;
create trigger equipment_sync_category
  before insert or update of category, category_id on public.equipment
  for each row execute function app.sync_equipment_category();
