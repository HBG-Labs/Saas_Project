# Prospect Radar — conformité RGPD et politique de conservation

Document de référence, à tenir à jour à chaque décision touchant la collecte,
la conservation ou la suppression de données de prospection. Rien ici n'est du
code : c'est ce que le code doit respecter.

## Ce que « donnée accessible publiquement » ne veut pas dire

Le Sirene/RNE est public et son usage à des fins de prospection B2B est un cas
d'usage établi — ça ne veut pas dire que toute donnée qui en dérive s'utilise
de la même façon. La distinction qui compte n'est pas « publique ou privée »,
c'est **à qui elle se rapporte** et **par quel canal elle est utilisée**.

## Matrice de conformité

| Type de donnée | Nature | Base légale mobilisable | Canal | Traitement Prospect Radar |
|---|---|---|---|---|
| Adresse générique d'entreprise (`contact@`, `info@`, standard) | Donnée de personne morale | Intérêt légitime (art. 6.1.f), prospection B2B | E-mail, téléphone | **Seul canal envisagé en V1**, et seulement une fois une source d'enrichissement validée (Phase 11 — aucune en V1) |
| Adresse professionnelle nominative (`prenom.nom@entreprise.fr`) | Donnée à caractère personnel (identifie une personne physique) | Intérêt légitime, à condition stricte que le contenu reste strictement professionnel et que l'opposition soit immédiate et sans justification à fournir | E-mail | Non utilisée en V1. Si une source future ne fournit QUE ce type d'adresse, la fonctionnalité doit le signaler explicitement avant tout envoi — jamais traité comme équivalent à une adresse générique |
| Téléphone professionnel (standard entreprise) | Donnée de personne morale | Intérêt légitime | Appel, SMS | Non collecté en V1 (aucun enrichissement branché) |
| Téléphone mobile nominatif | Donnée à caractère personnel | Intérêt légitime plus difficile à justifier pour un premier contact froid non sollicité — risque élevé | SMS, appel, WhatsApp | **Exclu de toute automatisation** ; si collecté un jour, traitement manuel exclusivement, jamais dans `prospect_contacts` sans confidence/source explicite |
| Nom du dirigeant (donnée Sirene/RNE) | Donnée à caractère personnel | Intérêt légitime pour PERSONNALISER un message professionnel adressé à l'entreprise (« à l'attention de… ») | — | Non stocké en V1 ; l'API Recherche d'Entreprises expose ce champ pour certaines structures, il n'est volontairement PAS repris dans `prospects` tant que ce point n'est pas retranché |
| Réseaux sociaux, sites tiers (LinkedIn, Facebook, Google) | — | — | — | **Hors périmètre absolu** : aucun scraping, quel que soit le canal, sans autorisation explicite de la plateforme concernée |

## Base légale retenue pour Prospect Radar V1

**Intérêt légitime** (article 6.1.f du RGPD), pour une prospection commerciale
B2B, limitée à :
- des personnes morales (entreprises), jamais des particuliers ;
- un contact **professionnel générique** si et seulement si un enrichissement
  futur en fournit un — en V1, aucune coordonnée de contact n'est collectée du
  tout, seule la fiche d'identification (Sirene) l'est ;
- un message respectant les critères CNIL de la prospection B2B légitime :
  lien direct avec l'activité professionnelle du destinataire, mention claire
  de qui contacte et pourquoi, moyen simple de s'opposer.

## Information et droit d'opposition

- Tout brouillon de message généré doit permettre une opposition simple (voir
  §17 du cahier des charges — jamais de ton intrusif, jamais de mention
  explicite de la source de détection).
