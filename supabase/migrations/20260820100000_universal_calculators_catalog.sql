-- =============================================================================
-- Les calculateurs universels entrent au catalogue
-- =============================================================================
--
-- LE CONSTAT
--
-- Douze calculateurs universels (convertisseur d'unités, pourcentage, pente,
-- débit…) ont été livrés côté code dans
-- `src/features/tools/calculators/universal/`, mais aucune ligne ne leur
-- correspond dans `public.tools`.
--
-- C'est le même cul-de-sac que celui réparé par
-- `20260812100200_catalog_reconciliation.sql` : `favorites` et `tool_history`
-- référencent un `tool_id`, que seul le catalogue fournit. Sans ligne ici :
--
--   • le bouton « Ajouter aux favoris » de la page d'outil reste désactivé,
--     puisque `useCatalogTool(slug)` ne trouve rien ;
--   • `useRecordToolUsage` n'a aucun `tool_id` à consigner, donc l'historique
--     d'utilisation reste vide ;
--   • le favori se rabattait sur `localStorage`, ce qui le rendait
--     mono-navigateur et le faisait diverger du favori serveur affiché sur la
--     page de détail — deux étoiles pour le même outil, jamais d'accord.
--
-- LA CATÉGORIE RETENUE
--
-- `general`, et non une nouvelle catégorie « universal ». Sa description en
-- base la destinait déjà exactement à ces outils : « Calculatrice
-- scientifique, pourcentages, conversions d'unités, temps, distances et
-- décibels. » Créer une huitième catégorie aurait dupliqué une intention déjà
-- exprimée, et ouvert une URL publique `/categories/universal` de plus.
--
-- Le tableau `UNIVERSAL_TOOLS` conserve son propre champ `category:
-- 'universal'` : il sert au regroupement visuel de la page catalogue, pas au
-- rangement en base. `ToolCard` sait déjà l'afficher (« Universel »).
--
-- `sort_order` = 100 + ordre déclaré : les calculateurs universels se rangent
-- après les outils métier déjà seedés, qui occupent la plage 10–50.
--
-- `short_description` reprend la première phrase de la description : le
-- registry côté code ne porte qu'un seul texte, et inventer ici un libellé
-- absent du code ferait diverger la carte et la page.
-- =============================================================================

insert into public.tools (
  slug, category_id, name, short_description, description,
  keywords, icon, sort_order, status, visibility
)
select
  v.slug, c.id, v.name, v.short_description, v.description,
  v.keywords, v.icon, v.sort_order,
  'active'::public.content_status,
  'public'::public.tool_visibility
