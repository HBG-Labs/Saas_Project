import {
  Check,
  Moon,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AvatarPicker, useMyProfile } from '@/features/profile';
import { ACCENT_COLORS } from '@/features/theme/accent-colors';
import { THEME_PRESETS } from '@/features/theme/theme-presets';
import { useTheme } from '@/features/theme/useTheme';
import { cn } from '@/lib/cn';

export function AppearanceSettingsTab({ onSaved }: { onSaved?: () => void }) {
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

  const profileQuery = useMyProfile();
  const avatarId = profileQuery.data?.identity?.avatar_id ?? null;
  const displayName = profileQuery.data?.identity?.display_name ?? '';
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Photo de profil (Avatar) */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <User className="size-3.5 text-primary" />
            <span>Photo de profil</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Choisissez votre avatar pour vos fiches d'intervention et votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0">
          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarId={avatarId}
                name={displayName}
                size="lg"
                className="border-primary/40 shrink-0 border-2 shadow-xs"
              />
              <div>
                <h4 className="text-xs font-bold text-foreground">Avatar sélectionné</h4>
                <p className="text-3xs text-muted-foreground">50 avatars REZO360 au choix.</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAvatarPickerOpen(true)}
              className="text-xs font-bold shrink-0 cursor-pointer"
            >
              Changer d'avatar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mode Sombre / Clair */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Sun className="size-3.5 text-primary" />
            <span>Mode d'affichage</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Basculez entre le thème clair (chantier/plein jour) et le thème sombre haute lisibilité.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTheme('light');
                onSaved?.();
              }}
              className={cn(
                'flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-xs font-semibold',
                theme === 'light'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs'
                  : 'border-border bg-surface hover:border-border-hover text-muted-foreground',
              )}
            >
              <Sun className="size-4 shrink-0" />
              <span>Clair (Chantier)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTheme('dark');
                onSaved?.();
              }}
              className={cn(
                'flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-xs font-semibold',
                theme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs'
                  : 'border-border bg-surface hover:border-border-hover text-muted-foreground',
              )}
            >
              <Moon className="size-4 shrink-0" />
              <span>Sombre (Haute Lisibilité)</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Presets de Thèmes Métier */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Styles Visuels & Ambiances</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Ambiances graphiques harmonisées conçues pour les pros du terrain.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {THEME_PRESETS.map((p) => {
              const isSelected = preset === p.id;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPreset(p.id);
                    onSaved?.();
                  }}
                  className={cn(
                    'flex flex-col items-start gap-1 p-2.5 rounded-xl border-2 transition-all text-left cursor-pointer group',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-2xs'
                      : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover',
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {p.label}
                    </span>
                    {isSelected && <Check className="size-3 text-primary" />}
                  </div>
                  <p className="text-3xs text-muted-foreground line-clamp-2 leading-tight">
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Nuances & Couleur Principale */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Palette className="size-3.5 text-primary" />
            <span>Couleur d'Accentuation Métier</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Personnalisez la couleur des boutons, jauges, badges et éléments interactifs.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0">
          <div className="flex flex-wrap gap-2 pt-1">
            {ACCENT_COLORS.map((c) => {
              const isSelected = accentColor === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setAccentColor(c.id);
                    onSaved?.();
                  }}
                  className={cn(
                    'min-h-touch sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer',
                    isSelected
                      ? 'border-foreground/40 bg-foreground/10 text-foreground font-bold shadow-2xs ring-2 ring-primary/40'
                      : 'border-border bg-surface hover:bg-surface-hover text-muted-foreground',
                  )}
                >
                  <span
                    className="size-3 rounded-full shrink-0 shadow-2xs border border-white/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mode Cockpit Compact & Réinitialisation */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold">Options d'affichage avancé</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Mode Cockpit Compact</h4>
              <p className="text-3xs text-muted-foreground">
                Réduit les marges et la taille des cartes pour afficher plus d'informations à l'écran.
              </p>
            </div>
            <Switch
              label="Mode Cockpit Compact"
              checked={compactMode}
              onCheckedChange={(val) => {
                setCompactMode(val);
                onSaved?.();
              }}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetCustomization();
                onSaved?.();
              }}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              <span>Rétablir le thème par défaut</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AvatarPicker
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
      />
    </div>
  );
}
