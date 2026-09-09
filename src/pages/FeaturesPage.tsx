import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Command,
  FileCheck2,
  FolderOpen,
  PackageSearch,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Kbd } from '@/components/ui/Kbd';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Ce que fait REZO360 — le produit d'aujourd'hui.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CETTE PAGE DÉCRIVAIT UN AUTRE PRODUIT
 *
 * Ses huit rubriques venaient du REZO360 des débuts, celui de la boîte à
 * outils : recherche, catalogue de calculatrices, favoris, historique, abaques,
 * mode sombre. Pas une ligne sur les clients, les interventions, le planning,
 * les équipes, les comptes rendus, la facturation ni l'assistant IA.
 *
 * Autrement dit : la page censée présenter le produit n'en présentait rien. Un
 * visiteur venu d'une publicité sur la gestion d'interventions y trouvait la
 * confirmation qu'il s'était trompé d'adresse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEPT AFFIRMATIONS ÉTAIENT FAUSSES, ET ONT ÉTÉ RETIRÉES
 *
 *   • « Calculs Certifiés Conformés » — « certifié » suppose un organisme
 *     certificateur ; il n'y en a aucun. En France, l'usage du terme expose.
 *     (« Conformés » n'est par ailleurs pas un mot.)
 *
 *   • « Toutes les cibles tactiles respectent 44 px » — mesuré faux : deux
 *     cibles sous 40 px subsistent, dont un lien du bandeau cookies à 17 px.
 *
 *   • « Documents intégrés dans chaque outil via l'onglet Documentation » — cet
 *     onglet n'existe pas. Un seul outil du catalogue a une modale de
 *     documentation.
 *
 *   • « Chaque calcul est automatiquement conservé » — plafonné à dix entrées
 *     sur la formule Gratuite, celle de la plupart des visiteurs.
 *
 *   • « Gagnez jusqu'à 30 secondes par recherche » — chiffre inventé.
 *
 *   • « L'architecture garantit un chargement ultra-rapide » — « garantit » est
 *     un engagement ; la page d'accueil pesait 3,5 Mo il y a deux jours.
 *
 *   • « Palette ardoise profonde » — la palette sombre est passée au marine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RÈGLE POUR LA SUITE
 *
 * Chaque rubrique ci-dessous correspond à un écran qui existe et à une route
 * atteignable. Les congés et les tâches récurrentes ont des tables en base mais
 * aucune entrée de navigation : ils ne sont donc pas annoncés. On ne promet pas
 * ce qu'un visiteur ne peut pas trouver.
 *
 * L'ordre suit le parcours réel d'une affaire — le client, puis le planning,
 * puis l'intervention, puis la facture — et non la liste des modules.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const FEATURES_LIST = [
  {
    icon: UsersRound,
    title: 'Clients, sites et contacts',
    subtitle: 'Le carnet d’adresses de votre activité',
    description:
      'Chaque client rassemble ses sites d’intervention, ses contacts et l’historique de ce qui a été fait chez lui. Vous retrouvez une adresse, un interlocuteur ou une intervention passée sans fouiller vos e-mails.',
    badge: 'Clients',
    benefit: 'Un seul endroit où chercher, quel que soit l’âge du dossier.',
  },
  {
    icon: CalendarDays,
    title: 'Planning et affectation',
    subtitle: 'Qui fait quoi, et quand',
    description:
      'Préparez vos missions, attribuez-les à un technicien ou à une équipe, et suivez leur avancement au fil de la journée. Le bureau voit où en est le terrain sans avoir à téléphoner.',
    badge: 'Organisation',
    benefit: 'Répondre à « vous passez quand ? » sans déranger personne.',
  },
  {
    icon: Wrench,
    title: 'Interventions sur le terrain',
    subtitle: 'Saisie sur place, depuis le téléphone',
    description:
      'Le technicien ouvre sa mission, déclenche le suivi du temps, remplit la checklist ou le formulaire propre au métier, et joint ses photos. Tout est renseigné pendant l’intervention, pas le soir venu.',
    badge: 'Terrain',
    benefit: 'Ce qui est saisi sur place n’est plus à ressaisir au bureau.',
  },
  {
    icon: FileCheck2,
    title: 'Comptes rendus signés',
    subtitle: 'Validés par le client, sur l’écran du téléphone',
    description:
      'Le compte rendu se rédige à la fin de l’intervention et se fait signer par le client directement sur l’appareil. Il part en PDF, et reste attaché à la mission comme à la fiche du client.',
    badge: 'Traçabilité',
    benefit: 'Une preuve de passage datée, difficile à contester.',
  },
  {
    icon: Receipt,
    title: 'Devis, factures et facturation électronique',
    subtitle: 'La suite logique de l’intervention',
    description:
      'Le devis reprend vos prestations déjà chiffrées ; la facture reprend l’intervention réalisée. REZO360 génère vos factures au format Factur-X et les transmet via un partenaire de dématérialisation agréé, avec le suivi de chaque envoi.',
    badge: 'Facturation',
    benefit: 'Aborder les obligations françaises à venir sans changer d’outil.',
  },
  {
    icon: FolderOpen,
    title: 'Bibliothèque documentaire',
    subtitle: 'Procédures, notices et plans, rangés',
    description:
      'Déposez vos documents d’entreprise et organisez-les en dossiers, à votre main. Chaque membre de l’équipe y accède depuis le terrain, selon les droits que vous lui avez donnés.',
    badge: 'Documents',
    benefit: 'La bonne notice trouvée sur place, pas cherchée au retour.',
  },
  {
    icon: Sparkles,
    title: 'Assistant IA',
    subtitle: 'Il cherche pour vous — et rien d’autre',
    description:
      // Vérifié : toutes les actions de l'assistant sont des navigations. Il
      // n'écrit aucune donnée métier. C'est un argument de confiance rare, et
      // il vaut mieux l'énoncer que de le laisser deviner.
      'Posez une question sur vos données ou vos documents et obtenez une réponse, plutôt que d’ouvrir cinq écrans. L’assistant fonctionne en lecture seule : il peut vous conduire au bon endroit, mais ne crée, ne modifie et ne supprime jamais rien.',
    badge: 'À partir de Starter',
    benefit: 'Vous restez seul à décider de ce qui change.',
  },
  {
    icon: PackageSearch,
    title: 'Stock, matériel et véhicules',
    subtitle: 'Ce que vous possédez, et où ça se trouve',
    description:
      'Suivez vos consommables et leurs mouvements, votre matériel et ses échéances de contrôle, vos véhicules et leur entretien. Chaque élément peut être rattaché à un collaborateur.',
    badge: 'Parc',
    benefit: 'Savoir ce qu’il reste avant de partir, pas en arrivant.',
  },
  {
    icon: ShieldCheck,
    title: 'Rôles, permissions et cloisonnement',
    subtitle: 'Chacun voit ce qui le concerne',
    description:
      // Le cloisonnement par organisation est applique par la base elle-meme,
      // sur chacune de ses tables — verifie lors de l'audit de securite.
      'Un technicien, un chef d’équipe et un dirigeant n’ont ni la même vue ni les mêmes droits. Le cloisonnement entre entreprises est appliqué par la base de données elle-même, table par table : une organisation ne peut pas lire les données d’une autre, même en cas d’erreur applicative.',
    badge: 'Sécurité',
    benefit: 'Ouvrir un accès à un intérimaire sans lui ouvrir la comptabilité.',
  },
  {
    icon: Smartphone,
    title: 'Sur le terrain comme au bureau',
    subtitle: 'Installable sur l’écran d’accueil',
    description:
      // « Toutes les cibles tactiles respectent 44 px » etait faux — mesure.
      // Ce qui se verifie, c'est l'installation sans magasin d'applications.
      'L’interface s’adapte au téléphone, à la tablette et à l’ordinateur, et s’installe sur votre écran d’accueil en un geste — sans passer par un magasin d’applications, et sans mise à jour à surveiller.',
    badge: 'Mobile',
    benefit: 'Aucun déploiement à organiser pour équiper une équipe.',
  },
  {
    icon: Command,
    title: 'Recherche universelle',
    subtitle: 'Une palette de commandes, depuis n’importe quel écran',
    description:
      'Le raccourci ⌘K (ou Ctrl+K) ouvre une recherche qui traverse le produit : un client, une mission, un outil, un écran. Vous tapez trois lettres au lieu de naviguer.',
    badge: 'Productivité',
    benefit: 'Atteindre n’importe quoi sans connaître le chemin.',
  },
  {
    icon: Wrench,
    title: 'Outils techniques métier',
    subtitle: 'Le catalogue qui a fait naître REZO360',
    description:
      // « Calculs Certifies Conformes » retire : « certifie » suppose un
      // organisme certificateur, il n'y en a aucun. Ce qui est vrai et
      // verifiable par l'utilisateur, c'est que la formule est affichee.
      'Calculs électriques, bilans optiques, sous-réseautage, conversions d’unités et dimensionnements. Chaque outil s’appuie sur les formules et normes publiées (NF C 15-100, UTE C 15-105, ITU-T, IEEE), et affiche la formule employée à côté du résultat pour que vous puissiez la vérifier.',
    badge: 'Outils',
    benefit: 'Un résultat que vous pouvez justifier, pas seulement recopier.',
  },
] as const;

