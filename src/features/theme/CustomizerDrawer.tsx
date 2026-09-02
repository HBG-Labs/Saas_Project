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
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="customizer-description"
          className={cn(
            'fixed inset-y-0 right-0 z-[70] flex h-full w-[min(20rem,88vw)] flex-col',
            'border-l border-border bg-surface shadow-modal transition-transform duration-300 ease-out',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'focus:outline-none',
          )}
        >
            {/* Header du panneau */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-3.5" />
                </div>
                <div>
                  <Dialog.Title className="text-xs font-bold text-foreground">
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
                  className="rounded-lg p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Fermer le panneau de personnalisation"
                >
                  <X className="size-3.5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Corps défilable */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* SECTION 1 : THÈMES ET AMBIANCES */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                    Thème & Ambiance
                  </h4>
                  <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-surface-sunken text-muted-foreground">
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
                          'border cursor-pointer',
                          isSelected
                            ? 'border-primary/80 bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30 font-medium'
                            : 'border-border/50 bg-surface-subtle hover:border-border hover:bg-surface-hover text-muted-foreground',
                        )}
                      >
                        {/* Radio indicator + nom */}
                        <div className="flex items-center gap-2 min-w-0 pr-2">
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
                            <span className="block text-2xs font-semibold text-foreground truncate">
                              {p.label}
                            </span>
                            <span className="block text-3xs text-muted-foreground truncate leading-tight">
                              {p.description}
                            </span>
                          </div>
                        </div>

                        {/* Pastilles de couleur en prévisualisation */}
                        <div className="flex shrink-0 items-center gap-0.5 rounded border border-border/70 bg-surface-raised p-0.5 shadow-2xs">
                          <span
                            className="size-2.5 rounded-2xs"
                            style={{ backgroundColor: p.preview.primary }}
                            title={`Couleur signature: ${p.preview.primary}`}
                          />
                          <span
                            className="size-2.5 rounded-2xs border border-black/10 dark:border-white/10"
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
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                    Couleur Principale
                  </h4>
                  <span className="text-3xs font-mono text-muted-foreground">
                    {accentColor === 'auto' ? 'Auto' : accentColor}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {ACCENT_COLORS.map((c) => {
                    const isSelected = accentColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAccentColor(c.id)}
                        title={c.label}
                        aria-label={c.label}
                        className={cn(
                          'relative flex size-6.5 shrink-0 items-center justify-center rounded-full transition-all duration-150',
                          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          isSelected
                            ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface scale-110 shadow-xs'
                            : 'hover:scale-110',
                        )}
                      >
                        {c.isAuto ? (
                          <div
                            className={cn(
                              'flex size-full items-center justify-center rounded-full border-2 bg-surface-sunken font-bold text-2xs transition-colors',
                              isSelected
                                ? 'border-foreground text-foreground'
                                : 'border-border text-foreground',
                            )}
                          >
                            A
                          </div>
                        ) : (
                          <div
                            className="size-full rounded-full shadow-2xs transition-transform"
                            style={{ backgroundColor: c.hex }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3 : DENSITÉ DE L'INTERFACE (MODE COMPACT HAUTE DENSITÉ) */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                    Densité d'affichage
                  </h4>
                  <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-surface-sunken text-muted-foreground">
                    {compactMode ? 'Compact' : 'Normal'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border border-border/60 bg-surface-subtle">
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
            <div className="border-t border-border bg-surface-subtle p-3 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetCustomization}
                className="w-full gap-1.5 rounded-lg text-2xs font-semibold h-8"
              >
                <RotateCcw className="size-3" />
                Réinitialiser
              </Button>
              <p className="text-center text-3xs text-muted-foreground">
                Sauvegardé instantanément sur cet appareil.
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );
}
