import { EDITEUR } from '@/config/legal';
import { PRICING_PLANS } from '@/config/pricing';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Conditions générales de vente et d'utilisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA GRILLE N'EST PAS RECOPIÉE, ELLE EST LUE
 *
 * Les prix viennent de `config/pricing.ts` — la même source que la page Tarifs
 * et que le calcul serveur. Les écrire à la main ici garantirait qu'un
 * changement de tarif en laisse une version périmée dans un document
 * contractuel, c'est-à-dire opposable.
 *
 * CE QUE CE TEXTE DÉCRIT EST CE QUE LE CODE FAIT
 *
 * Essai de quatorze jours sans carte, reprise du reliquat à la souscription,
 * prélèvement au prorata des sièges supplémentaires sur la facture suivante,
 * résiliation prenant effet en fin de période, retour à la formule Gratuite
 * sans suppression des données. Chacune de ces phrases correspond à un
 * comportement éprouvé, non à une intention.
 *
 * ⚠️ Rédigé par un ingénieur d'après le fonctionnement réel du produit, non par
 * un juriste. À relire avant l'ouverture commerciale.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function TermsPage() {
  useDocumentTitle('Conditions générales');

  const payants = PRICING_PLANS.filter((p) => p.id !== 'free');
  const supplement = payants[0]?.additionalUserPriceMonthly ?? 5;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        Conditions générales de vente et d’utilisation
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Ce que vous souscrivez, ce que nous devons, et comment on se sépare.
      </p>

      <Section titre="1. Objet">
        <p className="text-muted-foreground text-sm leading-relaxed">
          REZO360 est un service en ligne de gestion d’interventions destiné aux entreprises
          techniques : missions, clients, équipes, comptes rendus, parc matériel et outils de
          calcul. L’accès se fait par abonnement mensuel, sans engagement de durée.
        </p>
      </Section>

      <Section titre="2. Période d’essai">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Toute entreprise nouvellement créée bénéficie de{' '}
          <strong className="text-foreground">quatorze jours d’essai</strong>, sans carte bancaire
          et sans engagement. Aucun prélèvement n’intervient pendant cette période.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Souscrire pendant l’essai ne l’interrompt pas : les jours restants sont conservés, et le
          premier prélèvement a lieu à la date initialement annoncée. À défaut de souscription,
          l’accès bascule sur la formule Gratuite à l’échéance —{' '}
          <strong className="text-foreground">sans suppression des données</strong>, qui
          redeviennent visibles dès la souscription.
        </p>
      </Section>

      <Section titre="3. Formules et prix">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Prix en euros, hors taxes le cas échéant, par mois :
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left text-sm">
            <thead>
              <tr className="text-subtle-foreground text-xs">
                <th className="py-2 pr-3 font-medium">Formule</th>
                <th className="py-2 pr-3 font-medium">Prix mensuel</th>
                <th className="py-2 font-medium">Comptes inclus</th>
              </tr>
            </thead>
            <tbody>
              {payants.map((plan) => (
                <tr key={plan.id} className="border-border border-t">
                  <td className="text-foreground py-2 pr-3 font-medium">{plan.name}</td>
                  <td className="text-muted-foreground py-2 pr-3">{plan.priceMonthly} €</td>
                  <td className="text-muted-foreground py-2">{plan.includedUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Au-delà des comptes inclus, chaque compte actif supplémentaire est facturé{' '}
          <strong className="text-foreground">{supplement} € par mois</strong>. Un compte devient
          facturable lorsqu’il est <strong className="text-foreground">actif</strong> : une
          invitation en attente ne coûte rien.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Un ajout ou un retrait en cours de mois est calculé au prorata et porté sur la facture
          suivante. Aucun prélèvement immédiat n’est déclenché par un changement d’effectif.
        </p>
      </Section>

      <Section titre="4. Paiement">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Les paiements sont traités par Stripe. REZO360 ne conserve aucune donnée de carte
          bancaire : elles ne transitent jamais par nos serveurs. Les factures sont accessibles
          depuis le portail de facturation.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          En cas d’échec de prélèvement, l’accès est maintenu le temps que la situation soit
          régularisée — une équipe en intervention ne doit pas être bloquée par un incident de
          carte. Des relances sont émises par Stripe ; à défaut de régularisation, l’abonnement
          prend fin à l’échéance de la période en cours.
        </p>
      </Section>

      <Section titre="5. Résiliation">
        <p className="text-muted-foreground text-sm leading-relaxed">
          La résiliation s’effectue à tout moment depuis l’écran de facturation, sans préavis ni
          frais. Elle prend effet{' '}
          <strong className="text-foreground">à la fin de la période déjà payée</strong> : l’accès
          reste entier jusque-là, et la décision peut être annulée d’ici cette date.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Passée l’échéance, l’entreprise revient à la formule Gratuite. Ses données sont
          conservées et redeviennent accessibles à toute nouvelle souscription. Leur suppression
          définitive se demande par écrit.
        </p>
      </Section>

      <Section titre="6. Disponibilité">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Le service est fourni sans engagement contractuel de disponibilité. Des interruptions
          peuvent survenir pour maintenance ou du fait de nos hébergeurs. Nous nous efforçons de
          les réduire et d’en informer, sans que cela constitue une obligation de résultat.
        </p>
      </Section>

      <Section titre="7. Responsabilité">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Le client demeure responsable de l’exactitude des données qu’il saisit, du respect de ses
          propres obligations envers ses clients, et de la confidentialité de ses identifiants.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Les calculs et abaques proposés par les outils techniques sont fournis à titre d’aide.
          Ils ne se substituent ni aux normes applicables ni au jugement d’un professionnel
          qualifié, et n’engagent pas la responsabilité de l’éditeur.
        </p>
      </Section>

      <Section titre="8. Données">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Les données saisies appartiennent au client. Leur traitement est décrit dans la politique
          de confidentialité, qui fait partie intégrante des présentes conditions.
        </p>
      </Section>

      <Section titre="9. Modification et droit applicable">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Toute modification des présentes conditions est portée à la connaissance des clients avant
          son entrée en vigueur. Le droit français s’applique. À défaut de résolution amiable, les
          tribunaux compétents sont ceux du siège de l’éditeur.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Toute question :{' '}
          <a href={`mailto:${EDITEUR.email}`} className="text-primary hover:underline">
            {EDITEUR.email}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-foreground text-lg font-semibold">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
