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
