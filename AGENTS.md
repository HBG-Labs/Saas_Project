# REZO360 — règles de contribution

## Migrations Supabase

**Une migration déjà commitée ou appliquée est immuable.** Toute évolution du
schéma passe par un nouveau fichier horodaté. Ne jamais retoucher une migration
existante — pas même pour corriger une coquille, renommer un objet ou nettoyer
l'historique.

`supabase db push` ne rejoue jamais une version déjà appliquée. Modifier un
fichier déjà passé ne change donc pas la base : cela fait seulement diverger le
dépôt du schéma réel, en silence.

Détail et cas vécu : [`supabase/README.md`](supabase/README.md).
