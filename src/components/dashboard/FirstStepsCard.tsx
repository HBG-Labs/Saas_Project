import { ArrowRight, Check, Circle } from 'lucide-react';
import { Link } from 'react-router';

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
    },
    {
      id: 'client',
      fait: (customers.data ?? []).length > 0,
      titre: 'Enregistrez un client',
      detail: 'Avec son site d’intervention : c’est lui qui rattache un chantier à une adresse.',
      lien: ROUTES.customers,
      action: 'Créer une fiche',
    },
    {
      id: 'mission',
      fait: total > 0,
      titre: `Planifiez ${jobSingular.toLowerCase() === 'mission' ? 'une mission' : `un ${jobSingular.toLowerCase()}`}`,
      detail: 'Affectez-la à un intervenant : il la verra aussitôt sur son téléphone.',
      lien: ROUTES.missionNew,
      action: 'Créer',
    },
    {
      id: 'terrain',
      fait: enCours,
      titre: 'Laissez le terrain la prendre en charge',
      detail:
        'L’intervenant accepte, démarre, puis rédige son compte rendu. Vous suivez l’avancement sans appeler.',
      lien: ROUTES.missions,
      action: 'Suivre',
    },
    {
      id: 'validation',
      fait: valide,
      titre: 'Validez le compte rendu',
      detail:
        'C’est le document que vous remettez au client. Personne ne valide le sien : la séparation est appliquée par le serveur.',
      lien: ROUTES.review,
      action: 'Ouvrir le contrôle',
    },
  ];

  // Cycle complet bouclé : la carte n'a plus rien à apprendre à personne.
  if (etapes.every((e) => e.fait)) return null;

  const faites = etapes.filter((e) => e.fait).length;
  const prochaine = etapes.find((e) => !e.fait);

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-foreground text-base font-bold">Vos premiers pas</h2>
            <p className="text-muted-foreground text-xs">
              Cinq étapes jusqu’au premier compte rendu validé — le moment où l’outil montre ce
              qu’il sait faire.
            </p>
          </div>
          <span className="text-primary text-xs font-bold tabular-nums">
            {faites} / {etapes.length}
          </span>
        </div>

        <div className="bg-surface-sunken h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500"
            style={{ width: `${String((faites / etapes.length) * 100)}%` }}
          />
        </div>

        <ol className="space-y-1.5">
          {etapes.map((etape) => {
            const estProchaine = etape.id === prochaine?.id;

            return (
              <li
                key={etape.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                  estProchaine ? 'border-primary/40 bg-surface shadow-2xs' : 'border-transparent',
                  etape.fait && 'opacity-55',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    etape.fait
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {etape.fait ? (
                    <Check className="size-3" />
                  ) : (
                    <Circle className="size-1.5 fill-current" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-foreground text-sm font-semibold',
                      etape.fait && 'line-through',
                    )}
                  >
                    {etape.titre}
                  </p>
                  {/* Le détail n'apparaît que sur l'étape en cours : cinq
                      explications d'un coup transforment un guide en pavé. */}
                  {estProchaine ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">{etape.detail}</p>
                  ) : null}
                </div>

                {estProchaine ? (
                  <Link
                    to={etape.lien}
                    className="text-primary hover:bg-primary/10 inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                  >
                    {etape.action}
                    <ArrowRight className="size-3.5" />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
