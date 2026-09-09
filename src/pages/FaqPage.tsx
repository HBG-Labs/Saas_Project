import { ChevronDown, MessageSquare } from 'lucide-react';
import { Accordion } from 'radix-ui';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * La phrase des tarifs, CONSTRUITE À PARTIR DE LA SOURCE UNIQUE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CETTE PAGE A ANNONCÉ DES PRIX FAUX
 *
 * Elle promettait « la formule Pro (14,99 €/mois ou 149 €/an) » et « une
 * formule Équipe (39,99 €/mois/utilisateur) ». Pro coûte 39 €, et aucune
 * formule Équipe n'existe. Une page publique qui affiche un tarif engage
 * commercialement : un visiteur peut la capturer et s'en prévaloir.
 *
 * La cause n'est pas l'inattention, c'est la RECOPIE. Un prix écrit à la main
 * dans un texte ne suit pas la grille quand elle bouge, et rien ne signale
 * l'écart — ni test, ni compilation, ni relecture.
 *
 * D'où cette fonction plutôt qu'une phrase figée : les montants viennent de
 * `PRICING_PLANS`, qui alimente déjà la page des tarifs et l'inscription.
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

interface FaqEntree {
  id: string;
  question: string;
  answer: string;
}

interface FaqGroupe {
  titre: string;
  entrees: FaqEntree[];
}

