-- =============================================================================
-- Réconciliation du catalogue : la table `tools` rejoint le registry
-- =============================================================================
--
-- LE CONSTAT
--
-- Le catalogue a deux faces jointes par le `slug` : la table `tools` porte les
-- métadonnées et la curation, `src/tools/<slug>/index.ts` porte le code.
-- `reconcileRegistryWithCatalog()` existe précisément pour signaler leur
-- divergence — encore faut-il la corriger.
--
-- Sondage du registry contre la table, à cette date :
--
--   Publiés SANS implémentation (page vide, favori impossible à ouvrir) :
--     ohm-law-power · fiber-attenuation · dbm-mw-converter
--   Implémentés SANS ligne (aucun `tool_id`, donc ni favori ni historique) :
--     bandwidth-transfer-calculator · copper-color-code · ip-mac-converter
--     ipv6-subnet-calculator · ohm-law · tcp-bdp-calculator
--
-- Ces trois premiers sont volontairement retirés du registry par les exclusions
-- de glob de `src/tools/index.ts` : le code les masque. Ils sont donc DÉPUBLIÉS
-- ici, pas supprimés — `status = 'draft'` les retire du catalogue tout en
-- préservant leur `id`, et avec lui les favoris et l'historique déjà posés. Un
-- simple `update` les republiera le jour où leur implémentation reviendra.
--
-- Les six autres sont ajoutés. Sans ligne dans `tools`, ils fonctionnent mais
-- restent des culs-de-sac : `favorites` et `tool_history` référencent un
-- `tool_id`, que seul le catalogue fournit.
--
-- Les libellés reprennent mot pour mot ceux de `defineTool()`. Le contraire
-- afficherait un nom sur la carte et un autre sur la page.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dépublication des outils sans implémentation
-- -----------------------------------------------------------------------------
update public.tools
set status = 'draft'
where slug in ('ohm-law-power', 'fiber-attenuation', 'dbm-mw-converter');

-- -----------------------------------------------------------------------------
-- Publication des outils implémentés
-- -----------------------------------------------------------------------------
--
-- `insert ... select` avec jointure sur `categories` : la catégorie est
-- désignée par son slug, jamais par un UUID écrit en dur — celui-ci diffère
-- d'un environnement à l'autre.
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
  ('ohm-law', 'electrical', 'Calculateur Loi d''Ohm',
   'Tension, intensité et résistance, avec conversion automatique des unités.',
   'Calcul instantané de la tension U (V), l''intensité I (A) et la résistance R (Ω) avec conversion automatique des unités.',
   array['ohm','loi d''ohm','tension','intensité','courant','résistance','volt','ampère','électricité','u=ri','nf c 15-100'],
   'zap', 20),

  ('copper-color-code', 'telecom', 'Générateur Code Couleur Câble Cuivre Télécom',
   'Repérage des paires cuivre : 28 paires et multipaires jusqu''à 720.',
   'Repérage instantané des paires et couleurs de câbles cuivre télécom : 28 paires (4 amorces) et multipaires (8 à 720 paires).',
   array['cuivre','télécom','code couleur','ptt 92','multipaire','paire','fils','amorce','réseau','cad'],
   'radio-tower', 10),

  ('bandwidth-transfer-calculator', 'networking', 'Calculateur Débit Réseau',
   'Débit utile net, durée de transfert et bande passante requise.',
   'Calcul du débit utile net, estimation de la durée de transfert de fichiers et bande passante requise.',
   array['réseau','bande passante','transfert','vitesse','téléchargement','débit','octets','gbps','mbps'],
   'network', 20),

  ('ip-mac-converter', 'networking', 'Convertisseur IP Binaire',
   'IP en binaire 32 bits, hexadécimal, masques et Wildcard.',
   'Conversion d''adresses IP en binaire (32 bits), hexadécimal, masques réseaux et dérivations Wildcard.',
   array['ip','mac','wildcard','acl','cisco','binaire','hexadécimal','multicast','réseau','ospf'],
   'network', 30),

  ('ipv6-subnet-calculator', 'networking', 'Calculateur VLAN',
   'Planification 802.1Q, sous-réseaux virtuels et étiquetage de trames.',
   'Planification des VLANs (802.1Q), découpage de sous-réseaux virtuels et étiquetage de trames.',
   array['ipv6','réseau','eui-64','compression','adressage','prefix','mac','unicast','multicast'],
   'network', 40),

  ('tcp-bdp-calculator', 'networking', 'Calculateur PoE',
   'PoE / PoE+ / PoE++, bilan de consommation et chute de tension RJ45.',
   'Calcul d''alimentation PoE / PoE+ / PoE++ (802.3af/at/bt), bilan de consommation et chute de tension sur câble RJ45.',
   array['tcp','bdp','réseau','latence','rtt','buffer','window size','débit','wan','satellite'],
   'network', 50)
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
