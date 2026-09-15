# Relances automatiques des devis

Un devis envoyé au client depuis REZO360 et resté sans réponse est relancé
**automatiquement, dans le même fil**, à J+7 puis J+14 (cadence réglable par
entreprise), jamais après sa date de validité. Passée cette date sans réponse,
il passe en « Expiré ».

Décisions prises le 15/09/2026 : relance **au client** (pas seulement un rappel
interne), cadence par défaut **7 et 14 jours**, **expiration automatique**.

## Ce qui déclenche une relance, et ce qui l'arrête

| Une relance part si… | Elle ne part pas (motif visible sur la fiche devis) si… |
|---|---|
| le devis est `sent` depuis REZO360 (bouton « Envoyer au client » → conversation du portail liée au devis) | « Marquer comme envoyé » à la main, sans conversation |
| `sent_at` est posé (devis envoyé après cette fonctionnalité) | devis envoyé avant : jamais relancé, plutôt que relancé en rafale pour des envois anciens |
| l'échéance tombe **avant** `valid_until` | validité atteinte |
| le client n'a rien écrit dans le fil depuis l'envoi | le client a répondu (même sans accepter ni refuser) |
| `reminders_enabled` (interrupteur sur la fiche devis) | désactivé sur ce devis, ou cadence vide côté entreprise |
| le portail de l'entreprise est activé, la conversation ouverte | portail désactivé, conversation close |
| statut toujours `sent` | accepté, refusé, expiré, repassé en brouillon — les relances restantes sont « passées » avec ce motif |

Un devis **renvoyé** (brouillon → envoyé une seconde fois) repart de zéro ; les
relances de l'envoi précédent restent dans l'historique.

## Architecture

```
quotes (status → 'sent')
  → trigger app.stamp_quote_sent_at           (pose sent_at)
  → trigger app.plan_quote_reminders          (une ligne quote_reminders par échéance)
  → pg_cron */15 → app.trigger_quote_reminder_worker → net.http_post
  → quote-reminder-worker
      → claim_quote_reminders() (SKIP LOCKED)
      → revérifie l'état du devis (decideReminder)
      → INSERT client_messages (outbound, au nom de l'entreprise, service_role)
      → _shared/portal-outbound.ts : même courriel que « Envoyer au client »
        (Re:, In-Reply-To, References, adresse de réponse signée, Resend)
      → quote_reminders.status = sent | skipped | failed (+ motif)

quotes (valid_until dépassée)
  → pg_cron 04:15 UTC → app.expire_overdue_quotes() → status = 'expired'
  → trigger plan_quote_reminders passe les relances restantes
```

Le trigger n'envoie rien ; le worker n'invente rien. Une panne Resend replanifie
la relance (30 s, 1 min, 2 min… plafond 1 h, cinq essais) en **renvoyant le
même message** — pas de doublon dans le fil du client. Au cinquième échec, la
relance est abandonnée avec son motif.

## Réglages

- **Entreprise** : Paramètres → Devis → « Relances automatiques (jours après
  l'envoi) », saisie `7, 14`. Vide = aucune relance. Cinq échéances au plus,
  entre 1 et 365 jours (contrainte en base).
- **Devis** : fiche du devis → bloc « Relances automatiques » → interrupteur
  « Relancer ce client », historique et prochaine échéance.

## Secrets et Vault

Le worker réutilise **tout** ce que la messagerie du portail a déjà :
`RESEND_API_KEY`, `PORTAL_FROM_EMAIL`, `PORTAL_REPLY_SECRET`,
`PORTAL_INBOUND_DOMAIN`, `APP_URL`, `SUPPORT_TIMEZONE`. Un seul secret neuf :

```
supabase secrets set QUOTE_REMINDER_WORKER_SECRET=<chaîne aléatoire longue>
```

puis, une fois, dans le SQL Editor :

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/quote-reminder-worker', 'quote_reminder_worker_url');
select vault.create_secret('<LA MÊME VALEUR que QUOTE_REMINDER_WORKER_SECRET>', 'quote_reminder_worker_secret');
```

Sans Vault, `app.trigger_quote_reminder_worker` se tait (`raise notice`) ; les
relances restent planifiées et partiront dès la configuration posée.

## Déployer

```
npx supabase db push --linked
npx supabase functions deploy quote-reminder-worker --no-verify-jwt
npx supabase functions deploy portal-message-send            # extraction partagée
```

## Vérifier

```sql
-- Relances d'un devis
select sequence, status, due_at, sent_at, reason, attempts
from public.quote_reminders where quote_id = '<id>' order by created_at, sequence;

-- Tout ce qui est dû et pas encore parti
select q.reference, r.sequence, r.due_at, r.attempts, r.reason
from public.quote_reminders r join public.quotes q on q.id = r.quote_id
where r.status = 'pending' and r.due_at <= now() order by r.due_at;

-- Le message envoyé (et son suivi Resend) pour une relance
select m.status, m.sent_at, m.delivered_at, m.error
from public.quote_reminders r join public.client_messages m on m.id = r.message_id
where r.id = '<id>';
```

Journaux : dashboard → Edge Functions → `quote-reminder-worker` → Logs, ou
`npx supabase functions logs quote-reminder-worker`.

## Tests

- `supabase/functions/_shared/quote-reminders.test.ts` — décision (chaque motif
  de refus), texte de la relance, montants, courbe de reprise.
- `supabase/functions/quote-reminder-worker/handler.test.ts` — secret, fil
  (`Re:`, `In-Reply-To`, adresse de réponse), passage motivé, panne fournisseur,
  reprise sans doublon, abandon au 5e échec, réponse sans donnée sensible.
- `supabase/functions/portal-message-send/handler.test.ts` — inchangée après
  l'extraction de `_shared/portal-outbound.ts`.
- `supabase/tests/10_relances_devis.sql` — planification, validité, cadence,
  arrêt (accepté / désactivé), renvoi, expiration, tirage atomique.
- `src/features/organizations/schemas/organization.reminders.test.ts` —
  saisie de la cadence.
