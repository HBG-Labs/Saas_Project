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
          { path: ROUTES.tools, lazy: lazyPage(() => import('@/pages/ToolsPage')) },
          { path: ROUTE_PATTERNS.tool, lazy: lazyPage(() => import('@/pages/ToolDetailPage')) },
          { path: ROUTE_PATTERNS.category, lazy: lazyPage(() => import('@/pages/CategoryPage')) },
          { path: ROUTES.references, lazy: lazyPage(() => import('@/pages/ReferencesPage')) },
          { path: ROUTES.equipment, lazy: lazyPage(() => import('@/pages/equipment/EquipmentPage')) },
          { path: ROUTES.quotes, lazy: lazyPage(() => import('@/pages/quotes/QuotesPage')) },
          // DashboardPage en import direct pour HMR instantané
          { path: ROUTES.dashboard, Component: DashboardPage },
          { path: ROUTES.analytics, lazy: lazyPage(() => import('@/pages/analytics/AnalyticsPage')) },

          {
            element: <ProtectedRoute />,
            children: [
              {
                path: ROUTES.organizationNew,
                lazy: lazyPage(() => import('@/pages/organization/CreateOrganizationPage')),
              },
              {
                path: ROUTE_PATTERNS.invitation,
                lazy: lazyPage(() => import('@/pages/organization/AcceptInvitationPage')),
              },

              {
                element: <RequireOrganization />,
                children: [
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
