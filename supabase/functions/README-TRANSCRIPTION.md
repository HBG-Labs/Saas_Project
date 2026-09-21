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

## Architecture

```
navigateur : ligne workspace_recordings (uploading) → fichier dans workspace-audio → submit (pending)
  → pg_cron chaque minute, seulement s'il y a du travail
  → app.trigger_transcription_worker()          [Vault]
  → transcription-worker                        [Edge]
      → claim_workspace_recordings()            (SKIP LOCKED)
      → reserve_transcription_minutes()         (atomique ; « quota » si épuisé)
      → OpenAI transcription, puis résumé (reserve_ai_usage 'workspace')
      → record_workspace_recording_result()     (écrit dans la page ; recul 2/4/8… min, abandon au 6e échec)
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
