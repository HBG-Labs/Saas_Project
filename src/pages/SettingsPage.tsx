import {
  Bell,
  Building2,
  Calendar,
  Check,
  Palette,
  Shield,
} from 'lucide-react';
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

type SettingsTab = 'appearance' | 'planning_gps' | 'notifications' | 'organization_billing' | 'security';

const ALL_TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
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
  const [savedFeedback, setSavedFeedback] = useState(false);

  const triggerSavedFeedback = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Paramètres & Cockpit"
        description="Personnalisez votre interface, vos options cartographiques, vos alertes et vos accès de sécurité."
      />

      {/* Navigation par Onglets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'min-h-touch sm:min-h-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback de sauvegarde automatique */}
      {savedFeedback && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 text-xs font-bold animate-in fade-in slide-in-from-top-1">
          <Check className="size-3.5" />
          <span>Préférences mises à jour et synchronisées.</span>
        </div>
      )}

      {/* Contenu des Onglets */}
      {activeTab === 'appearance' && (
        <AppearanceSettingsTab onSaved={triggerSavedFeedback} />
      )}

      {activeTab === 'planning_gps' && (
        <PlanningMapSettingsTab onSaved={triggerSavedFeedback} />
      )}

      {activeTab === 'notifications' && (
        <NotificationsSettingsTab onSaved={triggerSavedFeedback} />
      )}

      {activeTab === 'organization_billing' && (
        <OrganizationBillingSettingsTab />
      )}

      {activeTab === 'security' && (
        <SecuritySettingsTab onSaved={triggerSavedFeedback} />
      )}
    </div>
  );
}
