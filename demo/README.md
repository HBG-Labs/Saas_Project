# Démo commerciale REZO360

Ce dossier est séparé de `e2e/`. Il enregistre un parcours commercial de 60 à
90 secondes depuis l'interface réelle, en 1920×1080, puis produit un MP4 H.264.

## Garde-fous

- URL applicative locale uniquement (`localhost` ou `127.0.0.1`).
- Projet Supabase autorisé : le staging déclaré dans `constants.json`.
- Le project ref principal est explicitement refusé.
- Authentification réalisée dans un contexte sans vidéo ; aucun `storageState`
  n'est écrit sur disque.
- Pendant l'enregistrement, seuls les GET/HEAD/OPTIONS, les RPC de lecture
  listés dans `helpers/safety.ts` et les signatures Storage des photos sont
  autorisés.
- `portal_touch_last_seen` est neutralisé. Toute autre écriture, fonction Edge
  ou requête vers un hôte externe fait échouer la démo.
- Aucun bouton de création, d'envoi, de paiement, de GPS, de chronomètre,
  d'upload ou de téléchargement n'est utilisé.

## Configuration locale

Créer `.env.demo.local` à partir de la section « Démo commerciale Playwright »
de `.env.example`, puis remplacer les valeurs factices. Pour ce scénario,
`DEMO_EMAIL` doit être l'adresse métier validée pendant l'audit.

Variables nécessaires à l'enregistrement :

- `DEMO_BASE_URL`
- `DEMO_EMAIL` et `DEMO_PASSWORD`
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` du staging
- `VITE_APP_ENV=staging`
- éventuellement `DEMO_PORTAL_EMAIL` et `DEMO_PORTAL_PASSWORD`

La préparation initiale nécessite en plus `DEMO_DATABASE_URL`,
`DEMO_SUPABASE_SERVICE_ROLE_KEY` et la confirmation littérale documentée dans
`.env.example`. Ces secrets restent dans `.env.demo.local`, ignoré par Git.

## Commandes

Préparer une branche staging fraîche, une seule fois :

```powershell
npm run demo:prepare
```

Cette commande annonce sa cible et ses mutations avant toute écriture. Elle
crée uniquement le tenant fictif, quatre comptes Auth de démonstration, les
données métier et les objets Storage nécessaires. Elle refuse de remplacer un
tenant ou un compte existant.

Enregistrer la vidéo :

```powershell
npm run demo:record
```

Le résultat final est `demo-output/rezo360-demo.mp4`. Les WebM bruts restent
dans `demo-output/raw/` pour faciliter un diagnostic. Le script vérifie avec
FFprobe que le MP4 mesure 1920×1080 et dure entre 60 et 90 secondes.

Le seed SQL est un fixture staging, pas une migration. Il ne doit jamais être
déplacé dans `supabase/migrations/`.
