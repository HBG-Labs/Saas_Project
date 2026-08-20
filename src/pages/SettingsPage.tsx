import {
  Bell,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  Globe,
  Lock,
  LogOut,
  Moon,
  Palette,
  RotateCcw,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Truck,
  User,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormError } from '@/components/feedback/FormError';
import { Switch } from '@/components/ui/Switch';
import { ROUTES } from '@/config/routes';
import { TERRITORIES, useDefaultTerritory } from '@/config/territories';
import { useAuth, signOutOtherDevices } from '@/features/auth';
import { useCurrentIndustry } from '@/features/industries';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { AvatarPickerModal, useAvatarStore } from '@/features/profile';
import { ACCENT_COLORS } from '@/features/theme/accent-colors';
import { THEME_PRESETS } from '@/features/theme/theme-presets';
import { useTheme } from '@/features/theme/useTheme';
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
  const {
    theme,
    setTheme,
    preset,
    setPreset,
    accentColor,
    setAccentColor,
    compactMode,
    setCompactMode,
    resetCustomization,
  } = useTheme();

  const { organization } = useCurrentOrganization();
  const { user } = useAuth();
  const { can } = usePermission();
  const { label: industryLabel } = useCurrentIndustry();
  const { avatarUrl } = useAvatarStore();
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const canManageOrg = can(PERMISSIONS.organizationUpdate);
  const tabs = ALL_TABS.filter((t) => {
    if (t.id === 'organization_billing' && !canManageOrg) {
      return false;
    }
    if (t.id === 'notifications' && !canManageOrg) {
      return false;
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Révocation des autres sessions — une vraie opération serveur, donc un état
  // de chargement et une erreur remontée, pas un simple retour visuel.
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);

  /** Date réelle de dernière connexion, telle que la connaît le serveur. */
  const lastSignInLabel =
    user?.last_sign_in_at == null
      ? null
      : new Date(user.last_sign_in_at).toLocaleString('fr-FR', {
          dateStyle: 'long',
          timeStyle: 'short',
        });

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    setSignOutError(null);
    setOthersSignedOut(false);
    try {
      await signOutOtherDevices();
      setOthersSignedOut(true);
    } catch (error) {
      setSignOutError(error);
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  // Préférences persistées localement
  const [notifyNewMission, setNotifyNewMission] = useState(() => {
    return localStorage.getItem('pref_notify_new_mission') !== 'false';
  });
  const [notifyMaintenanceDue, setNotifyMaintenanceDue] = useState(() => {
    return localStorage.getItem('pref_notify_maintenance_due') !== 'false';
  });
  const [notifyStockLow, setNotifyStockLow] = useState(() => {
    return localStorage.getItem('pref_notify_stock_low') !== 'false';
  });
  const [notifyLeaveRequests, setNotifyLeaveRequests] = useState(() => {
    return localStorage.getItem('pref_notify_leave_requests') !== 'false';
  });
  const [smsUrgentAlerts, setSmsUrgentAlerts] = useState(() => {
    return localStorage.getItem('pref_sms_urgent_alerts') === 'true';
  });

  const { territoryCode: defaultTerritory, setTerritoryCode: setDefaultTerritory } = useDefaultTerritory();
  const [trafficLayer, setTrafficLayer] = useState(() => {
    return localStorage.getItem('pref_traffic_layer') !== 'false';
  });
  const [vehicleType, setVehicleType] = useState(() => {
    return localStorage.getItem('pref_vehicle_type') ?? 'van';
  });
  const [gpsRefreshRate, setGpsRefreshRate] = useState(() => {
    return localStorage.getItem('pref_gps_refresh') ?? '30';
  });
  const [defaultVat, setDefaultVat] = useState(() => {
    return localStorage.getItem('pref_default_vat') ?? '8.5';
  });

  const triggerSaveFeedback = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  useEffect(() => {
    localStorage.setItem('pref_notify_new_mission', String(notifyNewMission));
    localStorage.setItem('pref_notify_maintenance_due', String(notifyMaintenanceDue));
    localStorage.setItem('pref_notify_stock_low', String(notifyStockLow));
    localStorage.setItem('pref_notify_leave_requests', String(notifyLeaveRequests));
    localStorage.setItem('pref_sms_urgent_alerts', String(smsUrgentAlerts));
    localStorage.setItem('pref_default_territory', defaultTerritory);
    localStorage.setItem('pref_traffic_layer', String(trafficLayer));
    localStorage.setItem('pref_vehicle_type', vehicleType);
    localStorage.setItem('pref_gps_refresh', gpsRefreshRate);
    localStorage.setItem('pref_default_vat', defaultVat);
  }, [
    notifyNewMission,
    notifyMaintenanceDue,
    notifyStockLow,
    notifyLeaveRequests,
    smsUrgentAlerts,
    defaultTerritory,
    trafficLayer,
    vehicleType,
    gpsRefreshRate,
    defaultVat,
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Paramètres de l'application"
        description="Configurez l'apparence de votre cockpit, les alertes de terrain, la cartographie, le planning et vos options d'entreprise."
        actions={
          savedFeedback ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-2xs font-semibold animate-in fade-in">
              <Check className="size-3.5" />
              <span>Synchronisé</span>
            </div>
          ) : undefined
        }
      />

      {/* Navigation par Onglets Compacts */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu des Onglets */}
      <div className="max-w-4xl space-y-4">
        {/* ========================================================================= */}
        {/* 1. APPARENCE & COCKPIT */}
        {/* ========================================================================= */}
        {activeTab === 'appearance' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Photo de Profil 3D (Avatar) */}
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  <span>Photo de profil 3D (Avatar)</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Personnalisez votre avatar animé pour vos fiches d'intervention et votre compte.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0">
                <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-full overflow-hidden border-2 border-primary/40 shadow-xs shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar 3D" className="size-full object-cover" />
                      ) : (
                        <div className="size-full bg-primary-subtle text-primary font-bold flex items-center justify-center text-xs">
                          HB
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Avatar 3D sélectionné</h4>
                      <p className="text-3xs text-muted-foreground">Patrons, techniciens, artisanes & styles variés.</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAvatarPickerOpen(true)}
                    className="gap-1.5 text-2xs h-7 px-2.5 cursor-pointer font-semibold shrink-0"
                  >
                    <Sparkles className="size-3 text-amber-500" />
                    <span>Choisir un avatar 3D</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mode Sombre / Clair */}
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Sun className="size-3.5 text-primary" />
                  <span>Mode d’éclairage (Thème)</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Basculez instantanément entre le mode sombre immersif et le mode clair haute luminosité.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0">
                <div className="grid grid-cols-2 gap-2 sm:w-72">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      triggerSaveFeedback();
                    }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-bold text-xs transition-all cursor-pointer',
                      theme === 'light'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary/30'
                        : 'border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    <Sun className="size-3.5 text-amber-500" />
                    <span>Mode Clair</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      triggerSaveFeedback();
                    }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-bold text-xs transition-all cursor-pointer',
                      theme === 'dark'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary/30'
                        : 'border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    <Moon className="size-3.5 text-sky-400" />
                    <span>Mode Sombre</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Couleur d'Accentuation */}
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Palette className="size-3.5 text-primary" />
                  <span>Couleur d’accentuation</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Personnalisez la couleur des boutons, indicateurs actifs, badges et graphiques.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                  {ACCENT_COLORS.map((c) => {
                    const isSelected = accentColor === c.id;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setAccentColor(c.id);
                          triggerSaveFeedback();
                        }}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30'
                            : 'border-border hover:bg-surface-hover hover:border-border-strong',
                        )}
                      >
                        <span
                          className="size-3.5 rounded-full border border-white/20 shrink-0 shadow-2xs flex items-center justify-center text-white"
                          style={{ backgroundColor: c.hex }}
                        >
                          {isSelected && <Check className="size-2.5 stroke-[3]" />}
                        </span>
                        <span className="text-2xs font-semibold text-foreground truncate">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Ambiance / Presets Cockpit */}
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Ambiance & Thèmes Préréglés</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Choisissez un style visuel adapté à votre environnement de travail (atelier, extérieur, bureau).
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
                  {THEME_PRESETS.slice(0, 6).map((p) => {
                    const isSelected = preset === p.id;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPreset(p.id);
                          triggerSaveFeedback();
                        }}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30'
                            : 'border-border hover:bg-surface-hover hover:border-border-strong',
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="text-xs font-bold text-foreground truncate">{p.label}</h4>
                            {isSelected && <Badge variant="primary" className="text-4xs px-1 py-0 h-4">Actif</Badge>}
                          </div>
                          <p className="text-3xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                        </div>

                        {/* Palette mini preview */}
                        <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                          <span className="size-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.preview.primary }} />
                          <span className="size-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.preview.surface }} />
                          <span className="size-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.preview.background }} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1 flex justify-between items-center flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetCustomization();
                      triggerSaveFeedback();
                    }}
                    className="gap-1.5 text-2xs h-7 px-2.5"
                  >
                    <RotateCcw className="size-3" />
                    <span>Rétablir l'apparence par défaut</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Densité d'affichage */}
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold">Densité d'affichage de l'interface</CardTitle>
                <CardDescription className="text-3xs">
                  Ajustez les espacements pour afficher davantage de données sur les écrans de terrain.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0">
                <Switch
                  label="Mode Compact haute densité"
                  description="Réduit la taille des cartes, marges et badges pour maximiser l'espace d'affichage."
                  checked={compactMode}
                  onCheckedChange={(checked) => {
                    setCompactMode(checked);
                    triggerSaveFeedback();
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. PLANNING & CARTOGRAPHIE */}
        {/* ========================================================================= */}
        {activeTab === 'planning_gps' && (
          <div className="space-y-4 animate-in fade-in">
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Globe className="size-3.5 text-primary" />
                  <span>Territoire & Centrage géographique par défaut</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Définit la zone de cadrage automatique de la carte GPS et le calendrier régional des jours fériés.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                  {TERRITORIES.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => {
                        setDefaultTerritory(t.code);
                        triggerSaveFeedback();
                      }}
                      className={cn(
                        'flex items-center gap-1.5 p-2 rounded-lg border text-2xs font-bold transition-all cursor-pointer',
                        defaultTerritory === t.code
                          ? 'border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary/30'
                          : 'border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                      )}
                    >
                      <span className="text-sm">{t.flag}</span>
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Truck className="size-3.5 text-primary" />
                  <span>Mobilité & Véhicules d'intervention</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Profil de calcul d'itinéraire pour estimer les temps de trajet réels des techniciens.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'van', label: 'Fourgon / Utilitaire', desc: 'Gabarit standard d\'intervention' },
                    { id: 'truck', label: 'Poids Lourd / Nacelle', desc: 'Vitesses et ponts adaptés' },
                    { id: 'car', label: 'Véhicule Léger (VL)', desc: 'Déplacements rapides' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVehicleType(v.id);
                        triggerSaveFeedback();
                      }}
                      className={cn(
                        'p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                        vehicleType === v.id
                          ? 'border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30'
                          : 'border-border hover:bg-surface-hover hover:border-border-strong',
                      )}
                    >
                      <h4 className="text-xs font-bold text-foreground">{v.label}</h4>
                      <p className="text-3xs text-muted-foreground mt-0.5">{v.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Fréquence de rafraîchissement GPS</h4>
                      <p className="text-3xs text-muted-foreground">Intervalle de mise à jour des positions en direct.</p>
                    </div>
                    <select
                      value={gpsRefreshRate}
                      onChange={(e) => {
                        setGpsRefreshRate(e.target.value);
                        triggerSaveFeedback();
                      }}
                      aria-label="Fréquence de rafraîchissement GPS"
                      className="px-2 py-1 rounded-lg bg-surface border border-border text-2xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="15">Toutes les 15 secondes</option>
                      <option value="30">Toutes les 30 secondes (Recommandé)</option>
                      <option value="60">Toutes les 1 minute</option>
                      <option value="300">Toutes les 5 minutes (Économie)</option>
                    </select>
                  </div>

                  <Switch
                    label="Afficher la couche de trafic en direct"
                    description="Visualiser les ralentissements et bouchons sur la carte Google Maps."
                    checked={trafficLayer}
                    onCheckedChange={(checked) => {
                      setTrafficLayer(checked);
                      triggerSaveFeedback();
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. ALERTES & NOTIFICATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'notifications' && canManageOrg && (
          <div className="space-y-4 animate-in fade-in">
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Bell className="size-3.5 text-primary" />
                  <span>Notifications d'intervention et de planning</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Configurez les événements déclenchant une alerte automatique pour vous et vos techniciens.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
                <Switch
                  label="Attribution de nouvelle mission"
                  description="Envoie une alerte immédiate au technicien dès qu'une intervention lui est assignée."
                  checked={notifyNewMission}
                  onCheckedChange={(checked) => {
                    setNotifyNewMission(checked);
                    triggerSaveFeedback();
                  }}
                />

                <Switch
                  label="Rappels d'échéances de maintenance (J-4 & J-1)"
                  description="Notifie le responsable avant l'expiration d'un contrat ou l'échéance d'un entretien périodique."
                  checked={notifyMaintenanceDue}
                  onCheckedChange={(checked) => {
                    setNotifyMaintenanceDue(checked);
                    triggerSaveFeedback();
                  }}
                />

                <Switch
                  label="Demandes de congés et absences"
                  description="Alerte lorsqu'un collaborateur dépose une demande de congés payés ou de RTT."
                  checked={notifyLeaveRequests}
                  onCheckedChange={(checked) => {
                    setNotifyLeaveRequests(checked);
                    triggerSaveFeedback();
                  }}
                />

                <Switch
                  label="Alerte de niveau de stock bas & outillage"
                  description="Prévient lorsque le seuil d'alerte d'un consommable ou équipement est atteint."
                  checked={notifyStockLow}
                  onCheckedChange={(checked) => {
                    setNotifyStockLow(checked);
                    triggerSaveFeedback();
                  }}
                />

                <div className="pt-2 border-t border-border">
                  <Switch
                    label="Alertes d'urgences par SMS"
                    description="Permet l'envoi de SMS en cas de panne critique ou d'intervention prioritaire."
                    checked={smsUrgentAlerts}
                    onCheckedChange={(checked) => {
                      setSmsUrgentAlerts(checked);
                      triggerSaveFeedback();
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. ENTREPRISE & FACTURATION */}
        {/* ========================================================================= */}
        {activeTab === 'organization_billing' && canManageOrg && (
          <div className="space-y-4 animate-in fade-in">
            {/* Carte synthétique entreprise avec lien direct */}
            <Card className="border-primary/40 bg-gradient-to-br from-primary/5 via-surface to-surface">
              <CardHeader className="py-3 px-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" />
                    <span>Informations de l'entreprise</span>
                  </CardTitle>
                  <NavLink
                    to={ROUTES.organization}
                    className="flex items-center gap-1 text-2xs font-bold text-primary hover:underline"
                  >
                    <span>Modifier la fiche complète</span>
                    <ChevronRight className="size-3" />
                  </NavLink>
                </div>
                <CardDescription className="text-3xs">
                  Coordonnées légales, secteur d'activité, adresse et contact de votre structure.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-surface border border-border">
                  <div>
                    <span className="text-4xs text-muted-foreground uppercase font-bold tracking-wider">Nom Commercial</span>
                    <p className="text-xs font-bold text-foreground mt-0.5">{organization?.name ?? 'REZO360'}</p>
                  </div>
                  <div>
                    <span className="text-4xs text-muted-foreground uppercase font-bold tracking-wider">Secteur d'activité</span>
                    <p className="text-xs font-bold text-foreground mt-0.5">{industryLabel ?? 'Non renseigné'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <NavLink to={ROUTES.organization}>
                    <Button size="sm" variant="primary" className="gap-1.5 text-2xs h-7 px-2.5">
                      <span>Gérer les coordonnées & le métier</span>
                      <ExternalLink className="size-3" />
                    </Button>
                  </NavLink>
                </div>
              </CardContent>
            </Card>

            {/* Préférences Devis & TVA */}
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold">Paramètres de facturation & devis</CardTitle>
                <CardDescription className="text-3xs">
                  Taux de TVA et devises appliqués par défaut dans vos modules de chiffrage.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Taux de TVA standard par défaut</h4>
                    <p className="text-3xs text-muted-foreground">Taux appliqué lors de la création d'un devis.</p>
                  </div>
                  <select
                    value={defaultVat}
                    onChange={(e) => {
                      setDefaultVat(e.target.value);
                      triggerSaveFeedback();
                    }}
                    aria-label="Taux de TVA par défaut"
                    className="px-2 py-1 rounded-lg bg-surface border border-border text-2xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="8.5">8.5 % (Taux normal DOM)</option>
                    <option value="20">20.0 % (Taux normal Métropole)</option>
                    <option value="10">10.0 % (Taux intermédiaire)</option>
                    <option value="5.5">5.5 % (Taux réduit)</option>
                    <option value="0">0.0 % (Exonération / Autoliquidation)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Devise principale</h4>
                    <p className="text-3xs text-muted-foreground">Monnaie de référence pour tous les montants.</p>
                  </div>
                  <Badge variant="primary" className="text-2xs font-mono font-bold px-2 py-0.5">EUR (€)</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. SÉCURITÉ & ACCÈS */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div className="space-y-4 animate-in fade-in">
            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  <span>Sécurité du compte & Authentification</span>
                </CardTitle>
                <CardDescription className="text-3xs">
                  Gérez vos identifiants, votre mot de passe et l'authentification renforcée.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Mot de passe</h4>
                    {/* « Il y a 14 jours » était écrit en dur, quelle que soit
                        la réalité. Une information fausse sur la sécurité d'un
                        compte est pire qu'une information absente. */}
                    <p className="text-3xs text-muted-foreground">
                      Choisissez un mot de passe long et propre à ce service.
                    </p>
                  </div>
                  <NavLink to={ROUTES.profile}>
                    <Button variant="outline" size="sm" className="text-2xs h-7 px-2.5">
                      Changer de mot de passe
                    </Button>
                  </NavLink>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Authentification à deux facteurs (2FA)</h4>
                    <p className="text-3xs text-muted-foreground">Sécurise la connexion avec un code à 6 chiffres via application d'authentification.</p>
                  </div>
                  <Badge variant="warning" className="text-4xs px-1.5 py-0.5">Désactivé</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-primary" />
                    <span>Sécurité de la session</span>
                  </CardTitle>
                </div>
                <CardDescription className="text-3xs">
                  Compte {user?.email ?? 'utilisateur'}
                  {lastSignInLabel !== null && ` · dernière connexion ${lastSignInLabel}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
                {/* La liste par appareil a été retirée : elle ne pouvait afficher
                    que ce navigateur, et « Déconnecter » n'effaçait qu'une ligne
                    locale sans toucher l'appareil visé. Ce bouton-ci révoque
                    réellement les jetons côté serveur. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-foreground">
                      Déconnecter tous les autres appareils
                    </h4>
                    <p className="text-3xs text-muted-foreground">
                      Révoque les sessions ouvertes ailleurs. Celle-ci reste active. Les
                      autres appareils sont déconnectés dans l’heure qui suit, au plus tard.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSigningOutOthers}
                    onClick={() => {
                      void handleSignOutOthers();
                    }}
                    className="shrink-0 text-3xs text-rose-600 hover:text-rose-700 hover:border-rose-500/30 h-7 px-2.5"
                  >
                    <LogOut className="size-3 mr-1" />
                    {isSigningOutOthers ? 'Révocation…' : 'Révoquer'}
                  </Button>
                </div>

                {othersSignedOut && (
                  <p className="text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Les autres sessions ont été révoquées.
                  </p>
                )}

                <FormError error={signOutError} />

                <p className="text-3xs text-muted-foreground border-t border-border pt-2.5">
                  La liste des appareils connectés n’est pas affichée : le service
                  d’authentification ne la met pas à disposition. L’annoncer à partir de
                  ce seul navigateur donnerait une réponse rassurante et fausse à la
                  question « suis-je connecté ailleurs ? ».
                </p>
              </CardContent>
            </Card>


            <Card className="border-rose-500/30">
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold text-rose-500">Zone sensible</CardTitle>
                <CardDescription className="text-3xs">
                  Actions irréversibles relatives à votre compte utilisateur.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-0">
                <Button variant="danger" size="sm" disabled className="text-2xs h-7 px-2.5">
                  Supprimer mon compte
                </Button>
                <p className="text-subtle-foreground mt-1.5 text-3xs">
                  Pour des raisons de sécurité et de conformité légale, contactez l'administrateur de votre organisation pour supprimer ce compte.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modale de Sélection d'Avatar 3D */}
      <AvatarPickerModal
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
      />
    </div>
  );
}