from (values
  ('unit-converter', 'general', 'Convertisseur d''unités',
   'Conversions universelles et rapides de longueurs, surfaces, volumes, masses,…',
   'Conversions universelles et rapides de longueurs, surfaces, volumes, masses, températures, pressions, vitesses, débits et puissances.',
   array['conversion','unites','longueur','surface','volume','masse','temperature','pression','vitesse','debit','puissance'],
   'arrow-left-right', 101),

  ('distance-calculator', 'general', 'Calculateur de Distance',
   'Conversions de distances, mesures de longueurs et calcul de distance euclidienne 2D entre…',
   'Conversions de distances, mesures de longueurs et calcul de distance euclidienne 2D entre coordonnées.',
   array['distance','longueur','metre','kilometre','pouce','pied','coordonnees','point'],
   'ruler', 102),

  ('surface-calculator', 'general', 'Calculateur de Surface',
   'Calcul précis des surfaces géométriques (rectangle, carré, cercle, triangle, trapèze)…',
   'Calcul précis des surfaces géométriques (rectangle, carré, cercle, triangle, trapèze) avec équivalences d’unités.',
   array['surface','aire','rectangle','carre','cercle','triangle','trapeze','m2','hectare'],
   'square', 103),

  ('volume-calculator', 'general', 'Calculateur de Volume',
   'Calcul de volumes géométriques (parallélépipède, cylindre, cuve, sphère) avec équivalence…',
   'Calcul de volumes géométriques (parallélépipède, cylindre, cuve, sphère) avec équivalence en litres et m³.',
   array['volume','capacite','litre','m3','cubage','cylindre','cuve','sphere','contenance'],
   'box', 104),

  ('slope-calculator', 'general', 'Calculateur de Pente',
   'Calcul direct et inverse de pente en %, angle en degrés, dénivelé et longueur de rampe…',
   'Calcul direct et inverse de pente en %, angle en degrés, dénivelé et longueur de rampe pour le terrassement, voirie et toitures.',
   array['pente','denivele','inclinaison','pourcentage','degres','angle','rampe','toiture','ecoulement'],
   'trending-up', 105),

  ('percentage-calculator', 'general', 'Calculateur de Pourcentage',
   'Calcul de part, taux d’évolution (+/-%), remise commerciale, majoration / TVA et…',
   'Calcul de part, taux d’évolution (+/-%), remise commerciale, majoration / TVA et proportionnalité.',
   array['pourcentage','tva','remise','evolution','taux','reduction','majoration','proportion'],
   'percent', 106),

  ('time-calculator', 'general', 'Calculateur de Temps',
   'Calcul de durée de travail, intervalle horaire, pointage, conversion en heures décimales…',
   'Calcul de durée de travail, intervalle horaire, pointage, conversion en heures décimales et cumul de durées.',
   array['temps','duree','heures','minutes','pointage','horaire','pause','decimales','chrono'],
   'clock', 107),

  ('weight-calculator', 'general', 'Calculateur de Poids',
   'Calcul de charge totale, conversion de masse (kg, tonnes, grammes, livres) et estimation…',
   'Calcul de charge totale, conversion de masse (kg, tonnes, grammes, livres) et estimation de poids pour le transport.',
   array['poids','masse','charge','kg','tonne','gramme','livre','transport','manutention'],
   'scale', 108),

  ('pressure-calculator', 'general', 'Calculateur de Pression',
   'Conversion instantanée de pressions pour les réseaux hydrauliques, pneumatiques, gaz, CVC…',
   'Conversion instantanée de pressions pour les réseaux hydrauliques, pneumatiques, gaz, CVC et compresseurs.',
   array['pression','bar','psi','kpa','pascal','mbar','hydraulique','pneumatique','compresseur'],
   'gauge', 109),

  ('flow-calculator', 'general', 'Calculateur de Débit',
   'Calcul de débit volumique (L/min, L/h, m³/h), conversion et estimation du temps de…',
   'Calcul de débit volumique (L/min, L/h, m³/h), conversion et estimation du temps de remplissage ou de vidange.',
   array['debit','pompe','litres','m3/h','remplissage','vidange','conduite','ecoulement','tuyau'],
   'droplets', 110),

  ('power-calculator', 'general', 'Calculateur de Puissance',
   'Conversions de puissance universelle (W, kW, MW, VA, kVA, chevaux) et calcul d’énergie…',
   'Conversions de puissance universelle (W, kW, MW, VA, kVA, chevaux) et calcul d’énergie consommée en kWh.',
   array['puissance','energie','watt','kw','kwh','mwh','joule','consommation','rendement'],
   'zap', 111),

  ('ratio-calculator', 'general', 'Calculateur de Rapport / Ratio',
   'Résolution rapide de règles de trois directes, simplification de ratios d’aspect et…',
   'Résolution rapide de règles de trois directes, simplification de ratios d’aspect et répartition proportionnelle de charges.',
   array['ratio','rapport','regle de trois','proportion','dosage','repartition','echelle'],
   'calculator', 112)
) as v(slug, category_slug, name, short_description, description, keywords, icon, sort_order)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do update set
  category_id       = excluded.category_id,
  name              = excluded.name,
  short_description = excluded.short_description,
  description       = excluded.description,
  keywords          = excluded.keywords,
  icon              = excluded.icon,
  sort_order        = excluded.sort_order,
  status            = excluded.status,
  visibility        = excluded.visibility;
