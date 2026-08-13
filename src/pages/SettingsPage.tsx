import { Moon, Sun } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { useTheme } from '@/features/theme/useTheme';
import type { Theme } from '@/features/theme/theme-context';
import { cn } from '@/lib/cn';

const THEME_OPTIONS: readonly { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader title="Paramètres" description="Préférences d’affichage et de compte." />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Apparence</CardTitle>
            <CardDescription>
              Le mode sombre réduit la fatigue visuelle en environnement peu éclairé.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <fieldset>
              <legend className="text-foreground mb-2 text-xs font-medium">Thème</legend>
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = theme === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTheme(option.value);
                      }}
                      aria-pressed={isActive}
                      className={cn(
                        'min-h-touch flex flex-col items-center justify-center gap-1.5 rounded-md border p-3 transition-colors',
                        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                        isActive
                          ? 'border-primary bg-primary-subtle text-primary'
                          : 'border-border text-muted-foreground hover:bg-surface-hover',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences</CardTitle>
            <CardDescription>
              Ces réglages seront actifs dès la mise en service des outils.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Switch
              label="Enregistrer l’historique"
              description="Conserve la liste des outils utilisés pour y revenir rapidement."
              defaultChecked
              disabled
            />
            <Switch
              label="Mémoriser les paramètres d’outils"
              description="Retrouve vos dernières valeurs saisies à la réouverture d’un outil."
              disabled
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-error">Zone sensible</CardTitle>
            <CardDescription>
              La suppression du compte efface définitivement vos favoris et votre historique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="danger" disabled>
              Supprimer mon compte
            </Button>
            <p className="text-subtle-foreground mt-2 text-xs">
              Fonctionnalité disponible ultérieurement.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