- Une opposition reçue (par n'importe quel canal) s'enregistre dans
  `prospect_suppressions`, clé par SIREN. Elle est **appliquée en base par
  trigger** (`app.enforce_prospect_suppression`), pas seulement par discipline
  de code côté worker — voir `20260917100000_prospecting_schema.sql`.
- Une opposition peut être retirée (table à `delete`, pas d'`update`) si
  l'entreprise elle-même demande explicitement à être recontactée — cette
  action reste manuelle, jamais automatique.

## Conservation

**Décision retenue (validée) — à documenter dans le code au moment où une
purge est implémentée, pas avant :**

- **Prospects non convertis** : conservation **3 ans** à compter de la date de
  collecte, prolongée à 3 ans à compter du **dernier contact pertinent émanant
  du prospect lui-même** (une réponse, une demande, une marque d'intérêt) —
  c'est-à-dire que répondre au premier message relance le délai, un silence
  total ne le relance jamais indéfiniment.
- **Prospects convertis en client** : l'historique commercial (notes,
  timeline, score initial) est conservé sans limite liée à la prospection —
  il devient une donnée contractuelle du client, régie par les règles de
  conservation de la relation client elle-même, pas par celles de la
  prospection.
- **Oppositions (`prospect_suppressions`)** : conservées **sans limite de
  durée déterminée à l'avance**, tant que c'est strictement nécessaire pour
  garantir que l'entreprise ne soit plus jamais recontactée — c'est la
  position CNIL constante sur les listes d'opposition : la donnée qui sert
  UNIQUEMENT à ne plus contacter quelqu'un n'est pas soumise à la même
  contrainte de durée que la donnée de prospection elle-même, précisément
  parce que la supprimer romprait la protection qu'elle est censée assurer.

**Ce qui N'EST PAS fait en Phase 2** : aucun job de purge automatique n'est
créé. Cette migration pose la structure ; l'implémentation d'une purge
(fonction + cron) est un chantier séparé, à ouvrir explicitement quand vous le
déciderez — pas glissé silencieusement dans une phase qui ne le mentionne pas.

## Minimisation

- Aucune ligne `prospect_contacts` n'est créée « au cas où » : la table reste
  vide tant qu'une source d'enrichissement n'est pas validée.
- `tranche_effectif` (tranche d'effectif salarié) est stockée à titre informatif
  uniquement — jamais utilisée dans le calcul du score sans décision explicite
  ultérieure, pour ne pas laisser une donnée collectée « dériver » vers un
  usage non prévu au moment de sa collecte.
- Le nom d'un dirigeant, disponible dans la donnée source pour certaines
  structures, n'est PAS repris dans le schéma V1 (voir matrice ci-dessus).

## Sécurité et traçabilité

- Isolation totale des données de prospection vis-à-vis des organisations
  clientes : aucune table `prospect*` ne porte de colonne `organization_id`,
  aucune policy ne s'ouvre sans `app.has_platform_permission(...)` — voir
  §« Contrôle » en fin de `20260917100000_prospecting_schema.sql`.
- `prospect_activities` est insert-only (même patron qu'`audit_logs`) : la
  timeline commerciale, y compris les instants où une opposition a été posée
  ou une conversion actée, ne peut jamais être réécrite après coup.

## Secteurs ciblés (Phase 4, `20260919090000`)

Codes NAF rév. 2 réels, jamais une correspondance par mot-clé. Choix
explicitement validés avec l'utilisateur :

| Métier REZO360 | Code(s) NAF | Poids | Remarque |
|---|---|---|---|
| Plomberie | 43.22A | 1.0 | |
| Électricité | 43.21A | 1.0 | |
| Chauffage | 43.22B | 1.0 | Couvre AUSSI le froid/climatisation — la nomenclature française ne les distingue pas. |
| Froid & Climatisation | — | — | Aucune ligne séparée : capté par 43.22B (ci-dessus), pas de code distinct en NAF rév. 2. |
| Nettoyage | 81.21Z, 81.22Z | 1.0 | Bâtiments courant / industriel. |
| Paysage & Espaces verts | 81.30Z | 1.0 | |
| Dératisation & Désinsectisation | 81.29A | 1.0 | |
| Aide à domicile | 88.10A | 1.0 | |
| Mécanique | 45.20A, 45.20B | 1.0 | Véhicules légers / autres véhicules. |
| Transport | 49.41A, 49.41B | 0.5 | Code réel mais large (transporteurs classiques, pas seulement du terrain proche REZO360). |
| Réseaux & IT | 62.02A | 0.5 | Idem : couvre surtout des ESN généralistes. |
| Fibre & Télécom | — | — | Non ciblé : aucun code NAF spécifique et fiable aux installateurs de terrain (43.21A se confondrait avec l'électricité, 61.90Z vise des opérateurs/FAI). |
| Autre métier de terrain | — | — | Catch-all, jamais ciblé. |

## Dédoublonnage SIREN / SIRET (Phase 4)

- **SIREN** identifie l'entreprise (`prospects`, clé primaire) — jamais
  recréé, toujours mis à jour via `upsert_prospect` (Phase 3), qui ne touche
  jamais au statut commercial ni à l'historique.
- **SIRET** identifie l'établissement retenu pour représenter la présence
  dans la zone ciblée (`prospect_establishments`) — un SIREN peut porter
  plusieurs SIRET (plusieurs établissements), une seule ligne par SIRET.
- Une entreprise n'a qu'une seule activité principale (un seul code NAF) à un
  instant donné : elle ne peut donc jamais être détectée deux fois dans le
  même run pour deux codes NAF ciblés différents — pas de risque de double
  traitement à ce niveau.
- Le worker (`prospecting-worker`) peut désormais traiter plusieurs zones
  actives dans un même run (ex. Martinique + Guadeloupe une fois cette
  dernière activée) : chacune contribue au même plafond de sécurité global —
  activer une zone supplémentaire n'augmente jamais la taille de
  l'échantillon au-delà de `MAX_SAMPLE_PER_RUN`.

## Score d'opportunité (Phase 5, `20260920090000`)

Trois critères, tous vérifiables directement sur la fiche du prospect —
jamais une donnée devinée, jamais `tranche_effectif` (voir § Minimisation) :

| Critère | Points max | Condition |
|---|---|---|
| Récence de création | 40 | Créée il y a moins de 6 mois (25 si < 12 mois, 10 si < 24 mois — le meilleur palier, jamais cumulé) |
| Pertinence du secteur | 40 | `prospecting_score_weights.secteur_pertinence_max` × `prospecting_sectors.relevance_weight` du secteur ciblé |
| Présence locale | 20 | L'établissement retenu par le worker est bien dans le département de la zone ciblée (pas un repli sur un siège ailleurs) |

Une entreprise administrativement **cessée reçoit toujours 0**, sans
exception : c'est une porte, pas un critère pondérable parmi d'autres.

Les pondérations vivent dans `prospecting_score_weights` (modifiables sans
déploiement), mais **un changement de pondération ne rescore pas
rétroactivement** les prospects déjà notés — décision volontaire, pour éviter
une réévaluation de masse silencieuse à chaque ajustement de configuration.
Une reprise explicite resterait une action délibérée, hors périmètre de
cette phase.

**Recalcul** : déclenché uniquement quand une donnée qui participe
réellement au score change (`created_on`, `statut_administratif`,
`sector_id`, `departement`, `zone_id`) — jamais sur une note, une priorité
manuelle, un statut commercial ou une assignation. Le trigger compare même
l'ancienne et la nouvelle valeur avant de recalculer, pour ne pas refaire le
travail lors d'une resynchronisation qui réécrit ces colonnes sans qu'elles
changent réellement.

`score_reasons` ne contient jamais un critère qui ne s'applique pas
réellement : un prospect sans secteur reconnu n'a pas de ligne
« secteur_pertinence » à 0, il n'en a simplement pas.

## Conversion prospect → essai → client (Phase 9, `20260923090000`)

« Passer en essai » est un simple changement de statut (`essai`), sans lien
particulier. « Convertir en client » (§22) est plus exigeant :

- **Relie le prospect à une VRAIE organisation REZO360**, jamais devinée :
  l'administrateur la choisit explicitement dans une recherche
  (`prospecting_search_organizations`, RPC `SECURITY DEFINER` gardée par
  `prospecting.manage` — `organizations` est une table tenant, invisible en
  lecture directe à un administrateur plateforme qui n'est membre d'aucune
  organisation cliente).
- **Ne crée jamais de doublon** : un index unique
  (`prospects_converted_organization_unique_idx`) empêche en base qu'une
  organisation soit liée à deux prospects — pas seulement une vérification
  applicative.
- **Arrête les relances commerciales en attente** : `convert_prospect_to_client`
  marque `completed_at` sur les `prospect_followups` encore ouverts du
  prospect, dans la même transaction que le changement de statut — un échec
  à mi-chemin ne peut jamais laisser un prospect « converti » avec des
  relances actives.
- **Conserve historique, source et score initial** sans code spécifique :
  la conversion ne touche ni `first_detected_at`, ni `source`, ni
  `score_reasons`, et le trigger de la Phase 2 prend un instantané du score
  à la transition `converti`, comme aux autres transitions majeures.

Un prospect converti ne montre plus les actions de statut « ordinaires »
(refuser, ignorer…) sur son écran — sa relation commerciale se gère
désormais dans son organisation REZO360, pas dans Prospect Radar.

## CRON quotidien et notification agrégée (Phase 10, `20260924090000`)

- **05:00 UTC**, validé explicitement par l'utilisateur, sans conflit avec
  les CRON existants (vérifié avant application).
- **Pagination incrémentale** : l'API Recherche d'Entreprises n'offre ni
  filtre ni tri par date (§ Phase 3-4). Sans curseur, un passage quotidien
  relirait indéfiniment la même première page. `prospecting_sync_cursors`
  retient, par zone × secteur, la prochaine page à lire ; le worker avance
  d'une page à chaque passage réussi et revient à la page 1 une fois la fin
  des résultats atteinte. Un run en échec (ex. limite de débit de l'API)
  laisse les curseurs intacts — vérifié en conditions réelles (deux passages
  consécutifs : 1→2, puis un 429 qui n'a PAS avancé les curseurs).
- **Notification interne** (§27) : un e-mail agrégé (🔥/🟠/🔵 + répartition
  géographique) part au même destinataire que les alertes d'inscription
  (`ADMIN_SIGNUP_EMAIL`, actuellement `contact@rezo360.fr` — jamais un
  second secret qui risquerait de diverger). Envoyé UNIQUEMENT si :
  - `notify: true` dans le corps de la requête — posé exclusivement par
    `app.trigger_prospecting_worker()`, jamais par un appel manuel de test ;
  - au moins un prospect a été **créé** (une simple mise à jour ne compte
    jamais) — « éviter les notifications inutiles ».
  Un échec d'envoi (transport non configuré, panne du fournisseur) ne fait
  jamais échouer le run de détection lui-même — best-effort, comme le reste
  de ce module qui n'envoie jamais rien automatiquement à un tiers.
