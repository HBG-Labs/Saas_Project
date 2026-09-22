# Enregistrements vocaux — transcription et résumé

Migration `20261005090000_enregistrements_vocaux.sql`, fonction Edge
`transcription-worker`. Arbitrages A–G du 20/09/2026.

## Ce que ça fait

Depuis une page du Workspace, une personne qui porte `ai.workspace` enregistre
(micro du navigateur), confirme que les participants sont informés, et dépose
l'audio. En tâche de fond, le worker transcrit (OpenAI `gpt-4o-transcribe`,
repli `whisper-1`), résume (points clés, décisions, actions) et **la base écrit
les deux dans la page** (blocs TipTap, révision prise). L'audio est effacé
après 30 jours ; le texte reste.

Quotas : la transcription consomme des **minutes** (`ai_transcription_minutes`
par formule : Starter 0, Pro 120, Business 600, Enterprise 3 000, Free sans
ligne) ; le résumé consomme **une requête IA** (`ai_assistant`).

Limite : 25 Mo et 60 minutes par enregistrement (limite de l'API ; le bucket
la porte). Le client enregistre en opus 48 kbit/s : une heure ≈ 20 Mo.

## Zéro perte audio (phase 2, 21/09/2026)

Côté client, `useAudioRecorder` (`src/features/workspace/hooks`) écrit chaque
tranche d'une seconde dans IndexedDB (`rezo360-audio`) avant tout envoi,
puis envoie en trois pas idempotents — ligne serveur, fichier par TUS
(`tus-js-client`, tranches de 6 Mo, URL de reprise gardée localement),
`submit_workspace_recording` — et ne vide le local qu'après la soumission
acceptée. Une capture retrouvée après fermeture est proposée « interrompue »
avec ce qui a été capté ; le retour du réseau relance ce qui attend. Sans
IndexedDB (navigation privée), la capture fonctionne en mémoire et l'écran
le dit. Le composant `WorkspaceRecorder` n'enregistre rien lui-même.

## Le moteur par organisation (phase 5)

`organizations.stt_engine` choisit la chaîne :

| Flag | Chaîne | Contexte transmis à OpenAI |
|---|---|---|
| `legacy` (défaut) | `gpt-4o-transcribe` → `whisper-1` | aucun |
| `v2` | `gpt-transcribe` (`languages: ['fr']`) → `gpt-4o-transcribe` → `whisper-1` (contexte coupé à 224 tokens) | une phrase de contexte : le glossaire du **secteur** de l'organisation (`_shared/stt-glossary.ts`, termes publics), puis — phase 6 — son dictionnaire (noms de clients, sites, techniciens qu'elle a choisis) |

Le modèle qui a répondu est consigné dans `workspace_recordings.engine`.
Basculer une organisation : `update organizations set stt_engine = 'v2' where id = …` ;
revenir : `'legacy'`. Aucun déploiement.

