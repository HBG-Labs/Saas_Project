import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { RequireOrganization, RequirePermission, RequirePlan } from '@/components/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RootLayout } from '@/components/layout/RootLayout';
import { ROUTE_PATTERNS, ROUTES } from '@/config/routes';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth';
import { FEATURES } from '@/features/billing';
import { PERMISSIONS } from '@/features/organizations';
import DashboardPage from '@/pages/DashboardPage';

// Imports directs des pages principales pour un rechargement HMR instantané
import LandingPage from '@/pages/LandingPage';

function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default });
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <ErrorFallback error={null} />,
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          // LandingPage en import direct pour HMR instantané
          { index: true, Component: LandingPage },
          { path: ROUTES.features, lazy: lazyPage(() => import('@/pages/FeaturesPage')) },
          { path: ROUTES.pricing, lazy: lazyPage(() => import('@/pages/PricingPage')) },
          { path: ROUTES.faq, lazy: lazyPage(() => import('@/pages/FaqPage')) },

          {
            element: <PublicOnlyRoute />,
            children: [
              { path: ROUTES.login, lazy: lazyPage(() => import('@/pages/LoginPage')) },
              { path: ROUTES.register, lazy: lazyPage(() => import('@/pages/RegisterPage')) },
              {
                path: ROUTES.forgotPassword,
                lazy: lazyPage(() => import('@/pages/ForgotPasswordPage')),
              },
            ],
          },

          { path: ROUTES.authCallback, lazy: lazyPage(() => import('@/pages/AuthCallbackPage')) },
        ],
      },

      {
        element: <AppLayout />,
        children: [
          // Catalogue et références : consultables sans compte. La policy
          // `tools_select_visible` ouvre déjà ces lignes au rôle `anon` — le
          // routage ne fait que refléter ce que la base autorise.
          { path: ROUTES.tools, lazy: lazyPage(() => import('@/pages/ToolsPage')) },
          { path: ROUTE_PATTERNS.tool, lazy: lazyPage(() => import('@/pages/ToolDetailPage')) },
          { path: ROUTE_PATTERNS.category, lazy: lazyPage(() => import('@/pages/CategoryPage')) },
          { path: ROUTES.references, lazy: lazyPage(() => import('@/pages/ReferencesPage')) },

          // Publiques et sans session : un prospect doit pouvoir lire les
          // conditions AVANT de créer un compte, et un tiers doit pouvoir
          // consulter les mentions légales sans en avoir un.
          {
            path: ROUTES.legalNotice,
            lazy: lazyPage(() => import('@/pages/legal/LegalNoticePage')),
          },
          { path: ROUTES.privacy, lazy: lazyPage(() => import('@/pages/legal/PrivacyPage')) },
          { path: ROUTES.terms, lazy: lazyPage(() => import('@/pages/legal/TermsPage')) },

          // HORS de `ProtectedRoute`, et c'est tout l'enjeu : la personne
          // invitée n'a par définition PAS ENCORE DE COMPTE. Sous protection,
          // elle était renvoyée à la connexion sans savoir qui l'invitait ni
          // pourquoi — le parcours reposait sur une condition que son unique
          // destinataire ne peut pas remplir.
          //
          // La page distingue elle-même les deux cas : elle propose de créer un
          // compte ou de se connecter à qui n'en a pas, et le bouton
          // d'acceptation à qui est déjà entré. Accepter reste fermé côté
          // serveur — `accept_organization_invitation` exige une session dont
          // l'adresse correspond à celle invitée.
          {
            path: ROUTE_PATTERNS.invitation,
            lazy: lazyPage(() => import('@/pages/organization/AcceptInvitationPage')),
          },

          {
            element: <ProtectedRoute />,
            children: [
              // Écrans de travail : ils n'affichent que des données
              // d'entreprise, que la RLS refuserait à une session absente. Les
              // laisser publics ne montrerait qu'une coquille vide.
              { path: ROUTES.dashboard, Component: DashboardPage },
              { path: ROUTES.analytics, lazy: lazyPage(() => import('@/pages/analytics/AnalyticsPage')) },
              { path: ROUTES.planning, lazy: lazyPage(() => import('@/pages/planning/PlanningPage')) },
              { path: ROUTES.map, lazy: lazyPage(() => import('@/pages/map/MapPage')) },
              // Le bloc-notes est personnel : ni organisation ni formule requises.
              { path: ROUTES.notes, lazy: lazyPage(() => import('@/pages/notes/NotesPage')) },
              {
                path: ROUTES.reports,
                lazy: lazyPage(() => import('@/pages/interventions/ReportsHubPage')),
              },

              {
                path: ROUTES.organizationNew,
                lazy: lazyPage(() => import('@/pages/organization/CreateOrganizationPage')),
              },

              {
                element: <RequireOrganization />,
                children: [
                  {
                    path: ROUTES.aiAssistant,
                    lazy: lazyPage(() => import('@/pages/ai/AiAssistantPage')),
                  },
                  {
                    element: <RequirePlan feature={FEATURES.customers} label="Le module Clients" />,
                    children: [
                      {
                        element: <RequirePermission permission={PERMISSIONS.customerView} />,
                        children: [
                          {
                            path: ROUTES.customers,
                            lazy: lazyPage(() => import('@/pages/customers/CustomersListPage')),
                          },
                        ],
                      },
                      {
                        path: ROUTE_PATTERNS.customer,
                        lazy: lazyPage(() => import('@/pages/customers/CustomerDetailPage')),
                      },
                    ],
                  },

                  {
                    element: <RequirePlan feature={FEATURES.missions} label="Le module Missions" />,
                    children: [
                      {
                        path: ROUTES.missions,
                        lazy: lazyPage(() => import('@/pages/missions/MissionsListPage')),
                      },
                      {
                        element: <RequirePermission permission={PERMISSIONS.missionCreate} />,
                        children: [
                          {
                            path: ROUTES.missionNew,
                            lazy: lazyPage(() => import('@/pages/missions/MissionCreatePage')),
                          },
                        ],
                      },
                      {
                        path: ROUTE_PATTERNS.mission,
                        lazy: lazyPage(() => import('@/pages/missions/MissionDetailPage')),
                      },
                      // Répertoire des dossiers terminés. Même formule et même
                      // RLS que la liste courante : ce sont les mêmes missions,
                      // seul l'état diffère.
                      {
                        path: ROUTES.archives,
                        lazy: lazyPage(() => import('@/pages/missions/ArchivedMissionsPage')),
                      },
                    ],
                  },

                  {
                    element: (
                      <RequirePlan feature={FEATURES.interventions} label="Le suivi d’intervention" />
                    ),
                    children: [
                      {
                        path: ROUTE_PATTERNS.intervention,
                        lazy: lazyPage(() => import('@/pages/interventions/InterventionPage')),
                      },
                      {
                        path: ROUTE_PATTERNS.interventionReport,
                        lazy: lazyPage(() => import('@/pages/interventions/ReportEditorPage')),
                      },
                      {
                        element: (
                          <RequirePermission permission={PERMISSIONS.interventionReview} />
                        ),
                        children: [
                          {
                            path: ROUTES.review,
                            lazy: lazyPage(() => import('@/pages/interventions/ReviewQueuePage')),
                          },
                        ],
                      },
                    ],
                  },

                  {
                    element: (
                      <RequirePlan feature={FEATURES.equipment} label="Le parc matériel" />
                    ),
                    children: [
                      {
                        element: <RequirePermission permission={PERMISSIONS.equipmentView} />,
                        children: [
                          {
                            path: ROUTES.equipment,
                            lazy: lazyPage(() => import('@/pages/equipment/EquipmentPage')),
                          },
                        ],
                      },
                    ],
                  },

                  {
                    element: <RequirePlan feature={FEATURES.quotes} label="Le module Devis" />,
                    children: [
                      {
                        element: <RequirePermission permission={PERMISSIONS.quoteView} />,
                        children: [
                          {
                            path: ROUTES.quotes,
                            lazy: lazyPage(() => import('@/pages/quotes/QuotesPage')),
                          },
                        ],
                      },
                    ],
                  },

                  {
                    element: <RequirePlan feature={FEATURES.teams} label="Le module Équipes" />,
                    children: [
                      {
                        element: <RequirePermission permission={PERMISSIONS.teamView} />,
                        children: [
                          {
                            path: ROUTES.teams,
                            lazy: lazyPage(() => import('@/pages/teams/TeamsListPage')),
                          },
                          {
                            path: ROUTE_PATTERNS.team,
                            lazy: lazyPage(() => import('@/pages/teams/TeamDetailPage')),
                          },
                        ],
                      },
                    ],
                  },

                  {
                    path: ROUTES.organization,
                    lazy: lazyPage(() => import('@/pages/organization/OrganizationSettingsPage')),
                  },
                  {
                    element: <RequirePermission permission={PERMISSIONS.memberView} />,
                    children: [
                      {
                        path: ROUTES.organizationMembers,
                        lazy: lazyPage(() => import('@/pages/organization/MembersPage')),
                      },
                      {
                        path: ROUTES.vehicles,
                        lazy: lazyPage(() => import('@/pages/vehicles/VehiclesPage')),
                      },
                    ],
                  },
                  {
                    element: <RequirePermission permission={PERMISSIONS.billingView} />,
                    children: [
                      {
                        path: ROUTES.organizationBilling,
                        lazy: lazyPage(() => import('@/pages/organization/BillingPage')),
                      },
                    ],
                  },

                  {
                    element: <RequirePlan feature={FEATURES.auditLog} label="Le journal d’audit" />,
                    children: [
                      {
                        element: <RequirePermission permission={PERMISSIONS.auditView} />,
                        children: [
                          {
                            path: ROUTES.auditLog,
                            lazy: lazyPage(() => import('@/pages/organization/AuditLogPage')),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              { path: ROUTES.favorites, lazy: lazyPage(() => import('@/pages/FavoritesPage')) },
              { path: ROUTES.history, lazy: lazyPage(() => import('@/pages/HistoryPage')) },
              { path: ROUTES.profile, lazy: lazyPage(() => import('@/pages/ProfilePage')) },
              { path: ROUTES.settings, lazy: lazyPage(() => import('@/pages/SettingsPage')) },
            ],
          },

          { path: '*', lazy: lazyPage(() => import('@/pages/NotFoundPage')) },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
