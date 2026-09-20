# Notifications actives — affectation, congé, compte rendu

Migration `20261004090000_notifications_actives.sql`, fonction Edge
`notification-worker`. Arbitrages A–G du 20/09/2026.

## Ce que ça fait

Trois familles d'événements enfilent un e-mail :

| Événement | Destinataires | Réglage |
|---|---|---|
| Mission affectée / réaffectée | le technicien affecté | `notify_new_mission` |
| Congé demandé | qui porte `leave.approve` (sauf le demandeur) | `notify_leave_requests` |
| Congé accordé / refusé | le demandeur | `notify_leave_requests` |
| Compte rendu soumis | qui porte `intervention.review` (sauf le technicien) | `notify_report_review` |
| Compte rendu renvoyé | le technicien | `notify_report_review` |

L'acteur de l'événement n'est jamais destinataire. Le réglage est lu **à
l'envoi**. Une seule ligne en attente par (destinataire, événement, entité) :
réaffecter trois fois n'envoie qu'une fois.

## Architecture

```
missions / leave_requests / intervention_reports (triggers AFTER)
  → app.enqueue_notification()                 [migration]
  → public.notification_deliveries             (file d'attente, service_role seul)
  → pg_cron, chaque minute, SEULEMENT s'il y a du travail
  → app.trigger_notification_worker()          [migration, via Vault]
  → net.http_post
  → notification-worker                        [Edge Function]
      → claim_notification_deliveries()        (SKIP LOCKED, joint adresse + réglages)
      → e-mail (transport existant : Resend ou SMTP, INVITATION_FROM_EMAIL)
      → record_notification_delivery_result()  (recul 2, 4, 8… min ; abandon au 8e échec)
```

## Mise en service

1. Secret de la fonction :
   ```
   supabase secrets set NOTIFICATION_WORKER_SECRET=<valeur longue aléatoire>
   ```
   `APP_URL` (déjà posé pour les alertes admin) sert au lien profond ;
   `SUPPORT_TIMEZONE` au format des heures.
2. Déployer : `supabase functions deploy notification-worker`.
3. Vault, une fois, dans le SQL Editor :
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notification-worker', 'notification_worker_url');
   select vault.create_secret('<même valeur que NOTIFICATION_WORKER_SECRET>', 'notification_worker_secret');
   ```
   Sans ces deux secrets, le planificateur se tait (`raise notice`) et la file
   attend : rien n'est perdu, rien ne part.

## Vérifier

- `select * from notification_worker_runs order by ran_at desc limit 5;` — le
  battement de cœur (uniquement quand il y avait du travail).
- `select event, status, count(*) from notification_deliveries group by 1, 2;`
- Une ligne `failed` porte `last_error`.

## Ce que ça ne fait pas

Pas de push (décision du 15/09), pas de SMS (aucun expéditeur), pas de suivi
d'ouverture, pas d'historique visible par la personne, pas de digest.