export default function FeaturesPage() {
  useDocumentTitle('Fonctionnalités');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Tout ce que REZO360 gère pour vous"
        description="Des clients au planning, du terrain à la facture : ce que la plateforme prend en charge au quotidien, et ce que vous cessez de faire à la main."
        actions={
          <Button asChild size="lg">
            {/*
              « Explorer les outils » envoyait vers le catalogue de
              calculatrices, c'est-à-dire vers l'ancien produit. L'action
              attendue d'une page de fonctionnalités est l'inscription.
            */}
            <Link to={ROUTES.register}>
              Commencer gratuitement
              <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {FEATURES_LIST.map((feat) => {
          const Icon = feat.icon;
          return (
            <Card
              key={feat.title}
              className="hover:border-primary/40 hover:shadow-overlay transition-all duration-200"
            >
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="neutral" className="text-2xs font-mono">
                    {feat.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{feat.title}</CardTitle>
                <p className="text-primary text-xs font-medium">{feat.subtitle}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-xs leading-relaxed">{feat.description}</p>
                {/*
                  CE BANDEAU DIT UNE CONSÉQUENCE, PLUS UN CHIFFRE.

                  Il annonçait « Gagnez jusqu'à 30 secondes par recherche » —
                  une mesure que personne n'a faite. Un chiffre inventé sur une
                  page de vente est ce qui décrédibilise le reste, y compris ce
                  qui est vrai.
                */}
                <div className="bg-surface-sunken/80 border-border/40 text-foreground flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                  <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{feat.benefit}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Raccourci de recherche : une précision utile, pas une pierre angulaire.
          Il ouvrait la page en pleine largeur, avant même que le produit ne soit
          présenté. Il vit désormais après la grille, à sa juste place. */}
      <div className="bg-surface/80 border-border/80 shadow-raised mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 sm:flex-row">
        <p className="text-muted-foreground text-xs">
          Astuce : tapez <Kbd>⌘</Kbd> <Kbd>K</Kbd> ou <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> depuis n’importe
          quelle page pour ouvrir la recherche universelle.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.pricing}>Comparer les formules</Link>
        </Button>
      </div>

      <div className="bg-surface-sunken border-border/80 mt-16 rounded-2xl border p-8 text-center sm:p-12">
        <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Prêt à essayer sur une vraie intervention ?
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm sm:text-base">
          {/*
            « Accédez gratuitement à tous les outils du catalogue » ramenait au
            produit d'hier. Et la formule Gratuite est bien sans carte : c'est
            l'essai des formules PAYANTES qui en demande une.
          */}
          La formule Gratuite est sans carte bancaire et sans limite de durée. Rien à installer,
          rien à migrer : vous commencez par une intervention, et vous voyez.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to={ROUTES.register}>Créer un compte gratuit</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to={ROUTES.pricing}>Voir les tarifs</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
