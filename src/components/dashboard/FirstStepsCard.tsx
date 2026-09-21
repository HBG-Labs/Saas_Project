import { ArrowRight, Check, Circle } from 'lucide-react';
import { Link } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import { useCustomers } from '@/features/customers';
import { useLabel } from '@/features/industries';
import { useMissionStatusCounts } from '@/features/missions';
import { useCurrentOrganization, useMembers } from '@/features/organizations';
import { cn } from '@/lib/cn';

/**
 * Le chemin jusqu'au premier compte rendu validé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CET ÉCRAN EXISTE
 *
 * Une entreprise qui vient de s'inscrire atterrit sur un cockpit complet et
 * vide : cinq groupes de menu, des sections sans données, aucune indication de
 * ce qu'il faut faire d'abord. Or ce produit ne se juge pas en ouvrant trois
 * écrans — il se juge quand le dirigeant voit un compte rendu signé qu'il peut
 * remettre à son client.
 *
 * Entre l'inscription et ce moment-là, il y a une chaîne de gestes. Chacun est
 * évident une fois connu, aucun ne l'est avant. Une période d'essai se consume
 * à les chercher.
 *
 * DÉDUIT, JAMAIS STOCKÉ
 *
 * Aucun drapeau « onboarding terminé » en base. Chaque étape est vraie ou
 * fausse selon ce que contient réellement l'organisation. Un état stocké finit
 * par mentir — coché alors que le client a supprimé sa seule mission, ou
 * décoché sur une entreprise qui tourne depuis six mois. Ici la carte s'efface
 * quand le travail est fait et reparaît si tout est effacé, ce qui est le
 * comportement juste dans les deux cas.
 *
 * ELLE NE SE FERME PAS À LA MAIN
 *
 * Pas de bouton « masquer ». Une entreprise qui n'a jamais fait valider un
 * compte rendu n'a pas fini de découvrir le produit, qu'elle le pense ou non.
 * Le jour où elle en valide un, la carte s'en va d'elle-même.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Etape {
  id: string;
  fait: boolean;
  titre: string;
  detail: string;
  lien: string;
  action: string;
  illustration: 'technicians' | 'customers' | 'missions' | 'teams' | 'reports';
}

export function FirstStepsCard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const jobSingular = useLabel('job');
  const workerPlural = useLabel('worker', true);

  const { has, isLoading: droitsEnCours } = useOrganizationEntitlements(organizationId);
  const members = useMembers(organizationId);
  const customers = useCustomers(organizationId);
  // La RÉPARTITION par statut, pas une page de missions : une entreprise dont
  // les cinquante dernières missions sont en cours a pu en valider mille avant.
  // Une liste tronquée ferait réapparaître ce guide chez un client aguerri.
  const missions = useMissionStatusCounts(organizationId);

  // Tant que les requêtes n'ont pas répondu, on n'affiche rien : une carte qui
  // apparaît puis disparaît au chargement est pire qu'une absence.
  if (droitsEnCours || members.isPending || customers.isPending || missions.isPending) return null;

  // Sans le module professionnel, ce parcours ne mène nulle part : chacune de
  // ses étapes bute sur le mur de `RequirePlan`. Le cas n'est pas théorique —
  // une organisation dont l'essai s'achève retombe sur Gratuit avec ses données
  // intactes mais invisibles, et verrait alors « Vos premiers pas 0 / 5 »
  // l'inviter à recréer ce qu'elle possède déjà, derrière une porte fermée.
  if (!has(FEATURES.missions)) return null;

  const equipe = (members.data ?? []).filter((m) => m.status === 'active').length;
  const parStatut: Record<string, number> = missions.data ?? {};
  const compte = (...statuts: string[]) =>
    statuts.reduce((total, statut) => total + (parStatut[statut] ?? 0), 0);

  const total = Object.values(parStatut).reduce((a, b) => a + b, 0);
  const enCours = compte('in_progress', 'completed', 'submitted', 'approved', 'closed') > 0;
  const valide = compte('approved', 'closed') > 0;

  const etapes: Etape[] = [
    {
      id: 'equipe',
      fait: equipe > 1,
      titre: `Ajoutez vos ${workerPlural.toLowerCase()}`,
      detail:
        'Créez leur compte directement et remettez-leur les accès de vive voix — sans attendre un courriel.',
      lien: ROUTES.organizationMembers,
      action: 'Ajouter',
      illustration: 'technicians',
    },
    {
      id: 'client',
      fait: (customers.data ?? []).length > 0,
      titre: 'Enregistrez un client',
      detail: 'Avec son site d’intervention : c’est lui qui rattache un chantier à une adresse.',
      lien: ROUTES.customers,
      action: 'Créer une fiche',
      illustration: 'customers',
    },
    {
      id: 'mission',
      fait: total > 0,
      titre: `Planifiez ${jobSingular.toLowerCase() === 'mission' ? 'une mission' : `un ${jobSingular.toLowerCase()}`}`,
      detail: 'Affectez-la à un intervenant : il la verra aussitôt sur son téléphone.',
      lien: ROUTES.missionNew,
      action: 'Créer',
      illustration: 'missions',
    },
    {
      id: 'terrain',
      fait: enCours,
      titre: 'Laissez le terrain la prendre en charge',
      detail:
        'L’intervenant accepte, démarre, puis rédige son compte rendu. Vous suivez l’avancement sans appeler.',
      lien: ROUTES.missions,
      action: 'Suivre',
      illustration: 'teams',
    },
    {
      id: 'validation',
      fait: valide,
      titre: 'Validez le compte rendu',
      detail:
        'C’est le document que vous remettez au client. Personne ne valide le sien : la séparation est appliquée par le serveur.',
      lien: ROUTES.review,
      action: 'Ouvrir le contrôle',
      illustration: 'reports',
    },
  ];

  // Cycle complet bouclé : la carte n'a plus rien à apprendre à personne.
  if (etapes.every((e) => e.fait)) return null;

  const faites = etapes.filter((e) => e.fait).length;
  const prochaine = etapes.find((e) => !e.fait);

  return (
    <Card className="border-primary/20 bg-primary-subtle/25 overflow-hidden">
      <CardContent className="space-y-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-foreground text-sm font-bold">Vos premiers pas</h2>
          <span className="text-primary text-xs font-bold tabular-nums">
            {faites} / {etapes.length}
          </span>
        </div>
        {prochaine && (
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5">
            <span className="border-primary/15 bg-surface/80 row-span-2 flex size-14 items-center justify-center overflow-hidden rounded-2xl border">
              <AtelierIllustration subject={prochaine.illustration} className="w-16 max-w-none" />
            </span>
            <p className="text-foreground min-w-0 text-sm font-semibold">{prochaine.titre}</p>
            <Button asChild variant="outline" size="sm" className="row-span-2 shrink-0 self-center">
              <Link to={prochaine.lien}>
                {prochaine.action}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-muted-foreground line-clamp-2 min-w-0 text-xs leading-relaxed">
              {prochaine.detail}
            </p>
          </div>
        )}
        <details className="group border-primary/15 border-t pt-1">
          <summary className="text-primary min-h-touch flex cursor-pointer items-center text-xs font-semibold sm:min-h-8">
            Voir les cinq étapes
          </summary>
          <ol className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 sm:grid-cols-2 sm:pt-3 xl:grid-cols-5">
            {etapes.map((etape) => (
              <li
                key={etape.id}
                className="flex items-start gap-1.5 text-xs last:col-span-2 sm:gap-2 sm:text-sm sm:last:col-span-1"
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    etape.fait
                      ? 'border-success/40 bg-success-subtle text-success'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {etape.fait ? (
                    <Check className="size-3" aria-label="Terminée" />
                  ) : (
                    <Circle className="size-1.5 fill-current" aria-label="À faire" />
                  )}
                </span>
                <span
                  className={cn(
                    'text-foreground leading-snug',
                    etape.fait && 'text-muted-foreground line-through',
                  )}
                >
                  {etape.titre}
                </span>
              </li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