/**
 * Vingt-six questions, groupées par intention.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI A ÉTÉ RECTIFIÉ DANS LA RÉDACTION FOURNIE
 *
 * Trois affirmations ont été vérifiées contre le produit réel avant d'être
 * publiées. Deux ont tenu, deux ont dû changer.
 *
 * VÉRIFIÉ ET CONSERVÉ — « l'assistant IA fonctionne en lecture seule ». Toutes
 * ses actions sont des navigations (`view_*`, et jusqu'à
 * `draft_intervention_report` qui ouvre simplement la page des rapports). Il
 * n'écrit aucune donnée métier. L'affirmation est exacte, on peut la tenir.
 *
 * VÉRIFIÉ ET RENFORCÉ — la facturation électronique. La rédaction fournie la
 * disait « intégrée dans son évolution », ce qui la SOUS-ESTIME : la connexion
 * au partenaire de dématérialisation est en environnement `production`, des
 * transmissions ont eu lieu, et un document Factur-X existe. On peut donc
 * l'annoncer, sans pour autant promettre la conformité à une obligation dont
 * le calendrier n'est pas de notre ressort.
 *
 * CORRIGÉ — « 14 jours d'essai gratuit » seul. Vrai mais incomplet, et
 * l'omission se paie à l'écran suivant : l'essai des formules payantes réclame
 * une carte. Sans elle, il suffirait de changer d'adresse e-mail pour
 * renouveler indéfiniment. La vraie bonne nouvelle était par ailleurs tue : la
 * formule Gratuite n'a ni carte ni date de fin.
 *
 * CORRIGÉ — « conçu avec une approche mobile-first ». C'est une revendication
 * de méthode, invérifiable par le lecteur et invérifiable par nous. Remplacée
 * par ce qui se constate : l'application s'installe sur l'écran d'accueil sans
 * magasin d'applications.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const FAQ_GROUPES: FaqGroupe[] = [
  {
    titre: 'Découvrir REZO360',
    entrees: [
      {
        id: 'quest-ce-que',
        question: 'Qu’est-ce que REZO360 ?',
        answer:
          'REZO360 est une plateforme tout-en-un conçue pour les professionnels et les entreprises de terrain. Elle centralise clients, équipes, interventions, rapports, documents, outils métier, assistant IA et facturation dans un seul espace.',
      },
      {
        id: 'a-qui',
        question: 'À qui s’adresse REZO360 ?',
        answer:
          'Aux indépendants, TPE, PME et entreprises disposant d’équipes terrain qui souhaitent mieux organiser leur activité, centraliser leurs informations et réduire le temps consacré aux tâches administratives.',
      },
      {
        id: 'metiers',
        question: 'Quels métiers peuvent utiliser REZO360 ?',
        answer:
          'De nombreux métiers de terrain : BTP, électricité, plomberie, climatisation, maintenance, réseaux, télécommunications, espaces verts, et toute activité nécessitant de gérer des clients, des équipes ou des interventions.',
      },
      {
        id: 'independants',
        question: 'REZO360 convient-il aux indépendants et aux petites entreprises ?',
        answer:
          'Oui. REZO360 accompagne aussi bien un professionnel seul qu’une entreprise composée de plusieurs équipes. Vous commencez simplement, puis faites évoluer votre utilisation avec votre activité.',
      },
      {
        id: 'pourquoi-changer',
        question: 'J’utilise déjà plusieurs logiciels. Pourquoi choisir REZO360 ?',
        answer:
          'REZO360 a justement été conçu pour éviter la multiplication des outils : retrouver l’essentiel de votre activité dans un même environnement, avec moins de ressaisies, moins d’informations dispersées, et une meilleure continuité entre le bureau et le terrain.',
      },
    ],
  },
  {
    titre: 'Interventions et équipes',
    entrees: [
      {
        id: 'ce-quon-gere',
        question: 'Que puis-je gérer avec REZO360 ?',
        answer:
          'Vos clients, contacts et sites, vos collaborateurs et équipes, vos missions et interventions, vos comptes rendus, vos documents et vos factures — ainsi que des outils destinés au quotidien des professionnels de terrain.',
      },
      {
        id: 'equipes',
        question: 'Puis-je gérer mes techniciens et mes équipes ?',
        answer:
          'Oui. Vous organisez vos collaborateurs en équipes, attribuez les interventions, et chacun accède aux informations nécessaires à son travail — ni plus, ni moins.',
      },
      {
        id: 'planifier',
        question: 'Puis-je planifier et suivre mes interventions ?',
        answer:
          'Oui. Vous préparez vos interventions, les attribuez et suivez leur avancement, ce qui vous donne une vision claire de l’activité terrain sans avoir à appeler qui que ce soit.',
      },
      {
        id: 'comptes-rendus',
        question: 'Mes techniciens peuvent-ils rédiger leurs comptes rendus sur le terrain ?',
        answer:
          'Oui. Les informations d’une intervention se renseignent depuis le terrain, avec photos et signature du client, ce qui évite la ressaisie administrative au retour.',
      },
      {
        id: 'historique-client',
        question: 'Puis-je retrouver l’historique des interventions d’un client ?',
        answer:
          'Oui. Les informations étant centralisées, vous retrouvez ce qui concerne un client, ses sites et les interventions réalisées chez lui.',
      },
    ],
  },
  {
    titre: 'Assistant IA',
    entrees: [
      {
        id: 'ia-existe',
        question: 'REZO360 intègre-t-il un assistant IA ?',
        answer:
          'Oui, à partir de la formule Starter. Il est conçu pour accompagner les professionnels de terrain et leur permettre d’accéder plus rapidement aux informations dont ils ont besoin.',
      },
      {
        id: 'ia-usage',
        question: 'À quoi sert l’assistant IA de REZO360 ?',
        answer:
          'À retrouver une information, comprendre une procédure, exploiter vos ressources techniques ou chercher dans votre documentation — sans passer de longues minutes à parcourir vos fichiers.',
      },
      {
        id: 'ia-documents',
        question: 'L’assistant IA peut-il utiliser les documents de mon entreprise ?',
        answer:
          'Oui, selon votre formule et vos autorisations. L’assistant s’appuie sur les documents mis à sa disposition pour répondre à partir des ressources de votre organisation, et uniquement de celles auxquelles vous avez accès.',
      },
      {
        id: 'ia-technique',
        question: 'Puis-je poser des questions techniques à l’assistant IA ?',
        answer:
          'Oui. Il vous accompagne dans la recherche et la compréhension d’informations techniques. Il reste un outil d’assistance : ce qui engage une intervention doit être vérifié et adapté au contexte réel du chantier.',
      },
      {
        id: 'ia-lecture-seule',
        question: 'L’assistant IA peut-il modifier mes données à ma place ?',
        answer:
          // Vérifié : toutes les actions de l'assistant sont des navigations
          // (`view_*`, et `draft_intervention_report` qui ouvre la page des
          // rapports). Aucune n'écrit de donnée métier.
          'Non. L’assistant fonctionne en lecture seule : il vous aide à retrouver l’information et peut vous conduire au bon écran, mais il ne crée, ne modifie et ne supprime jamais vos clients, interventions, documents ou factures. Vous restez seul à décider.',
      },
    ],
  },
  {
    titre: 'Documents et outils métier',
    entrees: [
      {
        id: 'bibliotheque',
        question: 'Puis-je centraliser les documents de mon entreprise ?',
        answer:
          'Oui. La bibliothèque REZO360 regroupe vos procédures, notices, plans et documents techniques, pour que votre équipe les retrouve au lieu de les chercher.',
      },
      {
        id: 'arborescence',
        question: 'Puis-je organiser mes fichiers et dossiers comme je le souhaite ?',
        answer:
          'Oui. La bibliothèque se structure en dossiers, à votre main, selon le fonctionnement de votre entreprise.',
      },
      {
        id: 'outils-metier',
        question: 'REZO360 propose-t-il des outils et calculateurs métier ?',
        answer:
          'Oui. Des outils destinés aux professionnels — réseaux, télécommunications, fibre, électricité, conversions techniques — qui s’appuient sur les formules et normes officielles (NF C 15-100, UTE C 15-105, ITU-T, IEEE) et affichent la formule employée à côté du résultat.',
      },
    ],
  },
  {
    titre: 'Facturation',
    entrees: [
      {
        id: 'factures',
        question: 'Puis-je gérer mes factures avec REZO360 ?',
        answer:
          'Oui. La facturation est intégrée à la plateforme, ce qui rapproche la gestion administrative de l’activité réellement effectuée sur le terrain.',
      },
      {
        id: 'continuite',
        question: 'Puis-je passer d’une intervention à une facture sans tout ressaisir ?',
        answer:
          'C’est précisément l’intention : une continuité entre le client, l’intervention, le compte rendu et la facture, pour supprimer les doubles saisies.',
      },
      {
        id: 'facture-electronique',
        question: 'REZO360 prend-il en charge la facturation électronique ?',
        answer:
          // La rédaction fournie disait « intègre dans son évolution », ce qui
          // sous-estime l'état réel : connexion au partenaire de
          // dématérialisation en environnement `production`, transmissions
          // effectuées, document Factur-X généré. On l'annonce donc — sans
          // promettre la conformité à un calendrier réglementaire qui ne
          // dépend pas de nous.
          'Oui. REZO360 génère vos factures au format Factur-X et les transmet via un partenaire de dématérialisation agréé, avec le suivi de chaque envoi. De quoi aborder les obligations françaises à venir sans changer d’outil.',
      },
    ],
  },
  {
    titre: 'Mobile, accès et sécurité',
    entrees: [
      {
        id: 'multi-appareils',
        question: 'Puis-je utiliser REZO360 sur smartphone, tablette et ordinateur ?',
        answer:
          // « Mobile-first » est une revendication de méthode, invérifiable par
          // le lecteur. Remplacée par ce qui se constate à l'usage.
          'Oui. L’interface s’adapte aux trois, et l’application s’installe sur votre écran d’accueil en un geste — sans passer par un magasin d’applications, et sans mise à jour à surveiller.',
      },
      {
        id: 'permissions',
        question: 'Puis-je choisir ce que chaque collaborateur peut voir ou modifier ?',
        answer:
          'Oui. Un système de rôles et de permissions règle finement les accès : un technicien, un chef d’équipe et un dirigeant ne voient pas la même chose, et ne peuvent pas les mêmes gestes.',
      },
      {
        id: 'securite-donnees',
        question: 'Comment les données de mon entreprise sont-elles protégées ?',
        answer:
          // Deux formulations à ne pas laisser revenir : « en Europe » (la base
          // tourne à Montréal) et « chiffré de bout en bout » (Supabase chiffre
          // en transit et au repos, mais peut lire la donnée).
          'Le cloisonnement entre entreprises est appliqué par la base de données elle-même, table par table : une organisation ne peut pas lire les données d’une autre, même en cas d’erreur applicative. Vos données sont hébergées au Canada, pays reconnu par la Commission européenne comme offrant un niveau de protection adéquat, et chiffrées en transit (TLS) comme au repos (AES-256).',
      },
    ],
  },
  {
    titre: 'Essai et abonnement',
    entrees: [
      {
        id: 'essai',
        question: 'Puis-je essayer REZO360 gratuitement avant de m’engager ?',
        answer:
          // « 14 jours gratuits » seul est vrai mais incomplet : l'essai des
          // formules payantes réclame une carte, et le découvrir après avoir lu
          // le contraire est ce qui fait fermer un onglet. Sans carte, il
          // suffirait de changer d'adresse e-mail pour renouveler indéfiniment.
          'Oui, de deux façons. La formule Gratuite ne demande aucune carte bancaire et n’expire jamais : vous entrez immédiatement et vous jugez sur pièces. Les formules payantes ouvrent en plus 14 jours d’essai — une carte est demandée pour vérification, rien n’est débité avant la fin de l’essai, et vous résiliez en deux clics.',
      },
      {
        id: 'formules',
        question: 'Quelles sont les formules et combien coûtent-elles ?',
        answer: phraseDesFormules(),
      },
    ],
  },
];

export default function FaqPage() {
  useDocumentTitle('FAQ');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Foire aux questions"
        description="Ce que la plateforme change concrètement, à qui elle s’adresse, ce qu’elle coûte, et ce qu’il advient de vos données."
      />

      {/*
        GROUPÉES, ET NON EN UNE LISTE DE VINGT-SIX.

        Un accordéon de vingt-six volets se parcourt en lisant chaque intitulé
        jusqu'à tomber sur le bon. Les sections permettent d'écarter d'un coup
        d'œil les quatre cinquièmes qui ne concernent pas la question du moment.

        Un accordéon par groupe : ouvrir une question de la facturation ne
        referme pas celle qu'on lisait sur l'assistant IA.
      */}
      <div className="mt-8 space-y-10">
        {FAQ_GROUPES.map((groupe, indexGroupe) => {
          /*
            Seul le premier groupe s'ouvre d'emblée : la page montre ainsi une
            réponse dès l'arrivée, sans imposer six volets ouverts.

            La garde explicite est exigée par `exactOptionalPropertyTypes` —
            passer `defaultValue: undefined` n'est pas la même chose que ne pas
            le passer, et le compilateur a raison de le distinguer.
          */
          const premiere = indexGroupe === 0 ? groupe.entrees[0]?.id : undefined;

          return (
            <section key={groupe.titre} aria-labelledby={`faq-${groupe.titre}`}>
              <h2
                id={`faq-${groupe.titre}`}
                className="text-primary mb-3 font-mono text-xs font-bold tracking-widest uppercase"
              >
                {groupe.titre}
              </h2>

              <div className="bg-surface/90 border-border/80 shadow-raised rounded-2xl border p-4 backdrop-blur-md sm:p-6">
                <Accordion.Root
                  type="single"
                  collapsible
                  className="space-y-3"
                  {...(premiere === undefined ? {} : { defaultValue: premiere })}
                >
                  {groupe.entrees.map((item) => (
                    <Accordion.Item
                      key={item.id}
                      value={item.id}
                      className="border-border/60 data-[state=open]:bg-surface-sunken/60 rounded-xl border px-4 py-1 transition-colors"
                    >
                      <Accordion.Header className="flex">
                        <Accordion.Trigger className="text-foreground hover:text-primary focus-visible:ring-ring group flex flex-1 items-center justify-between rounded-md py-4 text-left text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none">
                          <span>{item.question}</span>
                          <ChevronDown
                            className="text-subtle-foreground size-4 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                            aria-hidden="true"
                          />
                        </Accordion.Trigger>
                      </Accordion.Header>

                      <Accordion.Content className="text-muted-foreground border-border/40 mt-1 border-t pt-2 pb-4 text-xs leading-relaxed">
                        {item.answer}
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </div>
            </section>
          );
        })}
      </div>

      {/* Bloc de conversion final. */}
      <div className="bg-surface-sunken border-border/60 mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 text-center sm:flex-row sm:p-8 sm:text-left">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
            <MessageSquare className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              Vous avez encore une question ?
            </h2>
            <p className="text-muted-foreground text-xs">
              {/*
                « Notre équipe » pour une entreprise individuelle serait une
                petite fiction inutile. Dire qui répond vraiment vaut mieux, et
                rassure davantage un artisan qui hésite.
              */}
              Écrivez-nous : vous aurez une réponse d’une personne qui connaît le produit.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" size="sm">
            <a href="mailto:contact@rezo360.fr?subject=Question%20REZO360">Nous contacter</a>
          </Button>
          <Button asChild size="sm">
            {/*
              « Essayer gratuitement pendant 14 jours » redirait l'essai des
              formules payantes, alors que l'entrée sans risque est la formule
              Gratuite — sans carte et sans échéance. Le libellé reprend donc
              celui de la page d'accueil, pour que la promesse soit la même
              partout.
            */}
            <a href={ROUTES.register}>Commencer gratuitement</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
