import { Check, RotateCcw, Sparkles, X } from 'lucide-react';
import { Dialog } from 'radix-ui';

import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';

import { ACCENT_COLORS } from './accent-colors';
import { THEME_PRESETS } from './theme-presets';
import { useTheme } from './useTheme';

export function CustomizerDrawer() {
  const {
    preset,
    accentColor,
    compactMode,
    setPreset,
    setAccentColor,
    setCompactMode,
    resetCustomization,
    isCustomizerOpen,
    setIsCustomizerOpen,
  } = useTheme();

  return (
    <Dialog.Root open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs transition-opacity duration-200" />
        <Dialog.Content
          aria-describedby="customizer-description"
          className={cn(
            'fixed inset-y-0 right-0 z-[70] flex h-full w-[min(20rem,88vw)] flex-col',
            'border-border bg-surface shadow-modal border-l transition-transform duration-300 ease-out',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'focus:outline-none',
          )}
        >
          {/* Header du panneau */}
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
                <Sparkles className="size-3.5" />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-xs font-bold">
                  Personnalisation
                </Dialog.Title>
                <p id="customizer-description" className="text-3xs text-muted-foreground">
                  Ambiance & teintes du cockpit
                </p>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer rounded-lg p-1 transition-colors"
                aria-label="Fermer le panneau de personnalisation"
              >
                <X className="size-3.5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Corps défilable */}
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {/* SECTION 1 : THÈMES ET AMBIANCES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-3xs text-muted-foreground font-bold tracking-wider uppercase">
                  Thème & Ambiance
                </h4>
                <span className="text-3xs py-0.2 bg-surface-sunken text-muted-foreground rounded px-1.5 font-semibold">
                  {THEME_PRESETS.length}
                </span>
              </div>

              <div className="space-y-1" role="radiogroup" aria-label="Choisir une ambiance">
                {THEME_PRESETS.map((p) => {
                  const isSelected = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setPreset(p.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-all duration-150',
                        'cursor-pointer border',
                        isSelected
                          ? 'border-primary/80 bg-primary/5 text-foreground ring-primary/30 font-medium shadow-2xs ring-1'
                          : 'border-border/50 bg-surface-subtle hover:border-border hover:bg-surface-hover text-muted-foreground',
                      )}
                    >
                      {/* Radio indicator + nom */}
                      <div className="flex min-w-0 items-center gap-2 pr-2">
                        <div
                          className={cn(
                            'flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-all',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border-strong bg-surface',
                          )}
                        >
                          {isSelected ? <Check className="size-2.5 stroke-[3]" /> : null}
                        </div>
                        <div className="truncate">
                          <span className="text-2xs text-foreground block truncate font-semibold">
                            {p.label}
                          </span>
                          <span className="text-3xs text-muted-foreground block truncate leading-tight">
                            {p.description}
                          </span>
                        </div>
                      </div>

                      {/* Pastilles de couleur en prévisualisation */}
                      <div className="border-border/70 bg-surface-raised flex shrink-0 items-center gap-0.5 rounded border p-0.5 shadow-2xs">
                        <span
                          className="rounded-2xs size-2.5"
                          style={{ backgroundColor: p.preview.primary }}
                          title={`Couleur signature: ${p.preview.primary}`}
                        />
                        <span
                          className="rounded-2xs size-2.5 border border-black/10 dark:border-white/10"
                          style={{ backgroundColor: p.preview.background }}
                          title={`Arrière-plan: ${p.preview.background}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2 : COULEUR PRINCIPALE D'ACCENTUATION */}
            <div className="border-border space-y-2 border-t pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-3xs text-muted-foreground font-bold tracking-wider uppercase">
                  Couleur Principale
                </h4>
                <span className="text-3xs text-muted-foreground font-mono">
                  {ACCENT_COLORS.length} couleurs
                </span>
              </div>

              <div
                className="flex flex-wrap items-center gap-2.5 pt-1"
                role="group"
                aria-label="Choisir une couleur"
              >
                {ACCENT_COLORS.map((c) => {
                  const isSelected = accentColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAccentColor(c.id)}
                      title={c.label}
                      aria-label={c.label}
                      aria-pressed={isSelected}
                      className={cn(
                        'atelier-control atelier-icon-control relative flex size-[34px] shrink-0 items-center justify-center rounded-full transition-colors duration-150',
                        'focus-visible:ring-primary cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
                        isSelected
                          ? 'ring-foreground ring-offset-surface ring-2 ring-offset-2'
                          : 'hover:bg-surface-hover',
                      )}
                    >
                      {c.isAuto ? (
                        <div
                          className={cn(
                            'bg-surface-sunken text-2xs flex size-6.5 items-center justify-center rounded-full border-2 font-bold transition-colors',
                            isSelected
                              ? 'border-foreground text-foreground'
                              : 'border-border text-foreground',
                          )}
                        >
                          A
                        </div>
                      ) : (
                        <div className="size-6.5 rounded-full" style={{ backgroundColor: c.hex }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-muted-foreground text-xs" aria-live="polite">
              {ACCENT_COLORS.find((color) => color.id === accentColor)?.label}
            </p>
            {/* SECTION 3 : DENSITÉ DE L'INTERFACE (MODE COMPACT HAUTE DENSITÉ) */}
            <div className="border-border space-y-2 border-t pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-3xs text-muted-foreground font-bold tracking-wider uppercase">
                  Densité d'affichage
                </h4>
                <span className="text-3xs py-0.2 bg-surface-sunken text-muted-foreground rounded px-1.5 font-semibold">
                  {compactMode ? 'Compact' : 'Normal'}
                </span>
              </div>

              <div className="border-border/60 bg-surface-subtle rounded-lg border p-2.5">
                <Switch
                  id="customizer-compact-mode"
                  label="Mode Compact haute densité"
                  description="Resserre les cartes, badges et marges pour maximiser l'espace d'affichage."
                  checked={compactMode}
                  onCheckedChange={setCompactMode}
                />
              </div>
            </div>
          </div>

          {/* Footer avec Réinitialisation */}
          <div className="border-border bg-surface-subtle space-y-2 border-t p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetCustomization}
              className="text-2xs w-full gap-1.5 font-semibold"
            >
              <RotateCcw className="size-3" />
              Réinitialiser
            </Button>
            <p className="text-3xs text-muted-foreground text-center">
              Sauvegardé instantanément sur cet appareil.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
