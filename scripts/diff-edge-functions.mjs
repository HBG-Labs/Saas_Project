#!/usr/bin/env node
/**
 * Vérifie que le code DÉPLOYÉ de chaque edge function contient bien ce que le
 * dépôt dit qu'il devrait contenir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE SCRIPT EXISTE POUR ATTRAPER
 *
 * Une fonction Edge se déploie une par une, et rien ne signale un écart avec le
 * dépôt : `functions list` affiche un numéro de version qui s'incrémente même
 * sans changement de code, et un `updated_at` qu'il faut penser à lire.
 *
 * Le 03/09, `create-checkout-session` tournait dans une version antérieure de
 * six jours, dépourvue de la branche accordant 14 jours d'essai. Un client a
 * donc été débité immédiatement, alors que la page Tarifs, la FAQ, la page
 * d'inscription ET les CGU promettent « quatorze jours d'essai ». Le défaut
 * n'est apparu qu'au premier paiement réel.
 *
 * COMMENT LA COMPARAISON EST FAITE, ET POURQUOI PAS AUTREMENT
 *
 * L'API ne rend pas la source déployée mais le bundle eszip — sept méga-octets
 * incluant les dépendances. Le comparer ligne à ligne au fichier du dépôt n'a
 * aucun sens : tout diffère.
 *
 * En revanche la source y figure, et les LITTÉRAUX DE CHAÎNE y survivent
 * intacts. On extrait donc du fichier local ses chaînes distinctives et on
 * vérifie leur présence dans le bundle. Les noms de variables sont écartés :
 * un bundler peut les renommer, leur absence ne prouverait rien.
 *
 * Ce contrôle est asymétrique et l'assume : il détecte qu'il MANQUE au déployé
 * quelque chose que le dépôt contient. C'est le sens qui compte — on veut
 * savoir si ce qui tourne est en retard.
 *
 * LECTURE SEULE. Il ne déploie rien.
 *
 *     node scripts/diff-edge-functions.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const PROJET = 'wtsiaisfwtthmcxygeei';
const jeton = process.env.SUPABASE_ACCESS_TOKEN;

if (!jeton) {
  console.error('SUPABASE_ACCESS_TOKEN absent de l’environnement.');
  process.exit(1);
}

const racine = path.join(process.cwd(), 'supabase', 'functions');
const slugs = readdirSync(racine, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .sort();

/**
 * Les chaînes du fichier local qui servent de témoins.
 *
 * LES LIGNES DE COMMENTAIRE SONT RETIRÉES D'ABORD, et ce n'est pas un détail.
 *
 * Le bundler supprime les commentaires : leur absence du déployé est normale et
 * ne prouve rien. Pire, en français, les apostrophes de la prose — « l'accès »,
 * « qu'il », « aujourd'hui » — forment des paires que l'extracteur prend pour
 * des littéraux. Une première version signalait ainsi `create-member` et
 * `sync-subscription-seats` comme périmées sur la seule foi de fragments de
 * commentaires, alors que leur code était à jour.
 *
 * Écartées aussi : les chaînes portant une interpolation `${...}` — le bundle
 * n'en contient que les morceaux — et les trop courtes, qui apparaîtraient par
 * hasard dans sept méga-octets de dépendances.
 */
function temoins(source) {
  const code = source
    .split('\n')
    .filter((ligne) => {
      const t = ligne.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

  const trouves = new Set();
  for (const m of code.matchAll(/'([^'\\\n]{16,})'|"([^"\\\n]{16,})"/g)) {
    const valeur = m[1] ?? m[2];
    if (valeur && !valeur.includes('${')) trouves.add(valeur);
  }
  return [...trouves];
}

let perimees = 0;

console.log(`${slugs.length} fonctions à vérifier.\n`);

for (const slug of slugs) {
  const local = path.join(racine, slug, 'index.ts');
  if (!existsSync(local)) continue;

  const reponse = await fetch(
    `https://api.supabase.com/v1/projects/${PROJET}/functions/${slug}/body`,
    { headers: { Authorization: `Bearer ${jeton}` } },
  );

  if (!reponse.ok) {
    console.log(`  ABSENT ${slug.padEnd(30)} non déployée (HTTP ${reponse.status})`);
    perimees += 1;
    continue;
  }

  const bundle = await reponse.text();
  const attendus = temoins(readFileSync(local, 'utf8'));
  const manquants = attendus.filter((t) => !bundle.includes(t));

  if (manquants.length === 0) {
    console.log(`  OK     ${slug.padEnd(30)} ${attendus.length} témoins retrouvés`);
    continue;
  }

  perimees += 1;
  console.log(
    `  RETARD ${slug.padEnd(30)} ${manquants.length}/${attendus.length} témoins absents du déployé`,
  );
  for (const t of manquants.slice(0, 4)) {
    console.log(`           « ${t.length > 62 ? t.slice(0, 62) + '…' : t} »`);
  }
  if (manquants.length > 4) console.log(`           … et ${manquants.length - 4} autre(s)`);
}

console.log('');
if (perimees === 0) {
  console.log('Tout ce qui tourne contient bien ce que le dépôt décrit.');
} else {
  console.log(`${perimees} fonction(s) en retard sur le dépôt. À redéployer :`);
  console.log('  npx supabase functions deploy <slug>');
  process.exitCode = 1;
}
