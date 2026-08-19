import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Button } from '@/components/ui/Button';

interface ToolErrorBoundaryProps {
  /** Slug de l'outil affiché : sert aussi de clé de réinitialisation. */
  toolSlug: string;
  toolTitle?: string;
  children: ReactNode;
}

/**
 * Isolation des pannes d'un outil.
 *
 * Les outils sont la partie la plus volumineuse et la plus changeante de
 * REZO360, et chacun est chargé dynamiquement. Un calcul qui déborde ou un
 * rendu invalide ne doit pas emporter l'application entière.
 *
 * Cette frontière est placée AU PLUS PRÈS de la zone d'affichage de l'outil,
 * à l'intérieur de l'AppShell. En cas de crash :
 *   • l'en-tête, la navigation et le routing restent opérationnels ;
 *   • seule la zone de l'outil est remplacée par un message récupérable ;
 *   • « Réessayer » remonte l'outil à neuf (React démonte le sous-arbre en
 *     erreur, la réinitialisation le reconstruit) ;
 *   • changer d'outil réinitialise automatiquement via `resetKeys`, sinon
 *     l'erreur du précédent persisterait sur le suivant.
 */
export function ToolErrorBoundary({ toolSlug, toolTitle, children }: ToolErrorBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={[toolSlug]}
      onError={(error) => {
        console.error(`[outil:${toolSlug}]`, error.message);
      }}
      fallback={({ reset }) => (
        <div
          role="alert"
          className="border-border bg-danger-50 flex flex-col items-start gap-3 rounded-lg border p-6"
        >
          <div className="space-y-1">
            <h2 className="font-semibold">
              {toolTitle
                ? `L'outil « ${toolTitle} » a rencontré une erreur`
                : 'Cet outil a rencontré une erreur'}
            </h2>
            <p className="text-content-muted text-sm">
              Le reste de l&apos;application fonctionne normalement. Vous pouvez relancer
              l&apos;outil ou naviguer ailleurs.
            </p>
          </div>

          <Button onClick={reset} variant="primary" size="sm">
            Relancer l&apos;outil
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
