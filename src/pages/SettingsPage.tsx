import { Bell, Building2, Calendar, Check, ChevronRight, Palette, Shield } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { PERMISSIONS, usePermission } from '@/features/organizations';
import {
  AppearanceSettingsTab,
  NotificationsSettingsTab,
  OrganizationBillingSettingsTab,
  PlanningMapSettingsTab,
  SecuritySettingsTab,
} from '@/features/settings';
import { cn } from '@/lib/cn';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

type SettingsTab =
  'appearance' | 'planning_gps' | 'notifications' | 'organization_billing' | 'security';

const ALL_TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'appearance', label: 'Apparence & Cockpit', icon: Palette },
  { id: 'planning_gps', label: 'Planning & Cartographie', icon: Calendar },
  { id: 'notifications', label: 'Alertes & Notifications', icon: Bell },
  { id: 'organization_billing', label: 'Entreprise & Facturation', icon: Building2 },
  { id: 'security', label: 'Sécurité & Accès', icon: Shield },
];

export default function SettingsPage() {
  const { can } = usePermission();
  const canManageOrg = can(PERMISSIONS.organizationUpdate);

  const tabs = ALL_TABS.filter((t) => {
    if (t.id === 'organization_billing' && !canManageOrg) {
      return false;
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [savedFeedback, signalerSavedFeedback] = useEphemeralFlag(2500);

  const triggerSavedFeedback = () => {
    signalerSavedFeedback();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHeader
        title="Paramètres & Cockpit"
        description="Personnalisez votre interface, vos options cartographiques, vos alertes et vos accès de sécurité."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="relative min-w-0 lg:sticky lg:top-4">
          <nav
            className="no-scrollbar border-border lg:bg-surface-raised flex gap-1.5 overflow-x-auto border-b pr-8 pb-2 lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:p-2 lg:shadow-xs"
            aria-label="Catégories de paramètres"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'min-h-touch flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-[color,background-color,box-shadow] lg:w-full',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="flex-1">{tab.label}</span>
                  {isActive ? (
                    <ChevronRight className="hidden size-4 lg:block" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="from-background via-background/90 pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l to-transparent pr-1 lg:hidden">
            <ChevronRight className="text-primary size-4" aria-hidden="true" />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {savedFeedback ? (
            <div
              className="animate-in fade-in slide-in-from-top-1 border-success/20 bg-success/10 text-success flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
              role="status"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Préférences mises à jour et synchronisées.</span>
            </div>
          ) : null}

          <div>
            {activeTab === 'appearance' && <AppearanceSettingsTab onSaved={triggerSavedFeedback} />}

            {activeTab === 'planning_gps' && (
              <PlanningMapSettingsTab onSaved={triggerSavedFeedback} />
            )}

            {activeTab === 'notifications' && (
              <NotificationsSettingsTab onSaved={triggerSavedFeedback} />
            )}

            {activeTab === 'organization_billing' && <OrganizationBillingSettingsTab />}

            {activeTab === 'security' && <SecuritySettingsTab onSaved={triggerSavedFeedback} />}
          </div>
        </div>
      </div>
    </div>
  );
}
