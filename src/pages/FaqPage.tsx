import { ChevronDown, MessageSquare } from 'lucide-react';
import { Accordion } from 'radix-ui';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { PRICING_PLANS } from '@/config/pricing';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * La phrase des tarifs, CONSTRUITE À PARTIR DE LA SOURCE UNIQUE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CETTE PAGE ANNONÇAIT DES PRIX FAUX
 *
 * Elle promettait « la formule Pro (14,99 €/mois ou 149 €/an) » et « une
 * formule Équipe (39,99 €/mois/utilisateur) ». Pro coûte 39 €, et aucune
 * formule Équipe n'existe. Une page publique qui affiche un tarif engage
 * commercialement : un visiteur peut la capturer et s'en prévaloir.
 *
 * La cause n'est pas l'inattention, c'est la RECOPIE. Un prix écrit à la main
 * dans un texte ne suit pas la grille tarifaire quand elle bouge, et rien ne
 * signale l'écart — ni test, ni compilation, ni relecture.
 *
 * D'où cette fonction plutôt qu'une phrase figée : les montants viennent de
 * `PRICING_PLANS`, qui alimente déjà la page des tarifs et l'inscription.
 * Changer un prix à un seul endroit met désormais cette réponse à jour aussi.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function phraseDesFormules(): string {
  const gratuite = PRICING_PLANS.find((plan) => plan.priceMonthly === 0);
  const payantes = PRICING_PLANS.filter((plan) => plan.priceMonthly > 0);

  const detail = payantes
    .map(
      (plan) =>
        `${plan.name} à ${String(plan.priceMonthly)} €/mois (${String(plan.includedUsers)} utilisateurs inclus)`,
    )
    .join(', ');

  const supplement = payantes.find((plan) => plan.additionalUserPriceMonthly > 0);
  const phraseSupplement =
    supplement === undefined
      ? ''
      : ` Au-delà des utilisateurs inclus, chaque siège supplémentaire coûte ${String(supplement.additionalUserPriceMonthly)} €/mois.`;

  return (
    `La formule ${gratuite?.name ?? 'Gratuite'} est sans carte bancaire et sans limite de durée. ` +
    `Les formules payantes sont : ${detail}.${phraseSupplement} ` +
    'Toutes sont sans engagement et résiliables en deux clics depuis votre espace.'
  );
}

