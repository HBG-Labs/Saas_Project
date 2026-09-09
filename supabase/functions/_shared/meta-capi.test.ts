import assert from 'node:assert/strict';

import { assainirIdentifiantMeta, conversionADeclarer } from './meta-capi.ts';

/*
  Ces tests tournent SANS permission Deno — ni réseau, ni disque, ni variables
  d'environnement. Ils ne portent donc que sur les deux fonctions pures du
  module, ce qui est précisément là où se logent les défauts coûteux :
  l'une décide si une vente est comptée, l'autre filtre une donnée venue du
  navigateur avant qu'elle ne parte chez Stripe puis chez Meta.
*/

Deno.test('un essai qui commence est déclaré une seule fois', () => {
  assert.equal(conversionADeclarer(null, 'trialing'), 'StartTrial');

  // Rejeu, renouvellement, changement de carte : l'abonnement était déjà en
  // essai, rien de nouveau ne s'est produit.
  assert.equal(conversionADeclarer('trialing', 'trialing'), null);
});

Deno.test('un essai qui se transforme en abonnement est une vente', () => {
  assert.equal(conversionADeclarer('trialing', 'active'), 'Purchase');
});

Deno.test('un abonnement direct, sans essai, est une vente', () => {
  assert.equal(conversionADeclarer(null, 'active'), 'Purchase');
  assert.equal(conversionADeclarer('incomplete', 'active'), 'Purchase');
});

Deno.test('un impayé régularisé n’est PAS une seconde vente', () => {
  /*
    LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER.

    Un abonnement vivant traverse `active` → `past_due` → `active` à chaque
    carte expirée, chaque plafond atteint, chaque refus temporaire de banque.
    Compter ce retour comme une vente ferait grossir le chiffre remonté à Meta
    à proportion du nombre d'incidents de paiement — donc à proportion de la
    taille du portefeuille.

    L'erreur serait invisible : le total resterait plausible, simplement faux,
    et fausserait l'arbitrage entre campagnes.
  */
  assert.equal(conversionADeclarer('past_due', 'active'), null);
});

Deno.test('un abonnement déjà actif ne redéclare rien', () => {
  assert.equal(conversionADeclarer('active', 'active'), null);
});

Deno.test('une résiliation ne déclare aucune conversion', () => {
  assert.equal(conversionADeclarer('active', 'canceled'), null);
  assert.equal(conversionADeclarer('trialing', 'canceled'), null);
  assert.equal(conversionADeclarer('active', 'past_due'), null);
  assert.equal(conversionADeclarer('active', 'expired'), null);
});

Deno.test('un essai repris après résiliation compte à nouveau', () => {
  // L'organisation était partie, elle revient : c'est bien un nouvel essai.
  assert.equal(conversionADeclarer('canceled', 'trialing'), 'StartTrial');
});

Deno.test('un identifiant d’attribution au format attendu passe', () => {
  assert.equal(
    assainirIdentifiantMeta('fb.1.1700000000000.AbCdEf_12-34'),
    'fb.1.1700000000000.AbCdEf_12-34',
  );
  assert.equal(assainirIdentifiantMeta('  fb.1.170.xyz  '), 'fb.1.170.xyz');
});

Deno.test('tout ce qui sort du format est écarté, jamais corrigé', () => {
  /*
    Ces valeurs viennent de `document.cookie`, donc du client : rien ne garantit
    qu'elles soient ce que le pixel y avait écrit. Elles finissent en
    métadonnées Stripe puis dans un appel sortant vers Meta.

    Écarter plutôt que nettoyer : une valeur à demi corrigée n'apparierait rien
    chez Meta tout en donnant l'illusion d'un signal.
  */
  assert.equal(assainirIdentifiantMeta(''), null);
  assert.equal(assainirIdentifiantMeta('   '), null);
  assert.equal(assainirIdentifiantMeta(null), null);
  assert.equal(assainirIdentifiantMeta(undefined), null);
  assert.equal(assainirIdentifiantMeta(42), null);
  assert.equal(assainirIdentifiantMeta({ fbp: 'x' }), null);

  // Injections plausibles : séparateur de métadonnées, saut de ligne, balise.
  assert.equal(assainirIdentifiantMeta('fb.1.170.abc&evil=1'), null);
  assert.equal(assainirIdentifiantMeta('fb.1.170\nabc'), null);
  assert.equal(assainirIdentifiantMeta('<script>alert(1)</script>'), null);

  // Au-delà de 255 caractères, bien avant la limite de 500 de Stripe.
  assert.equal(assainirIdentifiantMeta('a'.repeat(256)), null);
  assert.equal(assainirIdentifiantMeta('a'.repeat(255)), 'a'.repeat(255));
});