Ce qui part chez OpenAI en v2, en plus de l'audio : la phrase de contexte
(≤ 1 500 caractères) — en tête, le **dictionnaire de l'organisation**
(`organization_vocabulary` : noms de clients, sites, techniciens, communes,
matériel, termes techniques qu'elle a choisis, 150 au plus, les plus
spécifiques d'abord), puis le glossaire de son secteur. Elle n'est jamais
journalisée. Le dictionnaire se gère avec `workspace.manage` ; la suggestion
(`suggest_organization_vocabulary`) propose des noms déjà présents dans les
données de l'organisation, rien n'entre sans un geste. RGPD : un terme, un
type, une source — pas d'adresse, pas de numéro ; isolé par organisation ;
supprimable. Ajouter un secteur au
glossaire de base = une entrée dans `GLOSSAIRE_PAR_SECTEUR`.

## La normalisation contrôlée (phase 7)

En v2 seulement. Après la transcription, avant le résumé, le texte passe par
`_shared/transcript-normalize.ts`. La règle : **jamais de reformulation**. La
passe ne sait faire qu'une chose — remplacer une forme par un terme connu
(dictionnaire de l'organisation, puis glossaire de son secteur) — en deux
couches :

| Couche | Ce qu'elle fait | Exemple | Modèle |
|---|---|---|---|
| `orthographe` | la graphie d'un terme connu : casse, accents, espaces, tirets | « caraibe telecom » → « Caraïbe Télécom », « pto » → « PTO », « 36 fo » → « 36FO » | aucun |
| `modele` | un mot mal entendu, remplacé par un terme connu **dans son seul passage** | « la photo est posée » → « la PTO est posée » (et pas « j'ai pris une photo ») | `gpt-5.6-luna`, qui **propose** `{contexte, de, vers}` ; le code n'applique que si `vers` est un terme connu, `contexte` un passage exact du texte, `de` ni un nombre ni déjà un terme, et proche de `vers` (distance d'édition ≤ moitié du terme, 2 au moins) |

Une majuscule de début de phrase sur un terme en minuscules reste. Une
réponse du modèle qui n'est pas le JSON attendu ne change rien. La couche
modèle fait partie de la transcription (couverte par les minutes réservées),
pas du quota de requêtes IA.

Ce qui est écrit (`record_workspace_recording_result`, `p_raw`,
`p_normalization`) : `transcript_raw` = la sortie du moteur, immuable ;
`transcript` = le texte normalisé ; `normalization_diff` = la liste des
remplacements `[{de, vers, occurrences, couche, contexte?}]` ;
`transcript_normalized_at`. **La liste rejouée sur le brut doit redonner le
texte** (`rejouer()`) — sinon la passe est jetée et le brut sert de texte,
sans trace. La page reçoit le texte normalisé. Un membre lit le brut et la
trace (`select`), n'en modifie aucun. Legacy : `transcript_raw = transcript`,
rien de marqué, comme avant.

Contester une correction : le brut est là, la trace dit quoi a changé et où.
Retirer le terme du dictionnaire suffit pour que la passe suivante ne le
refasse plus.

## Segments et résumé structuré (phase 8)

En v2 seulement. Le texte normalisé est découpé en **paragraphes numérotés**
(`_shared/transcript-segments.ts` : coupure sur les paragraphes existants,
puis entre phrases, ≤ 450 caractères, jamais au milieu d'une phrase) :
`segments = [{ id: 's1', start: null, end: null, speaker: null, text }]`.
Pas d'horodatage : les moteurs retenus n'en rendent pas, et on n'estime pas
des secondes au prorata des caractères — ce serait une information
inventée. La forme accueille `start`/`end`/`speaker` le jour où un moteur
les donne.

Le résumé (`_shared/structured-summary.ts`) reçoit ces paragraphes et rend
un JSON — `summary_json = { version: 1, points_cles, decisions, actions }`,
chaque élément avec ses **citations** (identifiants de segments). Le code ne
garde d'une citation que ce qui désigne un segment existant, borne le
nombre d'éléments (12 par section) et leur longueur (300 caractères) ; un
élément sans citation valable reste, visiblement « sans source ». Le
Markdown de la page (`summary`) est **dérivé** de ce JSON : « - Soudure —
Karim (jeudi) [§3] », où §3 est le 3ᵉ paragraphe de la transcription écrite
juste en dessous, un paragraphe par segment. Si le modèle ne rend pas la
forme attendue, repli sur le résumé libre (second appel, même réservation
IA) et `summary_json` reste null. Legacy : ni segments ni JSON, comme avant.

## Architecture

```
navigateur : ligne workspace_recordings (uploading) → fichier dans workspace-audio → submit (pending)
  → pg_cron chaque minute, seulement s'il y a du travail
  → app.trigger_transcription_worker()          [Vault]
  → transcription-worker                        [Edge]
      → claim_workspace_recordings()            (SKIP LOCKED)
      → reserve_transcription_minutes()         (atomique ; « quota » si épuisé)
      → OpenAI transcription
      → normalisation contrôlée (v2 : termes connus ; brut conservé, trace rejouable)
      → segments numérotés (v2) → résumé structuré cité, repli résumé libre (reserve_ai_usage 'workspace')
      → record_workspace_recording_result()     (brut, texte, trace, segments, résumé ; page paragraphe par segment ; recul 2/4/8… min, abandon au 6e échec)
      → claim_workspace_audio_purges() → Storage remove → mark_workspace_audio_deleted()
```

## Mise en service

1. `supabase secrets set TRANSCRIPTION_WORKER_SECRET=<valeur aléatoire>` —
   `OPENAI_API_KEY` est déjà posée.
2. `supabase functions deploy transcription-worker`.
3. Vault, une fois, dans le SQL Editor :
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/transcription-worker', 'transcription_worker_url');
   select vault.create_secret('<même valeur que TRANSCRIPTION_WORKER_SECRET>', 'transcription_worker_secret');
   ```

## Vérifier

- `select * from transcription_worker_runs order by ran_at desc limit 5;`
- `select status, count(*) from workspace_recordings group by 1;` — un `failed`
  porte `error`.
- `select * from transcription_quota_status('<org>');` (en tant que membre).

## RGPD

- `consent_confirmed_at` : la personne qui enregistre confirme que les
  participants sont informés. L'écran doit le rappeler avant chaque
  enregistrement.
- Audio conservé 30 jours, puis effacé par le worker. Transcription et résumé
  restent dans la page, comme n'importe quel texte de la page.
- L'audio et le texte transitent par OpenAI (sous-traitant). Phrase à porter
  dans la politique de confidentialité : « Les enregistrements vocaux réalisés
  dans le Workspace sont transcrits et résumés par un service tiers (OpenAI),
  puis supprimés de nos serveurs sous 30 jours ; la transcription reste dans
  la page où elle a été faite. »

## Ce que ça ne fait pas

Pas de diarisation (qui parle), pas de transcription en direct, pas de
traduction, pas d'enregistrement hors ligne.
