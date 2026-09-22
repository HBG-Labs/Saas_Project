import { Check, Moon, Palette, RotateCcw, Sparkles, Sun, User } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AvatarPicker, useMyProfile } from '@/features/profile';
import { ACCENT_COLORS, THEME_PRESETS, useTheme } from '@/features/theme';
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
    <div className="animate-in fade-in space-y-4">
      {/* Photo de profil (Avatar) */}
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <User className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Photo de profil</CardTitle>
              <CardDescription>
                Choisissez votre avatar pour vos fiches d'intervention et votre compte.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5">
          <div className="border-border bg-surface-raised flex flex-col items-stretch justify-between gap-4 rounded-xl border p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarId={avatarId}
                name={displayName}
                size="lg"
                className="border-primary/40 bg-primary-subtle shrink-0 border-2 shadow-xs md:[&_img]:size-[82%] md:[&_img]:rounded-full"
              />
              <div>
                <h4 className="text-foreground text-xs font-bold">Avatar sélectionné</h4>
                <p className="text-3xs text-muted-foreground">50 avatars REZO360 au choix.</p>
              </div>
            </div>

            <Button
              type="button"
              aria-pressed={theme === 'light'}
              variant="outline"
              size="sm"
              onClick={() => setIsAvatarPickerOpen(true)}
              className="shrink-0"
            >
              Changer d'avatar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mode Sombre / Clair */}
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-warning/10 text-warning flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Sun className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Mode d'affichage</CardTitle>
              <CardDescription>
                Basculez entre le thème clair et le thème sombre haute lisibilité.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={theme === 'dark'}
              onClick={() => {
                setTheme('light');
                onSaved?.();
              }}
              className={cn(
                'flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-[border-color,background-color,box-shadow]',
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
                'flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-[border-color,background-color,box-shadow]',
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
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Styles visuels & ambiances</CardTitle>
              <CardDescription>
                Ambiances graphiques harmonisées conçues pour les pros du terrain.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {THEME_PRESETS.map((p) => {
              const isSelected = preset === p.id;

              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setPreset(p.id);
                    onSaved?.();
                  }}
                  className={cn(
                    'group flex min-h-20 cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow]',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-2xs'
                      : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover',
                  )}
                >
                  <div className="flex w-full min-w-0 items-start justify-between gap-1">
                    <span className="text-foreground group-hover:text-primary min-w-0 text-xs leading-tight font-bold break-words transition-colors">
                      {p.label}
                    </span>
                    {isSelected && <Check className="text-primary mt-0.5 size-3 shrink-0" />}
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
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Palette className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Couleur d'accentuation métier</CardTitle>
              <CardDescription>
                Personnalisez la couleur des boutons, jauges, badges et éléments interactifs.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5">
          <div className="flex flex-wrap gap-2 pt-1">
            {ACCENT_COLORS.map((c) => {
              const isSelected = accentColor === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setAccentColor(c.id);
                    onSaved?.();
                  }}
                  className={cn(
                    'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-[border-color,background-color,box-shadow] sm:min-h-0',
                    isSelected
                      ? 'border-foreground/40 bg-foreground/10 text-foreground ring-primary/40 font-bold shadow-2xs ring-2'
                      : 'border-border bg-surface hover:bg-surface-hover text-muted-foreground',
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-full border border-white/20 shadow-2xs"
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
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <CardTitle>Options d'affichage</CardTitle>
          <CardDescription>
            Ajustez la densité de l'interface à votre façon de travailler.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 sm:pt-5">
          <div className="border-border bg-surface-raised rounded-xl border p-3">
            <Switch
              label="Mode Cockpit Compact"
              description="Réduit les marges et la taille des cartes pour afficher plus d'informations à l'écran."
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
              leadingIcon={<RotateCcw />}
              className="text-muted-foreground hover:text-foreground w-full sm:w-auto"
            >
              <span>Rétablir le thème par défaut</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AvatarPicker open={isAvatarPickerOpen} onOpenChange={setIsAvatarPickerOpen} />
    </div>
  );
}