const FAQ_ITEMS = [
  {
    id: 'ce-que-ca-simplifie',
    question: 'Qu’est-ce que REZO360 peut réellement simplifier dans mon entreprise ?',
    answer:
      'REZO360 centralise votre activité au même endroit : clients, équipes, interventions, rapports, documents, outils métier et facturation. Moins d’outils dispersés, moins de tâches administratives, et plus de temps pour votre activité.',
  },
  {
    id: 'pour-qui',
    question: 'REZO360 est-il adapté à mon métier et à la taille de mon entreprise ?',
    answer:
      'Oui. REZO360 est conçu pour les indépendants, les TPE et les entreprises avec des équipes terrain, dans de nombreux métiers : BTP, électricité, plomberie, climatisation, réseaux, télécoms, espaces verts et bien d’autres.',
  },
  {
    id: 'mobile',
    question: 'Puis-je gérer mon activité directement depuis mon téléphone ?',
    answer:
      'Oui. REZO360 s’utilise sur ordinateur, tablette et smartphone, et s’installe sur votre écran d’accueil en un geste — sans passer par un magasin d’applications. Au bureau comme sur le terrain, vos équipes retrouvent les mêmes informations.',
  },
  {
    id: 'demarrage',
    question: 'Est-ce compliqué de commencer avec REZO360 ?',
    answer:
      'Non. Créez votre espace, ajoutez vos collaborateurs et vos clients, puis organisez votre première intervention. Rien à installer, rien à migrer le premier jour : vous commencez par une intervention, et vous voyez.',
  },
  {
    id: 'formules',
    question: 'Quelles sont les différentes formules et est-ce gratuit ?',
    answer: phraseDesFormules(),
  },
  {
    id: 'essai',
    question: 'Puis-je essayer REZO360 avant de m’engager ?',
    answer:
      // « Gratuit sans engagement » seul serait vrai mais incomplet, et
      // l'omission se paie à l'écran suivant : l'essai des formules payantes
      // réclame une carte. La carte n'est pas là par gourmandise — sans elle,
      // il suffit de changer d'adresse e-mail pour renouveler indéfiniment.
      'Oui, de deux façons. La formule Gratuite ne demande aucune carte bancaire et n’expire jamais. Les formules payantes ouvrent 14 jours d’essai : une carte est demandée pour vérification, rien n’est débité avant la fin de l’essai, et vous pouvez résilier à tout moment.',
  },
  {
    id: 'fonctionnalites',
    question: 'Quelles fonctionnalités sont disponibles ?',
    answer:
      'La gestion complète des interventions, le planning et l’affectation des équipes, le suivi du temps passé, les formulaires et checklists adaptés à chaque métier, les comptes rendus signés par le client, les devis et la facturation électronique, la gestion du stock, du matériel et des véhicules — ainsi qu’un catalogue d’outils techniques.',
  },
  {
    id: 'fiabilite-calculs',
    question: 'Les calculs des outils techniques sont-ils fiables ?',
    answer:
      'Oui. Chaque outil s’appuie sur les formules et normes officielles (NF C 15-100, UTE C 15-105, ITU-T, IEEE), et affiche la formule employée à côté du résultat pour que vous puissiez la vérifier. Les valeurs sont présentées en chiffres tabulaires, afin d’éviter toute erreur de lecture.',
  },
  {
    id: 'donnees',
    question: 'Comment mes données d’entreprise sont-elles protégées ?',
    answer:
      // Deux formulations à ne pas laisser revenir : « en Europe » (la base
      // tourne à Montréal) et « chiffré de bout en bout » (Supabase chiffre en
      // transit et au repos, mais peut lire la donnée). Voir le même
      // commentaire dans `components/marketing/Faq.tsx`.
      'Vos données sont hébergées au Canada, pays reconnu par la Commission européenne comme offrant un niveau de protection adéquat. Elles sont chiffrées en transit (TLS) et au repos (AES-256), et l’accès est strictement cloisonné par organisation au niveau de la base (PostgreSQL Row Level Security).',
  },
  {
    id: 'favoris-historique',
    question: 'Puis-je retrouver mes outils favoris et mes calculs précédents ?',
    answer:
      'Oui. L’étoile présente sur chaque outil l’ajoute à vos favoris, qui apparaissent sur votre tableau de bord. Et chaque calcul effectué en étant connecté est conservé avec sa date, ses valeurs d’entrée et son résultat — utile pour un procès-verbal de recette ou un compte rendu.',
  },
];

export default function FaqPage() {
  useDocumentTitle('FAQ');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Foire aux questions & Réponses"
        description="Ce que la plateforme change concrètement, à qui elle s’adresse, ce qu’elle coûte, et ce qu’il advient de vos données."
      />

      <div className="bg-surface/90 border-border/80 shadow-raised rounded-2xl border p-6 sm:p-8 backdrop-blur-md">
        <Accordion.Root type="single" defaultValue="ce-que-ca-simplifie" collapsible className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <Accordion.Item
              key={item.id}
              value={item.id}
              className="border-border/60 rounded-xl border px-4 py-1 transition-colors data-[state=open]:bg-surface-sunken/60"
            >
              <Accordion.Header className="flex">
                <Accordion.Trigger className="text-foreground hover:text-primary flex flex-1 items-center justify-between py-4 font-semibold text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                  <span>{item.question}</span>
                  <ChevronDown
                    className="text-subtle-foreground size-4 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                  />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content className="text-muted-foreground text-xs leading-relaxed pb-4 pt-1 border-t border-border/40 mt-1">
                {item.answer}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>

      {/* Support & Contact */}
      <div className="bg-surface-sunken border-border/60 mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 text-center sm:flex-row sm:text-left sm:p-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <h3 className="text-foreground font-semibold text-sm">Vous avez une question spécifique ?</h3>
            <p className="text-muted-foreground text-xs">
              Écrivez-nous : vous aurez une réponse d&apos;une personne qui connaît le produit.
            </p>
          </div>
        </div>

        <Button asChild size="sm">
          <a href="mailto:contact@rezo360.fr?subject=Question%20REZO360">Nous contacter par e-mail</a>
        </Button>
      </div>
    </div>
  );
}
